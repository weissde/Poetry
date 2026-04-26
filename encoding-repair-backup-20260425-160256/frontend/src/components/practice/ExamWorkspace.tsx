﻿﻿import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { MetricCard } from "@/components/common/MetricCard";
import { SectionCard } from "@/components/common/SectionCard";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { WorkspaceLayout } from "@/components/common/WorkspaceLayout";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { apiGet, apiPost } from "@/lib/api";
import { teacherHintItems } from "@/content/teachingStatic";
import { VirtualizedList } from "@/components/common/VirtualizedList";
import { Magnet, PillNav, SpotlightCard, type PillNavItem } from "@/components/react-bits";
import type { PracticeDifficulty } from "@/stores/practiceStore";
import type { ExamHistoryItem, ExamResult, ExamResultItem, ExamSession, PaginationMeta } from "@/types";

type Mode = "zhongkao" | "gaokao" | "custom";
type ExamTemplateId =
 | "zhongkao_foundation"
 | "zhongkao_sprint"
 | "gaokao_appreciation"
 | "gaokao_comprehensive"
 | "subjective_repair";
type SubmitReason = "manual" | "auto" | null;
type WeakDimension = "questionType" | "dynasty" | "theme";
type ExamAction = "create" | "submit" | null;
type ResultReviewTab = "diagnosis" | "detail";
type ExamWorkspaceView = "session" | "history";
type ExamSetupStep = "template" | "params" | "preview" | "start";

interface ExamHistoryResponse {
 items: ExamHistoryItem[];
 pagination?: PaginationMeta;
}

const defaultDurationByMode: Record<Mode, number> = {
 zhongkao: 60,
 gaokao: 90,
 custom: 60,
};

const examTemplates: Array<{
 id: ExamTemplateId;
 label: string;
 mode: Mode;
 topic: string;
 count: number;
 durationMinutes: number;
 subjectiveRatio: number;
 level: "鍩虹" | "涓樁" | "楂橀樁";
 estimate: string;
 description: string;
}> = [
 {
 id: "zhongkao_foundation",
 label: "涓€冨熀纭€鍗?,
 mode: "zhongkao",
 topic: "鍙よ瘲璇嶅熀纭€宸╁浐",
 count: 8,
 durationMinutes: 60,
 subjectiveRatio: 0.25,
 level: "鍩虹",
 estimate: "绾?45-60 鍒嗛挓",
 description: "閫傚悎鏃ュ父绋虫€佸埛棰橈紝蹇€熷缓绔嬪垎鏁板熀绾裤€?,
 },
 {
 id: "zhongkao_sprint",
 label: "涓€冨啿鍒哄嵎",
 mode: "zhongkao",
 topic: "涓€冨彜璇楄瘝鍐插埡",
 count: 10,
 durationMinutes: 70,
 subjectiveRatio: 0.3,
 level: "涓樁",
 estimate: "绾?60-75 鍒嗛挓",
 description: "瑕嗙洊楂橀鑰冪偣锛屽己璋冮€熷害涓庣ǔ瀹氭€с€?,
 },
 {
 id: "gaokao_appreciation",
 label: "楂樿€冭祻鏋愬嵎",
 mode: "gaokao",
 topic: "楂樿€冨彜璇楅壌璧?,
 count: 10,
 durationMinutes: 90,
 subjectiveRatio: 0.4,
 level: "楂橀樁",
 estimate: "绾?80-95 鍒嗛挓",
 description: "寮哄寲璧忔瀽涓庤璇侊紝鎻愬崌涓昏琛ㄨ揪瀹屾暣搴︺€?,
 },
 {
 id: "gaokao_comprehensive",
 label: "楂樿€冪患鍚堝嵎",
 mode: "gaokao",
 topic: "楂樿€冨彜璇楄瘝缁煎悎",
 count: 12,
 durationMinutes: 100,
 subjectiveRatio: 0.35,
 level: "楂橀樁",
 estimate: "绾?90-110 鍒嗛挓",
 description: "涓诲瑙傛贩鍚堝帇娴嬶紝閫傚悎鍏ㄧ湡婕旂粌銆?,
 },
 {
 id: "subjective_repair",
 label: "涓昏棰樹慨澶嶅嵎",
 mode: "custom",
 topic: "涓昏璧忔瀽涓撻」淇",
 count: 8,
 durationMinutes: 75,
 subjectiveRatio: 0.75,
 level: "涓樁",
 estimate: "绾?60-80 鍒嗛挓",
 description: "鑱氱劍瑙傜偣銆佷緷鎹€佸垎鏋愰摼璺殑琛ㄨ揪淇銆?,
 },
];

