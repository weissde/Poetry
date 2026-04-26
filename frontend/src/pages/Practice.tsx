﻿﻿﻿﻿import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Brain, Download, History, PenSquare, Sparkles } from "lucide-react";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { NextStepRecommendations } from "@/components/common/NextStepRecommendations";
import { PageHeader } from "@/components/common/PageHeader";
import { PageStage } from "@/components/common/PageStage";
import ContextBanner from "@/components/ContextBanner";
import { SectionCard } from "@/components/common/SectionCard";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { TeachingStepBar } from "@/components/teaching/TeachingStepBar";
import { WorkspaceLayout } from "@/components/common/WorkspaceLayout";
import { QuestionCard } from "@/components/practice/QuestionCard";
import MemoryTabContent from "@/components/practice/MemoryTabContent";
import { BlurText, Magnet, PillNav, SpotlightCard, TiltedCard, type PillNavItem } from "@/components/react-bits";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { buildPersonalizedPracticeTopics } from "@/features/recommendations/personalized";
import { apiPost, updateLessonTaskStatus } from "@/lib/api";
import { practiceTeacherCue, teacherHintItems } from "@/content/teachingStatic";
import { usePracticeStore } from "@/stores/practiceStore";
import { useWeakness } from "@/hooks/useWeakness";
import type { PracticeDimension, PracticeDifficulty, PracticeQuestion } from "@/stores/practiceStore";
const WeaknessRadar = lazy(async () => {
  const module = await import("@/components/practice/WeaknessRadar");
  return { default: module.WeaknessRadar };
});

const ExamWorkspace = lazy(async () => {
  const module = await import("@/components/practice/ExamWorkspace");
  return { default: module.ExamWorkspace };
});

function WorkspaceLazyFallback({ label }: { label: string }): JSX.Element {
  return (
    <div className="rounded-2xl bg-stone-50 px-4 py-10 text-center text-sm text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
      {label}加载中...
    </div>
  );
}

const QUESTION_TYPE_OPTIONS: Array<{
 value: PracticeDimension;
 label: string;
 description: string;
 icon: JSX.Element;
}> = [
 { value: "memorization", label: "默写", description: "先稳基础识记", icon: <PenSquare className="h-4 w-4" /> },
 { value: "meaning", label: "词义理解", description: "抓关键词释义", icon: <BookOpen className="h-4 w-4" /> },
 { value: "technique", label: "手法分析", description: "辨析表达技巧", icon: <Brain className="h-4 w-4" /> },
 { value: "emotion", label: "情感把握", description: "定位情绪走向", icon: <Sparkles className="h-4 w-4" /> },
 { value: "appreciation", label: "综合赏析", description: "整合观点论证", icon: <History className="h-4 w-4" /> },
 { value: "comparison", label: "比较阅读", description: "同题异构对读", icon: <ArrowRight className="h-4 w-4" /> },
 { value: "context", label: "语境默写", description: "情境化回忆输出", icon: <Download className="h-4 w-4" /> },
];

const ALL_TYPES: PracticeDimension[] = QUESTION_TYPE_OPTIONS.map((item) => item.value);
const TYPE_LABEL_MAP: Record<PracticeDimension, string> = {
 memorization: "默写",
 meaning: "词义",
 technique: "手法",
 emotion: "情感",
 appreciation: "赏析",
 comparison: "比较阅读",
 context: "语境默写",
};

const practiceObjective = {
  title: "练测评估目标",
  summary: "通过专项练习、模拟考试和错题复盘，巩固课堂所学，形成学测闭环。",
  goals: ["完成至少一轮专项练习，建立当前基线", "识别薄弱题型并针对性强化", "将错题回流到复习计划中"],
  teacherHint: "建议先让学生完成 5-8 题建立基线，再根据诊断结果调整题型配置。",
};

type PracticeSecondaryTab = "export" | "diagnosis";
type PracticeWorkspaceView = "session" | "review";
type PracticeTypeNavValue = "all" | PracticeDimension;
type EvaluationEntryTab = "practice" | "exam" | "memory";

const secondaryTabOptions: Array<{ value: PracticeSecondaryTab; label: string }> = [
 { value: "diagnosis", label: "薄弱诊断" },
 { value: "export", label: "导出回看" },
];
const TYPE_NAV_ITEMS: ReadonlyArray<PillNavItem<PracticeTypeNavValue>> = [
 { id: "all", label: "全部题型" },
 ...QUESTION_TYPE_OPTIONS.map((item) => ({ id: item.value, label: item.label })),
];
const EVALUATION_ENTRY_ITEMS: ReadonlyArray<PillNavItem<EvaluationEntryTab>> = [
  { id: "practice", label: "专项练习" },
  { id: "exam", label: "模拟考试" },
  { id: "memory", label: "记忆训练" },
];
function isValidDifficulty(value: string | null): value is PracticeDifficulty {
 return value === "easy" || value === "medium" || value === "hard";
}

function parseTypes(raw: string | null): PracticeDimension[] {
 if (!raw || !raw.trim()) {
 return [];
 }
 const allowed = new Set<PracticeDimension>(ALL_TYPES);
 return raw
 .split(",")
 .map((item) => item.trim())
 .filter((item): item is PracticeDimension => allowed.has(item as PracticeDimension));
}

function parseEvaluationEntryTab(value: string | null): EvaluationEntryTab {
 if (value === "exam" || value === "memory") {
 return value;
 }
 return "practice";
}

function isWrongbookSubjectivePack(value: string | null): boolean {
 return value === "subjective_wrongbook";
}

function sourceLabelFromParams(params: URLSearchParams): string | null {
 const source = (params.get("source") || "").trim().toLowerCase();
 const pack = (params.get("pack") || "").trim().toLowerCase();
 const keywordTag = (params.get("keywordTag") || "").trim();
 const dynasty = (params.get("dynasty") || "").trim();
 const theme = (params.get("theme") || "").trim();
 const poetA = (params.get("poetA") || "").trim();
 const poetB = (params.get("poetB") || "").trim();

 if (pack === "subjective_wrongbook") {
 const detail = keywordTag || dynasty || theme;
 if (source === "exam") {
 return detail ? `来源：考试中心主观专项（${detail}）` : "来源：考试中心主观专项";
 }
 if (source === "my_learning") {
 return detail ? `来源：我的学习主观专项（${detail}）` : "来源：我的学习主观专项";
 }
 return detail ? `来源：错题本主观专项（${detail}）` : "来源：错题本主观专项";
 }
 if (source === "exam") {
 return "来源：考试中心";
 }
  if (source === "my_learning") {
  return "来源：我的学习";
  }
  if (source === "lesson_task") {
  return "来源：课堂任务";
  }
  if (source === "graph_compare") {
 if (poetA && poetB) {
 return `来源：图谱对比（${poetA} vs ${poetB}）`;
 }
 return "来源：图谱对比练习";
 }
 return null;
}

