import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { apiGet, apiPost } from "@/lib/api";
import {
  toPercent,
  isDueToday,
  buildDrillPairs as buildMemoryDrillPairs,
  buildBlankQuestions as buildMemoryBlankQuestions,
  normalizeCompareText,
  masteryLabel,
  masteryTone,
  qualityByAccuracy,
  buildHeatmapCells,
  type BlankQuestion as MemoryBlankQuestion,
  type DrillPair as MemoryDrillPair,
} from "@/lib/memoryUtils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MemoryItem {
  id: string;
  poemId: string;
  poemTitle: string;
  author: string;
  dynasty: string;
  firstLine: string;
  content: string;
  dueDate: string | null;
  interval: number;
  easeFactor: number;
  repetitions: number;
  reviewCount: number;
  totalReviews: number;
  averageQuality: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryStats {
  total: number;
  due: number;
  mature: number;
  young: number;
  averageRetention: number;
  streak: number;
  longestStreak: number;
  todayReviewed: number;
}

export interface MemoryAchievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
  progress: number;
  target: number;
}

export interface DrillPair {
  key: string;
  prompt: string;
  answer: string;
}

export interface BlankQuestion {
  index: number;
  sentence: string;
  stripped: string;
  answer: string;
  blank: string;
}

export type DrillMode = "idle" | "recite" | "fillBlanks" | "pairs" | "dictation";

export interface DrillReciteState {
  phase: "preview" | "recall" | "check";
}

export interface DrillFillBlanksState {
  phase: "answering" | "done";
  questions: BlankQuestion[];
  userAnswers: string[];
  correctCount: number;
}

export interface DrillPairsState {
  phase: "matching" | "done";
  clueItems: DrillPair[];
  answerPool: string[];
  selectedClue: string | null;
  selectedAnswer: string | null;
  matched: Record<string, string>;
  correctCount: number;
}

export interface DrillDictationState {
  phase: "writing" | "check";
  userInput: string;
  feedback: string | null;
}

export type DrillState =
  | { mode: "idle" }
  | { mode: "recite"; recite: DrillReciteState }
  | { mode: "fillBlanks"; fillBlanks: DrillFillBlanksState }
  | { mode: "pairs"; pairs: DrillPairsState }
  | { mode: "dictation"; dictation: DrillDictationState };

export type QueueWorkspaceView = "queue" | " للمعارف" | "stats" | "search";

/* ------------------------------------------------------------------ */
/*  Reducer for complex state bundles                                  */
/* ------------------------------------------------------------------ */

interface MemoryTabState {
  /* queue */
  items: MemoryItem[];
  queueLoading: boolean;
  queueError: string | null;
  page: number;
  pageSize: number;
  total: number;
  dueCount: number;
  onlyDue: boolean;

  /* review */
  savingId: string | null;
  message: string | null;

  /* stats */
  statsData: MemoryStats | null;
  statsLoading: boolean;

  /* achievements */
  achievements: MemoryAchievement[];
  insightTab: string;

  /* drill */
  drill: DrillState;
  drillError: string | null;
  selectedMemoryItem: MemoryItem | null;

  /* search */
  searchQuery: string;
  searchResults: any[];
  searchLoading: boolean;
  searchError: string | null;

  /* workspace nav */
  activeWorkspace: "review" | "digest" | "ume";
  queueWorkspaceView: QueueWorkspaceView;
  detailTab: string;
}