const EXAM_SETUP_STEPS: ReadonlyArray<PillNavItem<ExamSetupStep>> = [
 { id: "template", label: "1 閫夋ā鏉? },
 { id: "params", label: "2 璋冨弬鏁? },
 { id: "preview", label: "3 鐪嬮瑙? },
 { id: "start", label: "4 寮€濮? },
];

const weakDimensionLabelMap: Record<WeakDimension, string> = {
 questionType: "棰樺瀷",
 dynasty: "鏈濅唬",
 theme: "棰樻潗",
};

const modeLabelMap: Record<Mode, string> = {
 zhongkao: "涓€?,
 gaokao: "楂樿€?,
 custom: "鑷畾涔?,
};

function formatSeconds(totalSeconds: number): string {
 const safe = Math.max(0, totalSeconds);
 const minute = Math.floor(safe / 60)
 .toString()
 .padStart(2, "0");
 const second = (safe % 60).toString().padStart(2, "0");
 return `${minute}:${second}`;
}

function formatDateTime(value: string): string {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) {
 return value;
 }
 return date.toLocaleString();
}

function downloadTextFile(filename: string, content: string): void {
 const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = url;
 anchor.download = filename;
 document.body.appendChild(anchor);
 anchor.click();
 document.body.removeChild(anchor);
 URL.revokeObjectURL(url);
}

function buildExamReviewCardMarkdown(result: ExamResult, options?: { mode?: string; topic?: string }): string {
 const lines: string[] = [];
 const wrongItems = (result.detail || []).filter((item) => !item.isCorrect);
 lines.push("# 閿欓澶嶇洏鍗?);
 lines.push("");
 lines.push(`- 妯″紡锛?{options?.mode || "鏈煡"}`);
 lines.push(`- 涓婚锛?{options?.topic || "鏈缃?}`);
 lines.push(`- 鎴愮哗锛?{result.score}/${result.maxScore}锛?{result.percent}%锛塦);
 lines.push(`- 閿欓鏁伴噺锛?{wrongItems.length}`);
 lines.push("");
 lines.push("## 鏈満鏈€寮遍」");
 lines.push("");
 const weakRows = result.diagnostics?.weakest || [];
 if (!weakRows.length) {
 lines.push("- 鏆傛棤鏄庢樉寮遍」");
 } else {
 weakRows.slice(0, 5).forEach((row) => {
 lines.push(
 `- ${weakDimensionLabelMap[row.dimension]}路${row.label}锛氶敊璇?${row.wrong}/${row.attempts}锛屾纭巼 ${Math.round(row.rate * 100)}%`
 );
 });
 }
 lines.push("");
 lines.push("## 閿欓澶嶇洏");
 lines.push("");
 if (!wrongItems.length) {
 lines.push("- 鏈満鏃犻敊棰橈紝淇濇寔鐘舵€併€?);
 } else {
 wrongItems.slice(0, 12).forEach((item) => {
 lines.push(`### 绗?${item.index + 1} 棰橈紙${item.questionKind === "subjective" ? "涓昏棰? : "瀹㈣棰?}锛塦);
 lines.push(`- 棰樼洰锛?{item.content}`);
 lines.push(`- 澶卞垎锛?{item.score}/${item.maxScore}`);
 if (item.questionKind === "subjective") {
 lines.push(`- 鍙傝€冭鐐癸細${item.correctAnswer ? String(item.correctAnswer) : "鏃?}`);
 if (Array.isArray(item.missingKeywords) && item.missingKeywords.length > 0) {
 lines.push(`- 缂哄け鍏抽敭璇嶏細${item.missingKeywords.join("銆?)}`);
 }
 if (Array.isArray(item.suggestions) && item.suggestions.length > 0) {
 lines.push(`- 鏀硅繘寤鸿锛?{item.suggestions.join("锛?)}`);
 }
 } else {
 lines.push(`- 姝ｇ‘绛旀锛?{String(item.correctAnswer)}`);
 }
 lines.push(`- 瑙ｆ瀽锛?{item.explanation}`);
 lines.push("");
 });
 }
 lines.push("## 鏄庢棩澶嶄範浠诲姟");
 lines.push("");
 lines.push("1. 澶嶇洏鏈崱鐗囧墠 3 涓敊棰橈紝閲嶅啓绛旀銆?);
 lines.push("2. 閽堝鏈€寮遍」瀹屾垚 6 棰樹笓椤圭粌涔犮€?);
 lines.push("3. 鍙ｅご澶嶈堪 1 濂椻€滆鐐?渚濇嵁-鍒嗘瀽鈥濈瓟棰樻ā鏉裤€?);
 lines.push("");
 return lines.join("\n");
}

function buildWrongbookLink(dimension: WeakDimension, key: string): string {
 const params = new URLSearchParams();
 params.set("tab", "wrongbook");
 if (dimension === "questionType") {
 params.set("type", key);
 } else if (dimension === "dynasty") {
 params.set("dynasty", key);
 } else {
 params.set("theme", key);
 }
 return `/my-learning?${params.toString()}`;
}

function buildSubjectivePackLink(options?: {
 keywordTag?: string | null;
 dynasty?: string | null;
 theme?: string | null;
 status?: "pending" | "retry" | "all";
 count?: number;
 difficulty?: PracticeDifficulty;
 source?: string;
}): string {
 const params = new URLSearchParams();
 params.set("pack", "subjective_wrongbook");
 params.set("auto", "1");
 params.set("count", String(options?.count ?? 8));
 params.set("difficulty", options?.difficulty || "easy");
 params.set("status", options?.status || "all");
 params.set("source", (options?.source || "exam").trim());
 if (options?.keywordTag) {
 params.set("keywordTag", options.keywordTag);
 }
 if (options?.dynasty) {
 params.set("dynasty", options.dynasty);
 }
 if (options?.theme) {
 params.set("theme", options.theme);
 }
 return `/practice?${params.toString()}`;
}

function formatDayLabel(value: string): string {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) {
 return value;
 }
 const month = String(date.getMonth() + 1).padStart(2, "0");
 const day = String(date.getDate()).padStart(2, "0");
 return `${month}-${day}`;
}

function isSubjectiveExamItem(item: ExamResultItem): boolean {
 if (item.questionKind === "subjective") return true;
 if (item.questionType === "subjective") return true;
 return typeof item.correctAnswer === "string";
}

function getHistorySubjectiveSummary(item: ExamHistoryItem): { count: number; ratio: number | null } {
 if (item.composition && item.composition.total > 0) {
 return {
 count: item.composition.subjectiveCount,
 ratio: Number((item.composition.subjectiveRatio * 100).toFixed(1)),
 };
 }
 const detail = Array.isArray(item.detail) ? item.detail : [];
 if (!detail.length) {
 return { count: 0, ratio: null };
 }
 const subjectiveCount = detail.filter((entry) => isSubjectiveExamItem(entry)).length;
 return {
 count: subjectiveCount,
 ratio: Number(((subjectiveCount / detail.length) * 100).toFixed(1)),
 };
}

function computeRateByScore(items: ExamResultItem[]): number | null {
 if (!items.length) return null;
 const totalScore = items.reduce((sum, item) => sum + Number(item.score || 0), 0);
 const totalMax = items.reduce((sum, item) => sum + Number(item.maxScore || 0), 0);
 if (totalMax <= 0) return null;
 return Number(((totalScore / totalMax) * 100).toFixed(2));
}

function toFriendlyErrorMessage(error: unknown, fallback: string): string {
 const raw = error instanceof Error ? error.message : String(error || "");
 const message = raw.trim();
 if (!message) return fallback;

 const lower = message.toLowerCase();
 if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed")) {
 return "缃戠粶杩炴帴澶辫触锛岃纭鍚庣鏈嶅姟宸插惎鍔ㄥ苟鍙闂紙http://127.0.0.1:8000锛夈€?;
 }
 if (lower.includes("load failed")) {
 return "璇锋眰澶辫触锛岃绋嶅悗閲嶈瘯銆?;
 }
 if (lower.includes("timeout")) {
 return "璇锋眰瓒呮椂锛岃绋嶅悗閲嶈瘯銆?;
 }
 if (message.includes("鏃犳硶杩炴帴鍒拌繙绋嬫湇鍔″櫒")) {
 return "鏃犳硶杩炴帴鍚庣鏈嶅姟锛岃妫€鏌ユ湇鍔¤繘绋嬪拰绔彛銆?;
 }
 return message;
}

export function ExamWorkspace(): JSX.Element {
	 const { isTeacherMode } = useTeachingMode();
	 const [templateId, setTemplateId] = useState<ExamTemplateId>("zhongkao_foundation");
 const [mode, setMode] = useState<Mode>("zhongkao");
 const [topic, setTopic] = useState<string>("鍙よ瘲璇嶇患鍚?);
 const [count, setCount] = useState<number>(8);
 const [durationMinutes, setDurationMinutes] = useState<number>(defaultDurationByMode.zhongkao);
 const [subjectiveRatioPct, setSubjectiveRatioPct] = useState<number>(25);
 const [useSubjectiveCountOverride, setUseSubjectiveCountOverride] = useState<boolean>(false);
 const [subjectiveCountOverride, setSubjectiveCountOverride] = useState<number>(2);

 const [isCreating, setIsCreating] = useState<boolean>(false);
 const [session, setSession] = useState<ExamSession | null>(null);
 const [answers, setAnswers] = useState<Array<number | string | null>>([]);
 const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

 const [submitting, setSubmitting] = useState<boolean>(false);
 const [autoSubmitting, setAutoSubmitting] = useState<boolean>(false);
 const [submitReason, setSubmitReason] = useState<SubmitReason>(null);
 const [examWorkspaceView, setExamWorkspaceView] = useState<ExamWorkspaceView>("session");
 const [examSetupStep, setExamSetupStep] = useState<ExamSetupStep>("template");
 const [previewCountdown, setPreviewCountdown] = useState<number>(3);

 const [result, setResult] = useState<ExamResult | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [lastErrorAction, setLastErrorAction] = useState<ExamAction>(null);
 const [copyReviewCardStatus, setCopyReviewCardStatus] = useState<"idle" | "ok" | "error">("idle");
 const [examSummarySaved, setExamSummarySaved] = useState<boolean>(false);

 const [historyItems, setHistoryItems] = useState<ExamHistoryItem[]>([]);
 const [historyLoading, setHistoryLoading] = useState<boolean>(false);
 const [historyError, setHistoryError] = useState<string | null>(null);
 const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
 const [historyPage, setHistoryPage] = useState<number>(1);
 const [historyPageSize, setHistoryPageSize] = useState<number>(12);
 const [historyTotal, setHistoryTotal] = useState<number>(0);
 const [historyTotalPages, setHistoryTotalPages] = useState<number>(1);
 const [historyFilterMode, setHistoryFilterMode] = useState<"all" | Mode>("all");
 const [resultReviewTab, setResultReviewTab] = useState<ResultReviewTab>("diagnosis");
 const selectedTemplate = useMemo(
 () => examTemplates.find((item) => item.id === templateId) || null,
 [templateId],
 );

 useEffect(() => {
 const tpl = selectedTemplate;
 if (!tpl) return;
 setMode(tpl.mode);
 setTopic(tpl.topic);
 setCount(tpl.count);
 setDurationMinutes(tpl.durationMinutes);
 const nextRatio = Math.round(tpl.subjectiveRatio * 100);
 setSubjectiveRatioPct(nextRatio);
 setUseSubjectiveCountOverride(false);
 setSubjectiveCountOverride(Math.max(1, Math.round(tpl.count * tpl.subjectiveRatio)));
 }, [selectedTemplate]);

 const ratioBasedSubjectiveCount = useMemo(() => {
 const safeCount = Math.max(3, Math.min(20, Number.isFinite(count) ? count : 8));
 const safePct = Math.max(0, Math.min(100, Number.isFinite(subjectiveRatioPct) ? subjectiveRatioPct : 25));
 const raw = Math.round((safeCount * safePct) / 100);
 if (raw <= 0 && safePct > 0) return 1;
 if (safeCount > 1) return Math.min(raw, safeCount - 1);
 return Math.max(0, raw);
 }, [count, subjectiveRatioPct]);

 const effectiveSubjectiveCount = useMemo(() => {
 if (!useSubjectiveCountOverride) return ratioBasedSubjectiveCount;
 const safeCount = Math.max(3, Math.min(20, Number.isFinite(count) ? count : 8));
 const safeOverride = Math.max(0, Math.min(20, Number.isFinite(subjectiveCountOverride) ? subjectiveCountOverride : 0));
 if (safeCount > 1) return Math.min(safeOverride, safeCount - 1);
 return safeOverride;
 }, [count, ratioBasedSubjectiveCount, subjectiveCountOverride, useSubjectiveCountOverride]);

 const hasQuestions = useMemo(() => (session?.questions?.length ?? 0) > 0, [session]);
 const examInProgress = useMemo(() => Boolean(session && hasQuestions && !result), [hasQuestions, result, session]);
 const answeredCount = useMemo(
 () =>
 answers.filter((item) => {
 if (item === null) return false;
 if (typeof item === "string") return item.trim().length > 0;
 return true;
 }).length,
 [answers],
 );

 const timerClassName = useMemo(() => {
 if (remainingSeconds <= 300) return "text-red-700";
 if (remainingSeconds <= 900) return "text-amber-700";
 return "text-ink-700";
 }, [remainingSeconds]);

 const filteredHistoryItems = useMemo(() => {
 if (historyFilterMode === "all") return historyItems;
 return historyItems.filter((item) => item.examType === historyFilterMode);
 }, [historyFilterMode, historyItems]);

 const selectedHistoryResolved = useMemo(() => {
 if (!filteredHistoryItems.length) return null;
 if (!selectedHistoryId) return filteredHistoryItems[0];
 return filteredHistoryItems.find((item) => item.id === selectedHistoryId) || filteredHistoryItems[0];
 }, [filteredHistoryItems, selectedHistoryId]);

 const historyPercentMax = useMemo(() => {
 let maxValue = 1;
 filteredHistoryItems.forEach((item) => {
 if (item.percent > maxValue) maxValue = item.percent;
 });
 return maxValue;
 }, [filteredHistoryItems]);

 const selectedHistoryCompare = useMemo(() => {
 if (!selectedHistoryResolved) return null;
 const selectedIndex = filteredHistoryItems.findIndex((item) => item.id === selectedHistoryResolved.id);
 if (selectedIndex < 0) return null;
 const previous = filteredHistoryItems[selectedIndex + 1] || null;
 if (!previous) return null;

 const getWrongCount = (item: ExamHistoryItem): number => {
 if (Array.isArray(item.detail) && item.detail.length > 0) {
 return item.detail.filter((detailItem) => !detailItem.isCorrect).length;
 }
 return (item.diagnostics?.byQuestionType || []).reduce((sum, row) => sum + (row.wrong || 0), 0);
 };

 const getSubjectiveRate = (item: ExamHistoryItem): number | null => {
 const detail = Array.isArray(item.detail) ? item.detail : [];
 if (!detail.length) return null;
 const subjectiveItems = detail.filter((detailItem) => isSubjectiveExamItem(detailItem));
 return computeRateByScore(subjectiveItems);
 };

 const percentDelta = Number((selectedHistoryResolved.percent - previous.percent).toFixed(2));
 const wrongDelta = getWrongCount(selectedHistoryResolved) - getWrongCount(previous);
 const scoreDelta = Number((selectedHistoryResolved.score - previous.score).toFixed(2));
 const currentSubjectiveRate = getSubjectiveRate(selectedHistoryResolved);
 const previousSubjectiveRate = getSubjectiveRate(previous);
 const subjectiveRateDelta =
 currentSubjectiveRate === null || previousSubjectiveRate === null
 ? null
 : Number((currentSubjectiveRate - previousSubjectiveRate).toFixed(2));

 return { previous, percentDelta, wrongDelta, scoreDelta, subjectiveRateDelta };
 }, [filteredHistoryItems, selectedHistoryResolved]);

 const historySubjectiveTrend = useMemo(() => {
 const trend = filteredHistoryItems
 .slice(0, 12)
 .map((item) => {
 const detailItems = Array.isArray(item.detail) ? item.detail : [];
 const subjectiveItems = detailItems.filter((detailItem) => isSubjectiveExamItem(detailItem));
 const objectiveItems = detailItems.filter((detailItem) => !isSubjectiveExamItem(detailItem));
 return {
 id: item.id,
 dateLabel: formatDayLabel(item.createdAt),
 subjectiveRate: computeRateByScore(subjectiveItems),
 objectiveRate: computeRateByScore(objectiveItems),
 subjectiveCount: subjectiveItems.length,
 };
 })
 .filter((item) => item.subjectiveRate !== null || item.objectiveRate !== null);

 return trend.reverse();
 }, [filteredHistoryItems]);

 const selectedSubjectiveSummary = useMemo(() => {
 if (!selectedHistoryResolved || !Array.isArray(selectedHistoryResolved.detail)) return null;
 const subjectiveItems = selectedHistoryResolved.detail.filter((item) => isSubjectiveExamItem(item));
 if (subjectiveItems.length === 0) {
 return {
 count: 0,
 wrongCount: 0,
 scoreRate: null as number | null,
 avgAiRate: null as number | null,
 topMissingKeywords: [] as string[],
 };
 }

 const aiRateItems = subjectiveItems
 .map((item) => (typeof item.rate === "number" ? item.rate : null))
 .filter((item): item is number => item !== null);
 const avgAiRate = aiRateItems.length
 ? Number(((aiRateItems.reduce((sum, value) => sum + value, 0) / aiRateItems.length) * 100).toFixed(2))
 : null;

 const keywordCounter = new Map<string, number>();
 subjectiveItems.forEach((item) => {
 (item.missingKeywords || []).forEach((keyword) => {
 const cleaned = String(keyword || "").trim();
 if (!cleaned) return;
 keywordCounter.set(cleaned, (keywordCounter.get(cleaned) || 0) + 1);
 });
 });
 const topMissingKeywords = Array.from(keywordCounter.entries())
 .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
 .slice(0, 5)
 .map(([keyword, count]) => `${keyword}(${count})`);

 return {
 count: subjectiveItems.length,
 wrongCount: subjectiveItems.filter((item) => !item.isCorrect).length,
 scoreRate: computeRateByScore(subjectiveItems),
 avgAiRate,
 topMissingKeywords,
 };
 }, [selectedHistoryResolved]);

 const reviewCardMarkdown = useMemo(
 () => (result ? buildExamReviewCardMarkdown(result, { mode, topic: session?.topic || topic }) : ""),
 [mode, result, session?.topic, topic]
 );

 const exportSelectedHistoryMarkdown = (): void => {
 const row = selectedHistoryResolved;
 if (!row) return;
 const lines: string[] = [];
 lines.push(`# 妯¤€冩垚缁╂姤鍛奰);
 lines.push("");
 lines.push(`- 鏃堕棿锛?{formatDateTime(row.createdAt)}`);
 lines.push(`- 妯″紡锛?{row.examType}`);
 lines.push(`- 鍒嗘暟锛?{row.score}/${row.maxScore}`);
 lines.push(`- 姝ｇ‘鐜囷細${row.percent}%`);
 if (row.composition) {
 lines.push(
 `- 棰樺瀷鏋勬垚锛氫富瑙?${row.composition.subjectiveCount}/${row.composition.total}锛?{Math.round(row.composition.subjectiveRatio * 100)}%锛塦
 );
 }
 lines.push("");
 lines.push("## 钖勫急椤?);
 lines.push("");
 const weakRows = row.diagnostics?.weakest || [];
 if (!weakRows.length) {
 lines.push("- 鏆傛棤鏄庢樉钖勫急椤?);
 } else {
 weakRows.slice(0, 8).forEach((item) => {
 lines.push(
 `- ${weakDimensionLabelMap[item.dimension]}路${item.label}锛氶敊璇?${item.wrong}/${item.attempts}锛屾纭巼 ${Math.round(
 item.rate * 100
 )}%`
 );
 });
 }
 lines.push("");
 lines.push("## 閿欓鎽樿");
 lines.push("");
 const wrongItems = (row.detail || []).filter((item) => !item.isCorrect).slice(0, 12);
 if (!wrongItems.length) {
 lines.push("- 鏈満鏃犻敊棰?);
 } else {
 wrongItems.forEach((item) => {
 lines.push(`- 绗?${item.index + 1} 棰橈紙${item.questionKind === "subjective" ? "涓昏" : "瀹㈣"}锛夛細${item.content}`);
 });
 }
 const fileName = `exam-report-${new Date(row.createdAt).toISOString().slice(0, 10)}-${row.examType}.md`;
 downloadTextFile(fileName, lines.join("\n"));
 };

 const handleCopyReviewCard = async (): Promise<void> => {
 if (!reviewCardMarkdown) return;
 try {
 await navigator.clipboard.writeText(reviewCardMarkdown);
 setCopyReviewCardStatus("ok");
 } catch {
 setCopyReviewCardStatus("error");
 } finally {
 window.setTimeout(() => setCopyReviewCardStatus("idle"), 1800);
 }
 };

 const loadHistory = async (options?: { page?: number; pageSize?: number; force?: boolean }): Promise<void> => {
 const targetPage = Math.max(1, options?.page ?? historyPage);
 const targetPageSize = Math.max(6, Math.min(50, options?.pageSize ?? historyPageSize));
 const params = new URLSearchParams();
 params.set("includeDetail", "1");
 params.set("page", String(targetPage));
 params.set("pageSize", String(targetPageSize));

 setHistoryLoading(true);
 setHistoryError(null);
 try {
 const data = await apiGet<ExamHistoryResponse>(`/exam/history?${params.toString()}`, {
 cacheTtlMs: 120000,
 force: options?.force,
 });
 const items = data.items || [];
 setHistoryItems(items);

 const fallbackTotal = items.length;
 setHistoryTotal(Number(data.pagination?.total ?? fallbackTotal));
 setHistoryTotalPages(Math.max(1, Number(data.pagination?.totalPages ?? 1)));
 setHistoryPage(Number(data.pagination?.page ?? targetPage));
 setHistoryPageSize(Number(data.pagination?.pageSize ?? targetPageSize));
 setSelectedHistoryId((prev) => {
 if (prev && items.some((item) => item.id === prev)) return prev;
 return items[0]?.id || null;
 });
 } catch (err: unknown) {
 setHistoryError(toFriendlyErrorMessage(err, "璇诲彇鍘嗗彶鎴愮哗澶辫触"));
 } finally {
 setHistoryLoading(false);
 }
 };

 useEffect(() => {
 void loadHistory({ page: historyPage, pageSize: historyPageSize });
 }, [historyPage, historyPageSize]);

 useEffect(() => {
 if (!historyLoading && historyItems.length === 0 && historyTotal > 0 && historyPage > 1) {
 setHistoryPage((prev) => Math.max(1, prev - 1));
 }
 }, [historyLoading, historyItems.length, historyTotal, historyPage]);

 useEffect(() => {
 if (!(examWorkspaceView === "session" && !session && !result)) {
 return;
 }
 setPreviewCountdown(3);
 const timer = window.setInterval(() => {
 setPreviewCountdown((prev) => (prev > 1 ? prev - 1 : 1));
 }, 900);
 return () => {
 window.clearInterval(timer);
 };
 }, [examWorkspaceView, result, session]);

 const createExam = async (): Promise<void> => {
 setIsCreating(true);
 setError(null);
 setLastErrorAction(null);
 setResult(null);
 setExamWorkspaceView("session");
 setExamSetupStep("start");
 setResultReviewTab("diagnosis");
 setSubmitReason(null);
 setExamSummarySaved(false);

 try {
 const data = await apiPost<{ session: ExamSession }>("/exam/create", {
 mode,
 topic,
 count,
 durationMinutes,
 templateId,
 subjectiveRatio: Math.max(0, Math.min(1, subjectiveRatioPct / 100)),
 subjectiveCount: useSubjectiveCountOverride ? effectiveSubjectiveCount : undefined,
 }, { timeoutMs: 35000 });
 setSession(data.session);
 setAnswers(Array.from({ length: data.session.questions.length }, () => null));
 setRemainingSeconds((data.session.durationMinutes || durationMinutes) * 60);
 } catch (err: unknown) {
 setError(toFriendlyErrorMessage(err, "鍒涘缓鑰冭瘯澶辫触"));
 setLastErrorAction("create");
 } finally {
 setIsCreating(false);
 }
 };

 const submitExam = async (auto = false): Promise<void> => {
 if (!session || submitting || result) return;

 if (auto) setAutoSubmitting(true);
 setSubmitting(true);
 setError(null);
 setLastErrorAction(null);

 try {
 const data = await apiPost<{ result: ExamResult; practiceSummary?: { saved?: boolean } }>("/exam/submit", {
 mode,
 topic: session.topic,
 questions: session.questions,
 answers,
 }, { timeoutMs: 35000 });
 setExamWorkspaceView("session");
 setResult(data.result);
 setResultReviewTab("diagnosis");
 setExamSummarySaved(Boolean(data.practiceSummary?.saved));
 setSubmitReason(auto ? "auto" : "manual");
 setHistoryPage(1);
 await loadHistory({ page: 1, pageSize: historyPageSize, force: true });
 } catch (err: unknown) {
 setError(toFriendlyErrorMessage(err, "浜ゅ嵎澶辫触"));
 setLastErrorAction("submit");
 } finally {
 setSubmitting(false);
 setAutoSubmitting(false);
 }
 };

 useEffect(() => {
 if (!session || result || submitting) return;
 const timer = window.setInterval(() => {
 setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
 }, 1000);
 return () => {
 window.clearInterval(timer);
 };
 }, [session, result, submitting]);

 useEffect(() => {
 if (!session || result || submitting || autoSubmitting) return;
 if (remainingSeconds === 0) {
 void submitExam(true);
 }
 }, [remainingSeconds, session, result, submitting, autoSubmitting]);

 const renderDimensionCard = (
 title: string,
 rows: Array<{ key: string; label: string; attempts: number; wrong: number; rate: number }>,
 dimension: WeakDimension,
 ): JSX.Element => (
 <article className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-3">
 <h3 className="text-sm text-slate-600">{title}</h3>
 {rows.length === 0 ? <p className="mt-2 text-xs text-slate-400">鏆傛棤鏁版嵁</p> : null}
 <div className="mt-2 flow-sm">
 {rows.slice(0, 5).map((row) => (
 <div key={`${dimension}-${row.key}`} className="rounded-lg bg-slate-50 p-2">
 <div className="flex items-center justify-between text-xs text-slate-700">
 <span>{row.label}</span>
 <span>
 閿欒 {row.wrong}/{row.attempts}
 </span>
 </div>
 <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
 <span>姝ｇ‘鐜?{Math.round(row.rate * 100)}%</span>
 <Link to={buildWrongbookLink(dimension, row.key)} className="text-ink-700 hover:text-ink-900">
 鍘婚敊棰樻湰
 </Link>
 </div>
 </div>
 ))}
 </div>
 </article>
 );

 const examWorkspaceStatus = useMemo(() => {
 if (result) {
 return `宸插畬鎴?路 ${result.percent}%`;
 }
 if (submitting || autoSubmitting) {
 return "闃呭嵎涓?;
 }
 if (session && hasQuestions) {
 return `杩涜涓?路 ${formatSeconds(remainingSeconds)}`;
 }
 if (isCreating) {
 return "缁勫嵎涓?;
 }
 return "寰呭紑濮?;
 }, [autoSubmitting, hasQuestions, isCreating, remainingSeconds, result, session, submitting]);

 const objectiveCountPreview = useMemo(
 () => Math.max(0, Math.max(3, Math.min(20, Number.isFinite(count) ? count : 8)) - effectiveSubjectiveCount),
 [count, effectiveSubjectiveCount],
 );

 const paperStructureHint = useMemo(() => {
 if (effectiveSubjectiveCount <= 1) return "鍋忓瑙傦紝閫傚悎鍩虹妫€楠?;
 if (effectiveSubjectiveCount >= Math.max(3, count - 2)) return "鍋忎富瑙傦紝閫傚悎璧忔瀽琛ㄨ揪璁粌";
 return "涓诲瑙傚钩琛★紝閫傚悎缁煎悎婕旂粌";
 }, [count, effectiveSubjectiveCount]);

 const challengeHint = useMemo(() => {
 if (durationMinutes <= 45) return "鑺傚鍋忕揣锛屽缓璁厛淇濆熀纭€鍒?;
 if (durationMinutes >= 100 || effectiveSubjectiveCount >= 4) return "鎸戞垬杈冮珮锛屽缓璁厛鍋氭椂闂村垎閰?;
 return "闅惧害閫備腑锛岄€傚悎绋虫€佹ā鎷?;
 }, [durationMinutes, effectiveSubjectiveCount]);

 const sessionQuestionCount = session?.questions?.length ?? 0;
 const expectedSecondsPerQuestion = useMemo(() => {
 const denominator = sessionQuestionCount > 0 ? sessionQuestionCount : Math.max(1, count);
 return Math.max(30, Math.round((durationMinutes * 60) / denominator));
 }, [count, durationMinutes, sessionQuestionCount]);
 const latestHistoryItem = useMemo(() => (historyItems.length > 0 ? historyItems[0] : null), [historyItems]);
 const resultWeakestRows = useMemo(() => result?.diagnostics?.weakest?.slice(0, 2) || [], [result?.diagnostics?.weakest]);
 const examWorkbenchTitle =
 examWorkspaceView === "history" ? "鍘嗗彶鎴愮哗涓庢繁搴﹁瘖鏂? : result ? "鎴愮哗璇婃柇鍙? : session && hasQuestions ? "鏈妯¤€冧綔绛斿尯" : "鏈妯¤€冮瑙?;
 const examWorkbenchSubtitle =
 examWorkspaceView === "history"
 ? "绛涢€夊満娆″悗鏌ョ湅寮遍」銆佸姣斿拰涓昏棰樿秼鍔裤€?
 : result
 ? "瀹屾垚璇勫垎鍚庢煡鐪嬭瘖鏂€侀€愰鏄庣粏鍜岃ˉ鏁戝姩浣溿€?
 : session && hasQuestions
 ? "鎸夋椂闂村畬鎴愭湰鍦轰綔绛斿苟鎻愪氦璇勫垎銆?
 : "纭鏈嵎缁撴瀯鍚庡紑濮嬫ā鑰冦€?;
 const setupStepIndex = Math.max(0, EXAM_SETUP_STEPS.findIndex((item) => item.id === examSetupStep));
 const setupProgressPct = Math.round(((setupStepIndex + 1) / EXAM_SETUP_STEPS.length) * 100);
 const setupStepHint = useMemo(() => {
 if (examSetupStep === "template") return "鍏堥€夋渶鎺ヨ繎浣犵洰鏍囩殑妯℃澘銆?;
 if (examSetupStep === "params") return "寰皟棰橀噺銆佹椂闀夸笌涓昏棰樻瘮渚嬨€?;
	 if (examSetupStep === "preview") return "纭缁撴瀯銆佽妭濂忓拰鏈€杩戝熀绾裤€?;
	 return "鐐瑰嚮寮€濮嬪悗杩涘叆姝ｅ紡妯¤€冦€?;
	 }, [examSetupStep]);
	 const teacherHint = useMemo(() => teacherHintItems.find((item) => item.page === "exam") || null, []);

	 return (
	 <div className="flow-md">
	 {isTeacherMode && teacherHint ? (
	 <TeacherHintCallout title={teacherHint.title} detail={teacherHint.detail} />
	 ) : null}

	 <WorkspaceLayout
 colsClassName="xl:grid-cols-[420px_1fr]"
 aside={
 <SpotlightCard
 className="task-card flow-md rounded-[24px] bg-[linear-gradient(155deg,#fcfbf8,#f5f2ea)] p-5 shadow-[0_10px_30px_rgba(26,43,76,0.08)]"
 spotlightColor="rgba(201,169,110,0.12)"
 >
 <h2 className="font-display text-2xl text-ink-700">鏈妯¤€冭缃?</h2>
 <p className="text-xs text-slate-500">姝ラ鍖栧悜瀵硷細鍏堝畾妯℃澘锛屽啀璋冨弬鏁帮紝鏈€鍚庣‘璁ゅ悗寮€鑰冦€?</p>

 <PillNav items={EXAM_SETUP_STEPS} value={examSetupStep} onChange={setExamSetupStep} className="w-full" />

 <div className="h-1.5 rounded-full bg-stone-200">
 <div
 className="h-1.5 rounded-full bg-[linear-gradient(90deg,#1A2B4C,#C9A96E)] transition-all duration-500"
 style={{ width: `${setupProgressPct}%` }}
 />
 </div>
 <p className="rounded-xl bg-white/85 px-3 py-2 text-xs text-slate-600 shadow-[0_4px_14px_rgba(26,43,76,0.06)]">{setupStepHint}</p>

 <AnimatePresence mode="wait">
 {examSetupStep === "template" ? (
 <motion.div
 key="setup-template"
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 transition={{ duration: 0.24 }}
 className="grid grid-cols-1 gap-2"
 >
 {examTemplates.map((tpl) => {
 const active = tpl.id === templateId;
 return (
 <button
 key={tpl.id}
 type="button"
 onClick={() => {
 setTemplateId(tpl.id);
 setExamSetupStep("params");
 }}
 className={[
 "rounded-2xl px-3 py-3 text-left shadow-[0_4px_16px_rgba(26,43,76,0.06)] transition-all duration-300 hover:-translate-y-0.5",
 active
 ? "bg-[linear-gradient(132deg,rgba(26,43,76,0.92),rgba(45,69,114,0.92))] text-white"
 : "bg-white text-slate-700 hover:bg-stone-50",
 ].join(" ")}
 >
 <div className="flex items-center justify-between gap-2">
 <p className="font-display text-lg">{tpl.label}</p>
 <span className={["rounded-full px-2 py-1 text-[11px]", active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"].join(" ")}>
 {tpl.level}
 </span>
 </div>
 <p className={["mt-1 text-xs", active ? "text-white/75" : "text-slate-500"].join(" ")}>{tpl.estimate} 路 涓昏鍗犳瘮 {Math.round(tpl.subjectiveRatio * 100)}%</p>
 <p className={["mt-2 text-xs", active ? "text-white/85" : "text-slate-600"].join(" ")}>{tpl.description}</p>
 </button>
 );
 })}
 </motion.div>
 ) : null}

 {examSetupStep === "params" ? (
 <motion.div
 key="setup-params"
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 transition={{ duration: 0.24 }}
 className="flow-sm"
 >
 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <label>
 <span className="mb-1 block text-xs text-slate-500">妯″紡</span>
 <select
 value={mode}
 onChange={(event) => {
 const nextMode = event.target.value as Mode;
 setMode(nextMode);
 setDurationMinutes(defaultDurationByMode[nextMode]);
 }}
 className="input-main"
 >
 <option value="zhongkao">涓€冩ā寮?</option>
 <option value="gaokao">楂樿€冩ā寮?</option>
 <option value="custom">鑷畾涔夋ā寮?</option>
 </select>
 </label>
 <label>
 <span className="mb-1 block text-xs text-slate-500">涓婚</span>
 <input value={topic} onChange={(event) => setTopic(event.target.value)} className="input-main" placeholder="渚嬪锛氬攼璇楅壌璧? />
 </label>
 <label>
 <span className="mb-1 block text-xs text-slate-500">鎬婚閲?</span>
 <input
 type="number"
 value={count}
 min={5}
 max={20}
 onChange={(event) => setCount(Math.max(5, Math.min(20, Number(event.target.value) || 8)))}
 className="input-main"
 />
 </label>
 <label>
 <span className="mb-1 block text-xs text-slate-500">鏃堕暱锛堝垎閽燂級</span>
 <input
 type="number"
 value={durationMinutes}
 min={10}
 max={180}
 onChange={(event) => setDurationMinutes(Math.max(10, Math.min(180, Number(event.target.value) || 60)))}
 className="input-main"
 />
 </label>
 </div>

 <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
 <div>
 <p className="mb-1 text-xs text-slate-500">涓昏棰樺崰姣旓紙%锛?</p>
 <input
 type="number"
 min={0}
 max={100}
 value={subjectiveRatioPct}
 onChange={(event) => setSubjectiveRatioPct(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
 className="input-main control-dense w-full"
 />
 </div>
 <div>
 <p className="mb-1 text-xs text-slate-500">涓昏棰樻暟閲忥紙鎵嬪姩瑕嗙洊锛?</p>
 <input
 type="number"
 min={0}
 max={20}
 value={subjectiveCountOverride}
 onChange={(event) => setSubjectiveCountOverride(Math.max(0, Math.min(20, Number(event.target.value) || 0)))}
 disabled={!useSubjectiveCountOverride}
 className="input-main control-dense w-full disabled:cursor-not-allowed disabled:opacity-60"
 />
 </div>
 <label className="mt-6 flex items-center gap-2 text-sm text-slate-600 md:mt-0">
 <input type="checkbox" checked={useSubjectiveCountOverride} onChange={(event) => setUseSubjectiveCountOverride(event.target.checked)} />
 鍚敤鎵嬪姩涓昏棰樻暟閲? </label>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <button type="button" onClick={() => setExamSetupStep("template")} className="btn-secondary-compact">
 杩斿洖妯℃澘
 </button>
 <button type="button" onClick={() => setExamSetupStep("preview")} className="btn-secondary-compact">
 涓嬩竴姝ワ細鐪嬮瑙? </button>
 </div>
 </motion.div>
 ) : null}

 {examSetupStep === "preview" ? (
 <motion.div
 key="setup-preview"
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 transition={{ duration: 0.24 }}
 className="flow-sm"
 >
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
 <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[0_3px_12px_rgba(26,43,76,0.05)]">
 妯℃澘锛歿selectedTemplate?.label || "鑷畾涔夌粍鍗?} 路 {selectedTemplate?.level || "涓樁"}
 </p>
 <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[0_3px_12px_rgba(26,43,76,0.05)]">
 鏈嵎缁撴瀯锛氫富瑙?{effectiveSubjectiveCount} 路 瀹㈣ {objectiveCountPreview}
 </p>
 <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[0_3px_12px_rgba(26,43,76,0.05)]">缁撴瀯鍒ゆ柇锛歿paperStructureHint}</p>
 <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[0_3px_12px_rgba(26,43,76,0.05)]">鎸戞垬鎻愮ず锛歿challengeHint}</p>
 </div>
 <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700">
 鍗曢鑺傚绾?{Math.floor(expectedSecondsPerQuestion / 60)} 鍒?{expectedSecondsPerQuestion % 60} 绉?路
 鏈€杩戞垚缁?{latestHistoryItem ? `${Math.round(latestHistoryItem.score)}/${Math.round(latestHistoryItem.maxScore)}锛?{latestHistoryItem.percent}%锛塦 : "鏆傛棤鍩虹嚎"}
 </p>
 <div className="flex flex-wrap items-center gap-2">
 <button type="button" onClick={() => setExamSetupStep("params")} className="btn-secondary-compact">
 杩斿洖鍙傛暟
 </button>
 <button type="button" onClick={() => setExamSetupStep("start")} className="btn-secondary-compact">
 涓嬩竴姝ワ細寮€濮? </button>
 </div>
 </motion.div>
 ) : null}

 {examSetupStep === "start" ? (
 <motion.div
 key="setup-start"
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 transition={{ duration: 0.24 }}
 className="flow-sm"
 >
 <div className="toolbar-surface flex flex-wrap gap-2 text-xs text-slate-600">
 <span className="surface-chip">妯℃澘锛歿selectedTemplate?.label || "鑷畾涔夌粍鍗?}</span>
 <span className="surface-chip">妯″紡锛歿modeLabelMap[mode]}</span>
 <span className="surface-chip">棰橀噺锛歿count} 棰?</span>
 <span className="surface-chip">涓昏棰橈細{effectiveSubjectiveCount} 棰?</span>
 <span className="surface-chip">鏃堕暱锛歿durationMinutes} 鍒嗛挓</span>
 </div>
 <Magnet className="inline-flex">
  <button
  type="button"
  onClick={() => void createExam()}
  disabled={isCreating}
  className={[
  session || result ? "btn-secondary" : "btn-primary",
  "disabled:cursor-not-allowed disabled:opacity-60",
  ].join(" ")}
  >
  {isCreating ? "鐢熸垚涓?.." : "鐢熸垚骞跺紑濮嬫ā鑰?}
  </button>
 </Magnet>
 <div className="flex flex-wrap items-center gap-3">
 <Link to="/my-learning?tab=wrongbook" className="btn-secondary-compact">
 鏌ョ湅閿欓鏈? </Link>
 <Link to="/practice" className="text-xs text-slate-500 transition hover:text-ink-700">
 鍏堝幓缁冧範鍦虹儹韬? </Link>
 </div>
 </motion.div>
 ) : null}
 </AnimatePresence>

 {error ? (
 <div className="mt-3 rounded-lg bg-red-50 p-3">
 <p className="text-sm text-red-700">{error}</p>
 <div className="mt-2 flex flex-wrap gap-2">
 {lastErrorAction === "create" ? (
 <button type="button" onClick={() => void createExam()} className="btn-secondary-compact text-red-700 hover:bg-red-50">
 閲嶈瘯鐢熸垚
 </button>
 ) : null}
 {lastErrorAction === "submit" ? (
 <button type="button" onClick={() => void submitExam(false)} className="btn-secondary-compact text-red-700 hover:bg-red-50">
 閲嶈瘯浜ゅ嵎
 </button>
 ) : null}
 </div>
 </div>
 ) : null}
 </SpotlightCard>
 }
 >
 <section className="surface-card card-cozy flow-sm">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <h2 className="font-display text-2xl text-ink-700">{examWorkbenchTitle}</h2>
 <p className="text-xs text-slate-500">{examWorkbenchSubtitle}</p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <div className="segmented-tabs">
 <button
 type="button"
 onClick={() => setExamWorkspaceView("session")}
 className={["segmented-tab", examWorkspaceView === "session" ? "segmented-tab-active" : ""].join(" ")}
 >
 鏈妯¤€? </button>
 <button
 type="button"
 onClick={() => setExamWorkspaceView("history")}
 className={["segmented-tab", examWorkspaceView === "history" ? "segmented-tab-active" : ""].join(" ")}
 >
 鍘嗗彶娣辫瘖
 </button>
 </div>
 <span className="rounded-full shadow-[inset_0_0_0_1px_rgba(26,43,76,0.22)] bg-ink-50 px-3 py-1 text-xs text-ink-700">
 {examWorkspaceView === "history"
 ? historyLoading
 ? "鍘嗗彶鍔犺浇涓?.."
 : historyTotal > 0
 ? `${historyTotal} 鍦哄巻鍙瞏
 : "鏆傛棤鍘嗗彶"
 : examWorkspaceStatus}
 </span>
 </div>
 </div>

 <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
 <p className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white px-3 py-2 text-xs text-slate-600">
 褰撳墠妯℃澘锛歿selectedTemplate?.label || "鑷畾涔夌粍鍗?}
 </p>
 <p className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white px-3 py-2 text-xs text-slate-600">
 鏈嵎杩涘害锛歿session && hasQuestions ? `${answeredCount}/${session.questions.length}` : "鏈紑濮?}
 </p>
 <p className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white px-3 py-2 text-xs text-slate-600">鐘舵€侊細{examWorkspaceStatus}</p>
 </div>

 <div className="toolbar-surface flex flex-wrap items-center gap-2">
 {examWorkspaceView === "history" ? (
 <>
 <button type="button" onClick={() => setExamWorkspaceView("session")} className="btn-secondary-compact">
 杩斿洖鏈妯¤€? </button>
 <button
 type="button"
 onClick={() => void createExam()}
 disabled={isCreating}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-60"
 >
 {isCreating ? "鐢熸垚涓?.." : "鏂板紑涓€鍦烘ā鑰?}
 </button>
 <span className="surface-chip">褰撳墠绛涢€夛細{filteredHistoryItems.length} 鍦?</span>
 </>
 ) : (
 <>
 <button
 type="button"
 onClick={() => void createExam()}
 disabled={isCreating}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-60"
 >
 {isCreating ? "鐢熸垚涓?.." : "鐢熸垚骞跺紑濮嬫ā鑰?}
 </button>
 <button
 type="button"
 onClick={() => setExamWorkspaceView("history")}
 className="btn-secondary-compact"
 >
 鏌ョ湅鍘嗗彶涓庢繁搴﹁瘖鏂? </button>
 {examInProgress ? (
 <span className="surface-chip">鍊掕鏃?{formatSeconds(remainingSeconds)}</span>
 ) : (
 <span className="surface-chip">寤鸿鎬绘椂闀?{durationMinutes} 鍒嗛挓</span>
 )}
 </>
 )}
 </div>
 </section>

 {examWorkspaceView === "session" && !session && !result ? (
 <SectionCard
 className="result-card"
 weight="workspace"
 title="寮€鑰冮瑙?
 subtitle="纭鏈嵎缁撴瀯涓庝綔绛旇妭濂忋€?
 bodyClassName="flow-md"
 >
 <div className="flex items-center justify-between rounded-2xl bg-[linear-gradient(120deg,rgba(26,43,76,0.08),rgba(201,169,110,0.14))] px-4 py-3">
 <div>
 <p className="font-sans text-xs tracking-[0.12em] text-slate-500">鍏ュ満鍊掕鏃堕婕?</p>
 <p className="mt-1 font-sans text-xs text-slate-600">姝ｅ紡寮€鑰冨悗灏嗚嚜鍔ㄥ垏鎹㈠埌浣滅瓟瑙嗗浘銆?</p>
 </div>
 <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/80 shadow-[0_4px_14px_rgba(26,43,76,0.12)]">
 <AnimatePresence mode="wait">
 <motion.span
 key={previewCountdown}
 initial={{ opacity: 0, scale: 0.75, y: 8 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 1.15, y: -8 }}
 transition={{ duration: 0.28, ease: "easeOut" }}
 className="font-serif text-2xl text-[#1A2B4C]"
 >
 {previewCountdown}
 </motion.span>
 </AnimatePresence>
 </div>
 </div>

 <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
 <article className="workspace-preview-card !py-3">
 <p className="text-[11px] text-slate-500">鏈嵎缁撴瀯</p>
 <p className="mt-1 text-sm text-ink-700">
 {modeLabelMap[mode]} 路 {topic || "鍙よ瘲璇嶇患鍚?}
 </p>
 <p className="mt-1 text-xs text-slate-600">
 涓昏 {effectiveSubjectiveCount} 棰?路 瀹㈣ {objectiveCountPreview} 棰? </p>
 <p className="mt-2 rounded-md bg-white px-2 py-1 text-xs text-ink-700">缁撴瀯鍒ゆ柇锛歿paperStructureHint}</p>
 </article>
 <article className="workspace-preview-card !py-3">
 <p className="text-[11px] text-slate-500">浣滅瓟鑺傚</p>
 <p className="mt-1 text-sm text-ink-700">
 鎬绘椂闀?{durationMinutes} 鍒嗛挓 路 鍗曢绾?{Math.floor(expectedSecondsPerQuestion / 60)} 鍒?{expectedSecondsPerQuestion % 60} 绉? </p>
 <p className="mt-2 rounded-md bg-white px-2 py-1 text-xs text-amber-800">鎸戞垬鎻愮ず锛歿challengeHint}</p>
 </article>
 <article className="workspace-preview-card !py-3">
 <p className="text-[11px] text-slate-500">鏈€杩戞垚缁?</p>
 {latestHistoryItem ? (
 <>
 <p className="mt-1 text-sm text-ink-700">
 {Math.round(latestHistoryItem.score)}/{Math.round(latestHistoryItem.maxScore)} 路 {latestHistoryItem.percent}%
 </p>
 <p className="mt-1 text-xs text-slate-600">
 {formatDateTime(latestHistoryItem.createdAt)} 路 {modeLabelMap[latestHistoryItem.examType as Mode] || latestHistoryItem.examType}
 </p>
 </>
 ) : (
 <>
 <p className="mt-1 text-sm text-slate-700">鏆傛棤鍘嗗彶鍩虹嚎</p>
 <p className="mt-1 text-xs text-slate-600">棣栧満妯¤€冨畬鎴愬悗鑷姩鐢熸垚瓒嬪娍銆?</p>
 </>
 )}
 </article>
 </div>

 <div className="toolbar-surface flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => void createExam()}
 disabled={isCreating}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-60"
 >
 {isCreating ? "鐢熸垚涓?.." : "鐢熸垚骞跺紑濮嬫ā鑰?}
 </button>
 <button type="button" onClick={() => setExamWorkspaceView("history")} className="btn-secondary-compact">
 鏌ョ湅鍘嗗彶涓庢繁璇? </button>
 <Link to="/my-learning?tab=wrongbook" className="btn-secondary-compact">
 鍘婚敊棰樻湰
 </Link>
 </div>
 </SectionCard>
 ) : null}

 {examWorkspaceView === "history" ? (
 <section className="surface-card card-cozy flow-md">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <p className="font-display text-xl text-ink-700">鍘嗗彶鎴愮哗涓庢繁搴﹁瘖鏂?</p>
 <p className="text-xs text-slate-500">閫夋嫨鍦烘鏌ョ湅钖勫急椤广€佸姣斿拰涓昏棰樿〃鐜般€?</p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <span className="text-xs text-slate-500">
 {historyLoading ? "鍘嗗彶鍔犺浇涓?.." : historyTotal > 0 ? `${historyTotal} 鍦哄巻鍙瞏 : "鏆傛棤鍘嗗彶"}
 </span>
 <button
 type="button"
 onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
 className="btn-secondary-compact"
 >
 鍥炲埌寮€鑰冨尯
 </button>
 </div>
 </div>
 <SectionCard
 weight="summary"
 density="cozy"
 title="妯℃澘鎺ㄨ崘"
 subtitle="涓€閿垏鎹㈠悗杩斿洖寮€鑰冦€?
 bodyClassName="flow-sm"
 >
 <div className="flex flex-wrap gap-2">
 {examTemplates.map((tpl) => (
 <button
 key={`history-template-${tpl.id}`}
 type="button"
 onClick={() => {
 setTemplateId(tpl.id);
 setExamWorkspaceView("session");
 }}
 className={[
 "rounded-full px-3 py-1 text-xs transition",
 templateId === tpl.id ? "shadow-[inset_0_0_0_1px_rgba(26,43,76,0.62)] bg-ink-50 text-ink-700" : "bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] text-slate-700 hover:bg-slate-50",
 ].join(" ")}
 >
 {tpl.label}
 </button>
 ))}
 </div>
 </SectionCard>
 <SectionCard className="result-card" bodyClassName="flow-md">
 <div className="flex items-center justify-between">
 <h2 className="font-display text-2xl text-ink-700">鍦烘鍒楄〃涓庤瘖鏂?</h2>
 <button
 type="button"
 onClick={() => void loadHistory({ page: historyPage, pageSize: historyPageSize, force: true })}
 className="btn-secondary-compact"
 >
 鍒锋柊
 </button>
 </div>

 {historyLoading ? (
 <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
 {Array.from({ length: 4 }).map((_, index) => (
 <article key={`history-loading-${index}`} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white p-3 animate-pulse">
 <div className="h-3 w-24 rounded bg-slate-200" />
 <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
 <div className="mt-3 h-2 w-full rounded bg-slate-100" />
 </article>
 ))}
 </div>
 ) : null}
 {historyError ? (
 <div className="mt-3 rounded-lg shadow-[inset_0_0_0_1px_rgba(220,38,38,0.24)] bg-red-50 p-3">
 <p className="text-sm text-red-700">{historyError}</p>
 <button
 type="button"
 onClick={() => void loadHistory({ page: historyPage, pageSize: historyPageSize, force: true })}
 className="btn-secondary-compact mt-2 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.24)] text-red-700 hover:bg-red-50"
 >
 閲嶈瘯璇诲彇鍘嗗彶
 </button>
 </div>
 ) : null}
 {!historyLoading && !historyError && historyItems.length === 0 ? (
 <div className="mt-3 rounded-lg shadow-[inset_0_0_0_1px_rgba(26,43,76,0.16)] p-4 text-sm text-slate-500">
 <p>鏆傛棤鍘嗗彶妯¤€冭褰曘€?</p>
 <button type="button" onClick={() => setExamWorkspaceView("session")} className="btn-secondary-compact mt-2">
 杩斿洖鏈妯¤€? </button>
 </div>
 ) : null}
 {!historyLoading && !historyError && historyItems.length > 0 && filteredHistoryItems.length === 0 ? (
 <p className="mt-3 text-sm text-slate-500">褰撳墠绛涢€夋潯浠朵笅鏆傛棤鍘嗗彶璁板綍銆?</p>
 ) : null}

 {!historyLoading && !historyError && historyItems.length > 0 ? (
 <div className="toolbar-surface mt-4 flex items-center justify-between">
 <p className="text-xs text-slate-600">
 绗?{historyPage}/{historyTotalPages} 椤?路 鍏?{historyTotal} 鍦?路 褰撳墠绛涢€?{filteredHistoryItems.length} 鍦? </p>
 <div className="flex items-center gap-2">
 <select
 value={historyFilterMode}
 onChange={(event) => {
 setHistoryFilterMode(event.target.value as "all" | Mode);
 setSelectedHistoryId(null);
 }}
 className="input-main control-dense rounded-lg !px-2 text-xs"
 >
 <option value="all">鍏ㄩ儴妯″紡</option>
 <option value="zhongkao">涓€?</option>
 <option value="gaokao">楂樿€?</option>
 <option value="custom">鑷畾涔?</option>
 </select>
 <select
 value={historyPageSize}
 onChange={(event) => {
 setHistoryPageSize(Number(event.target.value));
 setHistoryPage(1);
 }}
 className="input-main control-dense rounded-lg !px-2 text-xs"
 >
 <option value={8}>8 / 椤?</option>
 <option value={12}>12 / 椤?</option>
 <option value={20}>20 / 椤?</option>
 </select>
 <button
 type="button"
 disabled={historyPage <= 1}
 onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
 >
 涓婁竴椤? </button>
 <button
 type="button"
 disabled={historyPage >= historyTotalPages}
 onClick={() => setHistoryPage((prev) => Math.min(historyTotalPages, prev + 1))}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
 >
 涓嬩竴椤? </button>
 </div>
 </div>
 ) : null}

 {!historyLoading && filteredHistoryItems.length > 0 ? (
 <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
 <article className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-2">
 <VirtualizedList
 items={filteredHistoryItems}
 getKey={(item) => item.id}
 height={560}
 estimateHeight={96}
 overscan={4}
 renderItem={(item) => {
 const active = selectedHistoryResolved?.id === item.id;
 const subjectiveSummary = getHistorySubjectiveSummary(item);
 return (
 <div className="pb-2">
 <button
 type="button"
 onClick={() => setSelectedHistoryId(item.id)}
 className={[
 "w-full rounded-lg p-3 text-left transition",
 active ? "shadow-[inset_0_0_0_1px_rgba(26,43,76,0.62)] bg-ink-50" : "bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] hover:bg-slate-50",
 ].join(" ")}
 >
 <div className="flex items-center justify-between text-xs text-slate-600">
 <span>{formatDateTime(item.createdAt)}</span>
 <span>{item.examType}</span>
 </div>
 <div className="mt-1 flex items-center justify-between text-sm text-slate-700">
 <span>
 {Math.round(item.score)}/{Math.round(item.maxScore)}
 </span>
 <span>{item.percent}%</span>
 </div>
 <p className="mt-1 text-[11px] text-slate-500">
 涓昏棰?{subjectiveSummary.count} 棰? {subjectiveSummary.ratio !== null ? `锛?{subjectiveSummary.ratio}%锛塦 : ""}
 </p>
 <div className="mt-2 h-1.5 rounded-full bg-slate-100">
 <div
 className="h-1.5 rounded-full bg-ink-700"
 style={{ width: `${Math.round((item.percent / historyPercentMax) * 100)}%` }}
 />
 </div>
 </button>
 </div>
 );
 }}
 />
 </article>

 <article className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-3">
 <div className="flex items-center justify-between">
 <h3 className="text-sm text-slate-600">褰撴寮遍」</h3>
 <button
 type="button"
 onClick={exportSelectedHistoryMarkdown}
 disabled={!selectedHistoryResolved}
 className="rounded shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)] px-2 py-1 text-[11px] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
 >
 瀵煎嚭鎶ュ憡
 </button>
 </div>
 {!selectedHistoryResolved ? <p className="mt-2 text-xs text-slate-500">璇烽€夋嫨宸︿晶鍦烘鏌ョ湅璇︽儏銆?</p> : null}
 {selectedHistoryResolved && (selectedHistoryResolved.diagnostics?.weakest || []).length === 0 ? (
 <p className="mt-2 text-xs text-slate-500">璇ュ満娆℃殏鏃犳槑鏄捐杽寮遍」銆?</p>
 ) : null}
 {selectedHistoryResolved && (selectedHistoryResolved.diagnostics?.weakest || []).length > 0 ? (
 <div className="mt-2 flow-sm">
 {(selectedHistoryResolved.diagnostics?.weakest || []).slice(0, 5).map((item) => (
 <div key={`${selectedHistoryResolved.id}-${item.dimension}-${item.key}`} className="rounded-lg bg-warm-50 p-2">
 <div className="flex items-center justify-between text-xs text-slate-700">
 <span>
 {weakDimensionLabelMap[item.dimension]} 路 {item.label}
 </span>
 <span>
 閿欒 {item.wrong}/{item.attempts}
 </span>
 </div>
 <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
 <span>姝ｇ‘鐜?{Math.round(item.rate * 100)}%</span>
 <Link to={buildWrongbookLink(item.dimension, item.key)} className="text-ink-700 hover:text-ink-900">
 鍘婚敊棰樻湰
 </Link>
 </div>
 </div>
 ))}
 </div>
 ) : null}

 <h3 className="mt-4 text-sm text-slate-600">鐩稿涓婃瀵规瘮</h3>
 {!selectedHistoryCompare ? (
 <p className="mt-2 text-xs text-slate-500">鏆傛棤鍙姣斿満娆★紙鑷冲皯闇€瑕佷袱娆℃ā鑰冿級銆?</p>
 ) : (
 <div className="mt-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
 <p>
 瀵规瘮鍦烘锛歿formatDateTime(selectedHistoryCompare.previous.createdAt)} 路 {selectedHistoryCompare.previous.examType}
 </p>
 <p className="mt-1">
 姝ｇ‘鐜囧彉鍖栵細{selectedHistoryCompare.percentDelta >= 0 ? "+" : ""}
 {selectedHistoryCompare.percentDelta}%
 </p>
 <p className="mt-1">
 寰楀垎鍙樺寲锛歿selectedHistoryCompare.scoreDelta >= 0 ? "+" : ""}
 {selectedHistoryCompare.scoreDelta}
 </p>
 <p className="mt-1">
 閿欓鍙樺寲锛? {selectedHistoryCompare.wrongDelta > 0
 ? `澶氶敊 ${selectedHistoryCompare.wrongDelta} 棰榒
 : selectedHistoryCompare.wrongDelta < 0
 ? `灏戦敊 ${Math.abs(selectedHistoryCompare.wrongDelta)} 棰榒
 : "鎸佸钩"}
 </p>
 {selectedHistoryCompare.subjectiveRateDelta !== null ? (
 <p className="mt-1">
 涓昏棰樺緱鍒嗙巼鍙樺寲锛歿selectedHistoryCompare.subjectiveRateDelta >= 0 ? "+" : ""}
 {selectedHistoryCompare.subjectiveRateDelta}%
 </p>
 ) : null}
 </div>
 )}

 <h3 className="mt-4 text-sm text-slate-600">涓昏棰樿秼鍔匡紙鏈€杩?12 鍦猴級</h3>
 {historySubjectiveTrend.length === 0 ? (
 <p className="mt-2 text-xs text-slate-500">鏆傛棤涓昏棰樺巻鍙叉暟鎹€?</p>
 ) : (
 <div className="mt-2 max-h-[210px] flow-sm overflow-auto">
 {historySubjectiveTrend.map((item) => (
 <div key={`subjective-trend-${item.id}`} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-2">
 <div className="flex items-center justify-between text-[11px] text-slate-600">
 <span>{item.dateLabel}</span>
 <span>
 涓昏 {item.subjectiveRate === null ? "--" : `${item.subjectiveRate}%`} 路 瀹㈣{" "}
 {item.objectiveRate === null ? "--" : `${item.objectiveRate}%`}
 </span>
 </div>
 <div className="mt-1 h-1.5 rounded-full bg-slate-100">
 <div
 className="h-1.5 rounded-full bg-ink-700"
 style={{ width: `${Math.max(0, Math.min(100, item.subjectiveRate ?? 0))}%` }}
 />
 </div>
 <p className="mt-1 text-[11px] text-slate-500">涓昏棰樻暟閲忥細{item.subjectiveCount}</p>
 </div>
 ))}
 </div>
 )}

 <h3 className="mt-4 text-sm text-slate-600">褰撴涓昏棰樺垎鏋?</h3>
 {!selectedSubjectiveSummary || selectedSubjectiveSummary.count === 0 ? (
 <p className="mt-2 text-xs text-slate-500">璇ュ満娆℃殏鏃犱富瑙傞鏁版嵁銆?</p>
 ) : (
 <div className="mt-2 rounded-lg bg-warm-50 p-3 text-xs text-slate-700">
 <p>
 涓昏棰?{selectedSubjectiveSummary.count} 棰橈紝閿欓 {selectedSubjectiveSummary.wrongCount} 棰橈紝寰楀垎鐜噞" "}
 {selectedSubjectiveSummary.scoreRate ?? "--"}%銆? </p>
 {selectedSubjectiveSummary.avgAiRate !== null ? (
 <p className="mt-1">AI璇勫垎骞冲潎瀹屾垚搴︼細{selectedSubjectiveSummary.avgAiRate}%</p>
 ) : null}
 {selectedSubjectiveSummary.topMissingKeywords.length > 0 ? (
 <p className="mt-1">楂橀缂哄け鍏抽敭璇嶏細{selectedSubjectiveSummary.topMissingKeywords.join("銆?)}</p>
 ) : (
 <p className="mt-1">鍏抽敭璇嶈鐩栬緝瀹屾暣锛岀户缁繚鎸併€?</p>
 )}
 <div className="mt-2 flex flex-wrap gap-2">
 <Link
 to={buildSubjectivePackLink({
 keywordTag:
 selectedSubjectiveSummary.topMissingKeywords.length > 0
 ? selectedSubjectiveSummary.topMissingKeywords[0].replace(/\(\d+\)$/, "")
 : undefined,
 })}
 className="rounded shadow-[inset_0_0_0_1px_rgba(26,43,76,0.30)] px-2 py-1 text-[11px] text-ink-700 hover:bg-ink-50"
 >
 涓€閿仛涓昏涓撻」
 </Link>
 <Link
 to={buildSubjectivePackLink({ status: "pending", difficulty: "medium", count: 10 })}
 className="rounded shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)] px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
 >
 浠呭仛寰呭涔犱富瑙傞
 </Link>
 </div>
 </div>
 )}

 <h3 className="mt-4 text-sm text-slate-600">褰撴閿欓鏄庣粏</h3>
 {!selectedHistoryResolved || !Array.isArray(selectedHistoryResolved.detail) ? (
 <p className="mt-2 text-xs text-slate-500">鏆傛棤閿欓鏄庣粏銆?</p>
 ) : (
 <div className="mt-2 max-h-[260px] flow-sm overflow-auto">
 {selectedHistoryResolved.detail.filter((item) => !item.isCorrect).length === 0 ? (
 <p className="text-xs text-slate-500">璇ュ満娆℃棤閿欓锛岃〃鐜板緢妫掋€?</p>
 ) : (
 selectedHistoryResolved.detail
 .filter((item) => !item.isCorrect)
 .slice(0, 8)
 .map((item) => (
 <div key={`${selectedHistoryResolved.id}-wrong-${item.index}`} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-2">
 <p className="text-xs text-slate-700">
 绗?{item.index + 1} 棰?路 {item.content}
 </p>
 <p className="mt-1 text-[11px] text-slate-500">瑙ｆ瀽锛歿item.explanation}</p>
 {item.questionType ? (
 <Link
 to={buildWrongbookLink("questionType", item.questionType)}
 className="mt-1 inline-block text-[11px] text-ink-700 hover:text-ink-900"
 >
 鍘婚敊棰樻湰鐪嬪悓棰樺瀷
 </Link>
 ) : null}
 </div>
 ))
 )}
 </div>
 )}
 </article>
 </div>
 ) : null}
 </SectionCard>
 </section>
 ) : null}

 {examWorkspaceView === "session" && session && hasQuestions && !result ? (
 <section className="surface-card flow-md">
 <div className="flex items-center justify-between">
 <h2 className="font-display text-2xl text-ink-700">浣滅瓟鍖?</h2>
 <div className="flex items-center gap-4 text-sm">
 <span className="text-slate-600">
 宸茬瓟 {answeredCount}/{session.questions.length}
 </span>
 <span className={timerClassName}>鍓╀綑鏃堕棿 {formatSeconds(remainingSeconds)}</span>
 </div>
 </div>
 <p className="text-xs text-slate-500">
 鏈嵎棰樺瀷鏋勬垚锛氫富瑙傞{" "}
 <span className="font-medium text-slate-700">{session.composition?.subjectiveCount ?? "--"}</span> /{" "}
 {session.composition?.total ?? session.questions.length}锛堝崰姣攞" "}
 <span className="font-medium text-slate-700">
 {session.composition ? `${Math.round(session.composition.subjectiveRatio * 100)}%` : "--"}
 </span>
 锛? {typeof session.subjectiveRequired === "number" ? (
 <span>
 {" "}
 路 鐩爣涓嶅皯浜?<span className="font-medium text-slate-700">{session.subjectiveRequired}</span> 棰? </span>
 ) : null}
 </p>

 {autoSubmitting ? (
 <p className="rounded-lg shadow-[inset_0_0_0_1px_rgba(217,119,6,0.24)] bg-amber-50 p-3 text-sm text-amber-700">鑰冭瘯鏃堕棿宸插埌锛屾鍦ㄨ嚜鍔ㄤ氦鍗?..</p>
 ) : null}

 {session.questions.map((question, index) => {
 const options = Array.isArray(question.options) ? question.options : [];
 const isSubjective =
 String(question.questionKind || "").toLowerCase() === "subjective" ||
 options.length < 2 ||
 typeof question.answer !== "number";
 const answerValue = answers[index];

 return (
 <article key={`${question.content}-${index}`} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-4">
 <p className="text-sm text-slate-500">
 绗?{index + 1} 棰?路 {isSubjective ? "涓昏棰? : "瀹㈣棰?}
 </p>
 <p className="mt-2 text-base text-slate-800">{question.content}</p>

 {isSubjective ? (
 <div className="mt-3 flow-sm">
 <textarea
 rows={4}
 value={typeof answerValue === "string" ? answerValue : ""}
 onChange={(event) => {
 const next = [...answers];
 next[index] = event.target.value;
 setAnswers(next);
 }}
 disabled={submitting || Boolean(result)}
 className="w-full rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] px-3 py-2 text-sm text-slate-700 outline-none ring-ink-700 transition focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60"
 placeholder="璇疯緭鍏ヤ綘鐨勮祻鏋愮瓟妗堬紝寤鸿鍖呭惈瑙傜偣銆佽瘲鍙ヤ緷鎹拰鎯呮劅鍒嗘瀽銆?
 />
 {Array.isArray(question.keywords) && question.keywords.length > 0 ? (
 <p className="text-xs text-slate-500">寤鸿瑕嗙洊鍏抽敭璇嶏細{question.keywords.join("銆?)}</p>
 ) : null}
 </div>
 ) : (
 <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
 {options.map((option, optionIndex) => (
 <button
 key={`${option}-${optionIndex}`}
 type="button"
 disabled={submitting || Boolean(result)}
 className={[
 "rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
 answerValue === optionIndex
 ? "bg-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.62)] text-white"
 : "bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] text-slate-700",
 ].join(" ")}
 onClick={() => {
 const next = [...answers];
 next[index] = optionIndex;
 setAnswers(next);
 }}
 >
 {String.fromCharCode(65 + optionIndex)}. {option}
 </button>
 ))}
 </div>
 )}
 </article>
 );
 })}

 {!result ? (
 <button
 type="button"
 onClick={() => void submitExam(false)}
 disabled={submitting}
 className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
 >
 {submitting ? "闃呭嵎涓?.." : "浜ゅ嵎骞惰瘎鍒?}
 </button>
 ) : null}
 </section>
 ) : null}

 {examWorkspaceView === "session" && result ? (
 <section className="surface-card flow-md">
 <h2 className="font-display text-2xl text-ink-700">鎴愮哗璇婃柇鍙?</h2>
 <div className="workspace-meta-grid">
 <MetricCard label="鎬诲垎" value={`${result.score}/${result.maxScore}`} variant="meta" />
 <MetricCard label="姝ｇ‘鐜? value={`${result.percent}%`} variant="meta" />
 <MetricCard
 label="鏈€寮遍」"
 value={
 resultWeakestRows.length > 0
 ? `${weakDimensionLabelMap[resultWeakestRows[0].dimension]}路${resultWeakestRows[0].label}`
 : "鏆傛棤"
 }
 variant="meta"
 />
 <MetricCard
 label="琛ユ晳寤鸿"
 value={resultWeakestRows.length > 0 ? "浼樺厛鍋氫笓椤硅ˉ鏁戦鍖? : "淇濇寔璁粌鑺傚"}
 variant="meta"
 />
 </div>

 <div className="rounded-lg shadow-[inset_0_0_0_1px_rgba(26,43,76,0.16)] bg-ink-50/70 p-3 text-sm text-ink-700">
 鏈満鎬荤粨锛氬緱鍒?{result.score}/{result.maxScore}锛屾纭巼 {result.percent}%銆? {resultWeakestRows.length > 0
 ? ` 鍏堣ˉ銆?{resultWeakestRows[0].label}銆嶏紝鍐嶅仛涓€杞悓棰樺瀷宸╁浐銆俙
 : " 褰撳墠琛ㄧ幇绋冲畾锛屽缓璁户缁繚鎸佷竴鍛?2-3 娆℃ā鑰冭妭濂忋€?}
 </div>

 {submitReason === "auto" ? (
 <p className="mt-2 rounded-lg shadow-[inset_0_0_0_1px_rgba(217,119,6,0.24)] bg-amber-50 p-3 text-sm text-amber-700">鏈涓哄€掕鏃剁粨鏉熷悗鑷姩浜ゅ嵎銆?</p>
 ) : null}
 <p className="mt-2 rounded-lg bg-warm-50 p-3 text-sm text-slate-700">{result.feedback}</p>
 {examSummarySaved ? (
 <p className="mt-2 rounded-lg shadow-[inset_0_0_0_1px_rgba(22,163,74,0.24)] bg-green-50 p-3 text-sm text-green-700">
 鏈満鑰冭瘯灏忕粨宸茶嚜鍔ㄥ啓鍏ュ涔犳。妗堬紝鍙湪
 <Link to="/my-learning" className="mx-1 underline underline-offset-2">
 鎴戠殑瀛︿範
 </Link>
 缁х画澶嶇洏銆? </p>
 ) : null}
 <div className="mt-3 flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => void handleCopyReviewCard()}
 className="rounded shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)] px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
 >
 澶嶅埗閿欓澶嶇洏鍗? </button>
 <button
 type="button"
 onClick={() => downloadTextFile(`exam-review-card-${new Date().toISOString().slice(0, 10)}.md`, reviewCardMarkdown)}
 className="rounded shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)] px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
 >
 瀵煎嚭澶嶇洏鍗? </button>
 {copyReviewCardStatus === "ok" ? <span className="text-xs text-green-700">宸插鍒?</span> : null}
 {copyReviewCardStatus === "error" ? <span className="text-xs text-red-700">澶嶅埗澶辫触锛岃浣跨敤瀵煎嚭</span> : null}
 </div>

 {resultWeakestRows.length > 0 ? (
 <SectionCard
 density="cozy"
 title="涓嬩竴姝ヨˉ鏁戝姩浣?
 subtitle="鎸夆€滀笓椤圭粌涔?鈫?閿欓澶嶇洏 鈫?鍐嶆妯¤€冣€濆舰鎴愰棴鐜€?
 bodyClassName="flow-sm"
 >
 <div className="flex flex-wrap gap-2">
 <Link
 to={buildWrongbookLink(resultWeakestRows[0].dimension, resultWeakestRows[0].key)}
 className="btn-primary-compact"
 >
 鍘婚敊棰樻湰瀹氫綅寮遍」
 </Link>
 <Link
 to={buildSubjectivePackLink({
 status: "all",
 difficulty: "easy",
 count: 8,
 source: "exam",
 dynasty: resultWeakestRows[0].dimension === "dynasty" ? resultWeakestRows[0].key : undefined,
 theme: resultWeakestRows[0].dimension === "theme" ? resultWeakestRows[0].key : undefined,
 })}
 className="btn-secondary-compact"
 >
 鐢熸垚琛ユ晳棰樺寘
 </Link>
 <Link to="/practice?topic=鑰冭瘯閿欏洜宸╁浐&count=6&difficulty=easy&auto=1&source=exam" className="btn-secondary-compact">
 鍘荤粌涔犲満宸╁浐
 </Link>
 </div>
 </SectionCard>
 ) : null}

 <div className="segmented-tabs mt-4">
 <button
 type="button"
 onClick={() => setResultReviewTab("diagnosis")}
 className={["segmented-tab", resultReviewTab === "diagnosis" ? "segmented-tab-active" : ""].join(" ")}
 >
 璇婃柇瑙嗗浘
 </button>
 <button
 type="button"
 onClick={() => setResultReviewTab("detail")}
 className={["segmented-tab", resultReviewTab === "detail" ? "segmented-tab-active" : ""].join(" ")}
 >
 閫愰鏄庣粏
 </button>
 </div>

 {resultReviewTab === "diagnosis" ? (
 result.diagnostics ? (
 <div className="mt-4 flow-md">
 <article className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-3">
 <h3 className="text-sm text-slate-600">鏈€寮遍」璇婃柇</h3>
 {result.diagnostics.weakest.length === 0 ? (
 <p className="mt-2 text-xs text-slate-400">鏈琛ㄧ幇绋冲畾锛屾殏鏈瘑鍒埌鏄庢樉钖勫急椤广€?</p>
 ) : (
 <div className="mt-2 flow-sm">
 {result.diagnostics.weakest.map((item) => (
 <div key={`${item.dimension}-${item.key}`} className="rounded-lg bg-warm-50 p-2">
 <div className="flex items-center justify-between text-xs text-slate-700">
 <span>
 {weakDimensionLabelMap[item.dimension]} 路 {item.label}
 </span>
 <span>
 閿欒 {item.wrong}/{item.attempts}
 </span>
 </div>
 <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
 <span>姝ｇ‘鐜?{Math.round(item.rate * 100)}%</span>
 <Link to={buildWrongbookLink(item.dimension, item.key)} className="text-ink-700 hover:text-ink-900">
 鍘婚敊棰樻湰瀹氫綅
 </Link>
 </div>
 </div>
 ))}
 </div>
 )}
 </article>

 <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
 {renderDimensionCard("棰樺瀷琛ㄧ幇", result.diagnostics.byQuestionType, "questionType")}
 {renderDimensionCard("鏈濅唬琛ㄧ幇", result.diagnostics.byDynasty, "dynasty")}
 {renderDimensionCard("棰樻潗琛ㄧ幇", result.diagnostics.byTheme, "theme")}
 </div>
 </div>
 ) : (
 <p className="mt-4 rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] px-3 py-2 text-xs text-slate-500">
 鏆傛棤璇婃柇鏁版嵁锛岃绋嶅悗閲嶈瘯鎴栧啀娆″畬鎴愪竴鍦烘ā鑰冨埛鏂般€? </p>
 )
 ) : null}

 {resultReviewTab === "detail" ? (
 <section className="mt-4 rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white p-3">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <p className="text-sm text-slate-700">閫愰鏄庣粏</p>
 <p className="text-xs text-slate-500">鍖呭惈姣忛寰楀垎銆佺瓟妗堝鐓с€佽瘎鍒嗚鏄庝笌鍚岀被閿欓璺宠浆銆?</p>
 </div>
 <span className="text-xs text-slate-500">
 鍏?{result.detail.length} 棰?路 閿欓 {result.detail.filter((item) => !item.isCorrect).length} 棰? </span>
 </div>

 <div className="mt-3 flow-sm">
 {result.detail.map((item) => {
 let fallbackLink: string | null = null;
 if (!item.isCorrect && item.questionType) {
 fallbackLink = buildWrongbookLink("questionType", item.questionType);
 } else if (!item.isCorrect && item.dynasty) {
 fallbackLink = buildWrongbookLink("dynasty", item.dynasty);
 } else if (!item.isCorrect && item.theme) {
 fallbackLink = buildWrongbookLink("theme", item.theme);
 }

 return (
 <div key={item.index} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-3 text-sm">
 <div className="flex items-center justify-between">
 <span>
 绗?{item.index + 1} 棰?路 {item.questionKind === "subjective" ? "涓昏棰? : "瀹㈣棰?}
 </span>
 <span className={item.isCorrect ? "text-green-700" : "text-red-700"}>{item.isCorrect ? "姝ｇ‘" : "閿欒"}</span>
 </div>
 <p className="mt-1 text-xs text-slate-500">
 寰楀垎 {item.score}/{item.maxScore}
 </p>
 <p className="mt-2 text-slate-700">{item.content}</p>
 {item.questionKind === "subjective" ? (
 <div className="mt-2 space-y-1 text-xs text-slate-600">
 <p>浣犵殑绛旀锛歿item.userAnswer ? String(item.userAnswer) : "锛堟湭浣滅瓟锛?}</p>
 <p>鍙傝€冭鐐癸細{item.correctAnswer ? String(item.correctAnswer) : "锛堟棤锛?}</p>
 {typeof item.feedback === "string" && item.feedback ? <p>璇勫垎璇存槑锛歿item.feedback}</p> : null}
 {Array.isArray(item.rubric) && item.rubric.length > 0 ? (
 <div className="mt-2 rounded-md shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-slate-50 p-2">
 <p className="text-[11px] text-slate-500">鍒嗛」璇勫垎</p>
 <div className="mt-1 space-y-1">
 {item.rubric.map((row) => (
 <div key={`${item.index}-${row.key}`} className="text-[11px] text-slate-600">
 <span>{row.label}锛?</span>
 <span>
 {row.score}/{row.maxScore}
 </span>
 {row.note ? <span>锛坽row.note}锛?</span> : null}
 </div>
 ))}
 </div>
 </div>
 ) : null}
 {Array.isArray(item.suggestions) && item.suggestions.length > 0 ? (
 <p>鏀硅繘寤鸿锛歿item.suggestions.join("锛?)}</p>
 ) : null}
 {Array.isArray(item.missingKeywords) && item.missingKeywords.length > 0 ? (
 <div className="pt-1">
 <Link
 to={buildSubjectivePackLink({
 keywordTag: item.missingKeywords[0],
 dynasty: item.dynasty || undefined,
 theme: item.theme || undefined,
 })}
 className="inline-block text-[11px] text-ink-700 hover:text-ink-900"
 >
 鐢ㄢ€渰item.missingKeywords[0]}鈥濆仛涓昏涓撻」
 </Link>
 </div>
 ) : null}
 </div>
 ) : (
 <div className="mt-2 space-y-1 text-xs text-slate-600">
 <p>浣犵殑閫夋嫨锛歿item.userAnswer === null ? "锛堟湭浣滅瓟锛? : String(item.userAnswer)}</p>
 <p>姝ｇ‘绛旀锛歿String(item.correctAnswer)}</p>
 </div>
 )}
 <p className="mt-1 text-slate-500">瑙ｆ瀽锛歿item.explanation}</p>
 {fallbackLink ? (
 <Link to={fallbackLink} className="mt-2 inline-block text-xs text-ink-700 hover:text-ink-900">
 鍘婚敊棰樻湰鏌ョ湅鍚岀被闂
 </Link>
 ) : null}
 </div>
 );
 })}
 </div>
 </section>
 ) : null}
 </section>
 ) : null}
 </WorkspaceLayout>
 </div>
 );
}

