function sourceMetricKeyFromParams(params: URLSearchParams): string | undefined {
 const source = (params.get("source") || "").trim().toLowerCase();
 const pack = (params.get("pack") || "").trim().toLowerCase();
 const auto = params.get("auto") === "1";

 if (pack === "subjective_wrongbook") {
 return source ? `subjective_pack_${source}` : "subjective_pack";
 }
 if (source) {
 return `practice_${source}`;
 }
 if (auto) {
 return "practice_auto";
 }
 return undefined;
}

function buildGraphCompareBackLink(params: URLSearchParams): string | null {
 const source = (params.get("source") || "").trim().toLowerCase();
 if (source !== "graph_compare") {
 return null;
 }
 const poetA = (params.get("poetA") || "").trim();
 const poetB = (params.get("poetB") || "").trim();
 const dynasty = (params.get("dynasty") || "").trim();
 const query = new URLSearchParams();
 query.set("compare", "1");
 if (poetA) {
 query.set("left", poetA);
 }
 if (poetB) {
 query.set("right", poetB);
 }
 if (dynasty) {
 query.set("dynasty", dynasty);
 }
 return `/graph?${query.toString()}`;
}

function buildSafeFileToken(value: string): string {
 const normalized = (value || "")
 .trim()
 .replace(/[\\/:*?"<>|]/g, "_")
 .replace(/\s+/g, "_");
 return normalized || "practice";
}

function downloadTextFile(filename: string, content: string): void {
 const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
 const href = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = href;
 anchor.download = filename;
 document.body.appendChild(anchor);
 anchor.click();
 document.body.removeChild(anchor);
 URL.revokeObjectURL(href);
}

function toMarkdownSafe(value: string): string {
 return value.replace(/\|/g, "\\|");
}

function buildPracticeMarkdown(
 topic: string,
 questions: PracticeQuestion[],
 selectedTypes: PracticeDimension[],
 difficulty: PracticeDifficulty,
 answersMap: Map<number, { selected: number; isCorrect: boolean }>,
): string {
 const lines: string[] = [];
 lines.push(`# 练习题导出：${topic || "未命名主题"}`);
 lines.push("");
 lines.push(`- 导出时间：${new Date().toLocaleString()}`);
 lines.push(`- 难度：${difficulty}`);
 lines.push(`- 题型：${selectedTypes.map((type) => TYPE_LABEL_MAP[type]).join("、")}`);
 lines.push(`- 题量：${questions.length}`);
 lines.push("");

 questions.forEach((question, index) => {
 const answered = answersMap.get(index);
 lines.push(`## ${index + 1}. ${question.content}`);
 lines.push("");
 question.options.forEach((option, optionIndex) => {
 const optionLetter = String.fromCharCode(65 + optionIndex);
 lines.push(`- ${optionLetter}. ${toMarkdownSafe(option)}`);
 });
 lines.push("");
 lines.push(`- 正确答案：${String.fromCharCode(65 + question.answer)}. ${toMarkdownSafe(question.options[question.answer] || "")}`);
 if (answered) {
 lines.push(`- 我的答案：${String.fromCharCode(65 + answered.selected)}. ${toMarkdownSafe(question.options[answered.selected] || "")}`);
 lines.push(`- 作答结果：${answered.isCorrect ? "正确" : "错误"}`);
 }
 lines.push(`- 解析：${toMarkdownSafe(question.explanation)}`);
 if (question.dynasty || question.theme || (question.keywordTags || []).length > 0) {
 lines.push(
 `- 维度：朝代${question.dynasty || "-"}；主题${question.theme || "-"}；关键词=${(question.keywordTags || []).join("/") || "-"}`,
 );
 }
 lines.push("");
 });

 return lines.join("\n");
}

function buildWrongOnlyMarkdown(
 topic: string,
 wrongRows: Array<{
 index: number;
 question: PracticeQuestion;
 selected: number;
 }>,
): string {
 const lines: string[] = [];
 lines.push(`# 错题集导出：${topic || "未命名主题"}`);
 lines.push("");
 lines.push(`- 导出时间：${new Date().toLocaleString()}`);
 lines.push(`- 错题数：${wrongRows.length}`);
 lines.push("");

 wrongRows.forEach((row) => {
 const { index, question, selected } = row;
 lines.push(`## ${index + 1}. ${question.content}`);
 lines.push("");
 lines.push(`- 我的答案：${String.fromCharCode(65 + selected)}. ${toMarkdownSafe(question.options[selected] || "")}`);
 lines.push(`- 正确答案：${String.fromCharCode(65 + question.answer)}. ${toMarkdownSafe(question.options[question.answer] || "")}`);
 lines.push(`- 解析：${toMarkdownSafe(question.explanation)}`);
 lines.push("");
 });

 return lines.join("\n");
}

export default function PracticePage(): JSX.Element {
	 const [searchParams, setSearchParams] = useSearchParams();
	 const { isTeacherMode, currentPoemId } = useTeachingMode();
	const { profile: weaknessProfile } = useWeakness();
  const isLegacyHistoryEntry = searchParams.get("entry") === "history";
	 const evaluationEntryTab = parseEvaluationEntryTab(searchParams.get("entry"));
  const presetAppliedRef = useRef<string>("");
  const savedSummaryRef = useRef<string>("");
  const lessonTaskStartRef = useRef<string>("");
  const lessonTaskCompletionRef = useRef<string>("");

 const [topic, setTopic] = useState<string>("静夜思");
 const [count, setCount] = useState<number>(5);
 const [difficulty, setDifficulty] = useState<PracticeDifficulty>("medium");
 const [selectedTypes, setSelectedTypes] = useState<PracticeDimension[]>(ALL_TYPES);
  const [secondaryTab, setSecondaryTab] = useState<PracticeSecondaryTab>("diagnosis");
  const [practiceWorkspaceView, setPracticeWorkspaceView] = useState<PracticeWorkspaceView>("session");
  const [lessonTaskStatusMessage, setLessonTaskStatusMessage] = useState<string | null>(null);

 const {
 questions,
 currentIndex,
 isFinished,
 isGenerating,
 error,
 answers,
 stats,
 generateQuestions,
 generateWrongbookSubjectivePack,
 submitAnswer,
 nextQuestion,
 resetPractice,
 } = usePracticeStore();

 const currentQuestion = questions[currentIndex] ?? null;
	 const sourceBadge = useMemo(() => sourceLabelFromParams(searchParams), [searchParams]);
	 const sourceMetricKey = useMemo(() => sourceMetricKeyFromParams(searchParams), [searchParams]);
	 const graphCompareBackLink = useMemo(() => buildGraphCompareBackLink(searchParams), [searchParams]);
  const lessonTaskId = useMemo(() => (searchParams.get("lessonTaskId") || "").trim(), [searchParams]);
  const teacherHint = useMemo(() => teacherHintItems.find((item) => item.page === "practice") || null, []);

  const recommendedTopics = useMemo(() => {
    return buildPersonalizedPracticeTopics(weaknessProfile);
  }, [weaknessProfile]);

  const weakestDimension = useMemo(() => {
    if (!weaknessProfile?.by_question_type) return null;
    const entries = Object.entries(weaknessProfile.by_question_type)
      .filter(([, v]) => v.attempts >= 2)
      .sort((a, b) => a[1].rate - b[1].rate);
    if (entries.length === 0) return null;
    const [key, metric] = entries[0];
    const labels: Record<string, string> = {
      memorization: "默写", meaning: "词义", technique: "手法",
      emotion: "情感", appreciation: "赏析", comparison: "比较阅读",
    };
    return { key, label: labels[key] ?? key, rate: Math.round(metric.rate * 100), attempts: metric.attempts };
  }, [weaknessProfile]);

 const switchEvaluationTab = (next: EvaluationEntryTab): void => {
 const params = new URLSearchParams(searchParams);
 params.set("entry", next);
 setSearchParams(params);
 };

 useEffect(() => {
 const key = searchParams.toString();
 if (!key || presetAppliedRef.current === key) {
 return;
 }
 presetAppliedRef.current = key;

 const rawTopic = (searchParams.get("topic") || "").trim();
 const rawCount = Number(searchParams.get("count"));
 const rawDifficulty = searchParams.get("difficulty");
 const parsedTypes = parseTypes(searchParams.get("types"));
 const wrongbookPack = isWrongbookSubjectivePack(searchParams.get("pack"));
 const wrongbookStatus = searchParams.get("status");
 const wrongbookDynasty = (searchParams.get("dynasty") || "").trim();
 const wrongbookTheme = (searchParams.get("theme") || "").trim();
 const wrongbookKeywordTag = (searchParams.get("keywordTag") || "").trim();
 const auto = searchParams.get("auto") === "1";

 const nextTopic = rawTopic || "静夜思";
 const nextCount = Number.isFinite(rawCount) ? Math.min(20, Math.max(3, Math.floor(rawCount))) : 5;
 const nextDifficulty: PracticeDifficulty = isValidDifficulty(rawDifficulty) ? rawDifficulty : "medium";
 const nextTypes = parsedTypes.length > 0 ? parsedTypes : ALL_TYPES;

 setTopic(nextTopic);
 setCount(nextCount);
 setDifficulty(nextDifficulty);
 setSelectedTypes(nextTypes);

 if (auto) {
 if (wrongbookPack) {
 void generateWrongbookSubjectivePack({
 count: nextCount,
 difficulty: nextDifficulty,
 status: wrongbookStatus === "retry" || wrongbookStatus === "all" ? wrongbookStatus : "pending",
 dynasty: wrongbookDynasty || undefined,
 theme: wrongbookTheme || undefined,
 keywordTag: wrongbookKeywordTag || undefined,
 });
 } else if (rawTopic) {
 void generateQuestions(nextTopic, {
 count: nextCount,
 difficulty: nextDifficulty,
 types: nextTypes,
 });
 }
 }
  }, [searchParams, generateQuestions, generateWrongbookSubjectivePack]);

  useEffect(() => {
  if (!lessonTaskId || lessonTaskStartRef.current === lessonTaskId) {
  return;
  }
  lessonTaskStartRef.current = lessonTaskId;
  void updateLessonTaskStatus(lessonTaskId, "in_progress").catch(() => {
  // Opening the practice entry should not be blocked by task status sync.
  });
  }, [lessonTaskId]);

 useEffect(() => {
 if (isLegacyHistoryEntry && evaluationEntryTab === "practice") {
 setPracticeWorkspaceView("review");
 }
 }, [evaluationEntryTab, isLegacyHistoryEntry]);

 const selectedTypeNavValue = useMemo<PracticeTypeNavValue>(() => {
 if (selectedTypes.length === 1) {
 return selectedTypes[0];
 }
 return "all";
 }, [selectedTypes]);

 const handleTypeNavChange = (value: PracticeTypeNavValue): void => {
 if (value === "all") {
 setSelectedTypes(ALL_TYPES);
 return;
 }
 setSelectedTypes([value]);
 };

 const handleGenerate = async (): Promise<void> => {
 const nextTopic = topic.trim() || "静夜思";
 if (!topic.trim()) {
 setTopic(nextTopic);
 }
 setPracticeWorkspaceView("session");
 await generateQuestions(nextTopic, {
 count,
 difficulty,
 types: selectedTypes,
 });
 };

 const handleRetrySamePoint = async (): Promise<void> => {
 if (!currentQuestion) {
 return;
 }
 setPracticeWorkspaceView("session");

 const source = (currentQuestion.questionSource || "").toLowerCase();
 if (source.includes("wrongbook_subjective")) {
 await generateWrongbookSubjectivePack({
 count: 5,
 difficulty: "easy",
 status: "all",
 dynasty: currentQuestion.dynasty || undefined,
 theme: currentQuestion.theme || undefined,
 keywordTag: currentQuestion.keywordTags?.[0] || undefined,
 });
 return;
 }

 const topicParts = [
 topic.trim(),
 currentQuestion.theme?.trim(),
 currentQuestion.dynasty?.trim(),
 ...(currentQuestion.keywordTags || []).slice(0, 2).map((item) => item.trim()),
 ].filter((item): item is string => Boolean(item));
 const retryTopic = topicParts.join(" · ") || "古诗词专项练习";

 await generateQuestions(retryTopic, {
 count: 5,
 difficulty: "easy",
 types: [currentQuestion.type],
 });
 };

 const summary = useMemo(() => {
 const attempts = Object.values(stats).reduce((acc, item) => acc + item.attempts, 0);
 const correct = Object.values(stats).reduce((acc, item) => acc + item.correct, 0);
 const accuracy = attempts === 0 ? 0 : Math.round((correct / attempts) * 100);

 return { attempts, correct, accuracy };
 }, [stats]);
 const isGraphComparePractice = useMemo(
 () => (searchParams.get("source") || "").trim().toLowerCase() === "graph_compare",
 [searchParams],
 );
 const compareTypeSummary = useMemo(() => {
 const rows = Object.entries(stats)
 .map(([type, row]) => {
 const attempts = Number(row.attempts || 0);
 const correct = Number(row.correct || 0);
 const rate = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
 return { type: type as PracticeDimension, attempts, correct, rate };
 })
 .filter((item) => item.attempts > 0);
 rows.sort((a, b) => {
 if (a.rate === b.rate) {
 return b.attempts - a.attempts;
 }
 return a.rate - b.rate;
 });
 return rows;
 }, [stats]);
 const weakestCompareType = compareTypeSummary.length > 0 ? compareTypeSummary[0] : null;
 const wrongSessionBreakdown = useMemo(() => {
 const byType = new Map<PracticeDimension, number>();
 answers.forEach((record) => {
 if (record.isCorrect) {
 return;
 }
 const q = questions[record.questionIndex];
 if (!q) {
 return;
 }
 byType.set(q.type, (byType.get(q.type) || 0) + 1);
 });
 const rows = Array.from(byType.entries())
 .map(([type, count]) => ({ type, label: TYPE_LABEL_MAP[type], count }))
 .sort((a, b) => b.count - a.count);
 const totalWrong = answers.filter((item) => !item.isCorrect).length;
 return { rows, totalWrong };
 }, [answers, questions]);
 const practiceGraphHref = useMemo(() => {
 const raw = (topic || "静夜思").trim();
 return `/graph?highlight=${encodeURIComponent(raw)}`;
 }, [topic]);
 const canExport = questions.length > 0;
 const selectedTypeSummary = useMemo(() => {
 if (selectedTypes.length === ALL_TYPES.length) {
 return "全部题型";
 }
 if (selectedTypes.length <= 3) {
 return selectedTypes.map((type) => TYPE_LABEL_MAP[type]).join("、");
 }
 return `${selectedTypes
 .slice(0, 3)
 .map((type) => TYPE_LABEL_MAP[type])
 .join("、")} 等${selectedTypes.length} 类`;
 }, [selectedTypes]);
 const practiceWorkspaceStatus = useMemo(() => {
 if (isGenerating) return "生成中";
 if (isFinished) return "已完成";
 if (questions.length > 0) return `作答中 ${currentIndex + 1}/${questions.length}`;
 return "待开始";
 }, [currentIndex, isFinished, isGenerating, questions.length]);
 const estimatedMinutes = useMemo(() => {
 const factor = difficulty === "hard" ? 3.4 : difficulty === "medium" ? 2.6 : 1.8;
 return Math.max(6, Math.round(count * factor));
 }, [count, difficulty]);
 const weakestTypeLabel = useMemo(() => {
 if (compareTypeSummary.length === 0) {
 return null;
 }
 return TYPE_LABEL_MAP[compareTypeSummary[0].type];
 }, [compareTypeSummary]);
 const practiceLoopStepLabel = useMemo(() => {
 if (isGenerating) {
 return "步骤1：生成中";
 }
 if (questions.length === 0) {
 return "步骤1：待生成";
 }
 if (!isFinished) {
 return "步骤2：作答中";
 }
 return "步骤3：已反馈";
 }, [isFinished, isGenerating, questions.length]);
 const practiceLoopHint = useMemo(() => {
 if (isGenerating) {
 return "正在组题";
 }
 if (questions.length === 0) {
 return "先生成题组";
 }
 if (!isFinished) {
 const remaining = Math.max(0, questions.length - summary.attempts);
 return `剩余 ${remaining} 题`;
 }
 return "先复盘再巩固";
 }, [isFinished, isGenerating, questions.length, summary.attempts]);
 const practiceWorkspaceTitle = practiceWorkspaceView === "review" ? "复盘与导出" : "当前练习";
 const practiceWorkspaceSubtitle =
 practiceWorkspaceView === "review"
 ? "查看诊断并导出本轮结果。"
 : isFinished
 ? "本轮已完成，可进入复盘。"
 : questions.length > 0
 ? "继续完成当前作答。"
 : "确认配置并开始一轮练习。";

 const handleExportJson = (): void => {
 if (!questions.length) {
 return;
 }

 const answerMap = new Map(
 answers.map((item) => [item.questionIndex, { selected: item.selected, isCorrect: item.isCorrect }]),
 );

 const payload = {
 topic,
 difficulty,
 selectedTypes,
 exportedAt: new Date().toISOString(),
 total: questions.length,
 questions: questions.map((question, index) => {
 const answered = answerMap.get(index);
 return {
 index: index + 1,
 type: question.type,
 typeLabel: TYPE_LABEL_MAP[question.type],
 content: question.content,
 options: question.options,
 answerIndex: question.answer,
 answerText: question.options[question.answer] || "",
 explanation: question.explanation,
 dynasty: question.dynasty || null,
 theme: question.theme || null,
 keywordTags: question.keywordTags || [],
 userSelectedIndex: answered ? answered.selected : null,
 userSelectedText: answered ? question.options[answered.selected] || "" : null,
 userIsCorrect: answered ? answered.isCorrect : null,
 };
 }),
 };

 const filename = `${buildSafeFileToken(topic)}_practice_${Date.now()}.json`;
 downloadTextFile(filename, JSON.stringify(payload, null, 2));
 };

 const handleExportMarkdown = (): void => {
 if (!questions.length) {
 return;
 }
 const answerMap = new Map(
 answers.map((item) => [item.questionIndex, { selected: item.selected, isCorrect: item.isCorrect }]),
 );
 const markdown = buildPracticeMarkdown(topic, questions, selectedTypes, difficulty, answerMap);
 const filename = `${buildSafeFileToken(topic)}_practice_${Date.now()}.md`;
 downloadTextFile(filename, markdown);
 };

 const handleExportWrongOnly = (): void => {
 if (!questions.length || !answers.length) {
 return;
 }

 const wrongRows = answers
 .filter((item) => !item.isCorrect)
 .map((item) => ({
 index: item.questionIndex,
 question: questions[item.questionIndex],
 selected: item.selected,
 }))
 .filter((item): item is { index: number; question: PracticeQuestion; selected: number } => Boolean(item.question));

 if (wrongRows.length === 0) {
 return;
 }

 const payload = {
 topic,
 exportedAt: new Date().toISOString(),
 wrongCount: wrongRows.length,
 wrongQuestions: wrongRows.map((row) => ({
 index: row.index + 1,
 type: row.question.type,
 typeLabel: TYPE_LABEL_MAP[row.question.type],
 content: row.question.content,
 options: row.question.options,
 userSelectedIndex: row.selected,
 userSelectedText: row.question.options[row.selected] || "",
 answerIndex: row.question.answer,
 answerText: row.question.options[row.question.answer] || "",
 explanation: row.question.explanation,
 dynasty: row.question.dynasty || null,
 theme: row.question.theme || null,
 keywordTags: row.question.keywordTags || [],
 })),
 };

 const base = `${buildSafeFileToken(topic)}_wrongbook_${Date.now()}`;
 downloadTextFile(`${base}.json`, JSON.stringify(payload, null, 2));
 downloadTextFile(`${base}.md`, buildWrongOnlyMarkdown(topic, wrongRows));
 };

 useEffect(() => {
 if (!isGraphComparePractice || !isFinished) {
 return;
 }
 const fingerprint = `${topic}|${summary.attempts}|${summary.correct}|${summary.accuracy}|${compareTypeSummary
 .map((row) => `${row.type}:${row.attempts}:${row.correct}:${row.rate}`)
 .join(";")}`;
 if (savedSummaryRef.current === fingerprint) {
 return;
 }
 savedSummaryRef.current = fingerprint;

 const summaryText = weakestCompareType
 ? `对比练习完成：共 ${summary.attempts} 题，正确率 ${summary.accuracy}%，最弱题型为${TYPE_LABEL_MAP[weakestCompareType.type]}。`
 : `对比练习完成：共 ${summary.attempts} 题，正确率 ${summary.accuracy}%。`;

 void apiPost("/practice/session-summary", {
 source: "graph_compare",
 topic,
 summary: summaryText,
 attempts: summary.attempts,
 correct: summary.correct,
 accuracy: summary.accuracy,
 weakType: weakestCompareType ? weakestCompareType.type : null,
 typeStats: compareTypeSummary.map((item) => ({
 type: item.type,
 attempts: item.attempts,
 correct: item.correct,
 rate: item.rate,
 })),
 }).catch(() => {
 // Keep practice flow smooth even when summary log persistence fails.
 });
  }, [isGraphComparePractice, isFinished, topic, summary.attempts, summary.correct, summary.accuracy, compareTypeSummary, weakestCompareType]);

  useEffect(() => {
  if (!isFinished || !lessonTaskId) {
  return;
  }
  const key = `${lessonTaskId}:${summary.attempts}:${summary.correct}:${summary.accuracy}`;
  if (lessonTaskCompletionRef.current === key) {
  return;
  }
  lessonTaskCompletionRef.current = key;
  void updateLessonTaskStatus(lessonTaskId, "completed")
  .then(() => {
  setLessonTaskStatusMessage("课堂任务已同步为已完成。");
  })
  .catch((error: unknown) => {
  setLessonTaskStatusMessage(error instanceof Error ? `课堂任务完成状态同步失败：${error.message}` : "课堂任务完成状态同步失败。");
  });
  }, [isFinished, lessonTaskId, summary.accuracy, summary.attempts, summary.correct]);

 return (
 <div className="page-shell">
 <PageStage tone="primary">
      <ContextBanner />
 <LearnJourneyProgress className="mb-4" />
 <TeachingStepBar currentIndex="04" />
 {isTeacherMode ? (
 <TeachingObjectiveCard
 variant="panel"
 kicker="教师目标提示"
 title={practiceObjective.title}
 summary={practiceObjective.summary}
 goals={practiceObjective.goals}
 chipLabel="当前阶段 · 练测评估"
 hint={practiceObjective.teacherHint}
 className="mb-4 shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
 />
 ) : null}
	 <PageHeader
	 variant="standard"
	 kicker="练测评估"
	 title="统一练习、测评与后续记忆入口"
	 subtitle="保留练习场核心流程，并在统一入口下补齐教师提示与教学评价表达。"
	 actions={
 sourceBadge || graphCompareBackLink ? (
 <div className="flex flex-wrap items-center gap-2">
 {sourceBadge ? (
 <span className="rounded-full shadow-[inset_0_0_0_1px_rgba(26,43,76,0.22)] bg-ink-50 px-3 py-1 text-xs text-ink-700">{sourceBadge}</span>
 ) : null}
 {graphCompareBackLink ? (
 <Link
 to={graphCompareBackLink}
 className="rounded-full shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
 >
 返回图谱继续对比
 </Link>
 ) : null}
 </div>
 ) : null
 }
 />
 </PageStage>

 <PageStage tone="secondary">
	 <SectionCard
	 title="AI 推荐今日任务"
	 subtitle="先用统一入口决定当前要做的是练习、阶段测评，还是记忆训练。"
	 weight="workspace"
	 density="roomy"
	 >
	 <div className="flex flex-col gap-4">
	 {isTeacherMode && teacherHint ? (
	 <TeacherHintCallout
	 title={teacherHint.title}
	 detail={teacherHint.detail}
	 action={
	 <Link to={practiceTeacherCue.ctaTo} className="btn-primary-compact justify-center">
	 {practiceTeacherCue.ctaLabel}
	 </Link>
	 }
	 />
	 ) : null}
	 <div className="rounded-2xl bg-[linear-gradient(135deg,#FFF9EE_0%,#F3E7CE_100%)] px-4 py-4 text-sm leading-7 text-[#4A3720] shadow-[0_8px_22px_rgba(34,58,94,0.05)]">
	 基于当前学情，建议先完成 5 道 {topic || "当前诗词"} 的重点巩固题，再进入阶段测评或记忆复习。
	 </div>
	 {isTeacherMode ? (
	 <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
	 {practiceTeacherCue.distribution.map((item) => (
	 <div
	 key={item.label}
	 className="rounded-2xl bg-white px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]"
	 >
	 <p className="learn-goal-kicker">{item.label}</p>
	 <p className="mt-2 font-serif text-2xl text-[#1A2B4C]">{item.value}</p>
	 <p className="mt-2 text-xs leading-6 text-slate-500">{practiceTeacherCue.detail}</p>
	 </div>
	 ))}
	 </div>
	 ) : null}
	 <PillNav items={EVALUATION_ENTRY_ITEMS} value={evaluationEntryTab} onChange={switchEvaluationTab} />
	 <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
	 <div className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
	 <p className="learn-goal-kicker">专项练习</p>
	 <p className="mt-2 text-sm leading-7 text-slate-600">当前诗词、题型与难度都在这一页完成配置和作答，适合课堂即时巩固。</p>
	 </div>
	 <div className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
	 <p className="learn-goal-kicker">模拟考试</p>
	 <p className="mt-2 text-sm leading-7 text-slate-600">统一入口下选择中考、高考或自定义模式，再进入考试中心完成计时测评。</p>
	 </div>
	 <div className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
	 <p className="learn-goal-kicker">记忆训练</p>
	 <p className="mt-2 text-sm leading-7 text-slate-600">把练测中暴露的薄弱诗句接到间隔复习队列，形成长期记忆闭环。</p>
	 </div>
	 </div>
	 </div>
	 </SectionCard>
 </PageStage>

 {evaluationEntryTab === "practice" ? (
 <WorkspaceLayout
 preset="editor"
 colsClassName="xl:grid-cols-[400px_1fr]"
 aside={
 <section className="task-card flow-md">
 <h2 className="panel-title">练习配置</h2>
 <p className="text-sm text-slate-500">设置主题、题量、难度和题型。</p>

 <label className="block">
 <span className="mb-1 block text-sm text-slate-700">诗词 / 主题</span>
 <input
 value={topic}
 onChange={(event) => setTopic(event.target.value)}
 placeholder="例如：静夜思、送别诗、边塞诗"
 className="input-main w-full"
 />
 </label>

 <div className="grid grid-cols-2 gap-3">
 <label className="block">
 <span className="mb-1 block text-sm text-slate-700">题量</span>
 <select
 value={count}
 onChange={(event) => setCount(Number(event.target.value))}
 className="input-main w-full"
 >
 <option value={5}>5 题</option>
 <option value={8}>8 题</option>
 <option value={10}>10 题</option>
 <option value={15}>15 题</option>
 </select>
 </label>

 <label className="block">
 <span className="mb-1 block text-sm text-slate-700">难度</span>
 <select
 value={difficulty}
 onChange={(event) => setDifficulty(event.target.value as PracticeDifficulty)}
 className="input-main w-full"
 >
 <option value="easy">基础</option>
 <option value="medium">中等</option>
 <option value="hard">进阶</option>
 </select>
 </label>
 </div>

 <div>
 <span className="mb-2 block text-sm text-slate-700">题型导航</span>
 <PillNav items={TYPE_NAV_ITEMS} value={selectedTypeNavValue} onChange={handleTypeNavChange} className="w-full" />
 <div className="mt-3 grid grid-cols-1 gap-2">
 {QUESTION_TYPE_OPTIONS.map((item) => {
 const active = selectedTypes.includes(item.value);
 return (
 <SpotlightCard
 key={item.value}
 className={[
 "rounded-2xl px-3 py-3 shadow-[0_4px_16px_rgba(26,43,76,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(26,43,76,0.08)]",
 active ? "bg-[linear-gradient(132deg,rgba(26,43,76,0.9),rgba(45,69,114,0.9))] text-white" : "bg-white/90 text-slate-700",
 ].join(" ")}
 spotlightColor="rgba(26,43,76,0.08)"
 >
 <div className="flex items-center gap-3">
 <span
 className={[
 "inline-flex h-8 w-8 items-center justify-center rounded-full",
 active ? "bg-white/20 text-white" : "bg-stone-100 text-[#1A2B4C]",
 ].join(" ")}
 >
 {item.icon}
 </span>
 <div>
 <p className={["font-sans text-sm", active ? "text-white" : "text-slate-700"].join(" ")}>{item.label}</p>
 <p className={["font-sans text-xs", active ? "text-white/80" : "text-slate-500"].join(" ")}>{item.description}</p>
 </div>
 </div>
 </SpotlightCard>
 );
 })}
 </div>
 </div>

 <SpotlightCard
 className="rounded-2xl bg-[color:var(--paper-elevated)] px-3 py-3 shadow-[0_4px_16px_rgba(26,43,76,0.05)]"
 spotlightColor="rgba(201,169,110,0.12)"
 >
 <p className="text-xs text-slate-500">推荐主题</p>
 <div className="mt-2 flex flex-wrap gap-2">
 {recommendedTopics.map((item) => (
 <button
 key={`recommend-${item}`}
 type="button"
 onClick={() => {
 setTopic(item);
 }}
 className="rounded-full px-3 py-1 text-xs transition hover:-translate-y-0.5 hover:bg-stone-50 shadow-[0_3px_12px_rgba(26,43,76,0.06)]"
                        style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}
 >
 {item}
 </button>
 ))}
 </div>
 </SpotlightCard>

 <div className="toolbar-surface flex flex-wrap gap-2 text-xs text-slate-600">
 <span className="surface-chip">主题：{topic.trim() || "未设置"}</span>
 <span className="surface-chip">题量：{count} 题</span>
 <span className="surface-chip">难度：{difficulty === "hard" ? "进阶" : difficulty === "medium" ? "中等" : "基础"}</span>
 <span className="surface-chip">题型：{selectedTypeSummary}</span>
 </div>

 <Magnet className="w-full">
 <button
 type="button"
 onClick={() => {
 void handleGenerate();
 }}
 disabled={isGenerating}
 className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
 >
 {isGenerating ? "生成中..." : `生成 ${count} 道题并开始作答`}
 </button>
 </Magnet>

 {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
 </section>
 }
 >
 <SectionCard
 className="result-card"
 weight="workspace"
 title={practiceWorkspaceTitle}
 subtitle={practiceWorkspaceSubtitle}
 bodyClassName="flow-md"
 actions={
 questions.length > 0 || summary.attempts > 0 ? (
 <div className="flex flex-wrap items-center gap-2">
 <div className="segmented-tabs">
 <button
 type="button"
 onClick={() => setPracticeWorkspaceView("session")}
 className={["segmented-tab", practiceWorkspaceView === "session" ? "segmented-tab-active" : ""].join(" ")}
 >
 当前练习
 </button>
 <button
 type="button"
 onClick={() => setPracticeWorkspaceView("review")}
 className={["segmented-tab", practiceWorkspaceView === "review" ? "segmented-tab-active" : ""].join(" ")}
 >
 复盘与导出
 </button>
 </div>
 <span className="rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-700">
 {summary.attempts > 0 ? `已作答${summary.attempts} 题 · 正确率${summary.accuracy}%` : "生成后进入作答"}
 </span>
 </div>
 ) : (
 <span className="rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-700">
 预计耗时 {estimatedMinutes} 分钟
 </span>
 )
 }
 >
 <div className="toolbar-surface flow-sm">
 <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
 {["1 生成题", "2 作答", "3 看反馈", "4 错题复盘"].map((label, index) => {
 const stepIndex = isGenerating ? 0 : questions.length === 0 ? 0 : isFinished ? 2 : 1;
 const reached = index <= stepIndex;
 return (
 <div
 key={`practice-loop-${label}`}
 className={[
 "rounded-lg px-2 py-2 text-center text-xs transition",
 reached ? "bg-ink-50 text-ink-700 shadow-[0_4px_12px_rgba(26,43,76,0.08)]" : "bg-white text-slate-500 shadow-[0_2px_10px_rgba(26,43,76,0.05)]",
 ].join(" ")}
 >
 {label}
 </div>
 );
 })}
 </div>
 <div className="h-1.5 rounded-full bg-stone-200">
 <div
 className="h-1.5 rounded-full bg-[linear-gradient(90deg,#1A2B4C,#C9A96E)] transition-all duration-500"
 style={{
 width: `${
 Math.round(
 (((isGenerating ? 0 : questions.length === 0 ? 0 : isFinished ? 2 : 1) + 1) / 4) * 100,
 )
 }%`,
 }}
 />
 </div>
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
 <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[0_2px_10px_rgba(26,43,76,0.05)]">{practiceWorkspaceStatus}</p>
 <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[0_2px_10px_rgba(26,43,76,0.05)]">
 {practiceLoopStepLabel} 路 {practiceLoopHint}
 </p>
 </div>
 </div>

 {practiceWorkspaceView === "session" ? (
 <>
 {!isGenerating && questions.length > 0 ? (
 <section className="toolbar-surface flex flex-wrap items-center justify-between gap-2">
 <p className="text-xs text-slate-600">当前题集 {questions.length} 题 · 已作答 {summary.attempts} 题 · 正确率 {summary.accuracy}%</p>
 <button
 type="button"
 onClick={() => {
 setPracticeWorkspaceView("session");
 resetPractice();
 }}
 className="btn-secondary-compact"
 >
 清空当前题集
 </button>
 </section>
 ) : null}

 {isGenerating ? (
 <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
 {Array.from({ length: 4 }).map((_, index) => (
 <article key={`practice-loading-${index}`} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white p-3 animate-pulse">
 <div className="h-4 w-24 rounded bg-slate-200" />
 <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
 <div className="mt-3 h-3 w-full rounded bg-slate-100" />
 <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
 <div className="mt-3 h-8 w-24 rounded bg-slate-200" />
 </article>
 ))}
 </section>
 ) : null}

 {!isGenerating && questions.length === 0 ? (
 <section className="card-cozy flow-md">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <h3 className="block-title">生成前预览</h3>
 <p className="mt-1 text-sm text-slate-600">确认配置后开始作答。</p>
 </div>
 <span className="rounded-full shadow-[inset_0_0_0_1px_rgba(26,43,76,0.22)] bg-ink-50 px-3 py-1 text-xs text-ink-700">建议节奏 {estimatedMinutes} 分钟</span>
 </div>

 <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
 <article className="workspace-preview-card">
 <p className="text-[11px] text-slate-500">练习主题</p>
 <p className="mt-1 text-sm text-ink-700">{topic.trim() || "未设置主题"}</p>
 </article>
 <article className="workspace-preview-card">
 <p className="text-[11px] text-slate-500">知识覆盖</p>
 <p className="mt-1 text-sm text-ink-700">{selectedTypeSummary}</p>
 </article>
 <article className="workspace-preview-card">
 <p className="text-[11px] text-slate-500">建议节奏</p>
 <p className="mt-1 text-sm text-ink-700">
 {count} 题 · {difficulty === "hard" ? "进阶" : difficulty === "medium" ? "中等" : "基础"}
 </p>
 </article>
 </div>

 <div className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white px-3 py-3">
 <p className="text-xs text-slate-500">默认下一步</p>
 {summary.attempts > 0 ? (
 <p className="mt-1 text-sm text-slate-700">
 最近一轮：{summary.attempts} 题，正确率 {summary.accuracy}%{weakestTypeLabel ? `，薄弱题型 ${weakestTypeLabel}` : ""}。
 </p>
 ) : (
 <p className="mt-1 text-sm text-slate-600">先完成一轮建立基线。</p>
 )}
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => {
 void handleGenerate();
 }}
 className="btn-secondary-compact"
 >
 立即生成一组题
 </button>
 <Link to="/my-learning?tab=wrongbook" className="btn-secondary-compact">
 查看错题本
 </Link>
 </div>
 </section>
 ) : null}

 {!isGenerating && currentQuestion && !isFinished ? (
 <section className="flow-sm">
 <section className="surface-card card-dense">
 <div className="flex items-center justify-between">
 <h3 className="block-title">当前作答</h3>
 <span className="text-xs text-slate-500">
 第{currentIndex + 1}/{questions.length}题
 </span>
 </div>
 </section>
 <QuestionCard
 question={currentQuestion}
 index={currentIndex}
 total={questions.length}
 poemTitle={topic}
 practiceSourceKey={sourceMetricKey}
 onSubmitAnswer={submitAnswer}
 onNext={nextQuestion}
 onRetrySamePoint={() => handleRetrySamePoint()}
 />
 </section>
 ) : null}

 {!isGenerating && isFinished ? (
 <section className="card-roomy space-y-5">
 <div>
 <h3 className="font-display text-3xl text-ink-700">练习完成</h3>
 <p className="mt-3 text-slate-600">
 共作答{summary.attempts}题，答对 {summary.correct} 题，正确率{" "}
 <BlurText as="span" className="font-semibold text-[#1A2B4C]" text={`${summary.accuracy}%`} delayPerChar={0.03} />
 </p>
  <p className="mt-2 text-sm text-slate-600">基于本轮结果，建议优先处理错题并衔接复习计划。</p>
  {lessonTaskStatusMessage ? (
  <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-800 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.22)]">
  {lessonTaskStatusMessage}
  </p>
  ) : null}
  </div>

 {wrongSessionBreakdown.totalWrong > 0 ? (
 <div>
 <p className="text-xs tracking-[0.12em] text-slate-500">错题分析</p>
 <div className="mt-2 grid gap-3 md:grid-cols-2">
 {wrongSessionBreakdown.rows.map((row) => (
 <TiltedCard key={row.type} maxTiltDeg={5} className="h-full">
 <article className="h-full rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
 <p className="text-sm font-medium text-[#1A2B4C]">{row.label}</p>
 <p className="mt-2 font-serif text-3xl text-[#1A2B4C]">
 ×{row.count}
 </p>
 <p className="mt-1 text-xs text-slate-500">本轮该题型错题条数</p>
 </article>
 </TiltedCard>
 ))}
 </div>
 </div>
 ) : (
 <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.22)]">本轮全部答对，可直接进入图谱拓展关联或再做一组巩固。</p>
 )}

 <section className="rounded-2xl bg-gradient-to-r from-slate-50 to-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16)]">
 <p className="text-xs tracking-[0.14em] text-slate-500">下一步推荐</p>
 <p className="mt-2 text-sm leading-7 text-slate-700">
 错题会在作答过程中自动收录；也可前往错题本集中复盘，并生成复习计划针对薄弱题型。
 </p>
 <div className="mt-4 grid gap-3 md:grid-cols-2">
 <TiltedCard maxTiltDeg={6} className="h-full">
 <article className="flex h-full flex-col justify-between rounded-2xl bg-white px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
 <div>
 <p className="text-sm font-semibold text-[#1A2B4C]">加入错题本</p>
 <p className="mt-2 text-xs leading-6 text-slate-600">
 已自动收录 {wrongSessionBreakdown.totalWrong} 道错题（可在错题本查看与筛选）。
 </p>
 </div>
 <Magnet className="mt-4 inline-flex">
 <Link to="/my-learning?tab=wrongbook" className="btn-primary-compact justify-center">
 查看错题本
 </Link>
 </Magnet>
 </article>
 </TiltedCard>
 <TiltedCard maxTiltDeg={6} className="h-full">
 <article className="flex h-full flex-col justify-between rounded-2xl bg-white px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
 <div>
 <p className="text-sm font-semibold text-[#1A2B4C]">生成复习计划</p>
 <p className="mt-2 text-xs leading-6 text-slate-600">在学情中心查看计划任务并针对薄弱题型安排巩固。</p>
 </div>
 <Magnet className="mt-4 inline-flex">
 <Link to="/my-learning?tab=plan" className="btn-secondary-compact justify-center">
 去复习计划
 </Link>
 </Magnet>
 </article>
 </TiltedCard>
 </div>
 <div className="mt-4 flex flex-wrap gap-2">
 <Magnet className="inline-flex">
 <Link to={practiceGraphHref} className="btn-secondary-compact justify-center">
 进入图谱关联
 </Link>
 </Magnet>
 <button type="button" onClick={() => setPracticeWorkspaceView("review")} className="btn-secondary-compact">
 进入复盘工作区
 </button>
 <button
 type="button"
 onClick={() => {
 setPracticeWorkspaceView("session");
 resetPractice();
 }}
 className="btn-secondary-compact"
 >
 重新开始
 </button>
 <button
 type="button"
 onClick={() => {
 void handleGenerate();
 }}
 className="btn-secondary-compact"
 >
 再来一组
 </button>
 </div>
 </section>

 {isGraphComparePractice ? (
 <article className="mt-5 rounded-lg shadow-[inset_0_0_0_1px_rgba(26,43,76,0.16)] bg-ink-50 p-4">
 <h4 className="text-sm text-ink-700">图谱对比小结</h4>
 <p className="mt-1 text-xs text-slate-600">
 {weakestCompareType
 ? `当前最弱题型：${TYPE_LABEL_MAP[weakestCompareType.type]}，${weakestCompareType.correct}/${weakestCompareType.attempts}，正确率 ${weakestCompareType.rate}%`
 : "暂无可分析数据，请先完成至少 1 题作答。"}
 </p>
 {compareTypeSummary.length > 0 ? (
 <div className="mt-2 flex flex-wrap gap-2">
 {compareTypeSummary.map((item) => (
 <span
 key={`compare-type-${item.type}`}
 className="rounded-full shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white px-2 py-1 text-[11px] text-slate-700"
 >
 {TYPE_LABEL_MAP[item.type]} {item.correct}/{item.attempts}，{item.rate}%
 </span>
 ))}
 </div>
 ) : null}
 {graphCompareBackLink ? (
 <div className="mt-3">
 <Link
 to={graphCompareBackLink}
 className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
 >
 返回图谱继续对比
 </Link>
 </div>
 ) : null}
 </article>
 ) : null}
 </section>
 ) : null}
 </>
 ) : null}

 {practiceWorkspaceView === "review" ? (
 <>
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <h2 className="font-display text-2xl text-ink-700">复盘与导出</h2>
 <p className="text-xs text-slate-500">按标签查看诊断或导出。</p>
 </div>
 <button type="button" onClick={() => setPracticeWorkspaceView("session")} className="btn-secondary-compact">
 返回当前练习
 </button>
 </div>

 <div className="segmented-tabs">
 {secondaryTabOptions.map((tab) => (
 <button
 key={tab.value}
 type="button"
 onClick={() => setSecondaryTab(tab.value)}
 className={[
 "segmented-tab min-w-[96px]",
 secondaryTab === tab.value ? "segmented-tab-active" : "hover:text-ink-700",
 ].join(" ")}
 >
 {tab.label}
 </button>
 ))}
 </div>

 {secondaryTab === "export" ? (
 <section className="flow-sm rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white p-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h4 className="block-title">导出与回看</h4>
 <span className="text-xs text-slate-500">{canExport ? "可导出当前题集" : "生成后可导出"}</span>
 </div>
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
 <button
 type="button"
 onClick={handleExportJson}
 disabled={!canExport}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
 >
 导出 JSON
 </button>
 <button
 type="button"
 onClick={handleExportMarkdown}
 disabled={!canExport}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
 >
 导出 Markdown
 </button>
 <button
 type="button"
 onClick={handleExportWrongOnly}
 disabled={!answers.some((item) => !item.isCorrect)}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
 >
 导出错题集
 </button>
 </div>
 <div className="flex flex-wrap gap-2">
 <Link to="/my-learning?tab=wrongbook" className="btn-secondary-compact">
 查看错题本
 </Link>
 <Link to="/practice?entry=exam" className="btn-secondary-compact">
 去考试中心
 </Link>
 </div>
 </section>
 ) : null}

 {secondaryTab === "diagnosis" ? (
 <>
 <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
<Suspense fallback={<WorkspaceLazyFallback label="薄弱诊断" />}>
<WeaknessRadar />
</Suspense>
 <section className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white p-3">
 <h4 className="block-title">题型表现</h4>
 <p className="mt-1 text-xs text-slate-500">按正确率从低到高排序。</p>
 {compareTypeSummary.length === 0 ? (
 <p className="mt-4 text-sm text-slate-500">完成作答后显示统计。</p>
 ) : (
 <div className="mt-4 flow-sm">
 {compareTypeSummary.map((item) => (
 <article key={`perf-${item.type}`} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-slate-50/70 p-3">
 <div className="flex items-center justify-between text-sm">
 <span className="text-ink-700">{TYPE_LABEL_MAP[item.type]}</span>
 <span className="text-slate-600">
 {item.correct}/{item.attempts} 路 {item.rate}%
 </span>
 </div>
 <div className="mt-2 h-2 rounded-full bg-slate-200">
 <div className="h-full rounded-full bg-ink-600 transition-all" style={{ width: `${Math.max(4, Math.min(100, item.rate))}%` }} />
 </div>
 </article>
 ))}
 </div>
 )}
 </section>
 </div>

 <NextStepRecommendations
 title="本轮练测后的推荐动作"
 subtitle="让练测结果自然流向错题、复习计划、图谱和记忆，不停在结果页。"
 items={[
 {
 title: "回到错题本",
 description: `本轮错题 ${wrongSessionBreakdown.totalWrong} 道，建议先在错题本集中筛选与复盘。`,
 to: "/my-learning?tab=wrongbook",
 ctaLabel: "看错题",
 badge: "优先",
 },
 {
 title: "生成复习计划",
 description: "把本轮薄弱题型转成未来几天的复习动作，避免只做题不回流。",
 to: "/my-learning?tab=plan",
 ctaLabel: "看计划",
 badge: "收束",
 },
 {
 title: "去记忆训练巩固",
 description: topic ? `围绕「${topic}」做一轮记忆打卡，把错因相关诗句稳定记住。` : "进入记忆训练中心，把薄弱诗句加入复习队列。",
 to: `/practice?entry=memory&from=practice&topic=${encodeURIComponent(topic || "")}`,
 ctaLabel: "去记忆",
 badge: "巩固",
 },
 {
 title: "进入知识图谱",
 description: "如果错因集中在题材、意象或诗人关系，就去图谱里补结构化理解。",
 to: practiceGraphHref,
 ctaLabel: "去图谱",
 badge: "拓展",
 },
 ]}
 className="mt-4"
 />
 </>
 ) : null}
 </>
 ) : null}
 </SectionCard>
      </WorkspaceLayout>
    ) : evaluationEntryTab === "exam" ? (
      <PageStage tone="detail">
        <Suspense fallback={<WorkspaceLazyFallback label="考试中心" />}>
          <ExamWorkspace />
        </Suspense>
      </PageStage>
    ) : evaluationEntryTab === "memory" ? (
      <PageStage tone="detail">
        <MemoryTabContent />
      </PageStage>
    ) : null}
  </div>
);
}