type MemoryTabAction =
  | { type: "PATCH_STATE"; updater: (state: MemoryTabState) => MemoryTabState }
  | { type: "SET_QUEUE_LOADING"; loading: boolean }
  | { type: "SET_QUEUE_ERROR"; error: string | null }
  | { type: "SET_QUEUE_DATA"; items: MemoryItem[]; total: number; dueCount: number }
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_PAGE_SIZE"; pageSize: number }
  | { type: "TOGGLE_ONLY_DUE" }
  | { type: "SET_SAVING_ID"; id: string | null }
  | { type: "SET_MESSAGE"; message: string | null }
  | { type: "SET_STATS"; data: MemoryStats }
  | { type: "SET_STATS_LOADING"; loading: boolean }
  | { type: "SET_ACHIEVEMENTS"; achievements: MemoryAchievement[] }
  | { type: "SET_INSIGHT_TAB"; tab: string }
  | { type: "SET_DRILL"; drill: DrillState }
  | { type: "SET_DRILL_ERROR"; error: string | null }
  | { type: "SET_SELECTED_MEMORY_ITEM"; item: MemoryItem | null }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "SET_SEARCH_RESULTS"; results: any[] }
  | { type: "SET_SEARCH_LOADING"; loading: boolean }
  | { type: "SET_SEARCH_ERROR"; error: string | null }
  | { type: "SET_ACTIVE_WORKSPACE"; ws: MemoryTabState["activeWorkspace"] }
  | { type: "SET_QUEUE_WORKSPACE_VIEW"; view: QueueWorkspaceView }
  | { type: "SET_DETAIL_TAB"; tab: string }
  | { type: "UPDATE_ITEM"; id: string; patch: Partial<MemoryItem> }
  | { type: "REMOVE_ITEM"; id: string };

const initialMemoryTabState: MemoryTabState = {
  items: [],
  queueLoading: false,
  queueError: null,
  page: 1,
  pageSize: 12,
  total: 0,
  dueCount: 0,
  onlyDue: false,
  savingId: null,
  message: null,
  statsData: null,
  statsLoading: false,
  achievements: [],
  insightTab: "overview",
  drill: { mode: "idle" },
  drillError: null,
  selectedMemoryItem: null,
  searchQuery: "",
  searchResults: [],
  searchLoading: false,
  searchError: null,
  activeWorkspace: "review",
  queueWorkspaceView: "queue",
  detailTab: "info",
};

