import { useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { ExamDiagnostics, FavoritePoemItem, PaginationMeta, PracticeSessionSummaryRecord } from "@/types";
import type { WrongQuestionRow, WrongStatus, WrongTrendPoint } from "@/components/my-learning/wrongbookTypes";

export type WrongFilterStatus = "all" | WrongStatus;
export type WrongQuestionType = "all" | string;
export type WrongTimeRange = "all" | "7" | "30";

interface WrongbookBatchPayload {
  ids: string[];
  action: "set_status" | "delete";
  status?: WrongStatus;
}

interface WrongbookMetaOption {
  value: string;
  count: number;
}

interface WrongbookMetaResponse {
  errorTypes: WrongbookMetaOption[];
  questionKinds: WrongbookMetaOption[];
  keywordTags: WrongbookMetaOption[];
  dynasties: WrongbookMetaOption[];
  themes: WrongbookMetaOption[];
}

interface PracticeSessionSummaryListResponse {
  items: PracticeSessionSummaryRecord[];
  pagination?: PaginationMeta;
}

interface WrongbookDashboardResponse {
  items: WrongQuestionRow[];
  meta: WrongbookMetaResponse;
  trend: {
    days: number;
    items: WrongTrendPoint[];
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
}

interface FavoritePoemsResponse {
  items: FavoritePoemItem[];
  pagination?: PaginationMeta;
}

interface LatestExamDiagnosticsEnvelope {
  exists: boolean;
  createdAt?: string | null;
  examType?: string | null;
  score?: number;
  maxScore?: number;
  percent?: number;
  diagnostics?: ExamDiagnostics | null;
}

export function useMyLearningData() {
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestionRow[]>([]);
  const [wrongLoading, setWrongLoading] = useState<boolean>(false);
  const [wrongError, setWrongError] = useState<string | null>(null);
  const [wrongStatusFilter, setWrongStatusFilter] = useState<WrongFilterStatus>("all");
  const [wrongTypeFilter, setWrongTypeFilter] = useState<WrongQuestionType>("all");
  const [wrongQuestionKindFilter, setWrongQuestionKindFilter] = useState<string>("all");
  const [wrongKeywordTagFilter, setWrongKeywordTagFilter] = useState<string>("");
  const [wrongPeriodFilter, setWrongPeriodFilter] = useState<WrongTimeRange>("all");
  const [wrongFocusDate, setWrongFocusDate] = useState<string>("");
  const [wrongDynastyFilter, setWrongDynastyFilter] = useState<string>("");
  const [wrongThemeFilter, setWrongThemeFilter] = useState<string>("");
  const [wrongKeyword, setWrongKeyword] = useState<string>("");
  const [wrongMeta, setWrongMeta] = useState<WrongbookMetaResponse>({
    errorTypes: [],
    questionKinds: [],
    keywordTags: [],
    dynasties: [],
    themes: [],
  });
  const [wrongMetaLoading, setWrongMetaLoading] = useState<boolean>(false);
  const [wrongTrend, setWrongTrend] = useState<WrongTrendPoint[]>([]);
  const [wrongTrendLoading, setWrongTrendLoading] = useState<boolean>(false);
  const [wrongTrendShowAllDays, setWrongTrendShowAllDays] = useState<boolean>(false);
  const [wrongTrendExpanded, setWrongTrendExpanded] = useState<boolean>(false);
  const [wrongTrendView, setWrongTrendView] = useState<"day" | "week">("day");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [wrongPage, setWrongPage] = useState<number>(1);
  const [wrongPageSize, setWrongPageSize] = useState<number>(24);
  const [wrongTotal, setWrongTotal] = useState<number>(0);
  const [wrongTotalPages, setWrongTotalPages] = useState<number>(1);
  const [wrongOverviewCounts, setWrongOverviewCounts] = useState<{ total: number; pending: number } | null>(null);
  const [showAdvancedWrongFilters, setShowAdvancedWrongFilters] = useState<boolean>(false);

  const [latestExamDiag, setLatestExamDiag] = useState<LatestExamDiagnosticsEnvelope | null>(null);
  const [latestExamDiagLoading, setLatestExamDiagLoading] = useState<boolean>(false);
  const [latestExamDiagError, setLatestExamDiagError] = useState<string | null>(null);

  const [examSummaryLogs, setExamSummaryLogs] = useState<PracticeSessionSummaryRecord[]>([]);
  const [examSummaryLogsLoading, setExamSummaryLogsLoading] = useState<boolean>(false);
  const [examSummaryLogsError, setExamSummaryLogsError] = useState<string | null>(null);
  const [examSummaryKeyword, setExamSummaryKeyword] = useState<string>("");
  const [examSummaryAppliedKeyword, setExamSummaryAppliedKeyword] = useState<string>("");
  const [examSummaryDays, setExamSummaryDays] = useState<WrongTimeRange>("30");
  const [examSummaryPage, setExamSummaryPage] = useState<number>(1);
  const [examSummaryPageSize] = useState<number>(6);
  const [examSummaryTotal, setExamSummaryTotal] = useState<number>(0);
  const [examSummaryTotalPages, setExamSummaryTotalPages] = useState<number>(1);
  const [examSummaryDeleteId, setExamSummaryDeleteId] = useState<string | null>(null);

  const [graphCompareLogs, setGraphCompareLogs] = useState<PracticeSessionSummaryRecord[]>([]);
  const [graphCompareLogsLoading, setGraphCompareLogsLoading] = useState<boolean>(false);
  const [graphCompareLogsError, setGraphCompareLogsError] = useState<string | null>(null);
  const [graphCompareKeyword, setGraphCompareKeyword] = useState<string>("");
  const [graphCompareAppliedKeyword, setGraphCompareAppliedKeyword] = useState<string>("");
  const [graphCompareDays, setGraphCompareDays] = useState<WrongTimeRange>("30");
  const [graphComparePage, setGraphComparePage] = useState<number>(1);
  const [graphComparePageSize] = useState<number>(6);
  const [graphCompareTotal, setGraphCompareTotal] = useState<number>(0);
  const [graphCompareTotalPages, setGraphCompareTotalPages] = useState<number>(1);
  const [graphCompareDeleteId, setGraphCompareDeleteId] = useState<string | null>(null);

  const [favoriteItems, setFavoriteItems] = useState<FavoritePoemItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState<boolean>(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [unfavoriteLoadingId, setUnfavoriteLoadingId] = useState<string | null>(null);
  const [favoriteKeyword, setFavoriteKeyword] = useState<string>("");
  const [favoriteAppliedKeyword, setFavoriteAppliedKeyword] = useState<string>("");
  const [favoritePage, setFavoritePage] = useState<number>(1);
  const [favoritePageSize, setFavoritePageSize] = useState<number>(12);
  const [favoriteTotal, setFavoriteTotal] = useState<number>(0);
  const [favoriteTotalPages, setFavoriteTotalPages] = useState<number>(1);
  const [favoriteNoteDrafts, setFavoriteNoteDrafts] = useState<Record<string, string>>({});
  const [favoriteNoteSavingId, setFavoriteNoteSavingId] = useState<string | null>(null);
  const [favoriteNoteMessages, setFavoriteNoteMessages] = useState<Record<string, string>>({});

  const currentWrongFilters = (): {
    period: WrongTimeRange;
    date: string;
    status: WrongFilterStatus;
    type: WrongQuestionType;
    questionKind: string;
    keywordTag: string;
    dynasty: string;
    theme: string;
    keyword: string;
    page: number;
    pageSize: number;
  } => ({
    period: wrongPeriodFilter,
    date: wrongFocusDate,
    status: wrongStatusFilter,
    type: wrongTypeFilter,
    questionKind: wrongQuestionKindFilter,
    keywordTag: wrongKeywordTagFilter,
    dynasty: wrongDynastyFilter,
    theme: wrongThemeFilter,
    keyword: wrongKeyword,
    page: wrongPage,
    pageSize: wrongPageSize,
  });

  const loadWrongbookDashboard = async (filters?: {
    period?: WrongTimeRange;
    date?: string;
    status?: WrongFilterStatus;
    type?: WrongQuestionType;
    questionKind?: string;
    keywordTag?: string;
    dynasty?: string;
    theme?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
    force?: boolean;
  }): Promise<void> => {
    const targetPeriod = filters?.period ?? wrongPeriodFilter;
    const targetDate = (filters?.date ?? wrongFocusDate).trim();
    const targetStatus = filters?.status ?? wrongStatusFilter;
    const targetType = filters?.type ?? wrongTypeFilter;
    const targetQuestionKind = (filters?.questionKind ?? wrongQuestionKindFilter).trim();
    const targetKeywordTag = (filters?.keywordTag ?? wrongKeywordTagFilter).trim();
    const targetDynasty = (filters?.dynasty ?? wrongDynastyFilter).trim();
    const targetTheme = (filters?.theme ?? wrongThemeFilter).trim();
    const targetKeyword = (filters?.keyword ?? wrongKeyword).trim();
    const targetPage = Math.max(1, filters?.page ?? wrongPage);
    const targetPageSize = Math.max(6, Math.min(200, filters?.pageSize ?? wrongPageSize));
    const trendDays = targetPeriod === "all" ? 30 : Number(targetPeriod);

    setWrongLoading(true);
    setWrongMetaLoading(true);
    setWrongTrendLoading(true);
    setWrongError(null);

    try {
      const params = new URLSearchParams();
      if (targetPeriod !== "all") {
        params.set("days", targetPeriod);
      }
      if (targetDate) {
        params.set("date", targetDate);
      }
      if (targetStatus !== "all") {
        params.set("status", targetStatus);
      }
      if (targetType !== "all") {
        params.set("errorType", targetType);
      }
      if (targetQuestionKind && targetQuestionKind !== "all") {
        params.set("questionKind", targetQuestionKind);
      }
      if (targetKeywordTag) {
        params.set("keywordTag", targetKeywordTag);
      }
      if (targetDynasty) {
        params.set("dynasty", targetDynasty);
      }
      if (targetTheme) {
        params.set("theme", targetTheme);
      }
      if (targetKeyword) {
        params.set("q", targetKeyword);
      }
      params.set("page", String(targetPage));
      params.set("pageSize", String(targetPageSize));
      params.set("trendDays", String(trendDays));

      const query = params.toString();
      const data = await apiGet<WrongbookDashboardResponse>(`/wrongbook/dashboard?${query}`, {
        cacheTtlMs: 120000,
        force: filters?.force,
      });

      setWrongQuestions(data.items || []);
      setWrongMeta({
        errorTypes: data.meta?.errorTypes || [],
        questionKinds: data.meta?.questionKinds || [],
        keywordTags: data.meta?.keywordTags || [],
        dynasties: data.meta?.dynasties || [],
        themes: data.meta?.themes || [],
      });
      setWrongTrend(data.trend?.items || []);
      const total = Number(data.pagination?.total ?? data.items?.length ?? 0);
      const totalPages = Math.max(1, Number(data.pagination?.totalPages ?? 1));
      setWrongTotal(total);
      setWrongTotalPages(totalPages);
      setWrongPage(Number(data.pagination?.page ?? targetPage));
      setWrongPageSize(Number(data.pagination?.pageSize ?? targetPageSize));
      setSelectedIds([]);
    } catch (error: unknown) {
      setWrongError(error instanceof Error ? error.message : "加载错题失败");
    } finally {
      setWrongLoading(false);
      setWrongMetaLoading(false);
      setWrongTrendLoading(false);
    }
  };

  const runBatchAction = async (payload: WrongbookBatchPayload): Promise<void> => {
    if (payload.ids.length === 0) {
      return;
    }

    setBatchLoading(true);
    setWrongError(null);
    try {
      await apiPost("/wrongbook/batch", payload);
      await loadWrongbookDashboard(currentWrongFilters());
      await loadWrongbookOverviewCounts({ force: true });
    } catch (error: unknown) {
      setWrongError(error instanceof Error ? error.message : "批量操作失败");
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = (): void => {
    setSelectedIds((prev) => {
      if (prev.length === wrongQuestions.length) {
        return [];
      }
      return wrongQuestions.map((item) => item.id);
    });
  };

  const loadWrongbookOverviewCounts = async (options?: { force?: boolean; signal?: AbortSignal }): Promise<void> => {
    try {
      const [allData, pendingData] = await Promise.all([
        apiGet<WrongbookDashboardResponse>("/wrongbook/dashboard?page=1&pageSize=6&trendDays=30", {
          cacheTtlMs: 120000,
          force: options?.force,
          signal: options?.signal,
        }),
        apiGet<WrongbookDashboardResponse>("/wrongbook/dashboard?status=pending&page=1&pageSize=6&trendDays=30", {
          cacheTtlMs: 120000,
          force: options?.force,
          signal: options?.signal,
        }),
      ]);
      setWrongOverviewCounts({
        total: Number(allData.pagination?.total ?? allData.items?.length ?? 0),
        pending: Number(pendingData.pagination?.total ?? pendingData.items?.length ?? 0),
      });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      // keep previous overview counts as fallback
    }
  };

  const loadLatestExamDiagnostics = async (): Promise<void> => {
    setLatestExamDiagLoading(true);
    setLatestExamDiagError(null);
    try {
      const data = await apiGet<LatestExamDiagnosticsEnvelope>("/exam/latest-diagnostics");
      setLatestExamDiag(data);
    } catch (error: unknown) {
      setLatestExamDiagError(error instanceof Error ? error.message : "读取模考诊断失败");
    } finally {
      setLatestExamDiagLoading(false);
    }
  };

  const loadGraphCompareLogs = async (filters?: {
    keyword?: string;
    page?: number;
    days?: WrongTimeRange;
  }): Promise<void> => {
    setGraphCompareLogsLoading(true);
    setGraphCompareLogsError(null);
    try {
      const targetKeyword = (filters?.keyword ?? graphCompareAppliedKeyword).trim();
      const targetPage = Math.max(1, Number(filters?.page ?? graphComparePage));
      const targetDays = (filters?.days ?? graphCompareDays) as WrongTimeRange;
      const query = new URLSearchParams();
      query.set("source", "graph_compare");
      query.set("page", String(targetPage));
      query.set("pageSize", String(graphComparePageSize));
      if (targetKeyword) {
        query.set("q", targetKeyword);
      }
      if (targetDays !== "all") {
        query.set("days", targetDays);
      }
      const data = await apiGet<PracticeSessionSummaryListResponse>(`/practice/session-summaries?${query.toString()}`);
      setGraphCompareLogs(Array.isArray(data.items) ? data.items : []);
      const total = Number(data.pagination?.total ?? data.items?.length ?? 0);
      const totalPages = Math.max(1, Number(data.pagination?.totalPages ?? 1));
      setGraphCompareTotal(total);
      setGraphCompareTotalPages(totalPages);
      setGraphComparePage(Number(data.pagination?.page ?? targetPage));
      setGraphCompareAppliedKeyword(targetKeyword);
    } catch (error: unknown) {
      setGraphCompareLogsError(error instanceof Error ? error.message : "读取图谱对比小结失败");
    } finally {
      setGraphCompareLogsLoading(false);
    }
  };

  const loadExamSummaryLogs = async (filters?: {
    keyword?: string;
    page?: number;
    days?: WrongTimeRange;
  }): Promise<void> => {
    setExamSummaryLogsLoading(true);
    setExamSummaryLogsError(null);
    try {
      const targetKeyword = (filters?.keyword ?? examSummaryAppliedKeyword).trim();
      const targetPage = Math.max(1, Number(filters?.page ?? examSummaryPage));
      const targetDays = (filters?.days ?? examSummaryDays) as WrongTimeRange;
      const query = new URLSearchParams();
      query.set("source", "exam_submit");
      query.set("page", String(targetPage));
      query.set("pageSize", String(examSummaryPageSize));
      if (targetKeyword) {
        query.set("q", targetKeyword);
      }
      if (targetDays !== "all") {
        query.set("days", targetDays);
      }
      const data = await apiGet<PracticeSessionSummaryListResponse>(`/practice/session-summaries?${query.toString()}`);
      setExamSummaryLogs(Array.isArray(data.items) ? data.items : []);
      const total = Number(data.pagination?.total ?? data.items?.length ?? 0);
      const totalPages = Math.max(1, Number(data.pagination?.totalPages ?? 1));
      setExamSummaryTotal(total);
      setExamSummaryTotalPages(totalPages);
      setExamSummaryPage(Number(data.pagination?.page ?? targetPage));
      setExamSummaryAppliedKeyword(targetKeyword);
    } catch (error: unknown) {
      setExamSummaryLogsError(error instanceof Error ? error.message : "读取考试小结失败");
    } finally {
      setExamSummaryLogsLoading(false);
    }
  };

  const deleteExamSummaryLog = async (summaryId: string): Promise<void> => {
    setExamSummaryDeleteId(summaryId);
    setExamSummaryLogsError(null);
    try {
      await apiDelete(`/practice/session-summaries/${summaryId}`);
      await loadExamSummaryLogs({ page: examSummaryPage });
    } catch (error: unknown) {
      setExamSummaryLogsError(error instanceof Error ? error.message : "删除考试小结失败");
    } finally {
      setExamSummaryDeleteId(null);
    }
  };

  const deleteGraphCompareLog = async (summaryId: string): Promise<void> => {
    setGraphCompareDeleteId(summaryId);
    setGraphCompareLogsError(null);
    try {
      await apiDelete(`/practice/session-summaries/${summaryId}`);
      await loadGraphCompareLogs({ page: graphComparePage });
    } catch (error: unknown) {
      setGraphCompareLogsError(error instanceof Error ? error.message : "删除图谱对比小结失败");
    } finally {
      setGraphCompareDeleteId(null);
    }
  };

  const loadFavorites = async (filters?: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    force?: boolean;
  }): Promise<void> => {
    const targetPage = Math.max(1, filters?.page ?? favoritePage);
    const targetPageSize = Math.max(6, Math.min(60, filters?.pageSize ?? favoritePageSize));
    const targetKeyword = (filters?.keyword ?? favoriteAppliedKeyword).trim();
    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("pageSize", String(targetPageSize));
    if (targetKeyword) {
      params.set("q", targetKeyword);
    }

    setFavoritesLoading(true);
    setFavoritesError(null);
    try {
      const data = await apiGet<FavoritePoemsResponse>(`/poems/favorites?${params.toString()}`, {
        cacheTtlMs: 120000,
        force: filters?.force,
      });
      setFavoriteItems(data.items || []);
      const fallbackTotal = data.items?.length || 0;
      setFavoriteTotal(Number(data.pagination?.total ?? fallbackTotal));
      setFavoriteTotalPages(Math.max(1, Number(data.pagination?.totalPages ?? 1)));
      setFavoritePage(Number(data.pagination?.page ?? targetPage));
      setFavoritePageSize(Number(data.pagination?.pageSize ?? targetPageSize));
      setFavoriteAppliedKeyword(targetKeyword);
    } catch (error: unknown) {
      setFavoritesError(error instanceof Error ? error.message : "读取收藏失败");
    } finally {
      setFavoritesLoading(false);
    }
  };

  const unfavoritePoem = async (poemId: string): Promise<void> => {
    setUnfavoriteLoadingId(poemId);
    setFavoritesError(null);
    try {
      await apiPost<{ poemId: string; isFavorited: boolean }>(`/poems/${poemId}/favorite`, { favorited: false });
      await loadFavorites({
        page: favoritePage,
        pageSize: favoritePageSize,
        keyword: favoriteAppliedKeyword,
        force: true,
      });
      setFavoriteNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[poemId];
        return next;
      });
      setFavoriteNoteMessages((prev) => {
        const next = { ...prev };
        delete next[poemId];
        return next;
      });
    } catch (error: unknown) {
      setFavoritesError(error instanceof Error ? error.message : "取消收藏失败");
    } finally {
      setUnfavoriteLoadingId(null);
    }
  };

  const saveFavoriteNote = async (poemId: string): Promise<void> => {
    const sourceItem = favoriteItems.find((item) => item.poemId === poemId);
    const draft = favoriteNoteDrafts[poemId] ?? sourceItem?.note ?? "";
    const nextNote = draft.slice(0, 4000);

    setFavoriteNoteSavingId(poemId);
    setFavoritesError(null);
    setFavoriteNoteMessages((prev) => {
      const next = { ...prev };
      delete next[poemId];
      return next;
    });

    try {
      const data = await apiPatch<{ poemId: string; note: string; noteUpdatedAt?: string | null }>(
        `/poems/${poemId}/note`,
        { note: nextNote },
      );

      setFavoriteItems((prev) =>
        prev.map((item) =>
          item.poemId === poemId
            ? {
                ...item,
                note: data.note,
                noteUpdatedAt: data.noteUpdatedAt || null,
              }
            : item,
        ),
      );
      setFavoriteNoteDrafts((prev) => ({ ...prev, [poemId]: data.note || "" }));
      setFavoriteNoteMessages((prev) => ({ ...prev, [poemId]: data.note ? "笔记已保存。" : "笔记已清空。" }));
    } catch (error: unknown) {
      setFavoritesError(error instanceof Error ? error.message : "保存笔记失败");
    } finally {
      setFavoriteNoteSavingId(null);
    }
  };

  return {
    wrongQuestions,
    wrongLoading,
    wrongError,
    wrongStatusFilter,
    wrongTypeFilter,
    wrongQuestionKindFilter,
    wrongKeywordTagFilter,
    wrongPeriodFilter,
    wrongFocusDate,
    wrongDynastyFilter,
    wrongThemeFilter,
    wrongKeyword,
    wrongMeta,
    wrongMetaLoading,
    wrongTrend,
    wrongTrendLoading,
    wrongTrendShowAllDays,
    wrongTrendExpanded,
    wrongTrendView,
    selectedIds,
    batchLoading,
    wrongPage,
    wrongPageSize,
    wrongTotal,
    wrongTotalPages,
    wrongOverviewCounts,
    showAdvancedWrongFilters,

    latestExamDiag,
    latestExamDiagLoading,
    latestExamDiagError,
    examSummaryLogs,
    examSummaryLogsLoading,
    examSummaryLogsError,
    examSummaryKeyword,
    examSummaryAppliedKeyword,
    examSummaryDays,
    examSummaryPage,
    examSummaryPageSize,
    examSummaryTotal,
    examSummaryTotalPages,
    examSummaryDeleteId,
    graphCompareLogs,
    graphCompareLogsLoading,
    graphCompareLogsError,
    graphCompareKeyword,
    graphCompareAppliedKeyword,
    graphCompareDays,
    graphComparePage,
    graphComparePageSize,
    graphCompareTotal,
    graphCompareTotalPages,
    graphCompareDeleteId,

    favoriteItems,
    favoritesLoading,
    favoritesError,
    unfavoriteLoadingId,
    favoriteKeyword,
    favoriteAppliedKeyword,
    favoritePage,
    favoritePageSize,
    favoriteTotal,
    favoriteTotalPages,
    favoriteNoteDrafts,
    favoriteNoteSavingId,
    favoriteNoteMessages,

    setWrongError,
    setWrongStatusFilter,
    setWrongTypeFilter,
    setWrongQuestionKindFilter,
    setWrongKeywordTagFilter,
    setWrongPeriodFilter,
    setWrongFocusDate,
    setWrongDynastyFilter,
    setWrongThemeFilter,
    setWrongKeyword,
    setWrongTrendShowAllDays,
    setWrongTrendExpanded,
    setWrongTrendView,
    setSelectedIds,
    setWrongPage,
    setWrongPageSize,
    setShowAdvancedWrongFilters,

    setExamSummaryKeyword,
    setExamSummaryDays,
    setExamSummaryPage,
    setGraphCompareKeyword,
    setGraphCompareDays,
    setGraphComparePage,

    setFavoriteKeyword,
    setFavoritePage,
    setFavoritePageSize,
    setFavoriteNoteDrafts,
    setFavoriteNoteMessages,

    currentWrongFilters,
    loadWrongbookDashboard,
    runBatchAction,
    toggleSelect,
    toggleSelectAll,
    loadWrongbookOverviewCounts,
    loadLatestExamDiagnostics,
    loadGraphCompareLogs,
    loadExamSummaryLogs,
    deleteExamSummaryLog,
    deleteGraphCompareLog,
    loadFavorites,
    unfavoritePoem,
    saveFavoriteNote,
  };
}
