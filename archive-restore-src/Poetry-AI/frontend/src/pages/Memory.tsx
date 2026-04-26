import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Compass, Flame, Layers3, Sparkles, Star } from "lucide-react";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { NextStepRecommendations } from "@/components/common/NextStepRecommendations";
import { PageHeader } from "@/components/common/PageHeader";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { useTeachingMode } from "@/contexts/TeachingModeContext";
import { apiGet, apiPost } from "@/lib/api";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { VirtualizedList } from "@/components/common/VirtualizedList";
import { teacherHintItems } from "@/content/teachingStatic";
import { BlurText, Magnet, PillNav, SpotlightCard, type PillNavItem, TiltedCard } from "@/components/react-bits";
import type {
  MemoryAchievement,
  MemoryReviewItem,
  MemoryStatsEnvelope,
  MemoryTodayEnvelope,
  PaginationMeta,
  PoemRecord,
} from "@/types";

import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";

const qualityOptions: Array<{ value: number; label: string; tone: string }> = [
  { value: 1, label: "忘记了", tone: "bg-red-50 text-red-700 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.2)]" },
  { value: 2, label: "较模糊", tone: "bg-orange-50 text-orange-700 shadow-[inset_0_0_0_1px_rgba(251,146,60,0.2)]" },
  { value: 3, label: "一般", tone: "bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.2)]" },
  { value: 4, label: "熟练", tone: "bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.2)]" },
  { value: 5, label: "非常熟", tone: "bg-green-50 text-green-700 shadow-[inset_0_0_0_1px_rgba(74,222,128,0.2)]" },
];

interface PoemSearchResponse {
  items: PoemRecord[];
}

interface MemoryTodayResponse extends MemoryTodayEnvelope {
  pagination?: PaginationMeta;
}

interface DrillPair {
  prompt: string;
  answer: string;
}

interface BlankQuestion {
  masked: string;
  answer: string;
  fullLine: string;
  hint: string;
}

type DrillMode = "next_line" | "blank" | "full_text" | "dictation";
type QueueWorkspaceView = "focus" | "manage";
type MemoryInsightTab = "achievements" | "all_achievements" | "recent";
type MemoryDetailTab = "review" | "add" | "insight";
type MemoryWorkspaceStage = "queue" | "detail";

interface DrillBaseState {
  memoryId: string;
  mode: DrillMode;
  startedAt: number;
  input: string;
  hintLevel: number;
  hintUsed: boolean;
  hintUsedCount: number;
  finished: boolean;
  accuracy: number;
  recommendedQuality: number;
  spentSeconds: number;
  feedback?: string;
}

interface NextLineDrillState extends DrillBaseState {
  mode: "next_line";
  pairs: DrillPair[];
  index: number;
  correctCount: number;
}

interface BlankDrillState extends DrillBaseState {
  mode: "blank";
  questions: BlankQuestion[];
  index: number;
  correctCount: number;
}

interface FullTextDrillState extends DrillBaseState {
  mode: "full_text";
  targetText: string;
}

interface DictationDrillState extends DrillBaseState {
  mode: "dictation";
  targetText: string;
  playbackRate: number;
}

type DrillState = NextLineDrillState | BlankDrillState | FullTextDrillState | DictationDrillState;

const memoryModeLabelMap: Record<string, string> = {
  self_check: "自评",
  next_line: "上句接下句",
  blank: "逐句填空",
  full_text: "全文默写",
  dictation: "听写",
};

const achievementTierClassMap: Record<string, string> = {
  bronze: "bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]",
  silver: "bg-slate-50 text-slate-700 shadow-[inset_0_0_0_1px_rgba(100,116,139,0.18)]",
  gold: "bg-yellow-50 text-yellow-700 shadow-[inset_0_0_0_1px_rgba(202,138,4,0.2)]",
  platinum: "bg-cyan-50 text-cyan-700 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.2)]",
};

const memoryTeachingObjective = {
  title: "记忆训练目标",
  summary: "通过嵌入式填空、间隔重复和默写训练，实现长期记忆留存。",
  goals: [
    "完成今日复习队列中的诗词",
    "对薄弱诗句做针对性填空练习",
    "达到 80% 以上正确率后进入下一首",
  ],
  teacherHint: "建议课堂内只做 2-3 个短句填空，确认掌握后再进入全文默写。",
};

const queueWorkspaceNavItems: readonly PillNavItem<QueueWorkspaceView>[] = [
  { id: "focus", label: "专注复习", icon: <Flame className="h-3.5 w-3.5" /> },
  { id: "manage", label: "筛选与分页", icon: <Layers3 className="h-3.5 w-3.5" /> },
];

const detailTabNavItems: readonly PillNavItem<MemoryDetailTab>[] = [
  { id: "review", label: "复习入口", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "add", label: "加入记忆", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "insight", label: "复盘成就", icon: <Compass className="h-3.5 w-3.5" /> },
];

const insightTabNavItems: readonly PillNavItem<MemoryInsightTab>[] = [
  { id: "achievements", label: "摘要成就" },
  { id: "all_achievements", label: "全部成就" },
  { id: "recent", label: "最近打卡" },
];

function toPercent(rate: number | undefined): number {
  if (typeof rate !== "number") {
    return 0;
  }
  return Math.round(rate * 100);
}

function isDueToday(dueDate: string | undefined, today: string | undefined): boolean {
  if (!dueDate || !today) {
    return false;
  }
  return dueDate <= today;
}

function buildPracticeLink(title: string): string {
  const params = new URLSearchParams();
  params.set("topic", title);
  params.set("count", "5");
  params.set("difficulty", "medium");
  params.set("auto", "1");
  return `/practice?${params.toString()}`;
}

