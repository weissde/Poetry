﻿﻿﻿import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Compass, Flame, Layers3, Sparkles, Star } from "lucide-react";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { NextStepRecommendations } from "@/components/common/NextStepRecommendations";
import { PageHeader } from "@/components/common/PageHeader";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { apiGet, apiPost } from "@/lib/api";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { VirtualizedList } from "@/components/common/VirtualizedList";
import { teacherHintItems } from "@/content/teachingStatic";
import { Magnet, PillNav, SpotlightCard, type PillNavItem, TiltedCard } from "@/components/react-bits";
import type {
  MemoryReviewItem,
  MemoryStatsEnvelope,
  MemoryTodayEnvelope,
  PaginationMeta,
  PoemRecord,
} from "@/types";

import { ProgressRing } from "@/components/memory/ProgressRing";
import { MemoryHeatmap } from "@/components/memory/MemoryHeatmap";
import { MemoryRatingBar } from "@/components/memory/MemoryRatingBar";
import { MemoryFlipCard } from "@/components/memory/MemoryFlipCard";
import {
  toPercent,
  isDueToday,
  buildPracticeLink,
  normalizeCompareText,
  buildDrillPairs,
  buildBlankQuestions,
  calcTextSimilarity,
  qualityWithHintPenalty,
  achievementProgressPercent,
  nextLineHintText,
  blankHintText,
  fullTextHintText,
  readTextAloud,
  scrollToSection,
  buildHeatmapCells,
  masteryPercent,
  masteryLabel,
  masteryTone,
  type DrillPair,
  type BlankQuestion,
} from "@/lib/memoryUtils";



interface PoemSearchResponse {
  items: PoemRecord[];
}

interface MemoryTodayResponse extends MemoryTodayEnvelope {
  pagination?: PaginationMeta;
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
  self_check: "鑷瘎",
  next_line: "涓婂彞鎺ヤ笅鍙?,
  blank: "閫愬彞濉┖",
  full_text: "鍏ㄦ枃榛樺啓",
  dictation: "鍚啓",
};

const achievementTierClassMap: Record<string, string> = {
  bronze: "bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]",
  silver: "bg-slate-50 text-slate-700 shadow-[inset_0_0_0_1px_rgba(100,116,139,0.18)]",
  gold: "bg-yellow-50 text-yellow-700 shadow-[inset_0_0_0_1px_rgba(202,138,4,0.2)]",
  platinum: "bg-cyan-50 text-cyan-700 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.2)]",
};

const memoryTeachingObjective = {
  title: "璁板繂璁粌鐩爣",
  summary: "閫氳繃宓屽叆寮忓～绌恒€侀棿闅旈噸澶嶅拰榛樺啓璁粌锛屽疄鐜伴暱鏈熻蹇嗙暀瀛樸€?,
  goals: [
    "瀹屾垚浠婃棩澶嶄範闃熷垪涓殑璇楄瘝",
    "瀵硅杽寮辫瘲鍙ュ仛閽堝鎬у～绌虹粌涔?,
    "杈惧埌 80% 浠ヤ笂姝ｇ‘鐜囧悗杩涘叆涓嬩竴棣?,
  ],
  teacherHint: "寤鸿璇惧爞鍐呭彧鍋?2-3 涓煭鍙ュ～绌猴紝纭鎺屾彙鍚庡啀杩涘叆鍏ㄦ枃榛樺啓銆?,
};

const queueWorkspaceNavItems: readonly PillNavItem<QueueWorkspaceView>[] = [
  { id: "focus", label: "涓撴敞澶嶄範", icon: <Flame className="h-3.5 w-3.5" /> },
  { id: "manage", label: "绛涢€変笌鍒嗛〉", icon: <Layers3 className="h-3.5 w-3.5" /> },
];

const detailTabNavItems: readonly PillNavItem<MemoryDetailTab>[] = [
  { id: "review", label: "澶嶄範鍏ュ彛", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "add", label: "鍔犲叆璁板繂", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "insight", label: "澶嶇洏鎴愬氨", icon: <Compass className="h-3.5 w-3.5" /> },
];

