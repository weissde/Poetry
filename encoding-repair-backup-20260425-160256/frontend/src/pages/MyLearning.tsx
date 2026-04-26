﻿﻿﻿import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
 apiDelete,
 apiGet,
 apiPatch,
 apiPost,
 createLessonTask,
 getLessonTasks,
 getUserLearningSummary,
 streamPost,
 updateLessonTaskStatus,
} from "@/lib/api";
import { useWeakness } from "@/hooks/useWeakness";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { PageHeader } from "@/components/common/PageHeader";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import { AnimatedMetricValue } from "@/components/common/AnimatedMetricValue";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { LearningOverview, type LearningTab } from "@/components/my-learning/LearningOverview";
import { Magnet, PillNav } from "@/components/react-bits";
import {
 wrongbookWorkspaceDescriptionMap,
 wrongbookWorkspaceLabelMap,
 type WrongbookWorkspaceTab,
} from "@/components/my-learning/wrongbookWorkspaceMeta";
import type { WrongStatus, WrongTrendDisplayRow } from "@/components/my-learning/wrongbookTypes";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { StateCalloutCard } from "@/components/common/StateCalloutCard";
import { useSearchParams } from "react-router-dom";
import type {
 LearningCoverageItem,
 LearningSummaryMetric,
 LearningSummaryPayload,
 LessonTaskCreatePayload,
 LessonTaskRecord,
 LessonTaskStatus,
 LessonTaskType,
 ReviewPlan,
 ReviewPlanProgress,
} from "@/types";
import {
 buildExamSummaryPracticeLink,
 buildGraphCompareLinkFromTopic,
 buildPlanTaskPracticeLink,
 buildPracticeBySourceLink,
 buildSubjectivePracticeLink,
 buildWrongRowPracticeLink,
 extractExamSummaryTopic,
 extractWrongSummaryTitle,
 formatSourceLabel,
} from "@/features/my-learning/linking";
import {
 aggregateWrongDimension,
 buildSourceWeakRows,
 getWrongTrendMax,
 metricRate,
 pickWrongTrendHotspot,
 summarizeWrongTrend,
 topWeakRows,
 toWrongTrendDailyRows,
 toWrongTrendWeeklyRows,
} from "@/features/my-learning/analytics";
import {
 useMyLearningData,
 type WrongFilterStatus,
 type WrongTimeRange,
} from "@/features/my-learning/useMyLearningData";

type ActiveTab = LearningTab;

type WrongbookMainView = "workspace" | "operations";
type TeacherLearningScope = "individual" | "classroom";
type ClassroomBoardTab = "overview" | "homework" | "distribution" | "export";

interface ReviewPlanEnvelope {
 planId: string | null;
 examDate: string | null;
 createdAt: string | null;
 plan: ReviewPlan | null;
 progress: ReviewPlanProgress | null;
 planEvidence?: {
 examSummaryCount?: number;
 examSummarySamples?: string[];
 keywordFocusTop?: string[];
 wrongSummaryTop?: string[];
 } | null;
}

const LearningTrend = lazy(async () => {
  const module = await import("@/components/my-learning/LearningTrend");
  return { default: module.LearningTrend };
});

const AIInsightReport = lazy(async () => {
  const module = await import("@/components/my-learning/AIInsightReport");
  return { default: module.AIInsightReport };
});

const WrongbookPanel = lazy(async () => {
  const module = await import("@/components/my-learning/WrongbookPanel");
  return { default: module.WrongbookPanel };
});

const WrongbookWorkspaceSummaryCard = lazy(async () => {
  const module = await import("@/components/my-learning/WrongbookWorkspaceSummaryCard");
  return { default: module.WrongbookWorkspaceSummaryCard };
});

const WrongbookListWorkspace = lazy(async () => {
  const module = await import("@/components/my-learning/WrongbookListWorkspace");
  return { default: module.WrongbookListWorkspace };
});

const WrongbookInsightWorkspace = lazy(async () => {
  const module = await import("@/components/my-learning/WrongbookInsightWorkspace");
  return { default: module.WrongbookInsightWorkspace };
});

const WrongbookTrendWorkspace = lazy(async () => {
  const module = await import("@/components/my-learning/WrongbookTrendWorkspace");
  return { default: module.WrongbookTrendWorkspace };
});

const DiagnosisWorkspace = lazy(async () => {
  const module = await import("@/components/my-learning/DiagnosisWorkspace");
  return { default: module.DiagnosisWorkspace };
});

const ReviewPlanPanel = lazy(async () => {
  const module = await import("@/components/my-learning/ReviewPlanPanel");
  return { default: module.ReviewPlanPanel };
});

const FavoritesPanel = lazy(async () => {
  const module = await import("@/components/my-learning/FavoritesPanel");
  return { default: module.FavoritesPanel };
});

const LearningReportExport = lazy(async () => {
  const module = await import("@/components/teaching/LearningReportExport");
  return { default: module.LearningReportExport };
});

const LessonTaskBoard = lazy(async () => {
  const module = await import("@/features/my-learning/LessonTaskBoard");
  return { default: module.LessonTaskBoard };
});

function MyLearningLazyFallback({ label }: { label: string }): JSX.Element {
  return (
    <div className="rounded-[22px] bg-stone-50 px-4 py-10 text-center text-sm text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
      {label}鍔犺浇涓?..
    </div>
  );
}

type ExamWeakDimension = "questionType" | "dynasty" | "theme";

const statusMap: Record<WrongStatus, string> = {
 pending: "待复习",
 mastered: "已掌握",
 retry: "闇€鍐嶇粌",
};

const questionTypeLabelMap: Record<string, string> = {
 memorization: "榛樺啓",
 meaning: "璇嶄箟",
 technique: "鎵嬫硶",
 emotion: "鎯呮劅",
 appreciation: "璧忔瀽",
 comparison: "姣旇緝闃呰",
 context: "璇榛樺啓",
 subjective: "主观题",
 exam: "鑰冭瘯",
};

const questionKindLabelMap: Record<string, string> = {
 subjective: "主观题",
 objective: "客观题",
};

const examDimensionLabelMap: Record<ExamWeakDimension, string> = {
 questionType: "棰樺瀷",
 dynasty: "鏈濅唬",
 theme: "棰樻潗",
};

const reviewPriorityLabelMap: Record<string, string> = {
 high: "高优先",
 medium: "中优先",
 low: "低优先",
};

const reviewPriorityClassMap: Record<string, string> = {
 high: "bg-red-50 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.24)] text-red-700",
 medium: "bg-amber-50 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.24)] text-amber-700",
 low: "shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-slate-100",
};

const myLearningTeachingObjective = {
 title: "瀛︽儏璇婃柇鐩爣",
 summary: "通过弱点分析、错题复盘和复习计划，实现针对性提升。",
 goals: [
 "鏌ョ湅鏈懆钖勫急棰樺瀷鍒嗗竷",
 "处理错题本中的高频错题",
 "鎵ц涓€у寲澶嶄範璁″垝",
 ],
 teacherHint: "教师可在此查看班级共性弱点，并据此调整下一课教学内容。",
};

const myLearningTeacherHint = {
 title: "鐝骇鏁版嵁鎺ュ叆鎻愮ず",
 detail: "当前页面已接入个人学情真实数据；班级名单、任务完成率与班级错题分布仍需后端聚合接口接入后再展示。",
};