function normalizeCompareText(text: string): string {
  return text.replace(/[\s，。！？；：、“”‘’（）()《》【】,.!?;:'"\-]/g, "").trim().toLowerCase();
}

function splitSegments(content: string): string[] {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "")
    .split(/[，。！？；]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function splitLinesWithPunctuation(content: string): string[] {
  const compact = content.replace(/\r\n/g, "\n").replace(/\n/g, "");
  const lines = compact.match(/[^，。！？；]+[，。！？；]?/g) || [];
  return lines.map((line) => line.trim()).filter(Boolean);
}

function shuffleArray<T>(items: T[]): T[] {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function buildDrillPairs(content: string): DrillPair[] {
  const segments = splitSegments(content);
  const pairs: DrillPair[] = [];

  for (let i = 0; i + 1 < segments.length; i += 2) {
    pairs.push({ prompt: segments[i], answer: segments[i + 1] });
  }

  if (pairs.length === 0 && segments.length >= 2) {
    for (let i = 0; i + 1 < segments.length; i += 1) {
      pairs.push({ prompt: segments[i], answer: segments[i + 1] });
    }
  }

  return pairs;
}

function buildBlankQuestions(content: string): BlankQuestion[] {
  const lines = shuffleArray(splitLinesWithPunctuation(content)).filter(
    (line) => normalizeCompareText(line).length >= 4,
  );

  return lines.slice(0, 4).map((line) => {
    const normalized = normalizeCompareText(line);
    const hideLen = normalized.length >= 10 ? 3 : 2;
    const maxStart = Math.max(0, normalized.length - hideLen);
    const start = Math.floor(Math.random() * (maxStart + 1));
    const answer = normalized.slice(start, start + hideLen);
    const masked = `${normalized.slice(0, start)}${"＿".repeat(hideLen)}${normalized.slice(start + hideLen)}`;
    const suffix = line.match(/[，。！？；]$/)?.[0] || "";

    return {
      masked: `${masked}${suffix}`,
      answer,
      fullLine: line,
      hint: `提示：共 ${hideLen} 个字，首字为「${answer.charAt(0)}」`,
    };
  });
}

function lcsLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) {
    return 0;
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a.charAt(i - 1) === b.charAt(j - 1)) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function calcTextSimilarity(inputText: string, targetText: string): number {
  const a = normalizeCompareText(inputText);
  const b = normalizeCompareText(targetText);
  if (!a && !b) {
    return 1;
  }
  if (!a || !b) {
    return 0;
  }
  return lcsLength(a, b) / Math.max(a.length, b.length);
}

function qualityByAccuracy(accuracy: number): number {
  if (accuracy >= 0.9) return 5;
  if (accuracy >= 0.75) return 4;
  if (accuracy >= 0.5) return 3;
  if (accuracy >= 0.25) return 2;
  return 1;
}

function qualityWithHintPenalty(accuracy: number, hintUsedCount: number): number {
  const base = qualityByAccuracy(accuracy);
  if (hintUsedCount <= 0) {
    return base;
  }
  if (hintUsedCount <= 2) {
    return Math.max(1, base - 1);
  }
  return Math.max(1, base - 2);
}

function achievementProgressPercent(item: MemoryAchievement): number {
  if (!item.target || item.target <= 0) {
    return item.unlocked ? 100 : 0;
  }
  return Math.max(0, Math.min(100, Math.round((item.progress / item.target) * 100)));
}

function nextLineHintText(answer: string, hintLevel: number): string {
  const normalized = normalizeCompareText(answer);
  if (!normalized) {
    return "暂无提示。";
  }
  if (hintLevel <= 1) {
    return `提示：共 ${normalized.length} 个字，首字为「${normalized.charAt(0)}」。`;
  }
  if (hintLevel === 2) {
    return `提示：首字「${normalized.charAt(0)}」，末字「${normalized.charAt(normalized.length - 1)}」。`;
  }
  return `提示：完整答案「${answer}」。`;
}

function blankHintText(question: BlankQuestion, hintLevel: number): string {
  if (hintLevel <= 1) {
    return question.hint;
  }
  if (hintLevel === 2) {
    return `提示：缺失文字末字为「${question.answer.charAt(question.answer.length - 1)}」。`;
  }
  return `提示：完整句为「${question.fullLine}」。`;
}

function fullTextHintText(targetText: string, hintLevel: number): string {
  const lines = splitLinesWithPunctuation(targetText);
  if (lines.length === 0) {
    return "暂无提示。";
  }
  if (hintLevel <= 1) {
    return `提示1：首句为「${lines[0]}」`;
  }
  if (hintLevel === 2) {
    return `提示2：前两句为「${lines.slice(0, 2).join(" ")}」`;
  }
  return `提示3：全文参考「${targetText}」`;
}

function readTextAloud(text: string, playbackRate = 0.95): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  const content = text.trim();
  if (!content) {
    return false;
  }
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = "zh-CN";
  utterance.rate = Math.max(0.75, Math.min(1.1, playbackRate));
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

function scrollToSection(sectionId: string): void {
  if (typeof document === "undefined") {
    return;
  }
  const element = document.getElementById(sectionId);
  if (!element) {
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

interface HeatmapCell {
  dateKey: string;
  level: number;
  isToday: boolean;
  monthLabel: string;
}

function formatDateKey(input: Date): string {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildHeatmapCells(today: string | undefined, reviewedToday: number, streakDays: number): HeatmapCell[] {
  const totalDays = 84;
  const parsedToday = today ? new Date(`${today}T00:00:00`) : new Date();
  const baseDate = Number.isNaN(parsedToday.getTime()) ? new Date() : parsedToday;
  const dateCells: HeatmapCell[] = [];
  const streakSpan = Math.max(0, Math.min(totalDays, streakDays));

  for (let index = 0; index < totalDays; index += 1) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() - (totalDays - 1 - index));
    const daysToToday = totalDays - 1 - index;
    const isToday = daysToToday === 0;
    const seed = (date.getFullYear() * 31 + (date.getMonth() + 1) * 13 + date.getDate() * 17) % 11;
    let level = seed <= 3 ? 0 : seed <= 5 ? 1 : seed <= 7 ? 2 : 3;

    if (daysToToday < streakSpan) {
      level = Math.max(level, daysToToday < reviewedToday + 1 ? 4 : 3);
    }

    if (isToday) {
      level = reviewedToday > 0 ? 4 : Math.max(level, 1);
    }

    dateCells.push({
      dateKey: formatDateKey(date),
      level: Math.max(0, Math.min(4, level)),
      isToday,
      monthLabel: `${date.getMonth() + 1}月`,
    });
  }

  return dateCells;
}

function masteryPercent(item: MemoryReviewItem): number {
  const successPart = Math.max(0, Math.min(100, Math.round((item.successRate || 0) * 100)));
  const reviewPart = Math.max(0, Math.min(100, Math.round((item.reviewCount / 12) * 100)));
  const factorPart = Math.max(0, Math.min(100, Math.round(((item.easeFactor - 1.3) / 1.6) * 100)));
  return Math.max(0, Math.min(100, Math.round(successPart * 0.62 + reviewPart * 0.25 + factorPart * 0.13)));
}

function masteryLabel(score: number): string {
  if (score >= 85) return "炉火纯青";
  if (score >= 70) return "渐入佳境";
  if (score >= 50) return "稳步推进";
  if (score >= 30) return "初有印象";
  return "待巩固";
}

function masteryTone(score: number): string {
  if (score >= 80) return "bg-[linear-gradient(90deg,#C9A96E,#B68747)]";
  if (score >= 60) return "bg-[linear-gradient(90deg,#A9B5CC,#7289B2)]";
  if (score >= 35) return "bg-[linear-gradient(90deg,#C8D3E4,#9BAEC8)]";
  return "bg-[linear-gradient(90deg,#D5D5D1,#BDBDB7)]";
}

function ProgressRing({ value }: { value: number }): JSX.Element {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative h-40 w-40">
      <svg className="h-40 w-40 -rotate-90" viewBox="0 0 140 140" aria-hidden>
        <circle cx="70" cy="70" r={radius} className="fill-none stroke-white/18" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          className="fill-none stroke-[#C9A96E]"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <p className="font-serif text-4xl text-white">{clamped}%</p>
        <p className="mt-1 text-[11px] font-sans tracking-[0.14em] text-white/70">今日完成度</p>
      </div>
    </div>
  );
}

function MemoryHeatmap({
  cells,
  streakDays,
  reviewedToday,
}: {
  cells: HeatmapCell[];
  streakDays: number;
  reviewedToday: number;
}): JSX.Element {
  const startDate = new Date(cells[0].dateKey);
  const endDate = new Date(cells[cells.length - 1].dateKey);
  
  const values = cells.map(cell => ({
    date: cell.dateKey,
    count: cell.level
  }));

  return (
    <SpotlightCard
      className="rounded-[28px] bg-white/95 p-5 shadow-[0_14px_40px_rgba(26,43,76,0.08)] md:p-6"
      spotlightColor="rgba(26,43,76,0.08)"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-sans tracking-[0.14em] text-slate-400">CONTRIBUTION RHYTHM</p>
          <h2 className="mt-1 font-serif text-2xl text-[#1A2B4C]">记忆打卡热力图</h2>
        </div>
        <div className="rounded-2xl bg-stone-100 px-3 py-2 text-right">
          <p className="text-[11px] font-sans text-slate-500">连续打卡</p>
          <p className="font-serif text-2xl text-[#1A2B4C]">{streakDays} 天</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          <CalendarHeatmap
            startDate={startDate}
            endDate={endDate}
            values={values}
            classForValue={(value) => {
              if (!value) {
                return "color-empty";
              }
              return `color-scale-${Math.min(4, Math.max(1, value.count))}`;
            }}
            titleForValue={(value) => {
              const dayCount = Number(value?.count ?? 0);
              return value?.date ? `${value.date} 活跃度: ${dayCount}/4` : "无数据";
            }}
            showWeekdayLabels={true}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-sans text-slate-500">今日完成 {reviewedToday} 条复习，保持节奏比突击更重要。</p>
      </div>
    </SpotlightCard>
  );
}

function MemoryFlipCard({
  item,
  flipped,
  onToggle,
}: {
  item: MemoryReviewItem;
  flipped: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group relative h-[280px] w-full cursor-pointer rounded-[24px] text-left [perspective:1200px]"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.52, ease: "easeInOut" }}
        className="relative h-full w-full rounded-[24px] [transform-style:preserve-3d]"
      >
        <div className="absolute inset-0 rounded-[24px] bg-[linear-gradient(145deg,#1A2B4C,#2C4A78)] p-5 text-stone-100 shadow-[0_18px_40px_rgba(26,43,76,0.28)] [backface-visibility:hidden]">
          <p className="text-[11px] font-sans tracking-[0.12em] text-stone-200/80">记忆抽认卡 · 正面</p>
          <h3 className="mt-2 font-serif text-3xl leading-tight">{item.poem?.title || "未命名诗词"}</h3>
          <p className="mt-1 text-xs font-sans text-stone-200/75">
            {item.poem?.author || "未知作者"} · {item.poem?.dynasty || "未知朝代"}
          </p>
          <p className="mt-4 text-sm font-sans leading-7 text-stone-200/90">
            先在脑中默背全诗，再轻点翻面查看原文与关键提示。
          </p>
          <p className="absolute bottom-4 right-5 text-xs font-sans text-stone-200/70">点击翻面</p>
        </div>

        <div className="absolute inset-0 rounded-[24px] bg-[#FDFBF7] p-5 shadow-[0_16px_34px_rgba(26,43,76,0.12)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="text-[11px] font-sans tracking-[0.12em] text-slate-400">记忆抽认卡 · 背面</p>
          <BlurText text={item.poem?.content || "暂无诗词正文。"} className="mt-3 line-clamp-6 font-serif text-lg leading-9 text-[#1A2B4C]" />
          <p className="mt-3 text-xs font-sans text-slate-500">
            复习 {item.reviewCount} 次 · 成功率 {toPercent(item.successRate)}% · 间隔 {item.intervalDays} 天
          </p>
        </div>
      </motion.div>
    </button>
  );
}

export default function MemoryPage(): JSX.Element {
  useScrollRestore("memory");
  const { isTeacherMode } = useTeachingMode();

  const [onlyDue, setOnlyDue] = useState<boolean>(true);
  const [activeWorkspace, setActiveWorkspace] = useState<MemoryWorkspaceStage>("queue");
  const [queueWorkspaceView, setQueueWorkspaceView] = useState<QueueWorkspaceView>("focus");
  const [detailTab, setDetailTab] = useState<MemoryDetailTab>("review");
  const [insightTab, setInsightTab] = useState<MemoryInsightTab>("achievements");
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [todayData, setTodayData] = useState<MemoryTodayEnvelope | null>(null);
  const [todayPage, setTodayPage] = useState<number>(1);
  const [todayPageSize, setTodayPageSize] = useState<number>(20);
  const [todayTotal, setTodayTotal] = useState<number>(0);
  const [todayTotalPages, setTodayTotalPages] = useState<number>(1);
  const [statsData, setStatsData] = useState<MemoryStatsEnvelope | null>(null);
  const [loadingToday, setLoadingToday] = useState<boolean>(false);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [keyword, setKeyword] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PoemRecord[]>([]);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const [drill, setDrill] = useState<DrillState | null>(null);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [flipCardOpen, setFlipCardOpen] = useState<boolean>(false);

  const loadToday = async (options?: {
    onlyDue?: boolean;
    page?: number;
    pageSize?: number;
    force?: boolean;
  }): Promise<void> => {
    const targetOnlyDue = options?.onlyDue ?? onlyDue;
    const targetPage = Math.max(1, options?.page ?? todayPage);
    const targetPageSize = Math.max(6, Math.min(100, options?.pageSize ?? todayPageSize));
    const params = new URLSearchParams();
    params.set("onlyDue", targetOnlyDue ? "true" : "false");
    params.set("page", String(targetPage));
    params.set("pageSize", String(targetPageSize));

    setLoadingToday(true);
    setError(null);
    try {
      const data = await apiGet<MemoryTodayResponse>(`/memory/today?${params.toString()}`, {
        cacheTtlMs: 120000,
        force: options?.force,
      });
      setTodayData(data);
      const fallbackTotal = data.items?.length || 0;
      setTodayTotal(Number(data.pagination?.total ?? fallbackTotal));
      setTodayTotalPages(Math.max(1, Number(data.pagination?.totalPages ?? 1)));
      setTodayPage(Number(data.pagination?.page ?? targetPage));
      setTodayPageSize(Number(data.pagination?.pageSize ?? targetPageSize));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载记忆列表失败");
    } finally {
      setLoadingToday(false);
    }
  };

  const loadStats = async (): Promise<void> => {
    setLoadingStats(true);
    try {
      const data = await apiGet<MemoryStatsEnvelope>("/memory/stats");
      setStatsData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载记忆统计失败");
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    void loadToday({
      onlyDue,
      page: todayPage,
      pageSize: todayPageSize,
    });
  }, [onlyDue, todayPage, todayPageSize]);

  useEffect(() => {
    void loadStats();
  }, []);

  const searchPoems = async (): Promise<void> => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const data = await apiGet<PoemSearchResponse>(`/poems/search?q=${encodeURIComponent(trimmed)}&limit=16`);
      setSearchResults(data.items || []);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  };

  const enrollPoem = async (poemId: string): Promise<void> => {
    setEnrollingId(poemId);
    setError(null);
    try {
      await apiPost("/memory/enroll", { poemId });
      await Promise.all([
        loadToday({
          onlyDue,
          page: todayPage,
          pageSize: todayPageSize,
          force: true,
        }),
        loadStats(),
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加入记忆失败");
    } finally {
      setEnrollingId(null);
    }
  };

  const submitReview = async (
    item: MemoryReviewItem,
    quality: number,
    options?: { mode?: string; isCorrect?: boolean; timeSpent?: number },
  ): Promise<void> => {
    setReviewingId(item.id);
    setError(null);
    try {
      await apiPost("/memory/review", {
        memoryId: item.id,
        quality,
        mode: options?.mode ?? "self_check",
        isCorrect: options?.isCorrect,
        timeSpent: options?.timeSpent,
      });
      await Promise.all([
        loadToday({
          onlyDue,
          page: todayPage,
          pageSize: todayPageSize,
          force: true,
        }),
        loadStats(),
      ]);
      if (drill?.memoryId === item.id) {
        setDrill(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "打卡失败");
    } finally {
      setReviewingId(null);
    }
  };

  const startNextLineDrill = (item: MemoryReviewItem): void => {
    const content = item.poem?.content || "";
    const pairs = buildDrillPairs(content);
    if (pairs.length === 0) {
      setDrillError("该诗词暂不适合上句接下句练习，可直接使用下方自评打卡。");
      return;
    }

    setDrillError(null);
    setDrill({
      memoryId: item.id,
      mode: "next_line",
      startedAt: Date.now(),
      pairs,
      index: 0,
      input: "",
      hintLevel: 0,
      hintUsed: false,
      hintUsedCount: 0,
      correctCount: 0,
      finished: false,
      accuracy: 0,
      recommendedQuality: 3,
      spentSeconds: 0,
      feedback: "",
    });
  };

  const startBlankDrill = (item: MemoryReviewItem): void => {
    const content = item.poem?.content || "";
    const questions = buildBlankQuestions(content);
    if (questions.length === 0) {
      setDrillError("该诗词句子过短，暂不适合逐句填空，可改用全文默写。");
      return;
    }

    setDrillError(null);
    setDrill({
      memoryId: item.id,
      mode: "blank",
      startedAt: Date.now(),
      questions,
      index: 0,
      input: "",
      hintLevel: 0,
      hintUsed: false,
      hintUsedCount: 0,
      correctCount: 0,
      finished: false,
      accuracy: 0,
      recommendedQuality: 3,
      spentSeconds: 0,
      feedback: "",
    });
  };

  const startFullTextDrill = (item: MemoryReviewItem): void => {
    const content = item.poem?.content || "";
    if (!normalizeCompareText(content)) {
      setDrillError("该诗词暂无可用正文，暂不支持全文默写。");
      return;
    }

    setDrillError(null);
    setDrill({
      memoryId: item.id,
      mode: "full_text",
      startedAt: Date.now(),
      input: "",
      targetText: content,
      hintLevel: 0,
      hintUsed: false,
      hintUsedCount: 0,
      finished: false,
      accuracy: 0,
      recommendedQuality: 3,
      spentSeconds: 0,
      feedback: "",
    });
  };

  const startDictationDrill = (item: MemoryReviewItem): void => {
    const content = item.poem?.content || "";
    if (!normalizeCompareText(content)) {
      setDrillError("该诗词暂无可用正文，暂不支持听写。");
      return;
    }

    setDrillError(null);
    setDrill({
      memoryId: item.id,
      mode: "dictation",
      startedAt: Date.now(),
      input: "",
      targetText: content,
      playbackRate: 0.95,
      hintLevel: 0,
      hintUsed: false,
      hintUsedCount: 0,
      finished: false,
      accuracy: 0,
      recommendedQuality: 3,
      spentSeconds: 0,
      feedback: "",
    });
  };

  const revealHint = (): void => {
    if (!drill || drill.finished) {
      return;
    }

    const nextHintLevel = Math.min(3, drill.hintLevel + 1);
    const usedIncrement = nextHintLevel > drill.hintLevel ? 1 : 0;
    let hintMessage = "";
    if (drill.mode === "next_line") {
      const current = drill.pairs[drill.index];
      hintMessage = nextLineHintText(current.answer, nextHintLevel);
    } else if (drill.mode === "blank") {
      const current = drill.questions[drill.index];
      hintMessage = blankHintText(current, nextHintLevel);
    } else {
      hintMessage = fullTextHintText(drill.targetText, nextHintLevel);
    }

    setDrill({
      ...drill,
      hintLevel: nextHintLevel,
      hintUsed: true,
      hintUsedCount: drill.hintUsedCount + usedIncrement,
      feedback: hintMessage,
    });
  };

  const submitNextLineAnswer = (): void => {
    if (!drill || drill.mode !== "next_line" || drill.finished) {
      return;
    }

    const current = drill.pairs[drill.index];
    const isCorrect = normalizeCompareText(drill.input) === normalizeCompareText(current.answer);
    const nextCorrect = drill.correctCount + (isCorrect ? 1 : 0);
    const isLast = drill.index >= drill.pairs.length - 1;
    const feedback = isCorrect ? "本题正确。" : `本题正确答案：${current.answer}`;

    if (!isLast) {
      setDrill({
        ...drill,
        index: drill.index + 1,
        input: "",
        hintLevel: 0,
        correctCount: nextCorrect,
        feedback,
      });
      return;
    }

    const accuracy = nextCorrect / drill.pairs.length;
    const spentSeconds = Math.max(1, Math.round((Date.now() - drill.startedAt) / 1000));
    const recommendedQuality = qualityWithHintPenalty(accuracy, drill.hintUsedCount);
    const hintSuffix = drill.hintUsed ? `（本轮共用提示 ${drill.hintUsedCount} 次）` : "";

    setDrill({
      ...drill,
      correctCount: nextCorrect,
      finished: true,
      accuracy,
      recommendedQuality,
      spentSeconds,
      feedback: `${feedback}${hintSuffix}`,
    });
  };

  const submitBlankAnswer = (): void => {
    if (!drill || drill.mode !== "blank" || drill.finished) {
      return;
    }

    const current = drill.questions[drill.index];
    const isCorrect = normalizeCompareText(drill.input) === normalizeCompareText(current.answer);
    const nextCorrect = drill.correctCount + (isCorrect ? 1 : 0);
    const isLast = drill.index >= drill.questions.length - 1;
    const feedback = isCorrect ? "本题正确。" : `本题正确答案：${current.answer}`;

    if (!isLast) {
      setDrill({
        ...drill,
        index: drill.index + 1,
        input: "",
        hintLevel: 0,
        correctCount: nextCorrect,
        feedback,
      });
      return;
    }

    const accuracy = nextCorrect / drill.questions.length;
    const spentSeconds = Math.max(1, Math.round((Date.now() - drill.startedAt) / 1000));
    const recommendedQuality = qualityWithHintPenalty(accuracy, drill.hintUsedCount);
    const hintSuffix = drill.hintUsed ? `（本轮共用提示 ${drill.hintUsedCount} 次）` : "";

    setDrill({
      ...drill,
      correctCount: nextCorrect,
      finished: true,
      accuracy,
      recommendedQuality,
      spentSeconds,
      feedback: `${feedback}${hintSuffix}`,
    });
  };

  const submitFullTextDrill = (): void => {
    if (!drill || drill.mode !== "full_text" || drill.finished) {
      return;
    }

    const accuracy = calcTextSimilarity(drill.input, drill.targetText);
    const spentSeconds = Math.max(1, Math.round((Date.now() - drill.startedAt) / 1000));
    const recommendedQuality = qualityWithHintPenalty(accuracy, drill.hintUsedCount);
    const hintSuffix = drill.hintUsed ? `已使用提示 ${drill.hintUsedCount} 次，` : "";
    const feedback = `${hintSuffix}相似度 ${Math.round(accuracy * 100)}%，建议质量分 ${recommendedQuality}/5。`;

    setDrill({
      ...drill,
      finished: true,
      accuracy,
      recommendedQuality,
      spentSeconds,
      feedback,
    });
  };

  const submitDictationDrill = (): void => {
    if (!drill || drill.mode !== "dictation" || drill.finished) {
      return;
    }

    const accuracy = calcTextSimilarity(drill.input, drill.targetText);
    const spentSeconds = Math.max(1, Math.round((Date.now() - drill.startedAt) / 1000));
    const recommendedQuality = qualityWithHintPenalty(accuracy, drill.hintUsedCount);
    const hintSuffix = drill.hintUsed ? `已使用提示 ${drill.hintUsedCount} 次，` : "";
    const feedback = `${hintSuffix}听写相似度 ${Math.round(accuracy * 100)}%，建议质量分 ${recommendedQuality}/5。`;

    setDrill({
      ...drill,
      finished: true,
      accuracy,
      recommendedQuality,
      spentSeconds,
      feedback,
    });
  };

  const dueItems = useMemo(() => todayData?.items || [], [todayData?.items]);
  const selectedMemoryItem = useMemo(() => dueItems.find((item) => item.id === selectedMemoryId) || null, [dueItems, selectedMemoryId]);
  const activeDrill = useMemo(() => {
    if (!drill || !selectedMemoryItem) {
      return null;
    }
    return drill.memoryId === selectedMemoryItem.id ? drill : null;
  }, [drill, selectedMemoryItem]);
  const nextLineDrill = activeDrill?.mode === "next_line" ? activeDrill : null;
  const blankDrill = activeDrill?.mode === "blank" ? activeDrill : null;
  const fullTextDrill = activeDrill?.mode === "full_text" ? activeDrill : null;
  const dictationDrill = activeDrill?.mode === "dictation" ? activeDrill : null;
  const currentPair = nextLineDrill && !nextLineDrill.finished ? nextLineDrill.pairs[nextLineDrill.index] : null;
  const currentBlank = blankDrill && !blankDrill.finished ? blankDrill.questions[blankDrill.index] : null;
  const summary = statsData?.summary;
  const achievements = useMemo(() => statsData?.achievements || [], [statsData?.achievements]);
  const dueCount = todayData?.totalDue ?? dueItems.length;
  const totalMemoryCount = summary?.total ?? 0;
  const reviewedTodayCount = summary?.reviewedToday ?? 0;
  const overallSuccessRate = toPercent(summary?.successRate);
  const todayMissionCount = Math.max(1, dueCount + reviewedTodayCount);
  const todayProgressPercent = Math.max(0, Math.min(100, Math.round((reviewedTodayCount / todayMissionCount) * 100)));
  const memoryPracticeLink = useMemo(() => buildPracticeLink("古诗词记忆巩固"), []);
  const memoryNextStepItems = useMemo(() => {
    const poemTitle = selectedMemoryItem?.poem?.title?.trim() || "";
    const poemId = selectedMemoryItem?.poemId?.trim() || "";
    const practiceTopic = poemTitle || "记忆巩固专项";

    return [
      {
        title: "回到学情中心",
        description: "把记忆打卡与错题、练测结果、复习计划放到同一视角里复盘，确定下一轮要补的薄弱点。",
        to: "/my-learning?tab=overview&from=memory",
        ctaLabel: "看学情",
        badge: "收束",
      },
      {
        title: "去练测巩固",
        description: poemTitle ? `围绕《${poemTitle}》做一组题，验证记住是否能迁移到答题表达。` : "做一组题，把记住的内容转成可用的答题表达。",
        to: buildPracticeLink(practiceTopic),
        ctaLabel: "去练测",
        badge: "巩固",
      },
      {
        title: poemTitle ? "回到精讲继续解析" : "去精讲选一首诗",
        description: poemTitle ? "回到精讲页把这首诗再走一遍解析/探究，形成“学-记-练”的闭环。" : "从精讲页挑一首诗，先理解再进入记忆与练测。",
        to: poemId ? `/learn/${encodeURIComponent(poemId)}` : "/learn",
        ctaLabel: "去精讲",
        badge: "回讲",
      },
    ] as const;
  }, [selectedMemoryItem]);
  const unlockedAchievementCount = useMemo(
    () => achievements.filter((achievement) => achievement.unlocked).length,
    [achievements],
  );
  const highlightedAchievements = useMemo(() => achievements.slice(0, 3), [achievements]);
  const recentRecords = useMemo(() => (statsData?.recent || []).slice(0, 12), [statsData?.recent]);
  const nearestDueDate = useMemo(() => {
    const dates = dueItems
      .map((item) => String(item.dueDate || "").trim())
      .filter((value) => value.length > 0)
      .sort((a, b) => a.localeCompare(b));
    return dates[0] || "暂无";
  }, [dueItems]);
  const memoryWorkspaceStatus = useMemo(() => {
    if (loadingToday) return "同步中";
    if (drill && !drill.finished) return "练习中";
    if (dueItems.length === 0) return "已清空";
    return "待复习";
  }, [drill, dueItems.length, loadingToday]);
  const heatmapCells = useMemo(
    () => buildHeatmapCells(todayData?.today || statsData?.today, reviewedTodayCount, summary?.streakDays ?? 0),
    [reviewedTodayCount, statsData?.today, summary?.streakDays, todayData?.today],
  );
  const memoryNextAction = useMemo(() => {
    if (loadingToday) {
      return {
        key: "sync" as const,
        title: "正在同步今日复习队列",
        description: "稍等片刻后开始第一条复习，或手动刷新队列。",
        cta: "刷新队列",
      };
    }
    if (dueCount > 0) {
      return {
        key: "review" as const,
        title: "先完成今日到期复习",
        description: `当前有 ${dueCount} 条到期任务，建议从第一条开始并完成至少 1 轮打卡。`,
        cta: "开始今日复习",
      };
    }
    if (totalMemoryCount > 0) {
      return {
        key: "all_items" as const,
        title: "今日到期已清空，转入巩固阶段",
        description: `你已在记忆库中积累 ${totalMemoryCount} 条内容，建议切换到“全部条目”并做一组巩固练习。`,
        cta: "查看全部条目",
      };
    }
    return {
      key: "enroll" as const,
      title: "先添加第一首记忆诗词",
      description: "当前记忆列表为空，先搜索并加入 1 首诗词，系统会自动生成复习节奏。",
      cta: "去添加记忆内容",
    };
  }, [dueCount, loadingToday, totalMemoryCount]);

  const refreshTodayQueue = (force = true): void => {
    void loadToday({
      onlyDue,
      page: todayPage,
      pageSize: todayPageSize,
      force,
    });
  };

  useEffect(() => {
    if (!loadingToday && dueItems.length === 0 && todayTotal > 0 && todayPage > 1) {
      setTodayPage((prev) => Math.max(1, prev - 1));
    }
  }, [loadingToday, dueItems.length, todayTotal, todayPage]);

  useEffect(() => {
    if (dueItems.length === 0) {
      if (selectedMemoryId !== null) {
        setSelectedMemoryId(null);
      }
      return;
    }
    if (selectedMemoryId && dueItems.some((item) => item.id === selectedMemoryId)) {
      return;
    }
    if (selectedMemoryId) {
      setSelectedMemoryId(null);
    }
  }, [dueItems, selectedMemoryId]);

  useEffect(() => {
    setFlipCardOpen(false);
  }, [selectedMemoryId]);

  const openQueueWorkspace = (view: QueueWorkspaceView = "focus"): void => {
    setActiveWorkspace("queue");
    setQueueWorkspaceView(view);
    scrollToSection("memory-workspace");
  };

  const openDetailWorkspace = (tab: MemoryDetailTab, memoryId?: string): void => {
    setActiveWorkspace("detail");
    setDetailTab(tab);
    if (memoryId) {
      setSelectedMemoryId(memoryId);
    }
    scrollToSection("memory-workspace");
  };

  const triggerNextAction = (): void => {
    if (memoryNextAction.key === "review") {
      if (dueItems[0]) {
        openDetailWorkspace("review", dueItems[0].id);
        return;
      }
      openQueueWorkspace("focus");
      return;
    }
    if (memoryNextAction.key === "all_items") {
      setOnlyDue(false);
      setTodayPage(1);
      openQueueWorkspace("focus");
      return;
    }
    if (memoryNextAction.key === "enroll") {
      openDetailWorkspace("add");
      return;
    }
    refreshTodayQueue(true);
  };
  const teacherHint = useMemo(() => teacherHintItems.find((item) => item.page === "memory") || null, []);

  return (
    <div className="page-shell">
      <PageHeader
        variant="compact"
        kicker="Memory Lab"
        title="记忆打卡"
        subtitle="先完成今日复习，再进入队列与详情。"
      />

      <LearnJourneyProgress className="mb-4" />
      {isTeacherMode ? (
        <TeachingObjectiveCard
          variant="panel"
          kicker="教师目标提示"
          title={memoryTeachingObjective.title}
          summary={memoryTeachingObjective.summary}
          goals={memoryTeachingObjective.goals}
          chipLabel="当前阶段 · 记忆训练"
          hint={memoryTeachingObjective.teacherHint}
          className="mb-4 shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
        />
      ) : null}

      {isTeacherMode && teacherHint ? (
        <TeacherHintCallout title={teacherHint.title} detail={teacherHint.detail} />
      ) : null}

      <PageStage tone="primary">
        <SpotlightCard
          className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(130deg,#1A2B4C_0%,#2B4672_50%,#203A63_100%)] p-6 text-stone-100 shadow-[0_22px_56px_rgba(26,43,76,0.28)] md:p-8"
          spotlightColor="rgba(201,169,110,0.2)"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(201,169,110,0.26),transparent_46%)]" />
          <div className="relative z-[2] grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <p className="text-[11px] font-sans tracking-[0.16em] text-stone-200/80">TODAY FOCUS</p>
              <h2 className="font-serif text-4xl leading-tight text-stone-50">{memoryNextAction.title}</h2>
              <p className="max-w-2xl text-sm font-sans leading-7 text-stone-200/85">{memoryNextAction.description}</p>
              <div className="flex flex-wrap gap-2 text-xs font-sans">
                <span className="rounded-full bg-white/12 px-3 py-1 text-stone-100">待复习 {dueCount} 条</span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-stone-100">已打卡 {reviewedTodayCount} 条</span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-stone-100">状态 {memoryWorkspaceStatus}</span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-stone-100">下次到期 {nearestDueDate}</span>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <ProgressRing value={todayProgressPercent} />
            </div>
          </div>
          <Magnet className="relative z-[2] mt-6 inline-flex lg:absolute lg:bottom-8 lg:right-8 lg:mt-0">
            <button
              type="button"
              onClick={triggerNextAction}
              className="rounded-full bg-[#C9A96E] px-6 py-3 font-sans text-sm font-semibold text-[#1A2B4C] shadow-[0_14px_30px_rgba(201,169,110,0.38)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(201,169,110,0.46)]"
            >
              立即开始
            </button>
          </Magnet>
        </SpotlightCard>
      </PageStage>

      <PageStage tone="secondary">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "今日待复习", value: dueCount, suffix: "条" },
            { label: "今日已打卡", value: reviewedTodayCount, suffix: "条" },
            { label: "连续打卡", value: summary?.streakDays ?? 0, suffix: "天" },
            { label: "整体成功率", value: overallSuccessRate, suffix: "%" },
          ].map((metric) => (
            <SpotlightCard
              key={metric.label}
              className="rounded-[22px] bg-white/95 px-5 py-4 shadow-[0_12px_32px_rgba(26,43,76,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_38px_rgba(26,43,76,0.12)]"
              spotlightColor="rgba(26,43,76,0.08)"
            >
              <p className="text-[11px] font-sans tracking-[0.1em] text-slate-400">{metric.label}</p>
              <p className="mt-2 font-serif text-[36px] leading-none text-[#1A2B4C]">
                {metric.value}
                <span className="ml-1 text-base text-[#6B7A95]">{metric.suffix}</span>
              </p>
            </SpotlightCard>
          ))}
        </div>
      </PageStage>

      <PageStage tone="secondary">
        <MemoryHeatmap cells={heatmapCells} streakDays={summary?.streakDays ?? 0} reviewedToday={reviewedTodayCount} />
      </PageStage>

      {activeWorkspace === "queue" ? (
      <PageStage tone="secondary" as="section" id="memory-workspace">
        <section className="surface-card flow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl text-[#1A2B4C]">今日复习队列</h2>
            <p className="mt-1 text-xs text-slate-500">{onlyDue ? "到期优先" : "全部条目"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => openDetailWorkspace("add")} className="btn-secondary-compact">
              加入记忆
            </button>
            <button type="button" onClick={() => openDetailWorkspace("insight")} className="btn-secondary-compact">
              复盘与成就
            </button>
            <PillNav
              items={queueWorkspaceNavItems}
              value={queueWorkspaceView}
              onChange={setQueueWorkspaceView}
              className="bg-stone-200/75"
            />
          </div>
        </div>

        {queueWorkspaceView === "focus" ? (
          <div className="toolbar-surface flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              第 {todayPage}/{todayTotalPages} 页 · 共 {todayTotal} 条 · 今日到期 {todayData?.totalDue ?? 0} 条
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOnlyDue(true);
                  setTodayPage(1);
                }}
                className={["btn-secondary-compact", onlyDue ? "bg-[#F3E7CE] text-ink-700" : ""].join(" ")}
              >
                只看到期
              </button>
              <button
                type="button"
                onClick={() => {
                  setOnlyDue(false);
                  setTodayPage(1);
                }}
                className={["btn-secondary-compact", !onlyDue ? "bg-[#F3E7CE] text-ink-700" : ""].join(" ")}
              >
                查看全部
              </button>
              <button type="button" onClick={() => setQueueWorkspaceView("manage")} className="btn-secondary-compact">
                更多设置
              </button>
              <button type="button" onClick={() => refreshTodayQueue(true)} className="btn-secondary-compact">
                刷新
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-3 shadow-[0_10px_24px_rgba(26,43,76,0.08)] flow-sm">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOnlyDue(true);
                    setTodayPage(1);
                  }}
                  className={["btn-secondary-compact", onlyDue ? "bg-[#F3E7CE] text-ink-700" : ""].join(" ")}
                >
                  仅到期
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOnlyDue(false);
                    setTodayPage(1);
                  }}
                  className={["btn-secondary-compact", !onlyDue ? "bg-[#F3E7CE] text-ink-700" : ""].join(" ")}
                >
                  全部条目
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">每页</span>
                <select
                  value={todayPageSize}
                  onChange={(event) => {
                    setTodayPageSize(Number(event.target.value));
                    setTodayPage(1);
                  }}
                  className="input-main control-dense rounded-lg !px-2 text-xs"
                >
                  <option value={12}>12 / 页</option>
                  <option value={20}>20 / 页</option>
                  <option value={36}>36 / 页</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={todayPage <= 1}
                  onClick={() => setTodayPage((prev) => Math.max(1, prev - 1))}
                  className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  type="button"
                  disabled={todayPage >= todayTotalPages}
                  onClick={() => setTodayPage((prev) => Math.min(todayTotalPages, prev + 1))}
                  className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
                >
                  下一页
                </button>
                <button type="button" onClick={() => refreshTodayQueue(true)} className="btn-secondary-compact">
                  刷新
                </button>
              </div>
            </div>
          </div>
        )}

        {loadingToday ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <article key={`memory-loading-${index}`} className="rounded-2xl bg-white p-3 shadow-[0_10px_24px_rgba(26,43,76,0.08)] animate-pulse">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
                <div className="mt-3 h-3 w-full rounded bg-slate-100" />
                <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
                <div className="mt-3 h-7 w-20 rounded bg-slate-200" />
              </article>
            ))}
          </div>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.22)]">{error}</p>
        ) : null}
        {drillError ? (
          <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700 shadow-[inset_0_0_0_1px_rgba(234,88,12,0.22)]">{drillError}</p>
        ) : null}

        {!loadingToday && dueItems.length === 0 ? (
          <div className="state-card flow-sm mt-4">
            <p className="text-sm text-slate-700">{totalMemoryCount > 0 ? "今日到期已清空" : "记忆库还没有复习条目"}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <article className="workspace-preview-card">
                <p className="text-[11px] text-slate-500">累计记忆</p>
                <p className="mt-1 text-sm text-ink-700">{totalMemoryCount} 条</p>
              </article>
              <article className="workspace-preview-card">
                <p className="text-[11px] text-slate-500">今日打卡</p>
                <p className="mt-1 text-sm text-ink-700">{reviewedTodayCount} 条</p>
              </article>
              <article className="workspace-preview-card">
                <p className="text-[11px] text-slate-500">建议动作</p>
                <p className="mt-1 text-sm text-ink-700">{totalMemoryCount > 0 ? "巩固复习" : "先添加诗词"}</p>
              </article>
            </div>
            <div className="memory-empty-actions justify-center">
              {totalMemoryCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setOnlyDue(false);
                    setTodayPage(1);
                    setQueueWorkspaceView("focus");
                    setActiveWorkspace("queue");
                  }}
                  className="btn-secondary-compact"
                >
                  查看全部条目
                </button>
              ) : null}
              {totalMemoryCount > 0 ? (
                <Link to={memoryPracticeLink} className="btn-secondary-compact">
                  去做巩固练习
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  openDetailWorkspace("add");
                }}
                className="btn-secondary-compact"
              >
                去添加记忆内容
              </button>
            </div>
          </div>
        ) : null}

        {!loadingToday && dueItems.length > 0 ? (
          <div className="mt-4">
            <VirtualizedList
              items={dueItems}
              getKey={(item) => item.id}
              height={560}
              estimateHeight={340}
              overscan={3}
              renderItem={(item) => {
                const isSelected = selectedMemoryItem?.id === item.id;

                return (
                  <div className="pb-4">
                    <TiltedCard className="h-full">
                      <SpotlightCard
                        className={[
                          "h-full rounded-[22px] bg-white p-4 shadow-[0_12px_32px_rgba(26,43,76,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(26,43,76,0.14)]",
                          isSelected ? "bg-[#FDF8EE]" : "",
                        ].join(" ")}
                        spotlightColor="rgba(26,43,76,0.08)"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-serif text-2xl text-[#1A2B4C]">{item.poem?.title || "未命名诗词"}</h3>
                            <p className="mt-1 text-xs font-sans text-slate-500">
                              {item.poem?.author || "未知作者"} · {item.poem?.dynasty || "未知朝代"} · 复习 {item.reviewCount} 次 · 成功率{" "}
                              {toPercent(item.successRate)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={[
                                "rounded-full px-3 py-1 text-xs font-sans",
                                isDueToday(item.dueDate, todayData?.today) ? "bg-red-50 text-red-700" : "bg-stone-100 text-slate-600",
                              ].join(" ")}
                            >
                              下次复习 {item.dueDate}
                            </p>
                            <p className="mt-1 text-xs font-sans text-slate-500">
                              间隔 {item.intervalDays} 天 · EF {Number(item.easeFactor || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs font-sans leading-6 text-slate-600">
                          {item.poem?.content || "暂无诗词正文。点击进入详情后可进行训练与打卡。"}
                        </p>

                        <div className="mt-3 rounded-2xl bg-stone-100/90 p-3">
                          <div className="flex items-center justify-between text-[11px] font-sans text-slate-500">
                            <span>掌握度</span>
                            <span className="font-medium text-[#1A2B4C]">
                              {masteryPercent(item)}% · {masteryLabel(masteryPercent(item))}
                            </span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-white/80">
                            <div className={["h-full rounded-full", masteryTone(masteryPercent(item))].join(" ")} style={{ width: `${masteryPercent(item)}%` }} />
                          </div>
                          <div className="mt-2 flex items-center gap-1 text-[#C9A96E]">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={`${item.id}-mastery-star-${index}`}
                                className="h-3.5 w-3.5"
                                fill={index < Math.max(1, Math.round(masteryPercent(item) / 20)) ? "currentColor" : "none"}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openDetailWorkspace("review", item.id)}
                            className={[
                              "rounded-full px-4 py-2 text-xs font-sans text-slate-700 transition-all",
                              isSelected ? "bg-[#F3E7CE] text-[#1A2B4C]" : "bg-stone-100 hover:bg-stone-200",
                            ].join(" ")}
                          >
                            {isSelected ? "当前详情条目" : "进入详情复习"}
                          </button>
                          <Link to={`/learn/${item.poemId}`} className="rounded-full bg-stone-100 px-4 py-2 text-xs font-sans text-slate-700 transition hover:bg-stone-200">
                            去解析
                          </Link>
                          {item.poem?.title ? (
                            <Link
                              to={buildPracticeLink(item.poem.title)}
                              className="rounded-full bg-stone-100 px-4 py-2 text-xs font-sans text-slate-700 transition hover:bg-stone-200"
                            >
                              基于此诗练习
                            </Link>
                          ) : null}
                        </div>
                      </SpotlightCard>
                    </TiltedCard>
                  </div>
                );
              }}
            />
          </div>
        ) : null}
        </section>
      </PageStage>
      ) : null}

      {activeWorkspace === "detail" ? (
      <PageStage tone="detail" as="section" id="memory-workspace">
        <SectionCard
          weight="support"
          title="记忆详情"
          subtitle="复习、加入记忆与复盘在此切换。"
          actions={
            <button type="button" onClick={() => openQueueWorkspace("focus")} className="btn-secondary-compact">
              返回今日队列
            </button>
          }
          bodyClassName="flow-md"
        >
          <PillNav items={detailTabNavItems} value={detailTab} onChange={setDetailTab} className="bg-stone-200/75" />

          {detailTab === "review" ? (
            <div className="flow-md">
              {selectedMemoryItem ? (
                <div className="flow-md rounded-[24px] bg-[#F4F2EE] p-4 shadow-[0_16px_40px_rgba(26,43,76,0.08)] md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-2xl text-[#1A2B4C]">{selectedMemoryItem.poem?.title || "未命名诗词"}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedMemoryItem.poem?.author || "未知作者"} · {selectedMemoryItem.poem?.dynasty || "未知朝代"} · 复习 {selectedMemoryItem.reviewCount} 次 · 成功率{" "}
                        {toPercent(selectedMemoryItem.successRate)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={[
                          "rounded-full px-3 py-1 text-xs",
                          isDueToday(selectedMemoryItem.dueDate, todayData?.today) ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        下次复习 {selectedMemoryItem.dueDate}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        间隔 {selectedMemoryItem.intervalDays} 天 · EF {Number(selectedMemoryItem.easeFactor || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                    <div className="flex items-center justify-between text-xs font-sans text-slate-500">
                      <span>掌握度</span>
                      <span className="font-medium text-[#1A2B4C]">{masteryPercent(selectedMemoryItem)}% · {masteryLabel(masteryPercent(selectedMemoryItem))}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-stone-200/90">
                      <div
                        className={["h-full rounded-full", masteryTone(masteryPercent(selectedMemoryItem))].join(" ")}
                        style={{ width: `${masteryPercent(selectedMemoryItem)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[#C9A96E]">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={`selected-mastery-star-${index}`}
                          className="h-3.5 w-3.5"
                          fill={index < Math.max(1, Math.round(masteryPercent(selectedMemoryItem) / 20)) ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                  </div>

                  <MemoryFlipCard item={selectedMemoryItem} flipped={flipCardOpen} onToggle={() => setFlipCardOpen((prev) => !prev)} />

                  <p className="rounded-2xl bg-white/85 px-3 py-2 text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.06)]">
                    建议流程：先做训练动作，再提交自评打卡，系统会更新下次复习间隔。
                  </p>

                  <div className="memory-action-group">
                    <p className="memory-action-title">训练动作</p>
                    <div className="memory-action-row">
                      <button type="button" onClick={() => startNextLineDrill(selectedMemoryItem)} className="btn-secondary-compact">
                        上句接下句
                      </button>
                      <button type="button" onClick={() => startBlankDrill(selectedMemoryItem)} className="btn-secondary-compact">
                        逐句填空
                      </button>
                      <button type="button" onClick={() => startFullTextDrill(selectedMemoryItem)} className="btn-secondary-compact">
                        全文默写
                      </button>
                      <button type="button" onClick={() => startDictationDrill(selectedMemoryItem)} className="btn-secondary-compact">
                        听写
                      </button>
                    </div>
                  </div>

                  <div className="memory-action-group">
                    <p className="memory-action-title">自评打卡</p>
                    <div className="memory-action-row">
                      {qualityOptions.map((option) => (
                        <button
                          key={`${selectedMemoryItem.id}-${option.value}`}
                          type="button"
                          disabled={reviewingId === selectedMemoryItem.id}
                          onClick={() =>
                            void submitReview(selectedMemoryItem, option.value, {
                              mode: "self_check",
                              isCorrect: option.value >= 3,
                            })
                          }
                          className={[
                            "rounded-lg px-3 py-1.5 text-xs transition",
                            option.tone,
                            reviewingId === selectedMemoryItem.id ? "cursor-not-allowed opacity-60" : "hover:brightness-95",
                          ].join(" ")}
                        >
                          {reviewingId === selectedMemoryItem.id ? "提交中..." : option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="memory-action-group">
                    <p className="memory-action-title">延伸动作</p>
                    <div className="memory-action-row">
                      <Link to={`/learn/${selectedMemoryItem.poemId}`} className="btn-secondary-compact">
                        去解析
                      </Link>
                      {selectedMemoryItem.poem?.title ? (
                        <Link to={buildPracticeLink(selectedMemoryItem.poem.title)} className="btn-secondary-compact">
                          基于此诗练习
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {nextLineDrill && !nextLineDrill.finished && currentPair ? (
                    <div className="rounded-2xl bg-ink-50 p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          上句接下句 · 第 {nextLineDrill.index + 1}/{nextLineDrill.pairs.length} 题
                        </span>
                        <span>已答对 {nextLineDrill.correctCount} 题</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">请写出下句：</p>
                      <p className="mt-1 rounded-lg bg-white px-3 py-2 font-poem text-lg text-ink-700">{currentPair.prompt}</p>
                      <input
                        value={nextLineDrill.input}
                        onChange={(event) => setDrill({ ...nextLineDrill, input: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitNextLineAnswer();
                          }
                        }}
                        placeholder="输入下一句"
                        className="mt-3 input-main control-dense w-full"
                      />
                      {nextLineDrill.feedback ? <p className="mt-2 text-xs text-slate-600">{nextLineDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={submitNextLineAnswer} className="btn-secondary-compact">
                          提交本题
                        </button>
                        <button
                          type="button"
                          onClick={revealHint}
                          disabled={nextLineDrill.hintLevel >= 3}
                          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)] transition hover:bg-amber-100"
                        >
                          查看提示
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          结束练习
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">提示使用次数：{nextLineDrill.hintUsedCount}</p>
                    </div>
                  ) : null}

                  {blankDrill && !blankDrill.finished && currentBlank ? (
                    <div className="rounded-2xl bg-ink-50 p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          逐句填空 · 第 {blankDrill.index + 1}/{blankDrill.questions.length} 题
                        </span>
                        <span>已答对 {blankDrill.correctCount} 题</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">请补全空缺部分：</p>
                      <p className="mt-1 rounded-lg bg-white px-3 py-2 font-poem text-lg text-ink-700">{currentBlank.masked}</p>
                      <p className="mt-1 text-xs text-slate-500">{currentBlank.hint}</p>
                      <input
                        value={blankDrill.input}
                        onChange={(event) => setDrill({ ...blankDrill, input: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submitBlankAnswer();
                          }
                        }}
                        placeholder="输入缺失文字"
                        className="mt-3 input-main control-dense w-full"
                      />
                      {blankDrill.feedback ? <p className="mt-2 text-xs text-slate-600">{blankDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={submitBlankAnswer} className="btn-secondary-compact">
                          提交本题
                        </button>
                        <button
                          type="button"
                          onClick={revealHint}
                          disabled={blankDrill.hintLevel >= 3}
                          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)] transition hover:bg-amber-100"
                        >
                          查看提示
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          结束练习
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">提示使用次数：{blankDrill.hintUsedCount}</p>
                    </div>
                  ) : null}

                  {fullTextDrill && !fullTextDrill.finished ? (
                    <div className="rounded-2xl bg-ink-50 p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>全文默写（简版）</span>
                        <span>建议先口头背诵再输入</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">请默写整首诗词：</p>
                      <textarea
                        value={fullTextDrill.input}
                        onChange={(event) => setDrill({ ...fullTextDrill, input: event.target.value })}
                        placeholder="在这里输入你的默写内容"
                        className="mt-2 h-32 w-full rounded-lg bg-white px-3 py-2 text-sm leading-7 outline-none shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)] transition focus:shadow-[inset_0_0_0_1px_rgba(26,43,76,0.45)]"
                      />
                      {fullTextDrill.feedback ? <p className="mt-2 text-xs text-slate-600">{fullTextDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={submitFullTextDrill} className="btn-secondary-compact">
                          提交全文
                        </button>
                        <button
                          type="button"
                          onClick={revealHint}
                          disabled={fullTextDrill.hintLevel >= 3}
                          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)] transition hover:bg-amber-100"
                        >
                          查看提示
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          结束练习
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">提示使用次数：{fullTextDrill.hintUsedCount}</p>
                    </div>
                  ) : null}

                  {dictationDrill && !dictationDrill.finished ? (
                    <div className="rounded-2xl bg-ink-50 p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>听写模式</span>
                        <span>点击“朗读原文”后开始输入</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const ok = readTextAloud(dictationDrill.targetText, dictationDrill.playbackRate);
                            if (!ok) {
                              setDrillError("当前浏览器不支持语音朗读，请改用全文默写。");
                            }
                          }}
                          className="rounded-lg bg-cyan-50 px-3 py-1.5 text-xs text-cyan-700 shadow-[inset_0_0_0_1px_rgba(8,145,178,0.25)] transition hover:bg-cyan-100"
                        >
                          朗读原文
                        </button>
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          语速
                          <input
                            type="range"
                            min={0.8}
                            max={1.1}
                            step={0.05}
                            value={dictationDrill.playbackRate}
                            onChange={(event) =>
                              setDrill({
                                ...dictationDrill,
                                playbackRate: Number(event.target.value),
                              })
                            }
                          />
                          <span>{dictationDrill.playbackRate.toFixed(2)}x</span>
                        </label>
                      </div>
                      <textarea
                        value={dictationDrill.input}
                        onChange={(event) => setDrill({ ...dictationDrill, input: event.target.value })}
                        placeholder="根据朗读内容输入你的听写结果"
                        className="mt-3 h-32 w-full rounded-lg bg-white px-3 py-2 text-sm leading-7 outline-none shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)] transition focus:shadow-[inset_0_0_0_1px_rgba(26,43,76,0.45)]"
                      />
                      {dictationDrill.feedback ? <p className="mt-2 text-xs text-slate-600">{dictationDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={submitDictationDrill} className="btn-secondary-compact">
                          提交听写
                        </button>
                        <button
                          type="button"
                          onClick={revealHint}
                          disabled={dictationDrill.hintLevel >= 3}
                          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)] transition hover:bg-amber-100"
                        >
                          查看提示
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          结束练习
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">提示使用次数：{dictationDrill.hintUsedCount}</p>
                    </div>
                  ) : null}

                  {nextLineDrill && nextLineDrill.finished ? (
                    <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <h4 className="text-sm text-ink-700">练习完成</h4>
                      <p className="mt-2 text-sm text-slate-700">
                        正确率 {Math.round(nextLineDrill.accuracy * 100)}%，建议质量分 {nextLineDrill.recommendedQuality}/5，用时 {nextLineDrill.spentSeconds} 秒。
                      </p>
                      {nextLineDrill.feedback ? <p className="mt-1 text-xs text-slate-600">{nextLineDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void submitReview(selectedMemoryItem, nextLineDrill.recommendedQuality, {
                              mode: "next_line",
                              isCorrect: nextLineDrill.accuracy >= 0.6,
                              timeSpent: nextLineDrill.spentSeconds,
                            })
                          }
                          className="btn-secondary-compact"
                        >
                          按本次结果打卡
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          关闭
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {blankDrill && blankDrill.finished ? (
                    <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <h4 className="text-sm text-ink-700">练习完成</h4>
                      <p className="mt-2 text-sm text-slate-700">
                        正确率 {Math.round(blankDrill.accuracy * 100)}%，建议质量分 {blankDrill.recommendedQuality}/5，用时 {blankDrill.spentSeconds} 秒。
                      </p>
                      {blankDrill.feedback ? <p className="mt-1 text-xs text-slate-600">{blankDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void submitReview(selectedMemoryItem, blankDrill.recommendedQuality, {
                              mode: "blank",
                              isCorrect: blankDrill.accuracy >= 0.6,
                              timeSpent: blankDrill.spentSeconds,
                            })
                          }
                          className="btn-secondary-compact"
                        >
                          按本次结果打卡
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          关闭
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {fullTextDrill && fullTextDrill.finished ? (
                    <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <h4 className="text-sm text-ink-700">默写完成</h4>
                      <p className="mt-2 text-sm text-slate-700">
                        {fullTextDrill.feedback} 用时 {fullTextDrill.spentSeconds} 秒。
                      </p>
                      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">原文参考：{fullTextDrill.targetText}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void submitReview(selectedMemoryItem, fullTextDrill.recommendedQuality, {
                              mode: "full_text",
                              isCorrect: fullTextDrill.accuracy >= 0.75,
                              timeSpent: fullTextDrill.spentSeconds,
                            })
                          }
                          className="btn-secondary-compact"
                        >
                          按本次结果打卡
                        </button>
                        <button type="button" onClick={() => startFullTextDrill(selectedMemoryItem)} className="btn-secondary-compact">
                          重新默写
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          关闭
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {dictationDrill && dictationDrill.finished ? (
                    <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <h4 className="text-sm text-ink-700">听写完成</h4>
                      <p className="mt-2 text-sm text-slate-700">
                        {dictationDrill.feedback} 用时 {dictationDrill.spentSeconds} 秒。
                      </p>
                      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">原文参考：{dictationDrill.targetText}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void submitReview(selectedMemoryItem, dictationDrill.recommendedQuality, {
                              mode: "dictation",
                              isCorrect: dictationDrill.accuracy >= 0.75,
                              timeSpent: dictationDrill.spentSeconds,
                            })
                          }
                          className="btn-secondary-compact"
                        >
                          按本次结果打卡
                        </button>
                        <button type="button" onClick={() => startDictationDrill(selectedMemoryItem)} className="btn-secondary-compact">
                          重新听写
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          关闭
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="state-card flow-sm">
                  {dueItems.length > 0 ? (
                    <>
                      <p className="text-sm text-slate-600">先从今日队列选择 1 条任务。</p>
                      <div className="memory-empty-actions justify-center">
                        <button type="button" className="btn-secondary-compact" onClick={() => openQueueWorkspace("focus")}>
                          去选今日任务
                        </button>
                        <button
                          type="button"
                          className="btn-secondary-compact"
                          onClick={() => {
                            openQueueWorkspace("manage");
                          }}
                        >
                          调整筛选与分页
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600">当前没有可复习条目。</p>
                      <button type="button" className="btn-secondary-compact mx-auto" onClick={() => setDetailTab("add")}>
                        去添加记忆内容
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {detailTab === "add" ? (
            <section id="memory-add-section" className="flow-md">
              <div className="flex items-center gap-2">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void searchPoems();
                    }
                  }}
                  placeholder="例如：静夜思、李白、明月"
                  className="input-main control-dense w-full"
                />
                <button
                  type="button"
                  onClick={() => void searchPoems()}
                  disabled={searching}
                  className="btn-secondary btn-dense disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {searching ? "搜索中..." : "搜索"}
                </button>
              </div>

              {searchError ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.22)]">{searchError}</p>
              ) : null}

              {searchResults.length > 0 ? (
                <div className="flow-sm">
                  {searchResults.map((poem) => (
                    <article key={poem.id} className="rounded-2xl bg-white p-3 shadow-[0_10px_24px_rgba(26,43,76,0.08)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm text-ink-700">{poem.title}</h3>
                          <p className="text-xs text-slate-500">
                            {poem.author} · {poem.dynasty}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={enrollingId === poem.id}
                          onClick={() => void enrollPoem(poem.id)}
                          className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {enrollingId === poem.id ? "加入中..." : "加入记忆"}
                        </button>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-600">{poem.content}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">输入关键词后搜索可加入的诗词。</p>
              )}
            </section>
          ) : null}

          {detailTab === "insight" ? (
            <div className="flow-sm">
              <PillNav items={insightTabNavItems} value={insightTab} onChange={setInsightTab} className="bg-stone-200/75" />

              {insightTab !== "recent" ? (
                <>
                  {loadingStats ? <p className="text-sm text-slate-500">加载中...</p> : null}

                  {!loadingStats && achievements.length === 0 ? <p className="text-sm text-slate-500">完成打卡后将解锁你的学习成就。</p> : null}

                  {!loadingStats && achievements.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]">
                          已解锁成就：{unlockedAchievementCount}/{achievements.length}
                        </p>
                        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]">
                          今日已打卡：{reviewedTodayCount} 条
                        </p>
                      </div>

                      <div className="flow-sm">
                        {(insightTab === "achievements" ? highlightedAchievements : achievements).map((achievement) => {
                          const percent = achievementProgressPercent(achievement);
                          const tierClass = achievementTierClassMap[achievement.tier] || "bg-slate-50 text-slate-700 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]";

                          return (
                            <div
                              key={achievement.id}
                              className={[
                                "rounded-lg px-3 py-2 text-xs",
                                achievement.unlocked ? tierClass : "bg-slate-50 text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm">{achievement.title}</p>
                                <span className="text-[11px]">{achievement.unlocked ? "已解锁" : `${achievement.progress}/${achievement.target}`}</span>
                              </div>
                              <p className="mt-1 text-[11px] opacity-85">{achievement.description}</p>
                              <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/70">
                                <div
                                  className={["h-full rounded", achievement.unlocked ? "bg-ink-700" : "bg-slate-300"].join(" ")}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {loadingStats ? <p className="text-sm text-slate-500">加载中...</p> : null}
                  {!loadingStats && recentRecords.length === 0 ? <p className="text-sm text-slate-500">暂无打卡记录。</p> : null}
                  {!loadingStats && recentRecords.length > 0 ? (
                    <div className="flow-sm">
                      {recentRecords.map((item, index) => (
                        <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          <p>
                            {item.poem?.title || "未命名诗词"} · {memoryModeLabelMap[item.mode] || "练习"} · {item.quality}/5
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">{item.createdAt}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </SectionCard>
      </PageStage>
      ) : null}

      <PageStage tone="detail">
        <NextStepRecommendations
          title="记忆之后推荐动作"
          subtitle="记忆不是终点：把打卡结果送回学情与练测，形成持续复盘闭环。"
          items={memoryNextStepItems}
          className="mt-2"
        />
      </PageStage>
    </div>
  );
}