const insightTabNavItems: readonly PillNavItem<MemoryInsightTab>[] = [
  { id: "achievements", label: "鎽樿鎴愬氨" },
  { id: "all_achievements", label: "鍏ㄩ儴鎴愬氨" },
  { id: "recent", label: "鏈€杩戞墦鍗? },
];

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
      setError(err instanceof Error ? err.message : "鍔犺浇璁板繂鍒楄〃澶辫触");
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
      setError(err instanceof Error ? err.message : "鍔犺浇璁板繂缁熻澶辫触");
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
      setSearchError(err instanceof Error ? err.message : "鎼滅储澶辫触");
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
      setError(err instanceof Error ? err.message : "鍔犲叆璁板繂澶辫触");
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
      setError(err instanceof Error ? err.message : "鎵撳崱澶辫触");
    } finally {
      setReviewingId(null);
    }
  };

  const startNextLineDrill = (item: MemoryReviewItem): void => {
    const content = item.poem?.content || "";
    const pairs = buildDrillPairs(content);
    if (pairs.length === 0) {
      setDrillError("璇ヨ瘲璇嶆殏涓嶉€傚悎涓婂彞鎺ヤ笅鍙ョ粌涔狅紝鍙洿鎺ヤ娇鐢ㄤ笅鏂硅嚜璇勬墦鍗°€?);
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
      setDrillError("璇ヨ瘲璇嶅彞瀛愯繃鐭紝鏆備笉閫傚悎閫愬彞濉┖锛屽彲鏀圭敤鍏ㄦ枃榛樺啓銆?);
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
      setDrillError("璇ヨ瘲璇嶆殏鏃犲彲鐢ㄦ鏂囷紝鏆備笉鏀寔鍏ㄦ枃榛樺啓銆?);
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
      setDrillError("璇ヨ瘲璇嶆殏鏃犲彲鐢ㄦ鏂囷紝鏆備笉鏀寔鍚啓銆?);
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
    const feedback = isCorrect ? "鏈姝ｇ‘銆? : `鏈姝ｇ‘绛旀锛?{current.answer}`;

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
    const hintSuffix = drill.hintUsed ? `锛堟湰杞叡鐢ㄦ彁绀?${drill.hintUsedCount} 娆★級` : "";

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
    const feedback = isCorrect ? "鏈姝ｇ‘銆? : `鏈姝ｇ‘绛旀锛?{current.answer}`;

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
    const hintSuffix = drill.hintUsed ? `锛堟湰杞叡鐢ㄦ彁绀?${drill.hintUsedCount} 娆★級` : "";

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
    const hintSuffix = drill.hintUsed ? `宸蹭娇鐢ㄦ彁绀?${drill.hintUsedCount} 娆★紝` : "";
    const feedback = `${hintSuffix}鐩镐技搴?${Math.round(accuracy * 100)}%锛屽缓璁川閲忓垎 ${recommendedQuality}/5銆俙;

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
    const hintSuffix = drill.hintUsed ? `宸蹭娇鐢ㄦ彁绀?${drill.hintUsedCount} 娆★紝` : "";
    const feedback = `${hintSuffix}鍚啓鐩镐技搴?${Math.round(accuracy * 100)}%锛屽缓璁川閲忓垎 ${recommendedQuality}/5銆俙;

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
  const memoryPracticeLink = useMemo(() => buildPracticeLink("鍙よ瘲璇嶈蹇嗗珐鍥?), []);
  const memoryNextStepItems = useMemo(() => {
    const poemTitle = selectedMemoryItem?.poem?.title?.trim() || "";
    const poemId = selectedMemoryItem?.poemId?.trim() || "";
    const practiceTopic = poemTitle || "璁板繂宸╁浐涓撻」";

    return [
      {
        title: "鍥炲埌瀛︽儏涓績",
        description: "鎶婅蹇嗘墦鍗′笌閿欓銆佺粌娴嬬粨鏋溿€佸涔犺鍒掓斁鍒板悓涓€瑙嗚閲屽鐩橈紝纭畾涓嬩竴杞琛ョ殑钖勫急鐐广€?,
        to: "/my-learning?tab=overview&from=memory",
        ctaLabel: "鐪嬪鎯?,
        badge: "鏀舵潫",
      },
      {
        title: "鍘荤粌娴嬪珐鍥?,
        description: poemTitle ? `鍥寸粫銆?{poemTitle}銆嬪仛涓€缁勯锛岄獙璇佽浣忔槸鍚﹁兘杩佺Щ鍒扮瓟棰樿〃杈俱€俙 : "鍋氫竴缁勯锛屾妸璁颁綇鐨勫唴瀹硅浆鎴愬彲鐢ㄧ殑绛旈琛ㄨ揪銆?,
        to: buildPracticeLink(practiceTopic),
        ctaLabel: "鍘荤粌娴?,
        badge: "宸╁浐",
      },
      {
        title: poemTitle ? "鍥炲埌绮捐缁х画瑙ｆ瀽" : "鍘荤簿璁查€変竴棣栬瘲",
        description: poemTitle ? "鍥炲埌绮捐椤垫妸杩欓璇楀啀璧颁竴閬嶈В鏋?鎺㈢┒锛屽舰鎴愨€滃-璁?缁冣€濈殑闂幆銆? : "浠庣簿璁查〉鎸戜竴棣栬瘲锛屽厛鐞嗚В鍐嶈繘鍏ヨ蹇嗕笌缁冩祴銆?,
        to: poemId ? `/learn/${encodeURIComponent(poemId)}` : "/learn",
        ctaLabel: "鍘荤簿璁?,
        badge: "鍥炶",
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
    return dates[0] || "鏆傛棤";
  }, [dueItems]);
  const memoryWorkspaceStatus = useMemo(() => {
    if (loadingToday) return "鍚屾涓?;
    if (drill && !drill.finished) return "缁冧範涓?;
    if (dueItems.length === 0) return "宸叉竻绌?;
    return "寰呭涔?;
  }, [drill, dueItems.length, loadingToday]);
  const heatmapCells = useMemo(
    () => buildHeatmapCells(todayData?.today || statsData?.today, reviewedTodayCount, summary?.streakDays ?? 0),
    [reviewedTodayCount, statsData?.today, summary?.streakDays, todayData?.today],
  );
  const memoryNextAction = useMemo(() => {
    if (loadingToday) {
      return {
        key: "sync" as const,
        title: "姝ｅ湪鍚屾浠婃棩澶嶄範闃熷垪",
        description: "绋嶇瓑鐗囧埢鍚庡紑濮嬬涓€鏉″涔狅紝鎴栨墜鍔ㄥ埛鏂伴槦鍒椼€?,
        cta: "鍒锋柊闃熷垪",
      };
    }
    if (dueCount > 0) {
      return {
        key: "review" as const,
        title: "鍏堝畬鎴愪粖鏃ュ埌鏈熷涔?,
        description: `褰撳墠鏈?${dueCount} 鏉″埌鏈熶换鍔★紝寤鸿浠庣涓€鏉″紑濮嬪苟瀹屾垚鑷冲皯 1 杞墦鍗°€俙,
        cta: "寮€濮嬩粖鏃ュ涔?,
      };
    }
    if (totalMemoryCount > 0) {
      return {
        key: "all_items" as const,
        title: "浠婃棩鍒版湡宸叉竻绌猴紝杞叆宸╁浐闃舵",
        description: `浣犲凡鍦ㄨ蹇嗗簱涓Н绱?${totalMemoryCount} 鏉″唴瀹癸紝寤鸿鍒囨崲鍒扳€滃叏閮ㄦ潯鐩€濆苟鍋氫竴缁勫珐鍥虹粌涔犮€俙,
        cta: "鏌ョ湅鍏ㄩ儴鏉＄洰",
      };
    }
    return {
      key: "enroll" as const,
      title: "鍏堟坊鍔犵涓€棣栬蹇嗚瘲璇?,
      description: "褰撳墠璁板繂鍒楄〃涓虹┖锛屽厛鎼滅储骞跺姞鍏?1 棣栬瘲璇嶏紝绯荤粺浼氳嚜鍔ㄧ敓鎴愬涔犺妭濂忋€?,
      cta: "鍘绘坊鍔犺蹇嗗唴瀹?,
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
        title="璁板繂鎵撳崱"
        subtitle="鍏堝畬鎴愪粖鏃ュ涔狅紝鍐嶈繘鍏ラ槦鍒椾笌璇︽儏銆?
      />

      <LearnJourneyProgress className="mb-4" />
      {isTeacherMode ? (
        <TeachingObjectiveCard
          variant="panel"
          kicker="鏁欏笀鐩爣鎻愮ず"
          title={memoryTeachingObjective.title}
          summary={memoryTeachingObjective.summary}
          goals={memoryTeachingObjective.goals}
          chipLabel="褰撳墠闃舵 路 璁板繂璁粌"
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
                <span className="rounded-full bg-white/12 px-3 py-1 text-stone-100">寰呭涔?{dueCount} 鏉?</span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-stone-100">宸叉墦鍗?{reviewedTodayCount} 鏉?</span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-stone-100">鐘舵€?{memoryWorkspaceStatus}</span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-stone-100">涓嬫鍒版湡 {nearestDueDate}</span>
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
              绔嬪嵆寮€濮?            </button>
          </Magnet>
        </SpotlightCard>
      </PageStage>

      <PageStage tone="secondary">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "浠婃棩寰呭涔?, value: dueCount, suffix: "鏉? },
            { label: "浠婃棩宸叉墦鍗?, value: reviewedTodayCount, suffix: "鏉? },
            { label: "杩炵画鎵撳崱", value: summary?.streakDays ?? 0, suffix: "澶? },
            { label: "鏁翠綋鎴愬姛鐜?, value: overallSuccessRate, suffix: "%" },
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
            <h2 className="font-serif text-3xl text-[#1A2B4C]">浠婃棩澶嶄範闃熷垪</h2>
            <p className="mt-1 text-xs text-slate-500">{onlyDue ? "鍒版湡浼樺厛" : "鍏ㄩ儴鏉＄洰"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => openDetailWorkspace("add")} className="btn-secondary-compact">
              鍔犲叆璁板繂
            </button>
            <button type="button" onClick={() => openDetailWorkspace("insight")} className="btn-secondary-compact">
              澶嶇洏涓庢垚灏?            </button>
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
              绗?{todayPage}/{todayTotalPages} 椤?路 鍏?{todayTotal} 鏉?路 浠婃棩鍒版湡 {todayData?.totalDue ?? 0} 鏉?            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOnlyDue(true);
                  setTodayPage(1);
                }}
                className={["btn-secondary-compact", onlyDue ? "bg-[#F3E7CE] text-ink-700" : ""].join(" ")}
              >
                鍙湅鍒版湡
              </button>
              <button
                type="button"
                onClick={() => {
                  setOnlyDue(false);
                  setTodayPage(1);
                }}
                className={["btn-secondary-compact", !onlyDue ? "bg-[#F3E7CE] text-ink-700" : ""].join(" ")}
              >
                鏌ョ湅鍏ㄩ儴
              </button>
              <button type="button" onClick={() => setQueueWorkspaceView("manage")} className="btn-secondary-compact">
                鏇村璁剧疆
              </button>
              <button type="button" onClick={() => refreshTodayQueue(true)} className="btn-secondary-compact">
                鍒锋柊
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
                  浠呭埌鏈?                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOnlyDue(false);
                    setTodayPage(1);
                  }}
                  className={["btn-secondary-compact", !onlyDue ? "bg-[#F3E7CE] text-ink-700" : ""].join(" ")}
                >
                  鍏ㄩ儴鏉＄洰
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">姣忛〉</span>
                <select
                  value={todayPageSize}
                  onChange={(event) => {
                    setTodayPageSize(Number(event.target.value));
                    setTodayPage(1);
                  }}
                  className="input-main control-dense rounded-lg !px-2 text-xs"
                >
                  <option value={12}>12 / 椤?</option>
                  <option value={20}>20 / 椤?</option>
                  <option value={36}>36 / 椤?</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={todayPage <= 1}
                  onClick={() => setTodayPage((prev) => Math.max(1, prev - 1))}
                  className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
                >
                  涓婁竴椤?                </button>
                <button
                  type="button"
                  disabled={todayPage >= todayTotalPages}
                  onClick={() => setTodayPage((prev) => Math.min(todayTotalPages, prev + 1))}
                  className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
                >
                  涓嬩竴椤?                </button>
                <button type="button" onClick={() => refreshTodayQueue(true)} className="btn-secondary-compact">
                  鍒锋柊
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
            <p className="text-sm text-slate-700">{totalMemoryCount > 0 ? "浠婃棩鍒版湡宸叉竻绌? : "璁板繂搴撹繕娌℃湁澶嶄範鏉＄洰"}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <article className="workspace-preview-card">
                <p className="text-[11px] text-slate-500">绱璁板繂</p>
                <p className="mt-1 text-sm text-ink-700">{totalMemoryCount} 鏉?</p>
              </article>
              <article className="workspace-preview-card">
                <p className="text-[11px] text-slate-500">浠婃棩鎵撳崱</p>
                <p className="mt-1 text-sm text-ink-700">{reviewedTodayCount} 鏉?</p>
              </article>
              <article className="workspace-preview-card">
                <p className="text-[11px] text-slate-500">寤鸿鍔ㄤ綔</p>
                <p className="mt-1 text-sm text-ink-700">{totalMemoryCount > 0 ? "宸╁浐澶嶄範" : "鍏堟坊鍔犺瘲璇?}</p>
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
                  鏌ョ湅鍏ㄩ儴鏉＄洰
                </button>
              ) : null}
              {totalMemoryCount > 0 ? (
                <Link to={memoryPracticeLink} className="btn-secondary-compact">
                  鍘诲仛宸╁浐缁冧範
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  openDetailWorkspace("add");
                }}
                className="btn-secondary-compact"
              >
                鍘绘坊鍔犺蹇嗗唴瀹?              </button>
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
                            <h3 className="font-serif text-2xl text-[#1A2B4C]">{item.poem?.title || "鏈懡鍚嶈瘲璇?}</h3>
                            <p className="mt-1 text-xs font-sans text-slate-500">
                              {item.poem?.author || "鏈煡浣滆€?} 路 {item.poem?.dynasty || "鏈煡鏈濅唬"} 路 澶嶄範 {item.reviewCount} 娆?路 鎴愬姛鐜噞" "}
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
                              涓嬫澶嶄範 {item.dueDate}
                            </p>
                            <p className="mt-1 text-xs font-sans text-slate-500">
                              闂撮殧 {item.intervalDays} 澶?路 EF {Number(item.easeFactor || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs font-sans leading-6 text-slate-600">
                          {item.poem?.content || "鏆傛棤璇楄瘝姝ｆ枃銆傜偣鍑昏繘鍏ヨ鎯呭悗鍙繘琛岃缁冧笌鎵撳崱銆?}
                        </p>

                        <div className="mt-3 rounded-2xl bg-stone-100/90 p-3">
                          <div className="flex items-center justify-between text-[11px] font-sans text-slate-500">
                            <span>鎺屾彙搴?</span>
                            <span className="font-medium text-[#1A2B4C]">
                              {masteryPercent(item)}% 路 {masteryLabel(masteryPercent(item))}
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
                            {isSelected ? "褰撳墠璇︽儏鏉＄洰" : "杩涘叆璇︽儏澶嶄範"}
                          </button>
                          <Link to={`/learn/${item.poemId}`} className="rounded-full bg-stone-100 px-4 py-2 text-xs font-sans text-slate-700 transition hover:bg-stone-200">
                            鍘昏В鏋?                          </Link>
                          {item.poem?.title ? (
                            <Link
                              to={buildPracticeLink(item.poem.title)}
                              className="rounded-full bg-stone-100 px-4 py-2 text-xs font-sans text-slate-700 transition hover:bg-stone-200"
                            >
                              鍩轰簬姝よ瘲缁冧範
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
          title="璁板繂璇︽儏"
          subtitle="澶嶄範銆佸姞鍏ヨ蹇嗕笌澶嶇洏鍦ㄦ鍒囨崲銆?
          actions={
            <button type="button" onClick={() => openQueueWorkspace("focus")} className="btn-secondary-compact">
              杩斿洖浠婃棩闃熷垪
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
                      <h3 className="font-serif text-2xl text-[#1A2B4C]">{selectedMemoryItem.poem?.title || "鏈懡鍚嶈瘲璇?}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedMemoryItem.poem?.author || "鏈煡浣滆€?} 路 {selectedMemoryItem.poem?.dynasty || "鏈煡鏈濅唬"} 路 澶嶄範 {selectedMemoryItem.reviewCount} 娆?路 鎴愬姛鐜噞" "}
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
                        涓嬫澶嶄範 {selectedMemoryItem.dueDate}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        闂撮殧 {selectedMemoryItem.intervalDays} 澶?路 EF {Number(selectedMemoryItem.easeFactor || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                    <div className="flex items-center justify-between text-xs font-sans text-slate-500">
                      <span>鎺屾彙搴?</span>
                      <span className="font-medium text-[#1A2B4C]">{masteryPercent(selectedMemoryItem)}% 路 {masteryLabel(masteryPercent(selectedMemoryItem))}</span>
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
                    寤鸿娴佺▼锛氬厛鍋氳缁冨姩浣滐紝鍐嶆彁浜よ嚜璇勬墦鍗★紝绯荤粺浼氭洿鏂颁笅娆″涔犻棿闅斻€?                  </p>

                  <div className="memory-action-group">
                    <p className="memory-action-title">璁粌鍔ㄤ綔</p>
                    <div className="memory-action-row">
                      <button type="button" onClick={() => startNextLineDrill(selectedMemoryItem)} className="btn-secondary-compact">
                        涓婂彞鎺ヤ笅鍙?                      </button>
                      <button type="button" onClick={() => startBlankDrill(selectedMemoryItem)} className="btn-secondary-compact">
                        閫愬彞濉┖
                      </button>
                      <button type="button" onClick={() => startFullTextDrill(selectedMemoryItem)} className="btn-secondary-compact">
                        鍏ㄦ枃榛樺啓
                      </button>
                      <button type="button" onClick={() => startDictationDrill(selectedMemoryItem)} className="btn-secondary-compact">
                        鍚啓
                      </button>
                    </div>
                  </div>

                  <div className="memory-action-group">
                    <p className="memory-action-title">鑷瘎鎵撳崱</p>
                    <div className="memory-action-row">
                      <MemoryRatingBar 
                        disabled={reviewingId === selectedMemoryItem.id}
                        submitting={reviewingId === selectedMemoryItem.id}
                        onRate={(quality) => void submitReview(selectedMemoryItem, quality, {
                          mode: "self_check",
                          isCorrect: quality >= 3,
                        })}
                      />
                    </div>
                  </div>

                  <div className="memory-action-group">
                    <p className="memory-action-title">寤朵几鍔ㄤ綔</p>
                    <div className="memory-action-row">
                      <Link to={`/learn/${selectedMemoryItem.poemId}`} className="btn-secondary-compact">
                        鍘昏В鏋?                      </Link>
                      {selectedMemoryItem.poem?.title ? (
                        <Link to={buildPracticeLink(selectedMemoryItem.poem.title)} className="btn-secondary-compact">
                          鍩轰簬姝よ瘲缁冧範
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {nextLineDrill && !nextLineDrill.finished && currentPair ? (
                    <div className="rounded-2xl bg-ink-50 p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          涓婂彞鎺ヤ笅鍙?路 绗?{nextLineDrill.index + 1}/{nextLineDrill.pairs.length} 棰?                        </span>
                        <span>宸茬瓟瀵?{nextLineDrill.correctCount} 棰?</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">璇峰啓鍑轰笅鍙ワ細</p>
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
                        placeholder="杈撳叆涓嬩竴鍙?
                        className="mt-3 input-main control-dense w-full"
                      />
                      {nextLineDrill.feedback ? <p className="mt-2 text-xs text-slate-600">{nextLineDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={submitNextLineAnswer} className="btn-secondary-compact">
                          鎻愪氦鏈
                        </button>
                        <button
                          type="button"
                          onClick={revealHint}
                          disabled={nextLineDrill.hintLevel >= 3}
                          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)] transition hover:bg-amber-100"
                        >
                          鏌ョ湅鎻愮ず
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          缁撴潫缁冧範
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">鎻愮ず浣跨敤娆℃暟锛歿nextLineDrill.hintUsedCount}</p>
                    </div>
                  ) : null}

                  {blankDrill && !blankDrill.finished && currentBlank ? (
                    <div className="rounded-2xl bg-ink-50 p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          閫愬彞濉┖ 路 绗?{blankDrill.index + 1}/{blankDrill.questions.length} 棰?                        </span>
                        <span>宸茬瓟瀵?{blankDrill.correctCount} 棰?</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">璇疯ˉ鍏ㄧ┖缂洪儴鍒嗭細</p>
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
                        placeholder="杈撳叆缂哄け鏂囧瓧"
                        className="mt-3 input-main control-dense w-full"
                      />
                      {blankDrill.feedback ? <p className="mt-2 text-xs text-slate-600">{blankDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={submitBlankAnswer} className="btn-secondary-compact">
                          鎻愪氦鏈
                        </button>
                        <button
                          type="button"
                          onClick={revealHint}
                          disabled={blankDrill.hintLevel >= 3}
                          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)] transition hover:bg-amber-100"
                        >
                          鏌ョ湅鎻愮ず
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          缁撴潫缁冧範
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">鎻愮ず浣跨敤娆℃暟锛歿blankDrill.hintUsedCount}</p>
                    </div>
                  ) : null}

                  {fullTextDrill && !fullTextDrill.finished ? (
                    <div className="rounded-2xl bg-ink-50 p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>鍏ㄦ枃榛樺啓锛堢畝鐗堬級</span>
                        <span>寤鸿鍏堝彛澶磋儗璇靛啀杈撳叆</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">璇烽粯鍐欐暣棣栬瘲璇嶏細</p>
                      <textarea
                        value={fullTextDrill.input}
                        onChange={(event) => setDrill({ ...fullTextDrill, input: event.target.value })}
                        placeholder="鍦ㄨ繖閲岃緭鍏ヤ綘鐨勯粯鍐欏唴瀹?
                        className="mt-2 h-32 w-full rounded-lg bg-white px-3 py-2 text-sm leading-7 outline-none shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)] transition focus:shadow-[inset_0_0_0_1px_rgba(26,43,76,0.45)]"
                      />
                      {fullTextDrill.feedback ? <p className="mt-2 text-xs text-slate-600">{fullTextDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={submitFullTextDrill} className="btn-secondary-compact">
                          鎻愪氦鍏ㄦ枃
                        </button>
                        <button
                          type="button"
                          onClick={revealHint}
                          disabled={fullTextDrill.hintLevel >= 3}
                          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)] transition hover:bg-amber-100"
                        >
                          鏌ョ湅鎻愮ず
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          缁撴潫缁冧範
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">鎻愮ず浣跨敤娆℃暟锛歿fullTextDrill.hintUsedCount}</p>
                    </div>
                  ) : null}

                  {dictationDrill && !dictationDrill.finished ? (
                    <div className="rounded-2xl bg-ink-50 p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>鍚啓妯″紡</span>
                        <span>鐐瑰嚮鈥滄湕璇诲師鏂団€濆悗寮€濮嬭緭鍏?</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const ok = readTextAloud(dictationDrill.targetText, dictationDrill.playbackRate);
                            if (!ok) {
                              setDrillError("褰撳墠娴忚鍣ㄤ笉鏀寔璇煶鏈楄锛岃鏀圭敤鍏ㄦ枃榛樺啓銆?);
                            }
                          }}
                          className="rounded-lg bg-cyan-50 px-3 py-1.5 text-xs text-cyan-700 shadow-[inset_0_0_0_1px_rgba(8,145,178,0.25)] transition hover:bg-cyan-100"
                        >
                          鏈楄鍘熸枃
                        </button>
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          璇€?                          <input
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
                        placeholder="鏍规嵁鏈楄鍐呭杈撳叆浣犵殑鍚啓缁撴灉"
                        className="mt-3 h-32 w-full rounded-lg bg-white px-3 py-2 text-sm leading-7 outline-none shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)] transition focus:shadow-[inset_0_0_0_1px_rgba(26,43,76,0.45)]"
                      />
                      {dictationDrill.feedback ? <p className="mt-2 text-xs text-slate-600">{dictationDrill.feedback}</p> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={submitDictationDrill} className="btn-secondary-compact">
                          鎻愪氦鍚啓
                        </button>
                        <button
                          type="button"
                          onClick={revealHint}
                          disabled={dictationDrill.hintLevel >= 3}
                          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)] transition hover:bg-amber-100"
                        >
                          鏌ョ湅鎻愮ず
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          缁撴潫缁冧範
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">鎻愮ず浣跨敤娆℃暟锛歿dictationDrill.hintUsedCount}</p>
                    </div>
                  ) : null}

                  {nextLineDrill && nextLineDrill.finished ? (
                    <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <h4 className="text-sm text-ink-700">缁冧範瀹屾垚</h4>
                      <p className="mt-2 text-sm text-slate-700">
                        姝ｇ‘鐜?{Math.round(nextLineDrill.accuracy * 100)}%锛屽缓璁川閲忓垎 {nextLineDrill.recommendedQuality}/5锛岀敤鏃?{nextLineDrill.spentSeconds} 绉掋€?                      </p>
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
                          鎸夋湰娆＄粨鏋滄墦鍗?                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          鍏抽棴
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {blankDrill && blankDrill.finished ? (
                    <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <h4 className="text-sm text-ink-700">缁冧範瀹屾垚</h4>
                      <p className="mt-2 text-sm text-slate-700">
                        姝ｇ‘鐜?{Math.round(blankDrill.accuracy * 100)}%锛屽缓璁川閲忓垎 {blankDrill.recommendedQuality}/5锛岀敤鏃?{blankDrill.spentSeconds} 绉掋€?                      </p>
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
                          鎸夋湰娆＄粨鏋滄墦鍗?                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          鍏抽棴
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {fullTextDrill && fullTextDrill.finished ? (
                    <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <h4 className="text-sm text-ink-700">榛樺啓瀹屾垚</h4>
                      <p className="mt-2 text-sm text-slate-700">
                        {fullTextDrill.feedback} 鐢ㄦ椂 {fullTextDrill.spentSeconds} 绉掋€?                      </p>
                      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">鍘熸枃鍙傝€冿細{fullTextDrill.targetText}</div>
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
                          鎸夋湰娆＄粨鏋滄墦鍗?                        </button>
                        <button type="button" onClick={() => startFullTextDrill(selectedMemoryItem)} className="btn-secondary-compact">
                          閲嶆柊榛樺啓
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          鍏抽棴
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {dictationDrill && dictationDrill.finished ? (
                    <div className="rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.08)]">
                      <h4 className="text-sm text-ink-700">鍚啓瀹屾垚</h4>
                      <p className="mt-2 text-sm text-slate-700">
                        {dictationDrill.feedback} 鐢ㄦ椂 {dictationDrill.spentSeconds} 绉掋€?                      </p>
                      <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">鍘熸枃鍙傝€冿細{dictationDrill.targetText}</div>
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
                          鎸夋湰娆＄粨鏋滄墦鍗?                        </button>
                        <button type="button" onClick={() => startDictationDrill(selectedMemoryItem)} className="btn-secondary-compact">
                          閲嶆柊鍚啓
                        </button>
                        <button type="button" onClick={() => setDrill(null)} className="btn-secondary-compact">
                          鍏抽棴
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="state-card flow-sm">
                  {dueItems.length > 0 ? (
                    <>
                      <p className="text-sm text-slate-600">鍏堜粠浠婃棩闃熷垪閫夋嫨 1 鏉′换鍔°€?</p>
                      <div className="memory-empty-actions justify-center">
                        <button type="button" className="btn-secondary-compact" onClick={() => openQueueWorkspace("focus")}>
                          鍘婚€変粖鏃ヤ换鍔?                        </button>
                        <button
                          type="button"
                          className="btn-secondary-compact"
                          onClick={() => {
                            openQueueWorkspace("manage");
                          }}
                        >
                          璋冩暣绛涢€変笌鍒嗛〉
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600">褰撳墠娌℃湁鍙涔犳潯鐩€?</p>
                      <button type="button" className="btn-secondary-compact mx-auto" onClick={() => setDetailTab("add")}>
                        鍘绘坊鍔犺蹇嗗唴瀹?                      </button>
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
                  placeholder="渚嬪锛氶潤澶滄€濄€佹潕鐧姐€佹槑鏈?
                  className="input-main control-dense w-full"
                />
                <button
                  type="button"
                  onClick={() => void searchPoems()}
                  disabled={searching}
                  className="btn-secondary btn-dense disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {searching ? "鎼滅储涓?.." : "鎼滅储"}
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
                            {poem.author} 路 {poem.dynasty}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={enrollingId === poem.id}
                          onClick={() => void enrollPoem(poem.id)}
                          className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {enrollingId === poem.id ? "鍔犲叆涓?.." : "鍔犲叆璁板繂"}
                        </button>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-600">{poem.content}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">杈撳叆鍏抽敭璇嶅悗鎼滅储鍙姞鍏ョ殑璇楄瘝銆?</p>
              )}
            </section>
          ) : null}

          {detailTab === "insight" ? (
            <div className="flow-sm">
              <PillNav items={insightTabNavItems} value={insightTab} onChange={setInsightTab} className="bg-stone-200/75" />

              {insightTab !== "recent" ? (
                <>
                  {loadingStats ? <p className="text-sm text-slate-500">鍔犺浇涓?..</p> : null}

                  {!loadingStats && achievements.length === 0 ? <p className="text-sm text-slate-500">瀹屾垚鎵撳崱鍚庡皢瑙ｉ攣浣犵殑瀛︿範鎴愬氨銆?</p> : null}

                  {!loadingStats && achievements.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]">
                          宸茶В閿佹垚灏憋細{unlockedAchievementCount}/{achievements.length}
                        </p>
                        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]">
                          浠婃棩宸叉墦鍗★細{reviewedTodayCount} 鏉?                        </p>
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
                                <span className="text-[11px]">{achievement.unlocked ? "宸茶В閿? : `${achievement.progress}/${achievement.target}`}</span>
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
                  {loadingStats ? <p className="text-sm text-slate-500">鍔犺浇涓?..</p> : null}
                  {!loadingStats && recentRecords.length === 0 ? <p className="text-sm text-slate-500">鏆傛棤鎵撳崱璁板綍銆?</p> : null}
                  {!loadingStats && recentRecords.length > 0 ? (
                    <div className="flow-sm">
                      {recentRecords.map((item, index) => (
                        <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          <p>
                            {item.poem?.title || "鏈懡鍚嶈瘲璇?} 路 {memoryModeLabelMap[item.mode] || "缁冧範"} 路 {item.quality}/5
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
          title="璁板繂涔嬪悗鎺ㄨ崘鍔ㄤ綔"
          subtitle="记忆不是终点：把打卡结果送回学情与练测，形成持续复盘闭环。"
          items={memoryNextStepItems}
          className="mt-2"
        />
      </PageStage>
    </div>
  );
}