function escapeHtml(value: string): string {
 return String(value || "")
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;")
 .replace(/\"/g, "&quot;")
 .replace(/'/g, "&#39;");
}

function escapeMarkdown(value: string): string {
 return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function downloadTextFile(filename: string, content: string): boolean {
 if (typeof window === "undefined") {
 return false;
 }
 const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
 const href = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = href;
 anchor.download = filename;
 document.body.appendChild(anchor);
 anchor.click();
 document.body.removeChild(anchor);
 URL.revokeObjectURL(href);
 return true;
}

function openStudyReportPrintWindow(title: string, bodyHtml: string): boolean {
 if (typeof window === "undefined") {
 return false;
 }
 const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
 if (!popup) {
 return false;
 }
 popup.document.open();
 popup.document.write(`<!doctype html>
 <html lang="zh-CN">
 <head>
   <meta charset="UTF-8" />
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
   <title>${escapeHtml(title)}</title>
   <style>
     body { margin: 0; padding: 32px; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; color: #243b5b; background: #f7f4ee; }
     .report-shell { max-width: 860px; margin: 0 auto; background: #fffdf8; border-radius: 24px; padding: 32px; box-shadow: 0 18px 44px rgba(34,58,94,0.08); }
     .report-kicker { margin: 0; font-size: 12px; letter-spacing: 0.18em; color: #9b6731; text-transform: uppercase; }
     .report-title { margin: 10px 0 0; font-family: "Noto Serif SC", SimSun, serif; font-size: 34px; line-height: 1.2; color: #203754; }
     .report-subtitle { margin: 12px 0 0; font-size: 15px; line-height: 1.9; color: #5d7188; }
     .metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 24px; }
     .metric-card { border: 1px solid rgba(214,223,231,0.92); border-radius: 18px; padding: 16px; background: #ffffff; }
     .metric-label { margin: 0; font-size: 12px; color: #6a7f94; }
     .metric-value { margin: 8px 0 0; font-family: "Noto Serif SC", SimSun, serif; font-size: 30px; color: #213857; }
     .metric-detail { margin: 8px 0 0; font-size: 13px; line-height: 1.8; color: #5f7389; }
     .section { margin-top: 24px; }
     .section-title { margin: 0 0 10px; font-family: "Noto Serif SC", SimSun, serif; font-size: 24px; color: #203754; }
     .section-copy { margin: 0; font-size: 14px; line-height: 1.9; color: #566b82; }
     .tag-list { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
     .tag { display: inline-flex; align-items: center; border-radius: 9999px; background: rgba(34,58,94,0.08); padding: 6px 12px; font-size: 12px; color: #294764; }
     .list-card { border-radius: 18px; background: #f8f5ef; padding: 18px; margin-top: 14px; }
     .list-card ul { margin: 10px 0 0; padding-left: 18px; }
     .list-card li { margin-top: 6px; line-height: 1.8; color: #5d7188; }
   </style>
 </head>
 <body>
   <div class="report-shell">${bodyHtml}</div>
 </body>
 </html>`);
 popup.document.close();
 popup.focus();
 window.setTimeout(() => {
 popup.print();
 }, 180);
 return true;
}

const PLAN_REMINDER_ENABLED_KEY = "poetry_ai_plan_reminder_enabled";
const PLAN_REMINDER_LAST_NOTIFY_KEY = "poetry_ai_plan_reminder_last_notify_at";
const PLAN_REMINDER_NOTIFY_INTERVAL_MS = 2 * 60 * 60 * 1000;

function isValidActiveTab(value: string | null): value is ActiveTab {
 return value === "overview" || value === "wrongbook" || value === "favorites" || value === "diagnosis" || value === "plan";
}

function isValidClassroomBoardTab(value: string | null): value is ClassroomBoardTab {
 return value === "overview" || value === "homework" || value === "distribution" || value === "export";
}

function normalizeWrongStatus(value: string | null): WrongFilterStatus {
 if (value === "pending" || value === "mastered" || value === "retry") {
 return value;
 }
 return "all";
}

function normalizeWrongPeriod(value: string | null): WrongTimeRange {
 if (value === "7" || value === "30") {
 return value;
 }
 return "all";
}

function parseLearningReportSections(text: string): {
 summaryTitle: string;
 summaryText: string;
 teacherAdviceTitle: string;
 teacherAdviceText: string;
 } | null {
 const normalized = String(text || "").trim();
 if (!normalized) {
 return null;
 }
 const blocks = normalized
 .split(/\n\s*\n/g)
 .map((item) => item.trim())
 .filter(Boolean);
 if (blocks.length < 2) {
 return null;
 }
 const [summaryBlock, teacherBlock] = blocks;
 const [summaryTitle = "AI 瀛︽儏瑙ｈ", ...summaryBodyLines] = summaryBlock.split("\n");
 const [teacherAdviceTitle = "鏁欏笀 / 瀹堕暱寤鸿", ...teacherBodyLines] = teacherBlock.split("\n");
 return {
 summaryTitle: summaryTitle.trim() || "AI 瀛︽儏瑙ｈ",
 summaryText: summaryBodyLines.join("\n").trim(),
 teacherAdviceTitle: teacherAdviceTitle.trim() || "鏁欏笀 / 瀹堕暱寤鸿",
 teacherAdviceText: teacherBodyLines.join("\n").trim(),
 };
}

function toLessonTaskErrorMessage(error: unknown, fallback: string): string {
 const message = error instanceof Error ? error.message : fallback;
 const lower = String(message || "").toLowerCase();
 if (lower.includes("020_lesson_tasks.sql") || lower.includes("lesson tasks are not ready")) {
 return "课堂任务表尚未就绪，请先执行迁移 `020_lesson_tasks.sql`。";
 }
 return message;
}

export default function MyLearningPage(): JSX.Element {
 useScrollRestore("my-learning");
 const { isTeacherMode } = useTeachingMode();

 const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
 const [teacherScope, setTeacherScope] = useState<TeacherLearningScope>("individual");
 const [classroomBoardTab, setClassroomBoardTab] = useState<ClassroomBoardTab>("overview");
 const [wrongbookMainView, setWrongbookMainView] = useState<WrongbookMainView>("workspace");
 const [wrongbookWorkspaceTab, setWrongbookWorkspaceTab] = useState<WrongbookWorkspaceTab>("list");
 const {
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
 examSummaryTotal,
 examSummaryTotalPages,
 examSummaryDeleteId,
 graphCompareLogs,
 graphCompareLogsLoading,
 graphCompareLogsError,
 graphCompareKeyword,
 graphCompareDays,
 graphComparePage,
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
 setWrongPage,
 setWrongPageSize,
 setShowAdvancedWrongFilters,
 setExamSummaryKeyword,
 setExamSummaryDays,
 setExamSummaryPage,
 setGraphCompareKeyword,
 setGraphCompareDays,
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
 } = useMyLearningData();
 const [showDiagnosisAdvanced, setShowDiagnosisAdvanced] = useState<boolean>(false);

 const [isGenerating, setIsGenerating] = useState<boolean>(false);
 const [planSaving, setPlanSaving] = useState<boolean>(false);
 const [planError, setPlanError] = useState<string | null>(null);
 const [plan, setPlan] = useState<ReviewPlan | null>(null);
 const [planId, setPlanId] = useState<string | null>(null);
 const [planProgress, setPlanProgress] = useState<ReviewPlanProgress | null>(null);
 const [planEvidence, setPlanEvidence] = useState<ReviewPlanEnvelope["planEvidence"]>(null);
 const [planShowOnlyPending, setPlanShowOnlyPending] = useState<boolean>(false);
 const [planPriorityFilter, setPlanPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
 const [planReminderEnabled, setPlanReminderEnabled] = useState<boolean>(false);
 const [planReminderPermission, setPlanReminderPermission] = useState<NotificationPermission>("default");
 const [planReminderMessage, setPlanReminderMessage] = useState<string>("");
 const [studyReportMessage, setStudyReportMessage] = useState<string>("");
 const [learningSummary, setLearningSummary] = useState<LearningSummaryPayload | null>(null);
 const [learningSummaryLoading, setLearningSummaryLoading] = useState<boolean>(false);
 const [learningSummaryError, setLearningSummaryError] = useState<string | null>(null);
 const [aiLearningReportText, setAiLearningReportText] = useState<string>("");
 const [aiLearningReportSource, setAiLearningReportSource] = useState<string | null>(null);
 const [aiLearningReportLoading, setAiLearningReportLoading] = useState<boolean>(false);
 const [aiLearningReportError, setAiLearningReportError] = useState<string | null>(null);
 const [lessonTasks, setLessonTasks] = useState<LessonTaskRecord[]>([]);
 const [lessonTasksLoading, setLessonTasksLoading] = useState<boolean>(false);
 const [lessonTaskSaving, setLessonTaskSaving] = useState<boolean>(false);
 const [lessonTaskUpdatingId, setLessonTaskUpdatingId] = useState<string | null>(null);
 const [lessonTaskError, setLessonTaskError] = useState<string | null>(null);
 const [lessonTaskMessage, setLessonTaskMessage] = useState<string>("");
 const [lessonTaskDraft, setLessonTaskDraft] = useState<LessonTaskCreatePayload>({
 title: "浠婃棩璇惧爞宸╁浐",
 detail: "完成一组 5 题练习，并回到错题本复盘错因。",
 taskType: "practice",
 status: "assigned",
 targetUserId: "",
 to: "/practice?entry=practice&auto=1&source=lesson_task",
 dueDate: "",
 });
 const [examDate, setExamDate] = useState<string>("");

 const { profile, refresh: refreshWeakness } = useWeakness();
 const [searchParams, setSearchParams] = useSearchParams();
 const routeFilterKeyRef = useRef<string>("");
 const skipUrlSyncRef = useRef<boolean>(false);
 const aiLearningReportAbortRef = useRef<AbortController | null>(null);
const aiLearningReportAutoRequestedRef = useRef<boolean>(false);
const latestPlanAbortRef = useRef<AbortController | null>(null);
const learningSummaryAbortRef = useRef<AbortController | null>(null);
const wrongbookOverviewAbortRef = useRef<AbortController | null>(null);

 useEffect(() => {
 if (!isTeacherMode) {
 setTeacherScope("individual");
 setClassroomBoardTab("overview");
 }
 }, [isTeacherMode]);

 useEffect(() => {
 if (isTeacherMode && teacherScope === "classroom") {
 void loadLessonTasks();
 }
 }, [isTeacherMode, teacherScope]);

 useEffect(() => {
 if (!isTeacherMode && activeTab === "overview") {
 void loadLessonTasks();
 }
 }, [activeTab, isTeacherMode]);

 useEffect(() => {
 void loadWrongbookDashboard(currentWrongFilters());
 }, [
 wrongPeriodFilter,
 wrongFocusDate,
 wrongStatusFilter,
 wrongTypeFilter,
 wrongQuestionKindFilter,
 wrongKeywordTagFilter,
 wrongDynastyFilter,
 wrongThemeFilter,
 wrongPage,
 wrongPageSize,
 ]);

 useEffect(() => {
 setWrongFocusDate("");
 }, [wrongPeriodFilter]);

 useEffect(() => {
 if (activeTab === "wrongbook") {
 void loadWrongbookOverviewCounts();
 return;
 }
 if (activeTab === "favorites") {
 void loadFavorites({
 page: favoritePage,
 pageSize: favoritePageSize,
 keyword: favoriteAppliedKeyword,
 });
 }
 }, [activeTab, favoritePage, favoritePageSize]);

 useEffect(() => {
 if (!wrongLoading && wrongQuestions.length === 0 && wrongTotal > 0 && wrongPage > 1) {
 setWrongPage((prev) => Math.max(1, prev - 1));
 }
 }, [wrongLoading, wrongQuestions.length, wrongTotal, wrongPage]);

 useEffect(() => {
 if (!favoritesLoading && favoriteItems.length === 0 && favoriteTotal > 0 && favoritePage > 1) {
 setFavoritePage((prev) => Math.max(1, prev - 1));
 }
 }, [favoritesLoading, favoriteItems.length, favoriteTotal, favoritePage]);

const loadLatestPlan = async (signal?: AbortSignal): Promise<void> => {
 setPlanError(null);
 try {
const data = await apiGet<ReviewPlanEnvelope>("/review-plan/latest", { signal });
 setPlanId(data.planId);
 setPlan(data.plan);
 setPlanProgress(data.progress);
 setPlanEvidence(data.planEvidence ?? null);
 if (data.examDate) {
 setExamDate(data.examDate);
 }
 } catch (error: unknown) {
if (error instanceof DOMException && error.name === "AbortError") {
return;
}
 setPlanError(error instanceof Error ? error.message : "璇诲彇澶嶄範璁″垝澶辫触");
} finally {
if (signal && latestPlanAbortRef.current?.signal === signal) {
latestPlanAbortRef.current = null;
}
 }
 };

const loadLearningSummary = async (force = false, signal?: AbortSignal): Promise<void> => {
 setLearningSummaryLoading(true);
 setLearningSummaryError(null);
 try {
const data = await getUserLearningSummary(force, signal);
 setLearningSummary(data);
 } catch (error: unknown) {
if (error instanceof DOMException && error.name === "AbortError") {
return;
}
 setLearningSummaryError(error instanceof Error ? error.message : "璇诲彇瀛︽儏鎬昏澶辫触");
 } finally {
if (signal && learningSummaryAbortRef.current?.signal === signal) {
learningSummaryAbortRef.current = null;
}
 setLearningSummaryLoading(false);
 }
 };

 const loadLessonTasks = async (force = false): Promise<void> => {
 setLessonTasksLoading(true);
 setLessonTaskError(null);
 try {
 const data = await getLessonTasks(force);
 setLessonTasks(Array.isArray(data.items) ? data.items : []);
 } catch (error: unknown) {
 setLessonTaskError(toLessonTaskErrorMessage(error, "璇诲彇璇惧爞浠诲姟澶辫触"));
 } finally {
 setLessonTasksLoading(false);
 }
 };

 const handleCreateLessonTask = async (): Promise<void> => {
 const title = String(lessonTaskDraft.title || "").trim();
 if (!title) {
 setLessonTaskError("请先填写任务标题。");
 return;
 }

 setLessonTaskSaving(true);
 setLessonTaskError(null);
 setLessonTaskMessage("");
 try {
 const targetUserId = String(lessonTaskDraft.targetUserId || "").trim();
 await createLessonTask({
 ...lessonTaskDraft,
 title,
 targetUserId: targetUserId || null,
 detail: String(lessonTaskDraft.detail || "").trim() || null,
 to: String(lessonTaskDraft.to || "").trim() || null,
 dueDate: String(lessonTaskDraft.dueDate || "").trim() || null,
 taskType: (lessonTaskDraft.taskType || "custom") as LessonTaskType,
 status: (lessonTaskDraft.status || "assigned") as LessonTaskStatus,
 });
 setLessonTaskMessage("课堂任务已创建，并会进入今日任务数据流。");
 setLessonTaskDraft((prev) => ({
 ...prev,
 title: "浠婃棩璇惧爞宸╁浐",
 detail: "完成一组 5 题练习，并回到错题本复盘错因。",
 status: "assigned",
 targetUserId: "",
 }));
 await loadLessonTasks(true);
 await loadLearningSummary(true);
 } catch (error: unknown) {
 setLessonTaskError(toLessonTaskErrorMessage(error, "鍒涘缓璇惧爞浠诲姟澶辫触"));
 } finally {
 setLessonTaskSaving(false);
 }
 };

 const handleLessonTaskStatusChange = async (taskId: string, status: LessonTaskStatus): Promise<void> => {
 setLessonTaskUpdatingId(taskId);
 setLessonTaskError(null);
 setLessonTaskMessage("");
 try {
 await updateLessonTaskStatus(taskId, status);
 setLessonTaskMessage("任务状态已更新。");
 await loadLessonTasks(true);
 await loadLearningSummary(true);
 } catch (error: unknown) {
 setLessonTaskError(toLessonTaskErrorMessage(error, "更新任务状态失败"));
 } finally {
 setLessonTaskUpdatingId(null);
 }
 };

 const loadAiLearningReport = async (): Promise<void> => {
 aiLearningReportAbortRef.current?.abort();
 const controller = new AbortController();
 aiLearningReportAbortRef.current = controller;
 setAiLearningReportLoading(true);
 setAiLearningReportError(null);
 setAiLearningReportText("");
 setAiLearningReportSource(null);
 try {
 const { text, source } = await streamPost({
 path: "/ai/learning-report",
 body: {},
 signal: controller.signal,
 onToken: (_token, cumulativeText, streamSource) => {
 setAiLearningReportText(cumulativeText);
 setAiLearningReportSource(streamSource || null);
 },
 });
 setAiLearningReportText(text);
 setAiLearningReportSource(source || null);
 } catch (error: unknown) {
 if (error instanceof DOMException && error.name === "AbortError") {
 return;
 }
 if (error instanceof Error && error.message.includes("aborted")) {
 return;
 }
 setAiLearningReportError(error instanceof Error ? error.message : "鐢熸垚 AI 瀛︽儏瑙ｈ澶辫触");
 } finally {
 if (aiLearningReportAbortRef.current === controller) {
 aiLearningReportAbortRef.current = null;
 }
 setAiLearningReportLoading(false);
 }
 };

 useEffect(() => {
latestPlanAbortRef.current?.abort();
learningSummaryAbortRef.current?.abort();
wrongbookOverviewAbortRef.current?.abort();

const latestPlanController = new AbortController();
const learningSummaryController = new AbortController();
const wrongbookOverviewController = new AbortController();

latestPlanAbortRef.current = latestPlanController;
learningSummaryAbortRef.current = learningSummaryController;
wrongbookOverviewAbortRef.current = wrongbookOverviewController;

void loadLatestPlan(latestPlanController.signal);
void loadWrongbookOverviewCounts({ signal: wrongbookOverviewController.signal });
void loadLearningSummary(false, learningSummaryController.signal);

return () => {
  latestPlanController.abort();
  learningSummaryController.abort();
  wrongbookOverviewController.abort();
  if (latestPlanAbortRef.current === latestPlanController) {
    latestPlanAbortRef.current = null;
  }
  if (learningSummaryAbortRef.current === learningSummaryController) {
    learningSummaryAbortRef.current = null;
  }
  if (wrongbookOverviewAbortRef.current === wrongbookOverviewController) {
    wrongbookOverviewAbortRef.current = null;
  }
};
 }, []);

 useEffect(() => {
 if (activeTab !== "overview") {
 return;
 }
if (!learningSummary && !learningSummaryLoading && !learningSummaryAbortRef.current) {
const controller = new AbortController();
learningSummaryAbortRef.current = controller;
void loadLearningSummary(false, controller.signal);
 }
 if (!aiLearningReportText && !aiLearningReportLoading && !aiLearningReportAutoRequestedRef.current) {
 aiLearningReportAutoRequestedRef.current = true;
 void loadAiLearningReport();
 }
 }, [activeTab, aiLearningReportLoading, aiLearningReportText, learningSummary, learningSummaryLoading]);

 useEffect(() => {
 return () => {
latestPlanAbortRef.current?.abort();
learningSummaryAbortRef.current?.abort();
wrongbookOverviewAbortRef.current?.abort();
 aiLearningReportAbortRef.current?.abort();
latestPlanAbortRef.current = null;
learningSummaryAbortRef.current = null;
wrongbookOverviewAbortRef.current = null;
 };
 }, []);

 useEffect(() => {
 const key = searchParams.toString();
 if (!key || routeFilterKeyRef.current === key) {
 return;
 }
 routeFilterKeyRef.current = key;
 skipUrlSyncRef.current = true;

	 const tabParam = searchParams.get("tab");
  const scopeParam = searchParams.get("scope");
  const boardParam = searchParams.get("board");
  if (isTeacherMode && scopeParam === "classroom") {
  setTeacherScope("classroom");
  }
  if (scopeParam === "individual") {
  setTeacherScope("individual");
  }
  if (isValidClassroomBoardTab(boardParam)) {
  setClassroomBoardTab(boardParam);
  if (boardParam === "homework") {
  void loadLessonTasks(true);
  }
  }
	 const hasWrongbookRouteParams = [
	 "period",
	 "status",
	 "type",
	 "questionKind",
	 "keywordTag",
	 "dynasty",
	 "theme",
	 "date",
	 "keyword",
	 "page",
	 "pageSize",
	 ].some((key) => Boolean((searchParams.get(key) || "").trim()));
	 const targetTab: ActiveTab = isValidActiveTab(tabParam) ? tabParam : hasWrongbookRouteParams ? "wrongbook" : "overview";
	 openWorkspaceShell(targetTab);

	 if (targetTab === "overview") {
	 return;
	 }

	 if (targetTab === "diagnosis") {
 const targetExamKeyword = (searchParams.get("examSummaryKeyword") || "").trim();
 const targetExamDays = normalizeWrongPeriod(searchParams.get("examSummaryDays"));
 setExamSummaryKeyword(targetExamKeyword);
 setExamSummaryDays(targetExamDays);
 setExamSummaryPage(1);
 void refreshWeakness();
 void loadLatestExamDiagnostics();
 void loadExamSummaryLogs({ keyword: targetExamKeyword, page: 1, days: targetExamDays });
 return;
 }
 if (targetTab === "plan") {
 void loadLatestPlan();
 return;
 }
 if (targetTab === "favorites") {
 void loadFavorites({
 page: favoritePage,
 pageSize: favoritePageSize,
 keyword: favoriteAppliedKeyword,
 });
 return;
 }

 const targetPeriod = normalizeWrongPeriod(searchParams.get("period"));
 const targetStatus = normalizeWrongStatus(searchParams.get("status"));
 const targetType = (searchParams.get("type") || "all").trim() || "all";
 const targetQuestionKind = (searchParams.get("questionKind") || "all").trim() || "all";
 const targetKeywordTag = (searchParams.get("keywordTag") || "").trim();
 const targetDynasty = (searchParams.get("dynasty") || "").trim();
 const targetTheme = (searchParams.get("theme") || "").trim();
 const targetDate = (searchParams.get("date") || "").trim();
 const targetKeyword = (searchParams.get("keyword") || "").trim();
 const targetPage = Math.max(1, Number(searchParams.get("page") || "1") || 1);
 const targetPageSizeRaw = Number(searchParams.get("pageSize") || String(wrongPageSize)) || wrongPageSize;
 const targetPageSize = Math.max(6, Math.min(200, targetPageSizeRaw));

 setWrongPeriodFilter(targetPeriod);
 setWrongStatusFilter(targetStatus);
 setWrongTypeFilter(targetType);
 setWrongQuestionKindFilter(targetQuestionKind);
 setWrongKeywordTagFilter(targetKeywordTag);
 setWrongDynastyFilter(targetDynasty);
 setWrongThemeFilter(targetTheme);
 setWrongFocusDate(targetDate);
 setWrongKeyword(targetKeyword);
 setWrongPage(targetPage);
 setWrongPageSize(targetPageSize);

 }, [searchParams]);

 const openWrongbookByExam = (dimension: ExamWeakDimension, key: string): void => {
 const normalizedKey = key.trim();
 if (!normalizedKey) {
 return;
 }

 const nextType = dimension === "questionType" ? normalizedKey : "all";
 const nextDynasty = dimension === "dynasty" ? normalizedKey : "";
 const nextTheme = dimension === "theme" ? normalizedKey : "";

 openWorkspaceShell("wrongbook");
 setWrongbookMainView("workspace");
 setWrongbookWorkspaceTab("list");
 setWrongStatusFilter("all");
 setWrongTypeFilter(nextType);
 setWrongQuestionKindFilter("all");
 setWrongKeywordTagFilter("");
 setWrongDynastyFilter(nextDynasty);
 setWrongThemeFilter(nextTheme);
 setWrongFocusDate("");
 setWrongKeyword("");
 setWrongPage(1);

 };

 useEffect(() => {
 if (skipUrlSyncRef.current) {
 skipUrlSyncRef.current = false;
 return;
 }

 const params = new URLSearchParams();
 if (activeTab !== "wrongbook") {
 params.set("tab", activeTab);
 if (activeTab === "diagnosis") {
 const examKeyword = examSummaryAppliedKeyword.trim();
 if (examKeyword) {
 params.set("examSummaryKeyword", examKeyword);
 }
 if (examSummaryDays !== "30") {
 params.set("examSummaryDays", examSummaryDays);
 }
 }
 } else {
 if (wrongPeriodFilter !== "all") {
 params.set("period", wrongPeriodFilter);
 }
 if (wrongStatusFilter !== "all") {
 params.set("status", wrongStatusFilter);
 }
 const type = wrongTypeFilter.trim();
 if (type && type !== "all") {
 params.set("type", type);
 }
 const questionKind = wrongQuestionKindFilter.trim();
 if (questionKind && questionKind !== "all") {
 params.set("questionKind", questionKind);
 }
 const keywordTag = wrongKeywordTagFilter.trim();
 if (keywordTag) {
 params.set("keywordTag", keywordTag);
 }
 const dynasty = wrongDynastyFilter.trim();
 if (dynasty) {
 params.set("dynasty", dynasty);
 }
 const theme = wrongThemeFilter.trim();
 if (theme) {
 params.set("theme", theme);
 }
 const date = wrongFocusDate.trim();
 if (date) {
 params.set("date", date);
 }
 const keyword = wrongKeyword.trim();
 if (keyword) {
 params.set("keyword", keyword);
 }
 if (wrongPage > 1) {
 params.set("page", String(wrongPage));
 }
 if (wrongPageSize !== 24) {
 params.set("pageSize", String(wrongPageSize));
 }
 }

 const nextKey = params.toString();
 const currentKey = searchParams.toString();
 if (nextKey === currentKey) {
 routeFilterKeyRef.current = nextKey;
 return;
 }

 routeFilterKeyRef.current = nextKey;
 setSearchParams(params, { replace: true });
 }, [
 activeTab,
 wrongPeriodFilter,
 wrongStatusFilter,
 wrongTypeFilter,
 wrongQuestionKindFilter,
 wrongKeywordTagFilter,
 wrongDynastyFilter,
 wrongThemeFilter,
 wrongFocusDate,
 wrongKeyword,
 wrongPage,
 wrongPageSize,
 examSummaryAppliedKeyword,
 examSummaryDays,
 searchParams,
 setSearchParams,
 ]);

 const togglePlanTask = async (dayIndex: number, taskIndex: number, done: boolean): Promise<void> => {
 if (!planId) {
 return;
 }

 setPlanSaving(true);
 setPlanError(null);
 try {
 const key = `${dayIndex}-${taskIndex}`;
 const data = await apiPatch<{ planId: string; plan: ReviewPlan; progress: ReviewPlanProgress }>(
 `/review-plan/${planId}/task`,
 { key, done },
 );
 setPlan(data.plan);
 setPlanProgress(data.progress);
 } catch (error: unknown) {
 setPlanError(error instanceof Error ? error.message : "保存任务状态失败");
 } finally {
 setPlanSaving(false);
 }
 };

 const movePlanTask = async (dayIndex: number, taskIndex: number, direction: "up" | "down"): Promise<void> => {
 if (!planId || !plan) {
 return;
 }
 const tasks = plan.dailyTasks?.[dayIndex]?.tasks || [];
 const nextIndex = direction === "up" ? taskIndex - 1 : taskIndex + 1;
 if (nextIndex < 0 || nextIndex >= tasks.length) {
 return;
 }

 setPlanSaving(true);
 setPlanError(null);
 try {
 const data = await apiPatch<{ planId: string; plan: ReviewPlan; progress: ReviewPlanProgress }>(
 `/review-plan/${planId}/task/reorder`,
 {
 dayIndex,
 fromIndex: taskIndex,
 toIndex: nextIndex,
 },
 );
 setPlan(data.plan);
 setPlanProgress(data.progress);
 } catch (error: unknown) {
 setPlanError(error instanceof Error ? error.message : "璋冩暣浠诲姟椤哄簭澶辫触");
 } finally {
 setPlanSaving(false);
 }
 };

 const reorderPlanTask = async (dayIndex: number, fromIndex: number, toIndex: number): Promise<void> => {
 if (!planId || !plan) {
 return;
 }
 const tasks = plan.dailyTasks?.[dayIndex]?.tasks || [];
 if (fromIndex < 0 || toIndex < 0 || fromIndex >= tasks.length || toIndex >= tasks.length || fromIndex === toIndex) {
 return;
 }

 setPlanSaving(true);
 setPlanError(null);
 try {
 const data = await apiPatch<{ planId: string; plan: ReviewPlan; progress: ReviewPlanProgress }>(
 `/review-plan/${planId}/task/reorder`,
 {
 dayIndex,
 fromIndex,
 toIndex,
 },
 );
 setPlan(data.plan);
 setPlanProgress(data.progress);
 } catch (error: unknown) {
 setPlanError(error instanceof Error ? error.message : "鎷栨嫿鎺掑簭澶辫触");
 } finally {
 setPlanSaving(false);
 }
 };

 const movePlanTaskAcrossDays = async (
 fromDayIndex: number,
 fromIndex: number,
 toDayIndex: number,
 toIndex: number,
 ): Promise<void> => {
 if (!planId || !plan) {
 return;
 }
 const fromTasks = plan.dailyTasks?.[fromDayIndex]?.tasks || [];
 const toTasks = plan.dailyTasks?.[toDayIndex]?.tasks || [];
 if (
 fromIndex < 0 ||
 fromIndex >= fromTasks.length ||
 toIndex < 0 ||
 toIndex > toTasks.length ||
 fromDayIndex < 0 ||
 toDayIndex < 0
 ) {
 return;
 }

 setPlanSaving(true);
 setPlanError(null);
 try {
 const data = await apiPatch<{ planId: string; plan: ReviewPlan; progress: ReviewPlanProgress }>(
 `/review-plan/${planId}/task/move`,
 {
 fromDayIndex,
 fromIndex,
 toDayIndex,
 toIndex,
 },
 );
 setPlan(data.plan);
 setPlanProgress(data.progress);
 } catch (error: unknown) {
 setPlanError(error instanceof Error ? error.message : "璺ㄥぉ鎷栨嫿澶辫触");
 } finally {
 setPlanSaving(false);
 }
 };

 const generatePlan = async (): Promise<void> => {
 setIsGenerating(true);
 setPlanError(null);

 try {
 const data = await apiPost<ReviewPlanEnvelope>("/review-plan/generate", {
 examDate: examDate || null,
 }, { timeoutMs: 30000 });
 setPlanId(data.planId);
 setPlan(data.plan);
 setPlanProgress(data.progress);
 setPlanEvidence(data.planEvidence ?? null);
 } catch (error: unknown) {
 setPlanError(error instanceof Error ? error.message : "生成计划失败，请稍后再试。");
 } finally {
 setIsGenerating(false);
 }
 };

 const wrongSummary = useMemo(() => {
 const map = new Map<string, number>();
 wrongQuestions.forEach((question) => {
 const key = question.poem_title || "未分类";
 map.set(key, (map.get(key) ?? 0) + 1);
 });

 return Array.from(map.entries()).map(([title, count]) => ({ title, count }));
 }, [wrongQuestions]);

 const wrongStatusStats = useMemo(() => {
 let pending = 0;
 let mastered = 0;
 let retry = 0;
 wrongQuestions.forEach((item) => {
 if (item.status === "pending") pending += 1;
 if (item.status === "mastered") mastered += 1;
 if (item.status === "retry") retry += 1;
 });
 return { total: wrongQuestions.length, pending, mastered, retry };
 }, [wrongQuestions]);

 const wrongTypeStats = useMemo(
 () => aggregateWrongDimension(wrongQuestions, (row) => row.error_type),
 [wrongQuestions],
 );
 const wrongDynastyStats = useMemo(
 () => aggregateWrongDimension(wrongQuestions, (row) => row.dynasty),
 [wrongQuestions],
 );
 const wrongThemeStats = useMemo(
 () => aggregateWrongDimension(wrongQuestions, (row) => row.theme),
 [wrongQuestions],
 );
 const keywordWeakRows = useMemo(() => topWeakRows(profile.by_keyword_tag || {}, 8), [profile.by_keyword_tag]);
 const imageryRate = useMemo(() => {
 if (keywordWeakRows.length === 0) {
 return 0;
 }
 const bestRate = Math.max(...keywordWeakRows.map((item) => Number(item.rate || 0)));
 return Math.max(0, Math.min(100, bestRate));
 }, [keywordWeakRows]);
 const keywordMasterySummary = useMemo(() => {
 const rows = Object.values(profile.by_keyword_tag || {});
 const attempts = rows.reduce((sum, row) => sum + (row.attempts || 0), 0);
 const correct = rows.reduce((sum, row) => sum + (row.correct || 0), 0);
 const rate = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
 return { attempts, correct, rate };
 }, [profile.by_keyword_tag]);
 const wrongTrendDailyRows = useMemo<WrongTrendDisplayRow[]>(
 () => toWrongTrendDailyRows(wrongTrend),
 [wrongTrend],
 );
 const wrongTrendWeeklyRows = useMemo<WrongTrendDisplayRow[]>(
 () => toWrongTrendWeeklyRows(wrongTrend),
 [wrongTrend],
 );
 const wrongTrendBaseRows = useMemo(
 () => (wrongTrendView === "week" ? wrongTrendWeeklyRows : wrongTrendDailyRows),
 [wrongTrendDailyRows, wrongTrendView, wrongTrendWeeklyRows],
 );
 const wrongTrendActiveDays = useMemo(
 () => wrongTrendBaseRows.filter((item) => Number(item.created || 0) > 0 || Number(item.mastered || 0) > 0),
 [wrongTrendBaseRows],
 );
 const wrongTrendDisplayRows = useMemo(
 () => (wrongTrendShowAllDays ? wrongTrendBaseRows : wrongTrendActiveDays),
 [wrongTrendActiveDays, wrongTrendBaseRows, wrongTrendShowAllDays],
 );
 const wrongTrendPreviewRows = useMemo(
 () => wrongTrendDisplayRows.slice(0, wrongTrendView === "week" ? 6 : 10),
 [wrongTrendDisplayRows, wrongTrendView],
 );
 const wrongTrendRowsForRender = useMemo(
 () => (wrongTrendExpanded ? wrongTrendDisplayRows : wrongTrendPreviewRows),
 [wrongTrendDisplayRows, wrongTrendExpanded, wrongTrendPreviewRows],
 );
 const wrongTrendSummary = useMemo(
 () => summarizeWrongTrend(wrongTrend, wrongTrendActiveDays.length, wrongTrendBaseRows.length),
 [wrongTrend, wrongTrendActiveDays.length, wrongTrendBaseRows.length],
 );
 const wrongTrendMax = useMemo(() => getWrongTrendMax(wrongTrendDisplayRows), [wrongTrendDisplayRows]);
 const wrongTrendHotspot = useMemo(() => pickWrongTrendHotspot(wrongTrendBaseRows), [wrongTrendBaseRows]);

 const dynastyWeakRows = useMemo(() => topWeakRows(profile.by_dynasty, 6), [profile.by_dynasty]);
 const themeWeakRows = useMemo(() => topWeakRows(profile.by_theme, 6), [profile.by_theme]);
 const sourceWeakRows = useMemo(
 () => buildSourceWeakRows(profile.by_question_source || {}, formatSourceLabel, 8),
 [profile.by_question_source],
 );
 const diagnosisDimensionRows = useMemo(
 () => [
 { key: "memorization", label: "榛樺啓", rate: metricRate(profile, "memorization"), group: "鍩虹鐞嗚В" },
 { key: "meaning", label: "璇嶄箟", rate: metricRate(profile, "meaning"), group: "鍩虹鐞嗚В" },
 { key: "technique", label: "鎵嬫硶", rate: metricRate(profile, "technique"), group: "閴磋祻琛ㄨ揪" },
 { key: "emotion", label: "鎯呮劅", rate: metricRate(profile, "emotion"), group: "閴磋祻琛ㄨ揪" },
 { key: "appreciation", label: "璧忔瀽", rate: metricRate(profile, "appreciation"), group: "閴磋祻琛ㄨ揪" },
 { key: "imagery", label: "鎰忚薄", rate: imageryRate, group: "閴磋祻琛ㄨ揪" },
 ],
 [imageryRate, profile],
 );
 const diagnosisAverageRate = useMemo(() => {
 if (diagnosisDimensionRows.length === 0) return 0;
 const sum = diagnosisDimensionRows.reduce((acc, item) => acc + Number(item.rate || 0), 0);
 return Math.round(sum / diagnosisDimensionRows.length);
 }, [diagnosisDimensionRows]);
 const diagnosisWeakestDimension = useMemo(() => {
 if (diagnosisDimensionRows.length === 0) return null;
 return diagnosisDimensionRows.reduce((weakest, item) => (item.rate < weakest.rate ? item : weakest));
 }, [diagnosisDimensionRows]);
 const diagnosisStrongestDimension = useMemo(() => {
 if (diagnosisDimensionRows.length === 0) return null;
 return diagnosisDimensionRows.reduce((strongest, item) => (item.rate > strongest.rate ? item : strongest));
 }, [diagnosisDimensionRows]);
 const completedTaskKeys = useMemo(() => new Set(plan?.completedTaskKeys || []), [plan?.completedTaskKeys]);
 const planTaskStats = useMemo(() => {
 const stats = {
 total: 0,
 pending: 0,
 high: 0,
 medium: 0,
 low: 0,
 };
 if (!plan) {
 return stats;
 }
 plan.dailyTasks.forEach((day, dayIndex) => {
 day.tasks.forEach((_, taskIndex) => {
 const taskKey = `${dayIndex}-${taskIndex}`;
 const done = completedTaskKeys.has(taskKey);
 const priority = day.taskPriorities?.[taskIndex] || "medium";
 stats.total += 1;
 if (!done) {
 stats.pending += 1;
 }
 if (priority === "high") {
 stats.high += 1;
 } else if (priority === "low") {
 stats.low += 1;
 } else {
 stats.medium += 1;
 }
 });
 });
 return stats;
 }, [plan, completedTaskKeys]);
 const overviewWrongTotal = wrongOverviewCounts?.total ?? wrongTotal;
 const overviewWrongPending =
 wrongOverviewCounts?.pending ?? (wrongStatusFilter === "pending" ? wrongTotal : wrongStatusStats.pending);
 const todayAction = useMemo(() => {
 if (overviewWrongPending > 0) {
 return {
 key: "wrongbook" as const,
 title: "浠婂ぉ鍏堟竻鐞嗗緟澶嶄範閿欓",
 description: `你当前还有 ${overviewWrongPending} 道待复习错题，先完成一轮回顾最稳妥。`,
 cta: "鍘婚敊棰樻湰澶勭悊",
 };
 }

 if (planTaskStats.pending > 0) {
 return {
 key: "plan" as const,
 title: "今天先推进复习计划",
 description: `当前复习计划还剩 ${planTaskStats.pending} 项任务，建议优先完成高优先级任务。`,
 cta: "去计划面板执行",
 };
 }

 if (diagnosisWeakestDimension) {
 return {
 key: "diagnosis" as const,
 title: "今天先补齐薄弱维度",
 description: `目前最薄弱的是 ${diagnosisWeakestDimension.label}（正确率 ${diagnosisWeakestDimension.rate}%），建议先做专项巩固。`,
 cta: "鏌ョ湅钖勫急璇婃柇",
 };
 }

	 return {
	 key: "favorites" as const,
	 title: "今天先从收藏诗词开始",
	 description: "当前核心任务较少，可以从收藏诗词中选一首做深度学习。",
	 cta: "去我的收藏挑选",
	 };
	 }, [diagnosisWeakestDimension, overviewWrongPending, planTaskStats.pending]);
	 const teacherHint = myLearningTeacherHint;
 const entryFrom = useMemo(() => String(searchParams.get("from") || "").trim().toLowerCase(), [searchParams]);
 const entryTip = useMemo(() => {
   if (!entryFrom) {
     return null;
   }

   if (entryFrom === "practice") {
     return {
       eyebrow: "鍏ュ彛鎵挎帴 路 鏉ヨ嚜缁冩祴",
       title: "缁冩祴宸插畬鎴愶紝涓嬩竴姝ユ妸閿欏洜鏀跺彛",
      description: "建议先看错题本并筛选本轮错题，再生成复习计划；若需要稳定记忆，可进入记忆训练把薄弱诗句加入队列。",
       tone: "warm" as const,
       actions: [
         { label: "鍘婚敊棰樻湰", to: "/my-learning?tab=wrongbook&from=practice", variant: "primary" as const },
        { label: "看复习计划", to: "/my-learning?tab=plan&from=practice" },
        { label: "去记忆训练", to: "/memory?from=my_learning" },
       ],
     };
   }

   if (entryFrom === "memory") {
     return {
       eyebrow: "鍏ュ彛鎵挎帴 路 鏉ヨ嚜璁板繂",
       title: "璁板繂鎵撳崱瀹屾垚锛屼笅涓€姝ュ仛杩佺Щ楠岃瘉",
      description: "建议做一组练测，确认“记住”已经能转成答题表达；同时回到计划面板，把薄弱点排进复习节奏。",
       tone: "info" as const,
       actions: [
        { label: "去练测", to: "/practice?entry=practice&auto=1&source=my_learning", variant: "primary" as const },
        { label: "看复习计划", to: "/my-learning?tab=plan&from=memory" },
        { label: "看薄弱诊断", to: "/my-learning?tab=diagnosis&from=memory" },
       ],
     };
   }

   if (entryFrom === "create") {
     return {
       eyebrow: "鍏ュ彛鎵挎帴 路 鏉ヨ嚜鍒涗綔",
       title: "浣滃搧宸蹭骇鍑猴紝涓嬩竴姝ユ妸鎴愭灉绾冲叆澶嶇洏",
      description: "建议回到学情总览收拢本周练测、错题与记忆状态，再根据薄弱点安排下一轮巩固。",
       tone: "success" as const,
       actions: [
         { label: "鐪嬪鎯呮€昏", to: "/my-learning?tab=overview&from=create", variant: "primary" as const },
        { label: "看复习计划", to: "/my-learning?tab=plan&from=create" },
        { label: "去图谱延展", to: "/graph?from=my_learning" },
       ],
     };
   }

   if (entryFrom === "graph") {
     return {
       eyebrow: "鍏ュ彛鎵挎帴 路 鏉ヨ嚜鍥捐氨",
      title: "图谱发现已形成，下一步把薄弱点转成行动",
      description: "建议选择一个薄弱节点，进入对应题组练测；若错因已明确，可回错题本或计划面板收束。",
       tone: "warm" as const,
       actions: [
        { label: "去练测", to: "/practice?entry=practice&auto=1&source=graph", variant: "primary" as const },
         { label: "鍘婚敊棰樻湰", to: "/my-learning?tab=wrongbook&from=graph" },
        { label: "看复习计划", to: "/my-learning?tab=plan&from=graph" },
       ],
     };
   }

   return {
     eyebrow: "鍏ュ彛鎵挎帴",
     title: "娆㈣繋鍥炲埌瀛︽儏涓績",
    description: "先在总览里确认本周薄弱点，再进入错题本或计划面板安排下一步。",
     tone: "neutral" as const,
     actions: [
       { label: "鐪嬪鎯呮€昏", to: "/my-learning?tab=overview", variant: "primary" as const },
       { label: "鐪嬮敊棰樻湰", to: "/my-learning?tab=wrongbook" },
     ],
   };
 }, [entryFrom, searchParams]);
	 const overviewMetricCards = useMemo<LearningSummaryMetric[]>(
	 () =>
	 learningSummary?.metrics?.length
	 ? learningSummary.metrics
	 : [
	 {
	 label: "掌握率趋势",
	 value: `${diagnosisAverageRate}%`,
	 detail:
	 diagnosisStrongestDimension && diagnosisWeakestDimension
	 ? `当前强项是 ${diagnosisStrongestDimension.label}，薄弱点集中在 ${diagnosisWeakestDimension.label}。`
	 : "近 30 天整体掌握率正在形成稳定基线。",
	 },
	 {
	 label: "知识点覆盖",
	 value: "4 类",
	 detail: "按题型、朝代、题材和记忆巩固四个维度整理当前覆盖面。",
	 },
	 {
	 label: "钖勫急鐜妭",
	 value: diagnosisWeakestDimension ? diagnosisWeakestDimension.label : "鏆傛棤",
	 detail: `待复习 ${overviewWrongPending} 题，计划待完成 ${planTaskStats.pending} 项。`,
	 },
	 ],
	 [diagnosisAverageRate, diagnosisStrongestDimension, diagnosisWeakestDimension, learningSummary?.metrics, overviewWrongPending, planTaskStats.pending],
	 );
	 const classroomReadinessCards = useMemo(
	 () => [
	 {
	 label: "涓汉瀛︽儏鍩虹嚎",
	 value: learningSummaryLoading ? "同步中" : `${learningSummary?.overview?.accuracy30d ?? diagnosisAverageRate}%`,
	 detail: "来自 /api/user/learning-summary。班级聚合接口接入前，不展示伪造班级均值。",
	 },
	 {
	 label: "待处理错题",
	 value: String(overviewWrongPending),
	 detail: "来自真实错题本统计，可作为后续班级共性错因聚合的基线。",
	 },
	 {
	 label: "计划待完成",
	 value: String(planTaskStats.pending),
	 detail: "来自当前复习计划执行状态，暂不冒充班级作业完成率。",
	 },
	 {
	 label: "当前薄弱点",
	 value: diagnosisWeakestDimension?.label || "鏆傛棤",
	 detail: diagnosisWeakestDimension
	 ? `个人维度正确率 ${diagnosisWeakestDimension.rate}%，后续可映射到班级错题分布。`
	 : "等待更多练测数据后生成真实薄弱维度。",
	 },
	 ],
	 [diagnosisAverageRate, diagnosisWeakestDimension, learningSummary?.overview?.accuracy30d, learningSummaryLoading, overviewWrongPending, planTaskStats.pending],
	 );
	 const learningCoverageItems = useMemo<LearningCoverageItem[]>(
	 () =>
	 learningSummary?.coverage?.length
	 ? learningSummary.coverage
	 : [
	 {
	 label: "棰樺瀷琛ㄧ幇",
	 mastery: diagnosisAverageRate,
	 description: "依据题型表现估算当前整体稳定度。",
	 },
	 {
	 label: "鏈濅唬鐞嗚В",
	 mastery: Math.max(0, diagnosisAverageRate - 4),
	 description: "结合朝代维度表现判断理解基础。",
	 },
	 {
	 label: "棰樻潗鐞嗚В",
	 mastery: Math.max(0, diagnosisAverageRate - 8),
	 description: "关注送别、思乡、山水等主题的迁移情况。",
	 },
	 {
	 label: "璁板繂宸╁浐",
	 mastery: Math.max(0, Math.min(100, 100 - overviewWrongPending * 6)),
	 description: "依据待处理任务粗估当前复习压力。",
	 },
	 ],
	 [diagnosisAverageRate, learningSummary?.coverage, overviewWrongPending],
	 );
	 const learningTrendPoints = useMemo(
	 () =>
	 learningSummary?.trend?.items?.length
	 ? learningSummary.trend.items
	 : [
	 { label: "第1周", value: Math.max(35, diagnosisAverageRate - 9) },
	 { label: "第2周", value: Math.max(40, diagnosisAverageRate - 5) },
	 { label: "第3周", value: Math.max(45, diagnosisAverageRate - 2) },
	 { label: "第4周", value: diagnosisAverageRate },
	 ],
	 [diagnosisAverageRate, learningSummary?.trend?.items],
	 );
	 const trendValues = useMemo(() => learningTrendPoints.map((item) => item.value), [learningTrendPoints]);
	 const trendMin = useMemo(() => Math.min(...trendValues), [trendValues]);
	 const trendMax = useMemo(() => Math.max(...trendValues), [trendValues]);
	 const trendChartPoints = useMemo(() => {
	 const width = 320;
	 const height = 120;
	 return learningTrendPoints.map((point, index) => {
	 const x = learningTrendPoints.length === 1 ? width / 2 : (index / (learningTrendPoints.length - 1)) * width;
	 const ratio = trendMax === trendMin ? 0.5 : (point.value - trendMin) / (trendMax - trendMin);
	 const y = height - ratio * (height - 18) - 10;
	 return { ...point, x, y };
	 });
	 }, [learningTrendPoints, trendMax, trendMin]);
	 const trendPolyline = useMemo(() => {
	 return trendChartPoints.map((point) => `${point.x},${point.y}`).join(" ");
	 }, [trendChartPoints]);
	 const overviewNarrative = useMemo(() => {
	 if (learningSummary?.narrative) {
	 return learningSummary.narrative;
	 }
	 const weakest = diagnosisWeakestDimension ? `${diagnosisWeakestDimension.label}${diagnosisWeakestDimension.rate}%` : "暂无明显薄弱点";
	 const strongest = diagnosisStrongestDimension ? `${diagnosisStrongestDimension.label}${diagnosisStrongestDimension.rate}%` : "鏆傛棤鏄庢樉寮洪」";
	 return `当前整体掌握率约 ${diagnosisAverageRate}%，强项为 ${strongest}，当前最需要补齐的是 ${weakest}。`;
	 }, [diagnosisAverageRate, diagnosisStrongestDimension, diagnosisWeakestDimension, learningSummary?.narrative]);
	 const parsedAiLearningReport = useMemo(() => parseLearningReportSections(aiLearningReportText), [aiLearningReportText]);
	 const learningReportSections = useMemo(() => {
	 const reportSeed = learningSummary?.reportSeed;
	 return [
	 {
	 title: parsedAiLearningReport?.summaryTitle || reportSeed?.summaryTitle || "AI 瀛︽儏瑙ｈ",
	 detail:
	 parsedAiLearningReport?.summaryText ||
	 reportSeed?.summaryText ||
	 "正在根据近期练测、错题与复习数据生成学情解读。",
	 },
	 {
	 title: parsedAiLearningReport?.teacherAdviceTitle || reportSeed?.teacherAdviceTitle || "鏁欏笀 / 瀹堕暱寤鸿",
	 detail:
	 parsedAiLearningReport?.teacherAdviceText ||
	 reportSeed?.teacherAdviceText ||
	 "建议先围绕当前薄弱点安排一轮专项练测，再回到错题与记忆训练做收束。",
	 },
	 ];
	 }, [learningSummary?.reportSeed, parsedAiLearningReport]);
	 const reportTitle = "诗境通阶段学情报告";
	 const buildStudyReportMarkdown = (generatedAt: string): string => {
	 const metricRows = overviewMetricCards
	 .map((item) => `| ${escapeMarkdown(item.label)} | ${escapeMarkdown(item.value)} | ${escapeMarkdown(item.detail)} |`)
	 .join("\n");
	 const trendText = learningTrendPoints.map((item) => `${item.label} ${item.value}%`).join(" 路 ");
	 const coverageRows = learningCoverageItems
	 .map((item) => `- **${escapeMarkdown(item.label)} ${item.mastery}%**：${escapeMarkdown(item.description)}`)
	 .join("\n");
	 const adviceRows = learningReportSections
	 .map((item) => `- **${escapeMarkdown(item.title)}**：${escapeMarkdown(item.detail)}`)
	 .join("\n");

	 return [
	 `# ${reportTitle}`,
	 "",
	 `- 生成时间：${generatedAt}`,
	 `- 学情摘要：${overviewNarrative}`,
	 "",
	 "## 鏍稿績鎸囨爣",
	 "",
	 "| 鎸囨爣 | 褰撳墠鍊?| 璇存槑 |",
	 "| --- | --- | --- |",
	 metricRows,
	 "",
	 "## 近 30 天趋势",
	 "",
	 `- ${trendText}`,
	 "",
	 "## 知识点覆盖",
	 "",
	 coverageRows,
	 "",
	 "## AI 学情解读与教学建议",
	 "",
	 adviceRows,
	 "",
	 ].join("\n");
	 };
	 const handleExportStudyReportPdf = (): void => {
	 const generatedAt = new Date().toLocaleString();
	 const coverageListHtml = learningCoverageItems
	 .map(
	 (item) =>
	 `<li><strong>${escapeHtml(item.label)}：</strong>${escapeHtml(String(item.mastery))}% / ${escapeHtml(item.description)}</li>`,
	 )
	 .join("");
	 const adviceListHtml = learningReportSections
	 .map((item) => `<li><strong>${escapeHtml(item.title)}锛?</strong>${escapeHtml(item.detail)}</li>`)
	 .join("");
	 const bodyHtml = `
	 <p class="report-kicker">Study Report</p>
	 <h1 class="report-title">诗境通阶段学情报告</h1>
	 <p class="report-subtitle">生成时间：${escapeHtml(generatedAt)}<br />${escapeHtml(overviewNarrative)}</p>
	 <section class="metric-grid">
	   ${overviewMetricCards
	 .map(
	 (item) => `
	   <article class="metric-card">
	     <p class="metric-label">${escapeHtml(item.label)}</p>
	     <p class="metric-value">${escapeHtml(item.value)}</p>
	     <p class="metric-detail">${escapeHtml(item.detail)}</p>
	   </article>`,
	 )
	 .join("")}
	 </section>
	 <section class="section">
	   <h2 class="section-title">杩?30 澶╄秼鍔?</h2>
	   <p class="section-copy">${escapeHtml(learningTrendPoints.map((item) => `${item.label} ${item.value}%`).join(" 路 "))}</p>
	 </section>
	 <section class="section">
	   <h2 class="section-title">鐭ヨ瘑鐐硅鐩栫儹鍔涘浘</h2>
	   <div class="tag-list">
	     ${learningCoverageItems.map((item) => `<span class="tag">${escapeHtml(item.label)} ${escapeHtml(String(item.mastery))}%</span>`).join("")}
	   </div>
	   <div class="list-card">
	     <ul>${coverageListHtml}</ul>
	   </div>
	 </section>
	 <section class="section">
	   <h2 class="section-title">AI 瀛︽儏瑙ｈ涓庢暀瀛﹀缓璁?</h2>
	   <div class="list-card">
	     <ul>${adviceListHtml}</ul>
	   </div>
	 </section>`;
	 const opened = openStudyReportPrintWindow(reportTitle, bodyHtml);
	 setStudyReportMessage(opened ? "已打开学情报告打印页，可在浏览器中另存为 PDF。" : "浏览器拦截了报告窗口，请允许弹窗后重试。");
	 };
	 const handleExportStudyReportMarkdown = (): void => {
	 const generatedAt = new Date().toLocaleString();
	 const timestamp = Date.now();
	 const markdown = buildStudyReportMarkdown(generatedAt);
	 const downloaded = downloadTextFile(`诗境通学情报告_${timestamp}.md`, markdown);
	 setStudyReportMessage(downloaded ? "已导出 Markdown 学情报告。" : "当前环境不支持下载 Markdown 学情报告。");
	 };
	 const reminderSupported = typeof window !== "undefined" && "Notification" in window;

 useEffect(() => {
 if (typeof window === "undefined") {
 return;
 }
 const stored = window.localStorage.getItem(PLAN_REMINDER_ENABLED_KEY);
 setPlanReminderEnabled(stored === "1");
 if (reminderSupported) {
 setPlanReminderPermission(Notification.permission);
 }
 }, [reminderSupported]);

 const requestPlanReminderPermission = async (): Promise<NotificationPermission | null> => {
 if (!reminderSupported) {
	 setPlanReminderMessage("当前浏览器不支持通知提醒。");
 return null;
 }
 const permission = await Notification.requestPermission();
 setPlanReminderPermission(permission);
 return permission;
 };

 const togglePlanReminder = async (): Promise<void> => {
 if (!planReminderEnabled) {
 const permission = planReminderPermission === "granted" ? "granted" : await requestPlanReminderPermission();
 if (permission !== "granted") {
	 setPlanReminderMessage("未获得通知权限，请在浏览器中允许通知。");
 return;
 }
 setPlanReminderEnabled(true);
 window.localStorage.setItem(PLAN_REMINDER_ENABLED_KEY, "1");
	 setPlanReminderMessage("复习提醒已开启。");
 return;
 }

 setPlanReminderEnabled(false);
 window.localStorage.setItem(PLAN_REMINDER_ENABLED_KEY, "0");
	 setPlanReminderMessage("复习提醒已关闭。");
 };

 const sendPlanReminderTest = async (): Promise<void> => {
 if (!reminderSupported) {
	 setPlanReminderMessage("当前浏览器不支持通知提醒。");
 return;
 }
 const permission = planReminderPermission === "granted" ? "granted" : await requestPlanReminderPermission();
 if (permission !== "granted") {
	 setPlanReminderMessage("通知权限未开启，无法发送测试提醒。");
 return;
 }
	 new Notification("诗境通复习提醒", {
	 body: "这是一条测试提醒：你可以按计划完成今天的复习任务。",
 tag: "poetry-ai-plan-reminder-test",
 });
	 setPlanReminderMessage("测试提醒已发送。");
 };

 useEffect(() => {
 if (!reminderSupported || !planReminderEnabled || planReminderPermission !== "granted") {
 return;
 }
 if (!plan || planTaskStats.pending <= 0) {
 return;
 }

 const now = Date.now();
 const lastNotifyAt = Number(window.localStorage.getItem(PLAN_REMINDER_LAST_NOTIFY_KEY) || "0");
 if (Number.isFinite(lastNotifyAt) && now - lastNotifyAt < PLAN_REMINDER_NOTIFY_INTERVAL_MS) {
 return;
 }

	 const title = "诗境通复习提醒";
	 const body = `当前还有 ${planTaskStats.pending} 项任务未完成，建议优先处理高优先级任务。`;
 new Notification(title, { body, tag: "poetry-ai-plan-reminder" });
 window.localStorage.setItem(PLAN_REMINDER_LAST_NOTIFY_KEY, String(now));
 }, [plan, planTaskStats.pending, planReminderEnabled, planReminderPermission, reminderSupported]);
 const wrongTypeOptions = useMemo(() => {
 const defaultTypeOrder = ["memorization", "meaning", "technique", "emotion", "appreciation", "comparison", "context", "subjective", "exam"];
 const seen = new Set<string>();
 const values: string[] = [];

 for (const item of defaultTypeOrder) {
 seen.add(item);
 values.push(item);
 }
 for (const item of wrongMeta.errorTypes) {
 const value = item.value;
 if (!seen.has(value)) {
 seen.add(value);
 values.push(value);
 }
 }

 return values;
 }, [wrongMeta.errorTypes]);

 const subjectiveWrongCount = useMemo(
 () => wrongQuestions.filter((item) => item.question_kind === "subjective").length,
 [wrongQuestions],
 );
 const showWrongAdvancedFilters = useMemo(
 () =>
 showAdvancedWrongFilters ||
 wrongQuestionKindFilter !== "all" ||
 Boolean(wrongDynastyFilter) ||
 Boolean(wrongThemeFilter) ||
 Boolean(wrongKeywordTagFilter),
 [
 showAdvancedWrongFilters,
 wrongQuestionKindFilter,
 wrongDynastyFilter,
 wrongThemeFilter,
 wrongKeywordTagFilter,
 ],
 );
 const subjectivePracticeLink = useMemo(
 () =>
 buildSubjectivePracticeLink({
 status: wrongStatusFilter,
 dynasty: wrongDynastyFilter,
 theme: wrongThemeFilter,
 keywordTag: wrongKeywordTagFilter,
 }),
 [wrongStatusFilter, wrongDynastyFilter, wrongThemeFilter, wrongKeywordTagFilter],
 );
 const wrongbookWorkspaceSummary = useMemo(
 () => ({
 label: wrongbookWorkspaceLabelMap[wrongbookWorkspaceTab],
 description: wrongbookWorkspaceDescriptionMap[wrongbookWorkspaceTab],
 }),
 [wrongbookWorkspaceTab],
 );

 const resetWrongbookFilters = (): void => {
 setWrongPeriodFilter("all");
 setWrongStatusFilter("all");
 setWrongTypeFilter("all");
 setWrongQuestionKindFilter("all");
 setWrongKeywordTagFilter("");
 setWrongDynastyFilter("");
 setWrongThemeFilter("");
 setWrongFocusDate("");
 setWrongKeyword("");
 setWrongPage(1);
 setWrongPageSize(24);
 void Promise.all([
 loadWrongbookDashboard({
 period: "all",
 date: "",
 status: "all",
 type: "all",
 questionKind: "all",
 keywordTag: "",
 dynasty: "",
 theme: "",
 keyword: "",
 page: 1,
 pageSize: 24,
 force: true,
 }),
 loadWrongbookOverviewCounts({ force: true }),
 ]);
 };

 const markWrongAsMastered = (id: string): void => {
 void apiPatch(`/wrongbook/${id}`, { status: "mastered" }).then(() => {
 void Promise.all([
 loadWrongbookDashboard(currentWrongFilters()),
 loadWrongbookOverviewCounts({ force: true }),
 ]);
 });
 };

 const markWrongAsRetry = (id: string): void => {
 void apiPatch(`/wrongbook/${id}`, { status: "retry" }).then(() => {
 void Promise.all([
 loadWrongbookDashboard(currentWrongFilters()),
 loadWrongbookOverviewCounts({ force: true }),
 ]);
 });
 };

 const deleteWrongQuestion = (id: string): void => {
 void apiDelete(`/wrongbook/${id}`).then(() => {
 void Promise.all([
 loadWrongbookDashboard(currentWrongFilters()),
 loadWrongbookOverviewCounts({ force: true }),
 ]);
 });
 };

 const scrollToSection = (id: string): void => {
 if (typeof document === "undefined") {
 return;
 }
 const element = document.getElementById(id);
 if (element) {
 element.scrollIntoView({ behavior: "smooth", block: "start" });
 }
 };

 const scrollToSectionDeferred = (id: string): void => {
 if (typeof window === "undefined") {
 return;
 }
 window.requestAnimationFrame(() => {
 scrollToSection(id);
 });
 };

 const openWorkspaceShell = (nextTab: ActiveTab): void => {
 setActiveTab(nextTab);
 scrollToSectionDeferred("my-learning-workspace");
 };

 const closeWorkspaceShell = (): void => {
 scrollToSectionDeferred("my-learning-workspace");
 };

 const openDiagnosisTab = (): void => {
 openWorkspaceShell("diagnosis");
 void refreshWeakness();
 void loadLatestExamDiagnostics();
 void loadExamSummaryLogs();
 void loadGraphCompareLogs();
 };

 const openPlanTab = (): void => {
 openWorkspaceShell("plan");
 void loadLatestPlan();
 };

	 const handleOverviewTabChange = (nextTab: ActiveTab): void => {
	 if (nextTab === "overview") {
	 openWorkspaceShell("overview");
	 return;
	 }
	 if (nextTab === "wrongbook") {
	 openWorkspaceShell("wrongbook");
 setWrongbookMainView("workspace");
 setWrongbookWorkspaceTab("list");
 void loadWrongbookDashboard(currentWrongFilters());
 return;
 }
 if (nextTab === "favorites") {
 openWorkspaceShell("favorites");
 return;
 }
 if (nextTab === "diagnosis") {
 openDiagnosisTab();
 return;
 }
 openPlanTab();
 };

 const scrollToStudyReportExport = (): void => {
 handleOverviewTabChange("overview");
 window.setTimeout(() => {
 document.getElementById("my-learning-report-export")?.scrollIntoView({ behavior: "smooth", block: "start" });
 }, 160);
 };

 const triggerTodayAction = (): void => {
 if (todayAction.key === "wrongbook") {
 openWorkspaceShell("wrongbook");
 setWrongbookMainView("workspace");
 setWrongbookWorkspaceTab("list");
 setWrongStatusFilter("pending");
 setWrongPage(1);
 void loadWrongbookDashboard({ ...currentWrongFilters(), status: "pending", page: 1 });
 return;
 }

 if (todayAction.key === "plan") {
 openPlanTab();
 return;
 }

 if (todayAction.key === "diagnosis") {
 openDiagnosisTab();
 return;
 }

 openWorkspaceShell("favorites");
 };
 const activeTabLabelMap: Record<ActiveTab, string> = {
 overview: "瀛︽儏鎬昏",
wrongbook: "我的错题本",
 favorites: "鎴戠殑鏀惰棌",
 diagnosis: "钖勫急璇婃柇",
 plan: "AI 澶嶄範璁″垝",
 };
 const activeWorkspaceSubtitleMap: Record<ActiveTab, string> = {
overview: "汇总当前掌握率、趋势变化与下一步学习建议。",
wrongbook: "处理待复习错题，并在列表、统计、趋势之间切换。",
favorites: "管理收藏诗词，沉淀重点作品与笔记。",
diagnosis: "查看最弱维度、考试诊断与专项回补入口。",
plan: "安排今日复习任务，推进执行并管理提醒。",
 };
 const wrongbookMainNavItems = useMemo(
 () => [
{ id: "workspace" as const, label: "错题处理区" },
 { id: "operations" as const, label: "绛涢€変笌鎵归噺" },
 ],
 [],
 );
 const teacherScopeNavItems = useMemo(
 () => [
 { id: "individual" as const, label: "涓汉瑙嗗浘" },
 { id: "classroom" as const, label: "鐝骇瑙嗗浘" },
 ],
 [],
 );
 const classroomBoardNavItems = useMemo(
 () => [
 { id: "overview" as const, label: "鐝骇鎬昏" },
 { id: "homework" as const, label: "浣滀笟瀹屾垚" },
 { id: "distribution" as const, label: "閿欓鍒嗗竷" },
 { id: "export" as const, label: "鎶ュ憡瀵煎嚭" },
 ],
 [],
 );
 const wrongbookWorkspaceNavItems = useMemo(
 () => [
 { id: "list" as const, label: "閿欓鍒楄〃" },
 { id: "insight" as const, label: "缁熻寮辩偣" },
 { id: "trend" as const, label: "瓒嬪娍澶嶇洏" },
 ],
 [],
 );

 if (isTeacherMode && teacherScope === "classroom") {
 return (
 <div className="page-shell">
 <PageStage tone="primary">
	 <PageHeader
	 variant="standard"
	 kicker="鎴戠殑瀛︽儏"
	 title="鏁欏笀鐝骇瑙嗗浘"
	 subtitle="鍦ㄤ釜浜哄鎯呴〉鐨勫熀纭€涓婂彔鍔犵彮绾ф瑙堛€佷綔涓氬畬鎴愩€侀敊棰樺垎甯冧笌鎶ュ憡瀵煎嚭銆?"
	 />
	 <LearnJourneyProgress className="mt-4" />
	 <TeachingObjectiveCard
	 variant="panel"
	 kicker="鏁欏笀鐩爣鎻愮ず"
	 title={myLearningTeachingObjective.title}
	 summary={myLearningTeachingObjective.summary}
	 goals={myLearningTeachingObjective.goals}
	 chipLabel="褰撳墠闃舵 路 瀛︽儏璇婃柇锛堢彮绾э級"
	 hint={myLearningTeachingObjective.teacherHint}
	 className="mt-4 shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
	 />
 </PageStage>

 <SectionCard
 className="surface-card card-dense"
 weight="workspace"
 title="瑙嗗浘鍒囨崲"
 subtitle="鏁欏笀妯″紡涓嬪彲鍦ㄤ釜浜哄鎯呬笌鐝骇瑙嗗浘涔嬮棿鍒囨崲銆?"
 actions={<PillNav items={teacherScopeNavItems} value={teacherScope} onChange={setTeacherScope} className="bg-stone-100" />}
 >
 <p className="text-xs leading-6 text-slate-500">褰撳墠涓虹彮绾ц鍥撅紝閫傚悎璇惧爞鎶曞睆灞曠ず鏁翠綋杩涘害銆佸叡鎬у急鐐逛笌涓嬩竴姝ュ畨鎺掋€?</p>
 </SectionCard>

 <PageStage id="my-learning-workspace" tone="detail" className="flow-md">
 {teacherHint ? <TeacherHintCallout title={teacherHint.title} detail={teacherHint.detail} /> : null}

 <SectionCard
 className="surface-card card-dense"
 weight="workspace"
 title="鐝骇宸ヤ綔鍙?"
 subtitle="鐝骇鑱氬悎鎺ュ彛鎺ュ叆鍓嶏紝浠呭睍绀虹湡瀹炰釜浜哄鎯呭熀绾夸笌鎺ュ叆鐘舵€併€?"
 actions={<PillNav items={classroomBoardNavItems} value={classroomBoardTab} onChange={setClassroomBoardTab} className="bg-stone-100" />}
 >
 <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
 {classroomReadinessCards.map((item) => (
 <article key={item.label} className="rounded-[1.1rem] px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.05)] shadow-[inset_0_0_0_1px_rgba(214,223,231,0.92)]" style={{ background: 'var(--bg-surface)' }}>
 <p className="text-xs tracking-[0.08em] text-slate-500">{item.label}</p>
 <p className="mt-2 font-serif text-3xl text-ink-700">{item.value}</p>
 <p className="mt-2 text-xs leading-6 text-slate-500">{item.detail}</p>
 </article>
 ))}
 </div>
 </SectionCard>

 {classroomBoardTab === "overview" ? (
 <SectionCard title="鐝骇鎬昏" subtitle="绛夊緟鐝骇 roster / class summary 鑱氬悎鎺ュ彛锛屼笉鐢ㄩ潤鎬佸鐢熷悕鍗曞崰浣嶃€?">
 <div className="rounded-[24px] bg-[linear-gradient(135deg,#fffaf0_0%,#f4ead8_100%)] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(201,169,110,0.24)]">
 <p className="font-serif text-2xl text-ink-700">鐝骇鎬昏寰呮帴鍏ョ湡瀹炴暟鎹?</p>
 <p className="mt-3 text-sm leading-7" style={{ color: 'var(--neutral)' }}>
 褰撳墠宸蹭繚鐣欑彮绾ц鍥惧叆鍙ｏ紝浣嗕笉鍐嶅睍绀轰吉閫犲鐢熴€佸湪绾夸汉鏁版垨杩涙鎺掑悕銆備笅涓€姝ラ渶瑕佸悗绔彁渚涚彮绾у悕鍗曘€佸鐢熷畬鎴愮巼銆佸叡鎬у急鐐瑰拰鏉冮檺杈圭晫鍚庡啀鎵撳紑鐪熷疄鐝骇闈㈡澘銆? </p>
 <div className="mt-4 grid gap-3 md:grid-cols-3">
 {["GET /api/classes/:id/summary", "GET /api/classes/:id/students", "GET /api/classes/:id/wrongbook/trend"].map((item) => (
 <span key={item} className="rounded-full px-3 py-2 text-xs shadow-[inset_0_0_0_1px_rgba(201,169,110,0.22)]" style={{ color: '#5A4B37', background: 'var(--bg-surface)', opacity: 0.72 }}>{item}</span>
 ))}
 </div>
 </div>
 </SectionCard>
 ) : null}

 {classroomBoardTab === "homework" ? (
<Suspense fallback={<MyLearningLazyFallback label="鐝骇浣滀笟闈㈡澘" />}>
<LessonTaskBoard
 mode="teacher"
 lessonTasks={lessonTasks}
 lessonTasksLoading={lessonTasksLoading}
 lessonTaskError={lessonTaskError}
 lessonTaskMessage={lessonTaskMessage}
 lessonTaskSaving={lessonTaskSaving}
 lessonTaskUpdatingId={lessonTaskUpdatingId}
 lessonTaskDraft={lessonTaskDraft}
 setLessonTaskDraft={setLessonTaskDraft}
 onCreate={() => void handleCreateLessonTask()}
 onStatusChange={(taskId, status) => void handleLessonTaskStatusChange(taskId, status)}
 />
</Suspense>
 ) : null}

 {classroomBoardTab === "distribution" ? (
 <SectionCard title="閿欓鍒嗗竷" subtitle="褰撳墠灞曠ず涓汉瑕嗙洊鍩虹嚎锛屼笉鍐掑厖鐝骇鍏辨€ч敊鍥犮€?">
 <div className="space-y-3">
 {learningCoverageItems.map((row) => (
 <article key={row.label} className="rounded-[22px] px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.06)]" style={{ background: 'var(--bg-surface)' }}>
 <div className="flex items-center justify-between gap-3 text-sm">
 <span className="text-ink-700">{row.label}</span>
 <span className="text-slate-500">{row.mastery}%</span>
 </div>
 <div className="mt-3 h-2 rounded-full bg-stone-200">
 <span className="block h-full rounded-full bg-[linear-gradient(90deg,#C9A96E_0%,#1A2B4C_100%)]" style={{ width: `${row.mastery}%` }} />
 </div>
 <p className="mt-2 text-xs leading-6 text-slate-500">{row.description}</p>
 </article>
 ))}
 </div>
 </SectionCard>
 ) : null}

 {classroomBoardTab === "export" ? (
 <SectionCard title="瀛︽儏鎶ュ憡瀵煎嚭" subtitle="鐝骇鎶ュ憡鎺ュ彛鎺ュ叆鍓嶏紝浠呭鍑哄綋鍓嶇湡瀹炰釜浜哄鎯呮姤鍛娿€?">
 <div className="space-y-4">
 <div className="rounded-[22px] bg-[linear-gradient(135deg,#FFF9EE_0%,#F3E7CE_100%)] px-4 py-4 text-sm leading-7 text-[#5A4B37] shadow-[0_10px_22px_rgba(34,58,94,0.05)]">
 褰撳墠瀵煎嚭鍐呭鏉ヨ嚜涓汉 `learning-summary`銆侀敊棰樹笌澶嶄範璁″垝銆傜彮绾ф姤鍛婇渶瑕?`class summary` 鑱氬悎鎺ュ彛鍚庡啀寮€鏀撅紝閬垮厤鎶婁釜浜烘牱鏈鏍囦负鐝骇缁撹銆? </div>
<Suspense fallback={<MyLearningLazyFallback label="瀛︿範鎶ュ憡瀵煎嚭" />}>
<LearningReportExport onExportPdf={handleExportStudyReportPdf} onExportMarkdown={handleExportStudyReportMarkdown} />
</Suspense>
 </div>
 </SectionCard>
 ) : null}
 </PageStage>
 </div>
 );
 }

 return (
 <div className="page-shell">
 <PageStage tone="primary">
	 <PageHeader
	 variant="standard"
	 kicker="鎴戠殑瀛︽儏"
	 title="浠庘€滄垜鐨勫涔犫€濊浆涓哄鎯呬腑蹇?"
	 subtitle="淇濈暀閿欓鏈€佽瘖鏂€佽鍒掋€佹敹钘忕瓑鍘熸湁宸ヤ綔鍖洪€昏緫锛屽苟琛ラ綈瀛︽儏鎬昏銆丄I 瑙ｈ涓庢姤鍛婂鍑虹€?"
	 actions={
	 <Magnet className="inline-flex">
	 <button type="button" onClick={scrollToStudyReportExport} className="btn-secondary-compact whitespace-nowrap">
	 瀵煎嚭瀛︿範鎶ュ憡
	 </button>
	 </Magnet>
	 }
	 />
	 <LearnJourneyProgress className="mt-4" />
   {entryTip ? (
     <div className="mt-4">
       <StateCalloutCard
         eyebrow={entryTip.eyebrow}
         title={entryTip.title}
         description={entryTip.description}
         tone={entryTip.tone}
         actions={entryTip.actions}
       />
     </div>
   ) : null}
	 {isTeacherMode ? (
	 <TeachingObjectiveCard
	 variant="panel"
	 kicker="鏁欏笀鐩爣鎻愮ず"
	 title={myLearningTeachingObjective.title}
	 summary={myLearningTeachingObjective.summary}
	 goals={myLearningTeachingObjective.goals}
	 chipLabel="褰撳墠闃舵 路 瀛︽儏璇婃柇"
	 hint={myLearningTeachingObjective.teacherHint}
	 className="mt-4 shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
	 />
	 ) : null}
 </PageStage>
 {isTeacherMode ? (
 <SectionCard
 className="surface-card card-dense"
 weight="workspace"
 title="瑙嗗浘鍒囨崲"
 subtitle="鏁欏笀妯″紡涓嬪彲鍦ㄤ釜浜哄鎯呬笌鐝骇瑙嗗浘涔嬮棿鍒囨崲銆?"
 actions={<PillNav items={teacherScopeNavItems} value={teacherScope} onChange={setTeacherScope} className="bg-stone-100" />}
 >
 <p className="text-xs leading-6 text-slate-500">褰撳墠涓轰釜浜鸿鍥撅紝閫傚悎鍏堣瓒嬪娍涓庡急鐐癸紝鍐嶅垏鍒扮彮绾ц鍥惧睍绀哄叡鎬ч棶棰樺拰瀵煎嚭鎶ュ憡銆?</p>
 </SectionCard>
 ) : null}
 <LearningOverview
 activeTab={activeTab}
 onChangeTab={handleOverviewTabChange}
 onStartToday={triggerTodayAction}
 wrongTotal={overviewWrongTotal}
 wrongPending={overviewWrongPending}
 favoriteTotal={favoriteTotal}
 planPending={planTaskStats.pending}
 weakFocus={diagnosisWeakestDimension ? `${diagnosisWeakestDimension.label} ${diagnosisWeakestDimension.rate}%` : "鏆傛棤鏄庢樉钖勫急鐐?"}
 todayTaskTitle={todayAction.title}
 todayTaskDescription={todayAction.description}
 titleText="鎴戠殑瀛︽儏"
 startLabel={todayAction.cta}
 todayProgress={
 planTaskStats.total > 0
 ? Math.round(((planTaskStats.total - planTaskStats.pending) / planTaskStats.total) * 100)
 : overviewWrongPending > 0
 ? 42
 : 78
 }
 />

 <PageStage id="my-learning-workspace" tone="detail" className="flow-md">
 <SectionCard
 className="surface-card card-dense"
 weight="workspace"
 title={activeTabLabelMap[activeTab]}
 subtitle={activeWorkspaceSubtitleMap[activeTab]}
 bodyClassName="flow-sm"
 actions={
 <button type="button" className="btn-secondary-compact" onClick={closeWorkspaceShell}>
 杩斿洖宸ヤ綔鍖哄叆鍙? </button>
 }
 >
 <p className="text-xs leading-6 text-slate-500">
 寰呭涔?{overviewWrongPending} 棰?路 鏀惰棌 {favoriteTotal} 棣?路 璁″垝寰呭畬鎴?{planTaskStats.pending} 椤广€? 褰撳墠宸ヤ綔鍖猴細{activeTabLabelMap[activeTab]}銆? </p>
	 </SectionCard>

	 {isTeacherMode && teacherHint ? (
	 <TeacherHintCallout title={teacherHint.title} detail={teacherHint.detail} />
	 ) : null}

	 {activeTab === "overview" ? (
	 <section className="flow-md">
	 {studyReportMessage ? (
	 <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]">
	 {studyReportMessage}
	 </div>
	 ) : null}
	 <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
	 <SectionCard
	 className="surface-card card-roomy"
	 weight="workspace"
	 title="瀛︽儏鎬昏"
	 subtitle="鑱氬悎灞曠ず鎺屾彙鐜囪秼鍔裤€佺煡璇嗙偣瑕嗙洊涓庝笅涓€姝ュ涔犲缓璁€?"
	 bodyClassName="flow-lg"
	 >
	 <div className="grid gap-3 md:grid-cols-3">
	 {overviewMetricCards.map((item, index) => (
	 <article
	 key={item.label}
	 className="rounded-[1.1rem] bg-white px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.05)] shadow-[inset_0_0_0_1px_rgba(214,223,231,0.92)]"
	 >
	 <p className="text-xs tracking-[0.08em] text-slate-500">{item.label}</p>
	 <AnimatedMetricValue
	 value={item.value}
	 className="mt-2 font-serif text-3xl text-ink-700"
	 durationMs={980 + index * 140}
	 />
	 <p className="mt-2 text-xs leading-6 text-slate-500">{item.detail}</p>
	 </article>
	 ))}
	 </div>

	 <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
	 <Suspense fallback={<MyLearningLazyFallback label="瀛︿範瓒嬪娍" />}>
	 <LearningTrend
       trendPolyline={trendPolyline}
       trendChartPoints={trendChartPoints}
       overviewNarrative={overviewNarrative}
     />
     </Suspense>

	 <article className="rounded-[1.2rem] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
	 <p className="learn-goal-kicker">鐭ヨ瘑鐐硅鐩栫儹鍔涘浘</p>
	 <div className="mt-4 space-y-3">
	 {learningCoverageItems.map((item) => (
	 <div key={item.label} className="rounded-2xl bg-white px-3 py-3 shadow-[0_4px_14px_rgba(34,58,94,0.04)]">
	 <div className="flex items-center justify-between gap-3">
	 <span className="font-medium text-ink-700">{item.label}</span>
	 <span className="text-sm text-slate-500">{item.mastery}%</span>
	 </div>
	 <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
	 <span
	 className="block h-full rounded-full bg-[linear-gradient(90deg,#C9A96E_0%,#1A2B4C_100%)]"
	 style={{ width: `${item.mastery}%` }}
	 />
	 </div>
	 <p className="mt-2 text-xs leading-6 text-slate-500">{item.description}</p>
	 </div>
	 ))}
	 </div>
	 </article>
	 </div>
	 </SectionCard>

    <Suspense fallback={<MyLearningLazyFallback label="AI 瀛︽儏瑙ｈ" />}>
    <AIInsightReport
       learningSummaryError={learningSummaryError}
       aiLearningReportError={aiLearningReportError}
       aiLearningReportLoading={aiLearningReportLoading}
       aiLearningReportSource={aiLearningReportSource}
       learningReportSections={learningReportSections}
       diagnosisWeakestDimension={diagnosisWeakestDimension}
       handleExportStudyReportPdf={handleExportStudyReportPdf}
       handleExportStudyReportMarkdown={handleExportStudyReportMarkdown}
     />
    </Suspense>
	 </div>
  {!isTeacherMode ? (
  <Suspense fallback={<MyLearningLazyFallback label="璇惧爞浠诲姟" />}>
  <LessonTaskBoard
  mode="student"
  lessonTasks={lessonTasks}
  lessonTasksLoading={lessonTasksLoading}
  lessonTaskError={lessonTaskError}
  lessonTaskMessage={lessonTaskMessage}
  lessonTaskUpdatingId={lessonTaskUpdatingId}
  onStatusChange={(taskId, status) => void handleLessonTaskStatusChange(taskId, status)}
  entryLimit={4}
  />
  </Suspense>
  ) : null}
	 </section>
	 ) : null}

	 {activeTab === "wrongbook" ? (
	 <section className="flow-md">
 <SectionCard
 className="surface-card card-dense"
 weight="workspace"
 title="閿欓鏈伐浣滃尯"
 subtitle="鍦ㄥ垪琛ㄣ€佺粺璁°€佽秼鍔夸笌绛涢€夋壒閲忎箣闂村垏鎹€?"
 bodyClassName="flow-sm"
 >
 <div className="flex flex-wrap items-center justify-between gap-2">
 <p className="text-xs" style={{ color: 'var(--neutral)' }}>
 当前模式：{wrongbookWorkspaceSummary.label} / 待复习 {overviewWrongPending} 题 / 趋势净变化 {wrongTrendSummary.net >= 0 ? "+" : ""}
 {wrongTrendSummary.net}
 </p>
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 className="btn-secondary-compact"
 onClick={() => {
 setWrongbookMainView("workspace");
 setWrongbookWorkspaceTab("list");
 setWrongStatusFilter("pending");
 setWrongPage(1);
 void loadWrongbookDashboard({ ...currentWrongFilters(), status: "pending", page: 1 });
 }}
 >
 鍏堢湅寰呭涔? </button>
 <button type="button" className="text-xs text-slate-500 transition hover:text-ink-700" onClick={openDiagnosisTab}>
 钖勫急璇婃柇
 </button>
 <button type="button" className="text-xs text-slate-500 transition hover:text-ink-700" onClick={openPlanTab}>
 澶嶄範璁″垝
 </button>
 </div>
 </div>

 <PillNav
 items={wrongbookMainNavItems}
 value={wrongbookMainView}
 onChange={setWrongbookMainView}
 className="w-full md:w-auto"
 />

 {wrongbookMainView === "workspace" ? (
 <>
 <PillNav
 items={wrongbookWorkspaceNavItems}
 value={wrongbookWorkspaceTab}
 onChange={setWrongbookWorkspaceTab}
 className="w-full md:w-auto"
 />
 <p className="text-xs leading-6 text-slate-500">{wrongbookWorkspaceSummary.description}</p>
 </>
 ) : (
 <p className="text-xs leading-6 text-slate-500">鍏堝畬鎴愮瓫閫変笌鎵归噺澶勭悊锛屽啀鍥炲埌閿欓澶勭悊鍖虹户缁鐩樸€?</p>
 )}
 </SectionCard>

 {wrongError ? (
 <div className="rounded-xl shadow-[inset_0_0_0_1px_rgba(220,38,38,0.24)] bg-red-50 p-4 text-sm text-red-700">{wrongError}</div>
 ) : null}

 {wrongbookMainView === "operations" ? (
<Suspense fallback={<MyLearningLazyFallback label="閿欓绛涢€変笌鎵归噺鎿嶄綔" />}>
<WrongbookPanel
 wrongPeriodFilter={wrongPeriodFilter}
 wrongStatusFilter={wrongStatusFilter}
 wrongTypeFilter={wrongTypeFilter}
 wrongKeyword={wrongKeyword}
 wrongQuestionKindFilter={wrongQuestionKindFilter}
 wrongDynastyFilter={wrongDynastyFilter}
 wrongThemeFilter={wrongThemeFilter}
 wrongKeywordTagFilter={wrongKeywordTagFilter}
 wrongTypeOptions={wrongTypeOptions}
 questionTypeLabelMap={questionTypeLabelMap}
 wrongMeta={wrongMeta}
 showWrongAdvancedFilters={showWrongAdvancedFilters}
 wrongMetaLoading={wrongMetaLoading}
 wrongFocusDate={wrongFocusDate}
 subjectiveWrongCount={subjectiveWrongCount}
 subjectivePracticeLink={subjectivePracticeLink}
 wrongQuestions={wrongQuestions}
 selectedIds={selectedIds}
 batchLoading={batchLoading}
 setWrongPeriodFilter={setWrongPeriodFilter}
 setWrongStatusFilter={setWrongStatusFilter}
 setWrongTypeFilter={setWrongTypeFilter}
 setWrongKeyword={setWrongKeyword}
 setWrongPage={setWrongPage}
 setShowAdvancedWrongFilters={setShowAdvancedWrongFilters}
 setWrongQuestionKindFilter={setWrongQuestionKindFilter}
 setWrongDynastyFilter={setWrongDynastyFilter}
 setWrongThemeFilter={setWrongThemeFilter}
 setWrongKeywordTagFilter={setWrongKeywordTagFilter}
 setWrongFocusDate={setWrongFocusDate}
 loadWrongbookDashboard={loadWrongbookDashboard}
 currentWrongFilters={currentWrongFilters}
 toggleSelectAll={toggleSelectAll}
 runBatchAction={runBatchAction}
 />
</Suspense>
 ) : (
 <>
<Suspense fallback={<MyLearningLazyFallback label="错题工作区概览" />}>
<WrongbookWorkspaceSummaryCard activeTab={wrongbookWorkspaceTab} activeDescription={wrongbookWorkspaceSummary.description} />
</Suspense>

 {wrongbookWorkspaceTab === "insight" ? (
<Suspense fallback={<MyLearningLazyFallback label="閿欓缁熻寮辩偣" />}>
<WrongbookInsightWorkspace
 wrongLoading={wrongLoading}
 wrongQuestions={wrongQuestions}
 wrongSummary={wrongSummary}
 wrongStatusStats={wrongStatusStats}
 wrongTypeStats={wrongTypeStats}
 wrongDynastyStats={wrongDynastyStats}
 wrongThemeStats={wrongThemeStats}
 keywordMasterySummary={keywordMasterySummary}
 keywordWeakRows={keywordWeakRows}
 questionTypeLabelMap={questionTypeLabelMap}
 buildSubjectivePracticeLink={buildSubjectivePracticeLink}
 onOpenKeywordWeakness={(keyword) => {
 setWrongQuestionKindFilter("subjective");
 setWrongKeywordTagFilter(keyword);
 setWrongPage(1);
 void loadWrongbookDashboard({
 ...currentWrongFilters(),
 questionKind: "subjective",
 keywordTag: keyword,
 page: 1,
 });
 }}
 />
</Suspense>
 ) : null}

 {wrongbookWorkspaceTab === "trend" ? (
<Suspense fallback={<MyLearningLazyFallback label="閿欓瓒嬪娍澶嶇洏" />}>
<WrongbookTrendWorkspace
 wrongPeriodFilter={wrongPeriodFilter}
 wrongTrendView={wrongTrendView}
 wrongTrendShowAllDays={wrongTrendShowAllDays}
 wrongFocusDate={wrongFocusDate}
 wrongTrendSummary={wrongTrendSummary}
 wrongTrendHotspot={wrongTrendHotspot}
 wrongTrendLoading={wrongTrendLoading}
 wrongTrend={wrongTrend}
 wrongTrendDisplayRows={wrongTrendDisplayRows}
 wrongTrendRowsForRender={wrongTrendRowsForRender}
 wrongTrendPreviewRows={wrongTrendPreviewRows}
 wrongTrendExpanded={wrongTrendExpanded}
 wrongTrendMax={wrongTrendMax}
 buildSubjectivePracticeLink={buildSubjectivePracticeLink}
 onSwitchTrendView={(view) => {
 setWrongTrendView(view);
 setWrongTrendExpanded(false);
 if (view === "week") {
 setWrongFocusDate("");
 }
 }}
 onToggleShowAllDays={() => {
 setWrongTrendShowAllDays((prev) => !prev);
 setWrongTrendExpanded(false);
 }}
 onClearFocusDate={() => {
 setWrongFocusDate("");
 setWrongPage(1);
 }}
 onOpenPendingWrongbook={() => {
 setWrongStatusFilter("pending");
 setWrongQuestionKindFilter("all");
 setWrongPage(1);
 void loadWrongbookDashboard({ ...currentWrongFilters(), status: "pending", page: 1 });
 }}
 onToggleExpanded={() => setWrongTrendExpanded((prev) => !prev)}
 onToggleFocusDate={(date) => {
 setWrongFocusDate((prev) => (prev === date ? "" : date));
 setWrongPage(1);
 }}
 />
</Suspense>
 ) : null}

 {wrongbookWorkspaceTab === "list" ? (
<Suspense fallback={<MyLearningLazyFallback label="閿欓鍒楄〃" />}>
<WrongbookListWorkspace
 wrongLoading={wrongLoading}
 wrongQuestions={wrongQuestions}
 wrongPage={wrongPage}
 wrongTotalPages={wrongTotalPages}
 wrongTotal={wrongTotal}
 wrongPageSize={wrongPageSize}
 selectedIds={selectedIds}
 questionKindLabelMap={questionKindLabelMap}
 questionTypeLabelMap={questionTypeLabelMap}
 statusMap={statusMap}
 onChangePageSize={(value) => {
 setWrongPageSize(value);
 setWrongPage(1);
 }}
 onPrevPage={() => setWrongPage((prev) => Math.max(1, prev - 1))}
 onNextPage={() => setWrongPage((prev) => Math.min(wrongTotalPages, prev + 1))}
 onToggleSelect={toggleSelect}
 onResetFilters={resetWrongbookFilters}
 buildWrongRowPracticeLink={buildWrongRowPracticeLink}
 onMarkMastered={markWrongAsMastered}
 onMarkRetry={markWrongAsRetry}
 onDelete={deleteWrongQuestion}
 />
</Suspense>
 ) : null}
 </>
 )}
 </section>
 ) : null}
 {activeTab === "favorites" ? (
<Suspense fallback={<MyLearningLazyFallback label="鎴戠殑鏀惰棌" />}>
<FavoritesPanel
 favoritePage={favoritePage}
 favoritePageSize={favoritePageSize}
 favoriteTotal={favoriteTotal}
 favoriteTotalPages={favoriteTotalPages}
 favoriteKeyword={favoriteKeyword}
 favoriteAppliedKeyword={favoriteAppliedKeyword}
 favoritesLoading={favoritesLoading}
 favoritesError={favoritesError}
 favoriteItems={favoriteItems}
 favoriteNoteDrafts={favoriteNoteDrafts}
 favoriteNoteMessages={favoriteNoteMessages}
 favoriteNoteSavingId={favoriteNoteSavingId}
 unfavoriteLoadingId={unfavoriteLoadingId}
 setFavoriteKeyword={setFavoriteKeyword}
 setFavoritePage={setFavoritePage}
 setFavoritePageSize={setFavoritePageSize}
 setFavoriteNoteDrafts={setFavoriteNoteDrafts}
 setFavoriteNoteMessages={setFavoriteNoteMessages}
 loadFavorites={loadFavorites}
 saveFavoriteNote={saveFavoriteNote}
 unfavoritePoem={unfavoritePoem}
 />
</Suspense>
 ) : null}

 {activeTab === "diagnosis" ? (
<Suspense fallback={<MyLearningLazyFallback label="钖勫急璇婃柇" />}>
<DiagnosisWorkspace
 diagnosisPanelProps={{
 diagnosisDimensionRows,
 diagnosisWeakestDimension,
 diagnosisStrongestDimension,
 diagnosisAverageRate,
 subjectivePracticeLink: buildSubjectivePracticeLink({ status: "all", difficulty: "easy", count: 6, source: "my_learning" }),
 onOpenPendingWrongbook: () => {
 openWorkspaceShell("wrongbook");
 setWrongbookMainView("workspace");
 setWrongbookWorkspaceTab("list");
 setWrongStatusFilter("pending");
 setWrongPage(1);
 void loadWrongbookDashboard({ ...currentWrongFilters(), status: "pending", page: 1 });
 },
 }}
 latestExamDiagnosisCardProps={{
 latestExamDiagLoading,
 latestExamDiagError,
 latestExamDiag,
 examDimensionLabelMap,
 onRefresh: () => {
 void loadLatestExamDiagnostics();
 },
 onOpenWrongbookByExam: openWrongbookByExam,
 buildSubjectivePracticeLink,
 }}
 diagnosisAdvancedPanelProps={{
 showDiagnosisAdvanced,
 onToggleAdvanced: () => setShowDiagnosisAdvanced((prev) => !prev),
 examSummaryKeyword,
 setExamSummaryKeyword,
 examSummaryDays,
 onChangeExamSummaryDays: (nextDays) => {
 setExamSummaryDays(nextDays);
 void loadExamSummaryLogs({ page: 1, days: nextDays });
 },
 examSummaryPage,
 examSummaryTotalPages,
 examSummaryTotal,
 examSummaryLogs,
 examSummaryLogsLoading,
 examSummaryLogsError,
 examSummaryDeleteId,
 onRefreshExamSummaryLogs: (page = examSummaryPage) => {
 void loadExamSummaryLogs({ page });
 },
 onSearchExamSummaryLogs: () => {
 void loadExamSummaryLogs({ keyword: examSummaryKeyword, page: 1 });
 },
 onClearExamSummaryLogs: () => {
 setExamSummaryKeyword("");
 void loadExamSummaryLogs({ keyword: "", page: 1 });
 },
 onDeleteExamSummaryLog: (id) => {
 void deleteExamSummaryLog(id);
 },
 buildExamSummaryPracticeLink,
 weakDimensions: profile.weak_dimensions,
 sourceWeakRows,
 buildPracticeBySourceLink,
 graphCompareKeyword,
 setGraphCompareKeyword,
 graphCompareDays,
 onChangeGraphCompareDays: (nextDays) => {
 setGraphCompareDays(nextDays);
 void loadGraphCompareLogs({ page: 1, days: nextDays });
 },
 graphComparePage,
 graphCompareTotalPages,
 graphCompareTotal,
 graphCompareLogs,
 graphCompareLogsLoading,
 graphCompareLogsError,
 graphCompareDeleteId,
 onRefreshGraphCompareLogs: (page = graphComparePage) => {
 void loadGraphCompareLogs({ page });
 },
 onSearchGraphCompareLogs: () => {
 void loadGraphCompareLogs({ keyword: graphCompareKeyword, page: 1 });
 },
 onClearGraphCompareLogs: () => {
 setGraphCompareKeyword("");
 void loadGraphCompareLogs({ keyword: "", page: 1 });
 },
 onDeleteGraphCompareLog: (id) => {
 void deleteGraphCompareLog(id);
 },
 buildGraphCompareLinkFromTopic,
 dynastyWeakRows,
 themeWeakRows,
 buildSubjectivePracticeLink,
 }}
 />
</Suspense>
 ) : null}

 {activeTab === "plan" ? (
<Suspense fallback={<MyLearningLazyFallback label="AI 澶嶄範璁″垝" />}>
<ReviewPlanPanel
 examDate={examDate}
 setExamDate={setExamDate}
 generatePlan={generatePlan}
 isGenerating={isGenerating}
 planError={planError}
 plan={plan}
 planEvidence={planEvidence}
 planProgress={planProgress}
 planTaskStats={planTaskStats}
 planShowOnlyPending={planShowOnlyPending}
 setPlanShowOnlyPending={setPlanShowOnlyPending}
 planReminderEnabled={planReminderEnabled}
 reminderSupported={reminderSupported}
 planReminderPermission={planReminderPermission}
 planReminderMessage={planReminderMessage}
 togglePlanReminder={togglePlanReminder}
 sendPlanReminderTest={sendPlanReminderTest}
 planPriorityFilter={planPriorityFilter}
 setPlanPriorityFilter={setPlanPriorityFilter}
 reviewPriorityLabelMap={reviewPriorityLabelMap}
 reviewPriorityClassMap={reviewPriorityClassMap}
 completedTaskKeys={completedTaskKeys}
 planSaving={planSaving}
 togglePlanTask={togglePlanTask}
 movePlanTask={movePlanTask}
 reorderPlanTask={reorderPlanTask}
 movePlanTaskAcrossDays={movePlanTaskAcrossDays}
 buildPlanTaskPracticeLink={buildPlanTaskPracticeLink}
 buildSubjectivePracticeLink={buildSubjectivePracticeLink}
 extractWrongSummaryTitle={extractWrongSummaryTitle}
 extractExamSummaryTopic={extractExamSummaryTopic}
 />
</Suspense>
 ) : null}
 </PageStage>
 </div>
 );
}