function memoryTabReducer(state: MemoryTabState, action: MemoryTabAction): MemoryTabState {
  switch (action.type) {
    case "PATCH_STATE":
      return action.updater(state);
    case "SET_QUEUE_LOADING":
      return { ...state, queueLoading: action.loading };
    case "SET_QUEUE_ERROR":
      return { ...state, queueError: action.error, queueLoading: false };
    case "SET_QUEUE_DATA":
      return { ...state, items: action.items, total: action.total, dueCount: action.dueCount, queueLoading: false, queueError: null };
    case "SET_PAGE":
      return { ...state, page: action.page };
    case "SET_PAGE_SIZE":
      return { ...state, pageSize: action.pageSize, page: 1 };
    case "TOGGLE_ONLY_DUE":
      return { ...state, onlyDue: !state.onlyDue, page: 1 };
    case "SET_SAVING_ID":
      return { ...state, savingId: action.id };
    case "SET_MESSAGE":
      return { ...state, message: action.message };
    case "SET_STATS":
      return { ...state, statsData: action.data, statsLoading: false };
    case "SET_STATS_LOADING":
      return { ...state, statsLoading: action.loading };
    case "SET_ACHIEVEMENTS":
      return { ...state, achievements: action.achievements };
    case "SET_INSIGHT_TAB":
      return { ...state, insightTab: action.tab };
    case "SET_DRILL":
      return { ...state, drill: action.drill };
    case "SET_DRILL_ERROR":
      return { ...state, drillError: action.error };
    case "SET_SELECTED_MEMORY_ITEM":
      return { ...state, selectedMemoryItem: action.item, drill: { mode: "idle" }, drillError: null };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };
    case "SET_SEARCH_RESULTS":
      return { ...state, searchResults: action.results, searchLoading: false, searchError: null };
    case "SET_SEARCH_LOADING":
      return { ...state, searchLoading: action.loading };
    case "SET_SEARCH_ERROR":
      return { ...state, searchError: action.error, searchLoading: false };
    case "SET_ACTIVE_WORKSPACE":
      return { ...state, activeWorkspace: action.ws };
    case "SET_QUEUE_WORKSPACE_VIEW":
      return { ...state, queueWorkspaceView: action.view };
    case "SET_DETAIL_TAB":
      return { ...state, detailTab: action.tab };
    case "UPDATE_ITEM": {
      const idx = state.items.findIndex((it) => it.id === action.id);
      if (idx === -1) return state;
      const next = [...state.items];
      next[idx] = { ...next[idx], ...action.patch };
      return { ...state, items: next };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((it) => it.id !== action.id), total: Math.max(0, state.total - 1) };
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useMemoryTab() {
  const [state, dispatch] = useReducer(memoryTabReducer, initialMemoryTabState);

  /* ---- derived ---- */
  const isReviewingRef = useRef(false);

  const stats = useMemo(() => state.statsData, [state.statsData]);
  const heatmapCells = useMemo(
    () => (stats ? buildHeatmapCells(undefined, stats.todayReviewed, stats.streak) : []),
    [stats],
  );
  const masteryPct = useMemo(() => (stats ? Math.round(stats.averageRetention || 0) : 0), [stats]);

  /* ---- queue ---- */
  const loadTodayQueue = useCallback(
    async (page?: number, pageSize?: number, onlyDue?: boolean) => {
      const p = page ?? state.page;
      const ps = pageSize ?? state.pageSize;
      const od = onlyDue ?? state.onlyDue;
      dispatch({ type: "SET_QUEUE_LOADING", loading: true });
      dispatch({ type: "SET_QUEUE_ERROR", error: null });
      try {
        const res = await apiGet<{ items: MemoryItem[]; total: number; dueCount: number }>(
          `/memory/today?page=${p}&pageSize=${ps}&onlyDue=${od}`
        );
        dispatch({
          type: "SET_QUEUE_DATA",
          items: res.items,
          total: res.total,
          dueCount: res.dueCount,
        });
      } catch (e: any) {
        dispatch({ type: "SET_QUEUE_ERROR", error: e?.message ?? "加载失败" });
      }
    },
    [state.page, state.pageSize, state.onlyDue]
  );

  const setPage = useCallback((page: number) => {
    dispatch({ type: "SET_PAGE", page });
  }, []);

  const toggleOnlyDue = useCallback(() => {
    dispatch({ type: "TOGGLE_ONLY_DUE" });
  }, []);

  /* ---- stats ---- */
  const loadStats = useCallback(async () => {
    dispatch({ type: "SET_STATS_LOADING", loading: true });
    try {
      const data = await apiGet<MemoryStats>("/memory/stats");
      dispatch({ type: "SET_STATS", data });
    } catch {
      dispatch({ type: "SET_STATS_LOADING", loading: false });
    }
  }, []);

  /* ---- review ---- */
  const submitReview = useCallback(async (item: MemoryItem, quality: number) => {
    dispatch({ type: "SET_SAVING_ID", id: item.id });
    dispatch({ type: "SET_MESSAGE", message: null });
    try {
      const res = await apiPost<{ nextDue: string; message?: string }>("/memory/review", {
        memoryId: item.id,
        quality,
      });
      dispatch({ type: "UPDATE_ITEM", id: item.id, patch: { dueDate: res.nextDue } });
      dispatch({ type: "SET_MESSAGE", message: res.message ?? "已记录" });
      return true;
    } catch (e: any) {
      dispatch({ type: "SET_MESSAGE", message: e?.message ?? "提交失败" });
      return false;
    } finally {
      dispatch({ type: "SET_SAVING_ID", id: null });
    }
  }, []);

  /* ---- search ---- */
  const searchPoems = useCallback(async (keyword: string) => {
    dispatch({ type: "SET_SEARCH_LOADING", loading: true });
    dispatch({ type: "SET_SEARCH_ERROR", error: null });
    try {
      const res = await apiGet<any[]>(`/poems/search?keyword=${encodeURIComponent(keyword)}`);
      dispatch({ type: "SET_SEARCH_RESULTS", results: res });
    } catch (e: any) {
      dispatch({ type: "SET_SEARCH_ERROR", error: e?.message ?? "搜索失败" });
    }
  }, []);

  /* ---- enroll ---- */
  const enrollPoem = useCallback(async (poemId: string) => {
    try {
      await apiPost("/memory/enroll", { poemId });
      await loadTodayQueue();
      await loadStats();
      dispatch({ type: "SET_MESSAGE", message: "已加入记忆库" });
    } catch (e: any) {
      dispatch({ type: "SET_MESSAGE", message: e?.message ?? "登记失败" });
    }
  }, [loadTodayQueue, loadStats]);

  /* ---- drill ---- */
  const startDrill = useCallback((item: MemoryItem, mode: Exclude<DrillMode, "idle">) => {
    dispatch({ type: "SET_SELECTED_MEMORY_ITEM", item });

    switch (mode) {
      case "recite":
        dispatch({ type: "SET_DRILL", drill: { mode: "recite", recite: { phase: "preview" } } });
        break;
      case "fillBlanks": {
        const questions = buildMemoryBlankQuestions(item.content).map(
          (question: MemoryBlankQuestion, index): BlankQuestion => ({
            index,
            sentence: question.fullLine,
            stripped: question.fullLine,
            answer: question.answer,
            blank: question.answer,
          }),
        );
        dispatch({
          type: "SET_DRILL",
          drill: {
            mode: "fillBlanks",
            fillBlanks: { phase: "answering", questions, userAnswers: new Array(questions.length).fill(""), correctCount: 0 },
          },
        });
        break;
      }
      case "pairs": {
        const clueItems = buildMemoryDrillPairs(item.content).map(
          (pair: MemoryDrillPair, index): DrillPair => ({
            key: `pair-${index}`,
            prompt: pair.prompt,
            answer: pair.answer,
          }),
        );
        const answerPool = clueItems.map((pair) => pair.answer).sort(() => Math.random() - 0.5);
        dispatch({
          type: "SET_DRILL",
          drill: {
            mode: "pairs",
            pairs: {
              phase: "matching",
              clueItems,
              answerPool,
              selectedClue: null,
              selectedAnswer: null,
              matched: {},
              correctCount: 0,
            },
          },
        });
        break;
      }
      case "dictation":
        dispatch({
          type: "SET_DRILL",
          drill: { mode: "dictation", dictation: { phase: "writing", userInput: "", feedback: null } },
        });
        break;
    }
  }, []);

  const cancelDrill = useCallback(() => {
    dispatch({ type: "SET_DRILL", drill: { mode: "idle" } });
  }, []);

  /* recite sub-actions */
  const reciteNextPhase = useCallback(() => {
    dispatch({ type: "PATCH_STATE", updater: (prev) => {
      if (prev.drill.mode !== "recite") return prev;
      const cur = prev.drill.recite.phase;
      const next: DrillReciteState["phase"] = cur === "preview" ? "recall" : cur === "recall" ? "check" : "preview";
      return { ...prev, drill: { mode: "recite" as const, recite: { phase: next } } };
    } });
  }, []);

  /* fill-blanks sub-actions */
  const updateBlankAnswer = useCallback((index: number, value: string) => {
    dispatch({ type: "PATCH_STATE", updater: (prev) => {
      if (prev.drill.mode !== "fillBlanks") return prev;
      const userAnswers = [...prev.drill.fillBlanks.userAnswers];
      userAnswers[index] = value;
      return { ...prev, drill: { ...prev.drill, fillBlanks: { ...prev.drill.fillBlanks, userAnswers } } };
    } });
  }, []);

  const submitFillBlanks = useCallback(() => {
    dispatch({ type: "PATCH_STATE", updater: (prev) => {
      if (prev.drill.mode !== "fillBlanks") return prev;
      const { questions, userAnswers } = prev.drill.fillBlanks;
      let correctCount = 0;
      for (let i = 0; i < questions.length; i++) {
        if (normalizeCompareText(userAnswers[i]) === normalizeCompareText(questions[i].answer)) correctCount++;
      }
      return { ...prev, drill: { ...prev.drill, fillBlanks: { ...prev.drill.fillBlanks, phase: "done" as const, correctCount } } };
    } });
  }, []);

  /* pairs sub-actions */
  const selectClue = useCallback((key: string) => {
    dispatch({ type: "PATCH_STATE", updater: (prev) => {
      if (prev.drill.mode !== "pairs") return prev;
      return { ...prev, drill: { ...prev.drill, pairs: { ...prev.drill.pairs, selectedClue: key } } };
    } });
  }, []);

  const selectAnswer = useCallback((answer: string) => {
    dispatch({ type: "PATCH_STATE", updater: (prev) => {
      if (prev.drill.mode !== "pairs") return prev;
      const { pairs } = prev.drill;
      if (!pairs.selectedClue) return prev;
      const isCorrect = pairs.clueItems.find((c) => c.key === pairs.selectedClue)?.answer === answer;
      const nextMatched = { ...pairs.matched };
      if (isCorrect) {
        nextMatched[pairs.selectedClue] = answer;
      }
      const totalPairs = pairs.clueItems.length;
      const correctCount = Object.keys(nextMatched).length;
      const phase: DrillPairsState["phase"] = correctCount >= totalPairs ? "done" : "matching";
      return {
        ...prev,
        drill: {
          ...prev.drill,
          pairs: {
            ...pairs,
            selectedClue: null,
            selectedAnswer: null,
            matched: nextMatched,
            correctCount,
            phase,
          },
        },
      };
    } });
  }, []);

  /* dictation sub-actions */
  const updateDictationInput = useCallback((value: string) => {
    dispatch({ type: "PATCH_STATE", updater: (prev) => {
      if (prev.drill.mode !== "dictation") return prev;
      return { ...prev, drill: { ...prev.drill, dictation: { ...prev.drill.dictation, userInput: value } } };
    } });
  }, []);

  const submitDictation = useCallback(() => {
    dispatch({ type: "PATCH_STATE", updater: (prev) => {
      if (prev.drill.mode !== "dictation" || !prev.selectedMemoryItem) return prev;
      const { userInput } = prev.drill.dictation;
      const actualContent = prev.selectedMemoryItem.content.replace(/[，。！？；：""''《》\s]/g, "");
      const inputClean = userInput.replace(/[，。！？；：""''《》\s]/g, "");
      const correct = actualContent === inputClean;
      return {
        ...prev,
        drill: {
          ...prev.drill,
          dictation: { ...prev.drill.dictation, phase: "check" as const, feedback: correct ? "完全正确！" : "请核对原文" },
        },
      };
    } });
  }, []);

  /* ---- drill completion -> submit quality ---- */
  const completeDrillWithQuality = useCallback(
    async (item: MemoryItem, accuracy: number) => {
      const quality = qualityByAccuracy(accuracy);
      const ok = await submitReview(item, quality);
      dispatch({ type: "SET_DRILL", drill: { mode: "idle" } });
      return ok;
    },
    [submitReview]
  );

  /* ---- workspace nav ---- */
  const setActiveWorkspace = useCallback((ws: MemoryTabState["activeWorkspace"]) => {
    dispatch({ type: "SET_ACTIVE_WORKSPACE", ws });
  }, []);

  const setQueueWorkspaceView = useCallback((view: QueueWorkspaceView) => {
    dispatch({ type: "SET_QUEUE_WORKSPACE_VIEW", view });
  }, []);

  const setDetailTab = useCallback((tab: string) => {
    dispatch({ type: "SET_DETAIL_TAB", tab });
  }, []);

  const setInsightTab = useCallback((tab: string) => {
    dispatch({ type: "SET_INSIGHT_TAB", tab });
  }, []);

  /* ---- effects ---- */
  // Auto-load queue when page / onlyDue change
  const prevPageKeyRef = useRef("");
  useEffect(() => {
    const key = `${state.page}|${state.pageSize}|${state.onlyDue}`;
    if (key !== prevPageKeyRef.current) {
      prevPageKeyRef.current = key;
      loadTodayQueue(state.page, state.pageSize, state.onlyDue);
    }
  }, [state.page, state.pageSize, state.onlyDue, loadTodayQueue]);

  // Load stats on mount
  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- return ---- */
  return {
    /* state */
    ...state,

    /* derived */
    stats,
    heatmapCells,
    masteryPct,

    /* actions */
    loadTodayQueue,
    loadStats,
    submitReview,
    searchPoems,
    enrollPoem,
    startDrill,
    cancelDrill,
    reciteNextPhase,
    updateBlankAnswer,
    submitFillBlanks,
    selectClue,
    selectAnswer,
    updateDictationInput,
    submitDictation,
    completeDrillWithQuality,
    setPage,
    toggleOnlyDue,
    setActiveWorkspace,
    setQueueWorkspaceView,
    setDetailTab,
    setInsightTab,
    setSearchQuery: (q: string) => dispatch({ type: "SET_SEARCH_QUERY", query: q }),
  };
}

export default useMemoryTab;
