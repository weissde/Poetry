import { useEffect, useMemo, useRef, useState } from "react";
import {
 apiDelete,
 apiGet,
 apiPatch,
 apiPost,
 createLessonTask,
 getClasses,
 getClassStudents,
 getClassSummary,
 getClassTasks,
 getClassWrongbookDistribution,
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
import ContextBanner from "@/components/ContextBanner";
import { SectionCard } from "@/components/common/SectionCard";
import { AnimatedMetricValue } from "@/components/common/AnimatedMetricValue";
import { LearningReportExport } from "@/components/teaching/LearningReportExport";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { LearningOverview, type LearningTab } from "@/components/my-learning/LearningOverview";
import { WrongbookPanel } from "@/components/my-learning/WrongbookPanel";
import { WrongbookWorkspaceSummaryCard } from "@/components/my-learning/WrongbookWorkspaceSummaryCard";
import { WrongbookListWorkspace } from "@/components/my-learning/WrongbookListWorkspace";
import { WrongbookInsightWorkspace } from "@/components/my-learning/WrongbookInsightWorkspace";
import { WrongbookTrendWorkspace } from "@/components/my-learning/WrongbookTrendWorkspace";
import { Magnet, PillNav } from "@/components/react-bits";
import {
 wrongbookWorkspaceDescriptionMap,
 wrongbookWorkspaceLabelMap,
 type WrongbookWorkspaceTab,
} from "@/components/my-learning/wrongbookWorkspaceMeta";
import type { WrongStatus, WrongTrendDisplayRow } from "@/components/my-learning/wrongbookTypes";
import { DiagnosisWorkspace } from "@/components/my-learning/DiagnosisWorkspace";
import { ReviewPlanPanel } from "@/components/my-learning/ReviewPlanPanel";
import { FavoritesPanel } from "@/components/my-learning/FavoritesPanel";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { escapeHtml, escapeMarkdown, downloadTextFile, openStudyReportPrintWindow } from "@/lib/export-helpers";
import { usePlanReminder } from "@/hooks/usePlanReminder";
import { StateCalloutCard } from "@/components/common/StateCalloutCard";
import { useSearchParams } from "react-router-dom";
import type {
 ClassRecord,
 ClassStudentRecord,
 ClassSummaryPayload,
 ClassWrongbookDistributionPayload,
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
import { LessonTaskBoard } from "@/features/my-learning/LessonTaskBoard";

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

type ExamWeakDimension = "questionType" | "dynasty" | "theme";

const statusMap: Record<WrongStatus, string> = {
 pending: "待复习",
 mastered: "已掌握",
 retry: "需再练",
};

const questionTypeLabelMap: Record<string, string> = {
 memorization: "默写",
 meaning: "词义",
 technique: "手法",
 emotion: "情感",
 appreciation: "赏析",
 comparison: "比较阅读",
 context: "语境默写",
 subjective: "主观题",
 exam: "考试",
};

const questionKindLabelMap: Record<string, string> = {
 subjective: "主观题",
 objective: "客观题",
};

const examDimensionLabelMap: Record<ExamWeakDimension, string> = {
 questionType: "题型",
 dynasty: "朝代",
 theme: "题材",
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
 title: "学情诊断目标",
 summary: "通过弱点分析、错题复盘和复习计划，实现针对性提升。",
 goals: [
 "查看本周薄弱题型分布",
 "处理错题本中的高频错题",
 "执行个性化复习计划",
 ],
 teacherHint: "教师可在此查看班级共性弱点，并据此调整下一课教学内容。",
};

const myLearningTeacherHint = {
 title: "班级数据接入提示",
 detail: "当前页面已接入个人学情真实数据；班级名单、班级任务完成率与班级错题分布需要后端聚合接口后再展示。",
};


const validActiveTabs = new Set<ActiveTab>(["overview", "wrongbook", "favorites", "plan", "diagnosis"]);
const validClassroomBoardTabs = new Set<ClassroomBoardTab>(["overview", "homework", "distribution", "export"]);

function isValidActiveTab(value: string | null): value is ActiveTab {
 return Boolean(value && validActiveTabs.has(value as ActiveTab));
}

function isValidClassroomBoardTab(value: string | null): value is ClassroomBoardTab {
 return Boolean(value && validClassroomBoardTabs.has(value as ClassroomBoardTab));
}

function normalizeWrongPeriod(value: string | null): WrongTimeRange {
 return value === "7" || value === "30" || value === "all" ? value : "30";
}

function normalizeWrongStatus(value: string | null): WrongFilterStatus {
 return value === "pending" || value === "mastered" || value === "retry" || value === "all" ? value : "all";
}

function toLessonTaskErrorMessage(error: unknown, fallback: string): string {
 return error instanceof Error && error.message ? error.message : fallback;
}

function parseLearningReportSections(text: string): {
 summaryTitle?: string;
 summaryText?: string;
 teacherAdviceTitle?: string;
 teacherAdviceText?: string;
} | null {
 const sections = String(text || "")
  .split(/\n{2,}|(?=^#{1,3}\s)/m)
  .map((section) => section.trim().replace(/^#{1,3}\s*/, ""))
  .filter(Boolean);
 if (sections.length === 0) {
  return null;
 }
 return {
  summaryTitle: sections[0]?.split("\n")[0] || undefined,
  summaryText: sections[0] || undefined,
  teacherAdviceTitle: sections[1]?.split("\n")[0] || undefined,
  teacherAdviceText: sections[1] || sections.slice(1).join("\n\n") || undefined,
 };
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
 title: "今日课堂巩固",
 detail: "完成一组 5 题练习，并回到错题本复盘错因。",
 taskType: "practice",
 status: "assigned",
 targetUserId: "",
 to: "/practice?entry=practice&auto=1&source=lesson_task",
 dueDate: "",
 });
 const [classroomClasses, setClassroomClasses] = useState<ClassRecord[]>([]);
 const [classroomSummaries, setClassroomSummaries] = useState<Record<string, ClassSummaryPayload>>({});
 const [classroomStudents, setClassroomStudents] = useState<ClassStudentRecord[]>([]);
 const [selectedClassId, setSelectedClassId] = useState<string>("");
 const [classroomLoading, setClassroomLoading] = useState<boolean>(false);
 const [classroomError, setClassroomError] = useState<string | null>(null);
 const [classWrongDistribution, setClassWrongDistribution] = useState<ClassWrongbookDistributionPayload | null>(null);
 const [classWrongDistributionLoading, setClassWrongDistributionLoading] = useState<boolean>(false);
 const [classWrongDistributionError, setClassWrongDistributionError] = useState<string | null>(null);
 const [examDate, setExamDate] = useState<string>("");

 const { profile, refresh: refreshWeakness } = useWeakness();
 const [searchParams, setSearchParams] = useSearchParams();
 const routeFilterKeyRef = useRef<string>("");
 const skipUrlSyncRef = useRef<boolean>(false);
 const aiLearningReportAbortRef = useRef<AbortController | null>(null);

 const loadClassroomData = async (): Promise<void> => {
 setClassroomLoading(true);
 setClassroomError(null);
 try {
 const classPayload = await getClasses(true);
 const classes = classPayload.items || [];
 setClassroomClasses(classes);
 const nextSelectedId = selectedClassId || classes[0]?.id || "";
 setSelectedClassId(nextSelectedId);
 const summaryPairs = await Promise.all(
 classes.map(async (item) => {
 try {
 return [item.id, await getClassSummary(item.id, true)] as const;
 } catch {
 return [item.id, null] as const;
 }
 }),
 );
 setClassroomSummaries(
 summaryPairs.reduce<Record<string, ClassSummaryPayload>>((acc, [id, summary]) => {
 if (summary) {
 acc[id] = summary;
 }
 return acc;
 }, {}),
 );
 if (nextSelectedId) {
 const studentPayload = await getClassStudents(nextSelectedId, true);
 setClassroomStudents(studentPayload.items || []);
 } else {
 setClassroomStudents([]);
 }
 } catch (error: unknown) {
 setClassroomError(error instanceof Error ? error.message : "读取班级数据失败");
 } finally {
 setClassroomLoading(false);
 }
 };

 useEffect(() => {
 if (!isTeacherMode) {
 setTeacherScope("individual");
 setClassroomBoardTab("overview");
 }
 }, [isTeacherMode]);

 useEffect(() => {
 if (isTeacherMode && teacherScope === "classroom") {
 void loadLessonTasks();
 void loadClassroomData();
 }
 }, [isTeacherMode, teacherScope]);

 useEffect(() => {
 if (isTeacherMode && teacherScope === "classroom" && selectedClassId) {
 void loadLessonTasks(true);
 }
 }, [isTeacherMode, selectedClassId, teacherScope]);

 useEffect(() => {
 if (!(isTeacherMode && teacherScope === "classroom" && selectedClassId)) {
 setClassWrongDistribution(null);
 return;
 }
 let active = true;
 setClassWrongDistributionLoading(true);
 setClassWrongDistributionError(null);
 void getClassWrongbookDistribution(selectedClassId, true)
 .then((payload) => {
 if (active) {
 setClassWrongDistribution(payload);
 }
 })
 .catch((error: unknown) => {
 if (active) {
 setClassWrongDistributionError(error instanceof Error ? error.message : "读取班级错题分布失败");
 }
 })
 .finally(() => {
 if (active) {
 setClassWrongDistributionLoading(false);
 }
 });
 return () => {
 active = false;
 };
 }, [isTeacherMode, selectedClassId, teacherScope]);

 useEffect(() => {
 if (!(isTeacherMode && teacherScope === "classroom" && selectedClassId)) {
 return;
 }
 let active = true;
 void getClassStudents(selectedClassId, true)
 .then((payload) => {
 if (active) {
 setClassroomStudents(payload.items || []);
 }
 })
 .catch(() => {
 if (active) {
 setClassroomStudents([]);
 }
 });
 return () => {
 active = false;
 };
 }, [isTeacherMode, selectedClassId, teacherScope]);

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

 const loadLatestPlan = async (): Promise<void> => {
 setPlanError(null);
 try {
 const data = await apiGet<ReviewPlanEnvelope>("/review-plan/latest");
 setPlanId(data.planId);
 setPlan(data.plan);
 setPlanProgress(data.progress);
 setPlanEvidence(data.planEvidence ?? null);
 if (data.examDate) {
 setExamDate(data.examDate);
 }
 } catch (error: unknown) {
 setPlanError(error instanceof Error ? error.message : "读取复习计划失败");
 }
 };

 const loadLearningSummary = async (force = false): Promise<void> => {
 setLearningSummaryLoading(true);
 setLearningSummaryError(null);
 try {
 const data = await getUserLearningSummary(force);
 setLearningSummary(data);
 } catch (error: unknown) {
 setLearningSummaryError(error instanceof Error ? error.message : "读取学情总览失败");
 } finally {
 setLearningSummaryLoading(false);
 }
 };

 const loadLessonTasks = async (force = false): Promise<void> => {
 setLessonTasksLoading(true);
 setLessonTaskError(null);
 try {
 const data =
 isTeacherMode && teacherScope === "classroom" && selectedClassId
 ? await getClassTasks(selectedClassId, force)
 : await getLessonTasks(force);
 setLessonTasks(Array.isArray(data.items) ? data.items : []);
 } catch (error: unknown) {
 setLessonTaskError(toLessonTaskErrorMessage(error, "读取课堂任务失败"));
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
 title: "今日课堂巩固",
 detail: "完成一组 5 题练习，并回到错题本复盘错因。",
 status: "assigned",
 targetUserId: "",
 }));
 await loadLessonTasks(true);
 await loadLearningSummary(true);
 } catch (error: unknown) {
 setLessonTaskError(toLessonTaskErrorMessage(error, "创建课堂任务失败"));
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
 setAiLearningReportError(error instanceof Error ? error.message : "生成 AI 学情解读失败");
 } finally {
 if (aiLearningReportAbortRef.current === controller) {
 aiLearningReportAbortRef.current = null;
 }
 setAiLearningReportLoading(false);
 }
 };

 useEffect(() => {
 void loadLatestPlan();
 void loadWrongbookOverviewCounts();
 void loadLearningSummary();
 }, []);

 useEffect(() => {
 if (activeTab !== "overview") {
 return;
 }
 if (!learningSummary && !learningSummaryLoading) {
 void loadLearningSummary();
 }
 if (!aiLearningReportText && !aiLearningReportLoading) {
 void loadAiLearningReport();
 }
 }, [activeTab, aiLearningReportLoading, aiLearningReportText, learningSummary, learningSummaryLoading]);

 useEffect(() => {
 return () => {
 aiLearningReportAbortRef.current?.abort();
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
 setPlanError(error instanceof Error ? error.message : "调整任务顺序失败");
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
 setPlanError(error instanceof Error ? error.message : "拖拽排序失败");
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
 setPlanError(error instanceof Error ? error.message : "跨天拖拽失败");
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
 { key: "memorization", label: "默写", rate: metricRate(profile, "memorization"), group: "基础理解" },
 { key: "meaning", label: "词义", rate: metricRate(profile, "meaning"), group: "基础理解" },
 { key: "technique", label: "手法", rate: metricRate(profile, "technique"), group: "鉴赏表达" },
 { key: "emotion", label: "情感", rate: metricRate(profile, "emotion"), group: "鉴赏表达" },
 { key: "appreciation", label: "赏析", rate: metricRate(profile, "appreciation"), group: "鉴赏表达" },
 { key: "imagery", label: "意象", rate: imageryRate, group: "鉴赏表达" },
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
 const {
  reminderSupported,
  planReminderEnabled,
  planReminderPermission,
  planReminderMessage,
  togglePlanReminder,
  sendPlanReminderTest,
 } = usePlanReminder(plan, planTaskStats.pending);
 const overviewWrongTotal = wrongOverviewCounts?.total ?? wrongTotal;
 const overviewWrongPending =
 wrongOverviewCounts?.pending ?? (wrongStatusFilter === "pending" ? wrongTotal : wrongStatusStats.pending);
 const todayAction = useMemo(() => {
 if (overviewWrongPending > 0) {
 return {
 key: "wrongbook" as const,
 title: "今天先清理待复习错题",
 description: `你当前还有 ${overviewWrongPending} 道待复习错题，先完成一轮回顾最稳妥。`,
 cta: "去错题本处理",
 };
 }

 if (planTaskStats.pending > 0) {
 return {
 key: "plan" as const,
 title: "今天先推进复习计划",
 description: `当前复习计划剩余 ${planTaskStats.pending} 项任务，建议优先完成高优先任务。`,
 cta: "去计划面板执行",
 };
 }

 if (diagnosisWeakestDimension) {
 return {
 key: "diagnosis" as const,
 title: "今天先补齐薄弱维度",
 description: `目前最薄弱的是「${diagnosisWeakestDimension.label}」（正确率 ${diagnosisWeakestDimension.rate}%），建议先做专项巩固。`,
 cta: "查看薄弱诊断",
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
       eyebrow: "入口承接 · 来自练测",
       title: "练测已完成，下一步把错因收口",
       description: "建议先看错题本筛选本轮错题，再生成复习计划；若需要稳定记忆，可进入记忆训练把薄弱诗句加入队列。",
       tone: "warm" as const,
       actions: [
         { label: "去错题本", to: "/my-learning?tab=wrongbook&from=practice", variant: "primary" as const },
         { label: "看复习计划", to: "/my-learning?tab=plan&from=practice" },
         { label: "去记忆训练", to: "/memory?from=my_learning" },
       ],
     };
   }

   if (entryFrom === "memory") {
     return {
       eyebrow: "入口承接 · 来自记忆",
       title: "记忆打卡完成，下一步做迁移验证",
       description: "建议做一组练测确认“记住”已经能转成答题表达；同时回到计划面板把薄弱点排进复习节奏。",
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
       eyebrow: "入口承接 · 来自创作",
       title: "作品已产出，下一步把成果纳入复盘",
       description: "建议回到学情总览收拢本周练测/错题/记忆状态，再根据薄弱点安排下一轮巩固。",
       tone: "success" as const,
       actions: [
         { label: "看学情总览", to: "/my-learning?tab=overview&from=create", variant: "primary" as const },
         { label: "看复习计划", to: "/my-learning?tab=plan&from=create" },
         { label: "去图谱延展", to: "/graph?from=my_learning" },
       ],
     };
   }

   if (entryFrom === "graph") {
     return {
       eyebrow: "入口承接 · 来自图谱",
       title: "图谱发现已形成，下一步把薄弱点转成动作",
       description: "建议选择一个薄弱节点，进入对应题组练测；若错因已明确，回错题本/计划面板做收束。",
       tone: "warm" as const,
       actions: [
         { label: "去练测", to: "/practice?entry=practice&auto=1&source=graph", variant: "primary" as const },
         { label: "去错题本", to: "/my-learning?tab=wrongbook&from=graph" },
         { label: "看复习计划", to: "/my-learning?tab=plan&from=graph" },
       ],
     };
   }

   return {
     eyebrow: "入口承接",
     title: "欢迎回到学情中心",
     description: "先在总览里确认本周薄弱点，再进入错题本/计划面板安排下一步。",
     tone: "neutral" as const,
     actions: [
       { label: "看学情总览", to: "/my-learning?tab=overview", variant: "primary" as const },
       { label: "看错题本", to: "/my-learning?tab=wrongbook" },
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
	 ? `当前强项是${diagnosisStrongestDimension.label}，薄弱点集中在${diagnosisWeakestDimension.label}。`
	 : "近 30 天总体掌握率正在形成稳定基线。",
	 },
	 {
	 label: "知识点覆盖",
	 value: "4 类",
	 detail: "按题型、朝代、题材和记忆巩固四个维度整理当前覆盖面。",
	 },
	 {
	 label: "薄弱环节",
	 value: diagnosisWeakestDimension ? diagnosisWeakestDimension.label : "暂无",
	 detail: `待复习 ${overviewWrongPending} 题 · 计划待完成 ${planTaskStats.pending} 项。`,
	 },
	 ],
	 [diagnosisAverageRate, diagnosisStrongestDimension, diagnosisWeakestDimension, learningSummary?.metrics, overviewWrongPending, planTaskStats.pending],
	 );
	 const classroomReadinessCards = useMemo(
	 () => [
	 {
	 label: "个人学情基线",
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
	 value: diagnosisWeakestDimension?.label || "暂无",
	 detail: diagnosisWeakestDimension
	 ? `个人维度正确率 ${diagnosisWeakestDimension.rate}%，后续可映射到班级错题分布。`
	 : "等待更多练测数据后生成真实薄弱维度。",
	 },
	 ],
	 [diagnosisAverageRate, diagnosisWeakestDimension, learningSummary?.overview?.accuracy30d, learningSummaryLoading, overviewWrongPending, planTaskStats.pending],
	 );
	 const selectedClass = useMemo(
	 () => classroomClasses.find((item) => item.id === selectedClassId) || null,
	 [classroomClasses, selectedClassId],
	 );
	 const selectedClassSummary = selectedClassId ? classroomSummaries[selectedClassId] : null;
	 const classroomTotals = useMemo(
	 () =>
	 classroomClasses.reduce(
	 (acc, item) => {
	 const summary = classroomSummaries[item.id];
	 acc.students += summary?.studentCount || 0;
	 acc.tasks += summary?.taskCount || 0;
	 if (summary) {
	 acc.completionTotal += summary.taskCompletionRate;
	 acc.summaryCount += 1;
	 }
	 return acc;
	 },
	 { students: 0, tasks: 0, completionTotal: 0, summaryCount: 0 },
	 ),
	 [classroomClasses, classroomSummaries],
	 );
  const classroomSummaryCards = useMemo(
	 () => [
	 {
	 label: "班级数量",
	 value: classroomLoading ? "同步中" : String(classroomClasses.length),
	 detail: "来自 /api/classes，展示当前教师拥有的真实班级。",
	 },
	 {
	 label: "学生总数",
	 value: classroomLoading ? "同步中" : String(classroomTotals.students),
	 detail: "来自 class_members 聚合，学生加入班级后自动计入。",
	 },
	 {
	 label: "班级作业",
	 value: classroomLoading ? "同步中" : String(classroomTotals.tasks),
	 detail: "来自 lesson_tasks，整班发布后会计入这里。",
	 },
	 {
	 label: "平均完成率",
	 value: classroomLoading || classroomTotals.summaryCount === 0 ? "0%" : `${Math.round(classroomTotals.completionTotal / classroomTotals.summaryCount)}%`,
	 detail: "来自班级 summary 聚合，不再使用个人数据冒充班级均值。",
	 },
	 ],
	 [classroomClasses.length, classroomLoading, classroomTotals],
	 );
	 const classWrongDistributionSections = useMemo(
	 () => [
	 { title: "题型错因", rows: classWrongDistribution?.byType || [] },
	 { title: "朝代分布", rows: classWrongDistribution?.byDynasty || [] },
	 { title: "题材分布", rows: classWrongDistribution?.byTheme || [] },
	 { title: "意象标签", rows: classWrongDistribution?.byKeywordTag || [] },
	 ],
	 [classWrongDistribution],
	 );
	 const learningCoverageItems = useMemo<LearningCoverageItem[]>(
	 () =>
	 learningSummary?.coverage?.length
	 ? learningSummary.coverage
	 : [
	 {
	 label: "题型表现",
	 mastery: diagnosisAverageRate,
	 description: "依据题型表现估算当前整体稳定度。",
	 },
	 {
	 label: "朝代理解",
	 mastery: Math.max(0, diagnosisAverageRate - 4),
	 description: "结合朝代维度表现判断比较阅读基础。",
	 },
	 {
	 label: "题材理解",
	 mastery: Math.max(0, diagnosisAverageRate - 8),
	 description: "关注送别、思乡、山水等主题迁移情况。",
	 },
	 {
	 label: "记忆巩固",
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
	 const strongest = diagnosisStrongestDimension ? `${diagnosisStrongestDimension.label}${diagnosisStrongestDimension.rate}%` : "暂无明显强项";
	 return `当前整体掌握率约 ${diagnosisAverageRate}%，强项为 ${strongest}，当前最需要补齐的是 ${weakest}。`;
	 }, [diagnosisAverageRate, diagnosisStrongestDimension, diagnosisWeakestDimension, learningSummary?.narrative]);
	 const parsedAiLearningReport = useMemo(() => parseLearningReportSections(aiLearningReportText), [aiLearningReportText]);
	 const learningReportSections = useMemo(() => {
	 const reportSeed = learningSummary?.reportSeed;
	 return [
	 {
	 title: parsedAiLearningReport?.summaryTitle || reportSeed?.summaryTitle || "AI 学情解读",
	 detail:
	 parsedAiLearningReport?.summaryText ||
	 reportSeed?.summaryText ||
	 "正在根据近期练测、错题与复习数据生成学情解读。",
	 },
	 {
	 title: parsedAiLearningReport?.teacherAdviceTitle || reportSeed?.teacherAdviceTitle || "教师 / 家长建议",
	 detail:
	 parsedAiLearningReport?.teacherAdviceText ||
	 reportSeed?.teacherAdviceText ||
	 "建议先围绕当前薄弱点安排一轮专项练测，再回错题与记忆训练做收束。",
	 },
	 ];
	 }, [learningSummary?.reportSeed, parsedAiLearningReport]);
	 const reportTitle = "诗境通阶段学情报告";
	 const buildStudyReportMarkdown = (generatedAt: string): string => {
	 const metricRows = overviewMetricCards
	 .map((item) => `| ${escapeMarkdown(item.label)} | ${escapeMarkdown(item.value)} | ${escapeMarkdown(item.detail)} |`)
	 .join("\n");
	 const trendText = learningTrendPoints.map((item) => `${item.label} ${item.value}%`).join(" · ");
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
	 "## 核心指标",
	 "",
	 "| 指标 | 当前值 | 说明 |",
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
	 `<li><strong>${escapeHtml(item.label)}：</strong>${escapeHtml(String(item.mastery))}% · ${escapeHtml(item.description)}</li>`,
	 )
	 .join("");
	 const adviceListHtml = learningReportSections
	 .map((item) => `<li><strong>${escapeHtml(item.title)}：</strong>${escapeHtml(item.detail)}</li>`)
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
	   <h2 class="section-title">近 30 天趋势</h2>
	   <p class="section-copy">${escapeHtml(learningTrendPoints.map((item) => `${item.label} ${item.value}%`).join(" · "))}</p>
	 </section>
	 <section class="section">
	   <h2 class="section-title">知识点覆盖热力图</h2>
	   <div class="tag-list">
	     ${learningCoverageItems.map((item) => `<span class="tag">${escapeHtml(item.label)} ${escapeHtml(String(item.mastery))}%</span>`).join("")}
	   </div>
	   <div class="list-card">
	     <ul>${coverageListHtml}</ul>
	   </div>
	 </section>
	 <section class="section">
	   <h2 class="section-title">AI 学情解读与教学建议</h2>
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
	 const downloaded = downloadTextFile(`诗境通_学情报告_${timestamp}.md`, markdown);
	 setStudyReportMessage(downloaded ? "已导出 Markdown 学情报告。" : "当前环境不支持下载 Markdown 学情报告。");
	 };
	 

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
 overview: "学情总览",
 wrongbook: "我的错题本",
 favorites: "我的收藏",
 diagnosis: "薄弱诊断",
 plan: "AI 复习计划",
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
 { id: "operations" as const, label: "筛选与批量" },
 ],
 [],
 );
 const teacherScopeNavItems = useMemo(
 () => [
 { id: "individual" as const, label: "个人视图" },
 { id: "classroom" as const, label: "班级视图" },
 ],
 [],
 );
 const classroomBoardNavItems = useMemo(
 () => [
 { id: "overview" as const, label: "班级总览" },
 { id: "homework" as const, label: "作业完成" },
 { id: "distribution" as const, label: "错题分布" },
 { id: "export" as const, label: "报告导出" },
 ],
 [],
 );
 const wrongbookWorkspaceNavItems = useMemo(
 () => [
 { id: "list" as const, label: "错题列表" },
 { id: "insight" as const, label: "统计弱点" },
 { id: "trend" as const, label: "趋势复盘" },
 ],
 [],
 );

 if (isTeacherMode && teacherScope === "classroom") {
 return (
 <div className="page-shell">
 <PageStage tone="primary">
        <ContextBanner />
	 <PageHeader
	 variant="standard"
	 kicker="我的学情"
	 title="教师班级视图"
	 subtitle="在个人学情页的基础上叠加班级概览、作业完成、错题分布与报告导出。"
	 />
	 <LearnJourneyProgress className="mt-4" />
	 <TeachingObjectiveCard
	 variant="panel"
	 kicker="教师目标提示"
	 title={myLearningTeachingObjective.title}
	 summary={myLearningTeachingObjective.summary}
	 goals={myLearningTeachingObjective.goals}
	 chipLabel="当前阶段 · 学情诊断（班级）"
	 hint={myLearningTeachingObjective.teacherHint}
	 className="mt-4 shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
	 />
 </PageStage>

 <SectionCard
 className="surface-card card-dense"
 weight="workspace"
 title="视图切换"
 subtitle="教师模式下可在个人学情与班级视图之间切换。"
 actions={<PillNav items={teacherScopeNavItems} value={teacherScope} onChange={setTeacherScope} className="bg-stone-100" />}
 >
 <p className="text-xs leading-6 text-slate-500">当前为班级视图，适合课堂投屏展示整体进度、共性弱点与下一步安排。</p>
 </SectionCard>

 <PageStage id="my-learning-workspace" tone="detail" className="flow-md">
 {teacherHint ? <TeacherHintCallout title={teacherHint.title} detail={teacherHint.detail} /> : null}

 <SectionCard
 className="surface-card card-dense"
 weight="workspace"
 title="班级工作台"
 subtitle="班级聚合接口接入前，仅展示真实个人学情基线与接入状态。"
 actions={<PillNav items={classroomBoardNavItems} value={classroomBoardTab} onChange={setClassroomBoardTab} className="bg-stone-100" />}
 >
 <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
 {classroomSummaryCards.map((item) => (
 <article key={item.label} className="rounded-[1.1rem] px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.05)] shadow-[inset_0_0_0_1px_rgba(214,223,231,0.92)]" style={{ background: 'var(--bg-surface)' }}>
 <p className="text-xs tracking-[0.08em] text-slate-500">{item.label}</p>
 <p className="mt-2 font-serif text-3xl text-[#1A2B4C]">{item.value}</p>
 <p className="mt-2 text-xs leading-6 text-slate-500">{item.detail}</p>
 </article>
 ))}
 </div>
 </SectionCard>

 {classroomBoardTab === "overview" ? (
 <SectionCard title="班级总览" subtitle="来自真实班级、学生名单和作业完成率接口。">
 {classroomError ? (
 <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{classroomError}</p>
 ) : null}
 <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
 <div className="space-y-2">
 {classroomClasses.length === 0 ? (
 <p className="rounded-2xl bg-stone-50 px-4 py-4 text-sm text-slate-500">暂无班级。先到教师工作台创建班级并邀请学生加入。</p>
 ) : null}
 {classroomClasses.map((item) => {
 const summary = classroomSummaries[item.id];
 const active = selectedClassId === item.id;
 return (
 <button
 key={item.id}
 type="button"
 onClick={() => setSelectedClassId(item.id)}
 className={[
 "w-full rounded-2xl px-4 py-4 text-left transition shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]",
 active ? "bg-[#1A2B4C] text-white" : "bg-white text-[#1A2B4C] hover:bg-stone-50",
 ].join(" ")}
 >
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-sm font-semibold">{item.name}</p>
 <p className={["mt-1 text-xs", active ? "text-white/70" : "text-slate-500"].join(" ")}>邀请码 {item.inviteCode || "--"}</p>
 </div>
 <span className={["rounded-full px-2 py-1 text-xs", active ? "bg-white/14 text-white" : "bg-stone-100 text-slate-600"].join(" ")}>
 {summary?.studentCount ?? 0} 人
 </span>
 </div>
 </button>
 );
 })}
 </div>
 <div className="rounded-[24px] bg-[linear-gradient(135deg,#fffaf0_0%,#f4ead8_100%)] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(201,169,110,0.24)]">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <p className="text-xs tracking-[0.14em] text-slate-500">当前班级</p>
 <p className="mt-2 font-serif text-2xl text-[#1A2B4C]">{selectedClass?.name || "未选择班级"}</p>
 <p className="mt-2 text-sm text-slate-600">邀请码：{selectedClass?.inviteCode || "--"}</p>
 </div>
 <button type="button" onClick={() => void loadClassroomData()} className="btn-secondary-compact">刷新</button>
 </div>
 <div className="mt-5 grid gap-3 md:grid-cols-3">
 <article className="rounded-2xl bg-white/80 px-4 py-4 text-center">
 <p className="font-serif text-3xl text-[#1A2B4C]">{selectedClassSummary?.studentCount ?? classroomStudents.length}</p>
 <p className="mt-1 text-xs text-slate-500">学生</p>
 </article>
 <article className="rounded-2xl bg-white/80 px-4 py-4 text-center">
 <p className="font-serif text-3xl text-[#1A2B4C]">{selectedClassSummary?.taskCount ?? 0}</p>
 <p className="mt-1 text-xs text-slate-500">作业</p>
 </article>
 <article className="rounded-2xl bg-white/80 px-4 py-4 text-center">
 <p className="font-serif text-3xl text-[#1A2B4C]">{selectedClassSummary?.taskCompletionRate ?? 0}%</p>
 <p className="mt-1 text-xs text-slate-500">完成率</p>
 </article>
 </div>
 <div className="mt-5">
 <p className="text-xs tracking-[0.14em] text-slate-500">学生名单</p>
 <div className="mt-2 grid gap-2 md:grid-cols-2">
 {classroomStudents.length === 0 ? <p className="text-sm text-slate-500">暂无学生加入。</p> : null}
 {classroomStudents.slice(0, 8).map((student) => (
 <article key={student.id || student.userId || student.user_id} className="rounded-xl bg-white/80 px-3 py-3">
 <p className="text-sm text-[#1A2B4C]">{student.userId || student.user_id || "学生"}</p>
 <p className="mt-1 text-xs text-slate-500">{student.role || "student"}</p>
 </article>
 ))}
 </div>
 </div>
 </div>
 </div>
 </SectionCard>
 ) : null}

 {false && classroomBoardTab === "overview" ? (
 <SectionCard title="班级总览" subtitle="等待班级 roster / class summary 聚合接口，不用静态学生名单占位。">
 <div className="rounded-[24px] bg-[linear-gradient(135deg,#fffaf0_0%,#f4ead8_100%)] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(201,169,110,0.24)]">
 <p className="font-serif text-2xl text-[#1A2B4C]">班级总览待接入真实数据</p>
 <p className="mt-3 text-sm leading-7" style={{ color: 'var(--neutral)' }}>
 当前已保留班级视图入口，但不再展示伪造学生、在线人数或进步排名。下一步需要后端提供班级名单、学生完成率、共性弱点和权限边界后再打开真实班级面板。
 </p>
 <div className="mt-4 grid gap-3 md:grid-cols-3">
 {["GET /api/classes/:id/summary", "GET /api/classes/:id/students", "GET /api/classes/:id/wrongbook/trend"].map((item) => (
 <span key={item} className="rounded-full px-3 py-2 text-xs shadow-[inset_0_0_0_1px_rgba(201,169,110,0.22)]" style={{ color: '#5A4B37', background: 'var(--bg-surface)', opacity: 0.72 }}>{item}</span>
 ))}
 </div>
 </div>
 </SectionCard>
 ) : null}

 {classroomBoardTab === "homework" ? (
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
 ) : null}

 {classroomBoardTab === "distribution" ? (
 <SectionCard title="错题分布" subtitle="来自选中班级学生错题本的真实聚合。">
 {classWrongDistributionError ? <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{classWrongDistributionError}</p> : null}
 <div className="mb-4 grid gap-3 md:grid-cols-3">
 <article className="rounded-2xl bg-stone-50 px-4 py-4 text-center">
 <p className="font-serif text-3xl text-[#1A2B4C]">{classWrongDistributionLoading ? "--" : classWrongDistribution?.totalWrong ?? 0}</p>
 <p className="mt-1 text-xs text-slate-500">错题总数</p>
 </article>
 <article className="rounded-2xl bg-stone-50 px-4 py-4 text-center">
 <p className="font-serif text-3xl text-[#1A2B4C]">{classWrongDistributionLoading ? "--" : classWrongDistribution?.studentCount ?? 0}</p>
 <p className="mt-1 text-xs text-slate-500">学生样本</p>
 </article>
 <article className="rounded-2xl bg-stone-50 px-4 py-4 text-center">
 <p className="font-serif text-3xl text-[#1A2B4C]">{selectedClass?.name || "--"}</p>
 <p className="mt-1 text-xs text-slate-500">当前班级</p>
 </article>
 </div>
 <div className="grid gap-4 xl:grid-cols-2">
 {classWrongDistributionSections.map((section) => {
 const maxCount = Math.max(1, ...section.rows.map((row) => row.count));
 return (
 <article key={section.title} className="rounded-[22px] px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.06)]" style={{ background: 'var(--bg-surface)' }}>
 <p className="text-sm font-semibold text-[#1A2B4C]">{section.title}</p>
 <div className="mt-3 space-y-3">
 {section.rows.length === 0 ? <p className="text-sm text-slate-500">暂无数据</p> : null}
 {section.rows.slice(0, 6).map((row) => (
 <div key={`${section.title}-${row.value}`}>
 <div className="flex items-center justify-between gap-3 text-sm">
 <span className="text-[#1A2B4C]">{row.value}</span>
 <span className="text-slate-500">{row.count}</span>
 </div>
 <div className="mt-2 h-2 rounded-full bg-stone-200">
 <span className="block h-full rounded-full bg-[linear-gradient(90deg,#C9A96E_0%,#1A2B4C_100%)]" style={{ width: `${Math.max(6, Math.round((row.count / maxCount) * 100))}%` }} />
 </div>
 </div>
 ))}
 </div>
 </article>
 );
 })}
 </div>
 </SectionCard>
 ) : null}

 {false && classroomBoardTab === "distribution" ? (
 <SectionCard title="错题分布" subtitle="当前展示个人覆盖基线，不冒充班级共性错因。">
 <div className="space-y-3">
 {learningCoverageItems.map((row) => (
 <article key={row.label} className="rounded-[22px] px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.06)]" style={{ background: 'var(--bg-surface)' }}>
 <div className="flex items-center justify-between gap-3 text-sm">
 <span className="text-[#1A2B4C]">{row.label}</span>
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
 <SectionCard title="学情报告导出" subtitle="班级报告接口接入前，仅导出当前真实个人学情报告。">
 <div className="space-y-4">
 <div className="rounded-[22px] bg-[linear-gradient(135deg,#FFF9EE_0%,#F3E7CE_100%)] px-4 py-4 text-sm leading-7 text-[#5A4B37] shadow-[0_10px_22px_rgba(34,58,94,0.05)]">
 当前导出内容来自个人 `learning-summary`、错题与复习计划。班级报告需要 `class summary` 聚合接口后再开放，避免把个人样本误标为班级结论。
 </div>
 <LearningReportExport onExportPdf={handleExportStudyReportPdf} onExportMarkdown={handleExportStudyReportMarkdown} />
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
	 kicker="我的学情"
	 title="从“我的学习”转为学情中心"
	 subtitle="保留错题本、诊断、计划、收藏等原有工作区逻辑，并补齐学情总览、AI 解读与报告导出。"
	 actions={
	 <Magnet className="inline-flex">
	 <button type="button" onClick={scrollToStudyReportExport} className="btn-secondary-compact whitespace-nowrap">
	 导出学习报告
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
	 kicker="教师目标提示"
	 title={myLearningTeachingObjective.title}
	 summary={myLearningTeachingObjective.summary}
	 goals={myLearningTeachingObjective.goals}
	 chipLabel="当前阶段 · 学情诊断"
	 hint={myLearningTeachingObjective.teacherHint}
	 className="mt-4 shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
	 />
	 ) : null}
 </PageStage>
 {isTeacherMode ? (
 <SectionCard
 className="surface-card card-dense"
 weight="workspace"
 title="视图切换"
 subtitle="教师模式下可在个人学情与班级视图之间切换。"
 actions={<PillNav items={teacherScopeNavItems} value={teacherScope} onChange={setTeacherScope} className="bg-stone-100" />}
 >
 <p className="text-xs leading-6 text-slate-500">当前为个人视图，适合先讲趋势与弱点，再切到班级视图展示共性问题和导出报告。</p>
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
 weakFocus={diagnosisWeakestDimension ? `${diagnosisWeakestDimension.label} ${diagnosisWeakestDimension.rate}%` : "暂无明显薄弱点"}
 todayTaskTitle={todayAction.title}
 todayTaskDescription={todayAction.description}
 titleText="我的学情"
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
 返回工作区入口
 </button>
 }
 >
 <p className="text-xs leading-6 text-slate-500">
 待复习 {overviewWrongPending} 题 · 收藏 {favoriteTotal} 首 · 计划待完成 {planTaskStats.pending} 项。
 当前工作区：{activeTabLabelMap[activeTab]}。
 </p>
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
	 title="学情总览"
	 subtitle="聚合展示掌握率趋势、知识点覆盖与下一步学习建议。"
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
	 className="mt-2 font-serif text-3xl text-[#1A2B4C]"
	 durationMs={980 + index * 140}
	 />
	 <p className="mt-2 text-xs leading-6 text-slate-500">{item.detail}</p>
	 </article>
	 ))}
	 </div>

	 <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
	 <article className="rounded-[1.2rem] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
	 <p className="learn-goal-kicker">掌握率趋势（近30天）</p>
	 <svg viewBox="0 0 320 132" className="mt-4 w-full">
	 <path d="M0 118 H320" stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
	 <polyline
	 fill="none"
	 stroke="#C9A96E"
	 strokeWidth="4"
	 strokeLinecap="round"
	 strokeLinejoin="round"
	 points={trendPolyline}
	 />
	 {trendChartPoints.map((point) => (
	 <g key={point.label}>
	 <circle cx={point.x} cy={point.y} r="5.5" fill="#1A2B4C" />
	 <text x={point.x} y={Math.max(16, point.y - 12)} textAnchor="middle" fontSize="11" fill="#5f7389">
	 {point.value}%
	 </text>
	 <text x={point.x} y="128" textAnchor="middle" fontSize="11" fill="#6b7280">
	 {point.label}
	 </text>
	 </g>
	 ))}
	 </svg>
	 <p className="mt-2 text-sm leading-7 text-slate-600">{overviewNarrative}</p>
	 </article>

	 <article className="rounded-[1.2rem] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
	 <p className="learn-goal-kicker">知识点覆盖热力图</p>
	 <div className="mt-4 space-y-3">
	 {learningCoverageItems.map((item) => (
	 <div key={item.label} className="rounded-2xl bg-white px-3 py-3 shadow-[0_4px_14px_rgba(34,58,94,0.04)]">
	 <div className="flex items-center justify-between gap-3">
	 <span className="font-medium text-[#1A2B4C]">{item.label}</span>
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

	 <div id="my-learning-report-export" className="scroll-mt-28">
	 <SectionCard
	 className="surface-card card-roomy"
	 weight="summary"
	 title="AI 学情解读"
	 subtitle="用自然语言概括当前学习状态，并给出面向教师 / 家长的建议。"
	 bodyClassName="flow-lg"
	 actions={
	 <Magnet className="inline-flex">
	 <LearningReportExport onExportPdf={handleExportStudyReportPdf} onExportMarkdown={handleExportStudyReportMarkdown} />
	 </Magnet>
	 }
	 >
	 {learningSummaryError ? (
	 <div className="rounded-[1rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
	 学情总览接口暂不可用，当前已回退到页面内推断结果。原因：{learningSummaryError}
	 </div>
	 ) : null}
	 {aiLearningReportError ? (
	 <div className="rounded-[1rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
	 AI 学情解读暂不可用，当前展示后端聚合的建议文本。原因：{aiLearningReportError}
	 </div>
	 ) : null}
	 <article className="rounded-[1.2rem] bg-[linear-gradient(135deg,#FFF9EE_0%,#F3E7CE_100%)] px-4 py-4 shadow-[0_10px_22px_rgba(34,58,94,0.05)]">
	 <p className="learn-goal-kicker">{learningReportSections[0]?.title || "AI 学情解读"}</p>
	 <p className="mt-2 text-sm leading-7 text-[#5A4B37]">
	 {aiLearningReportLoading ? "正在流式生成学情解读..." : learningReportSections[0]?.detail}
	 </p>
	 {aiLearningReportSource ? <p className="mt-2 text-xs text-[#8A6B32]">来源：{aiLearningReportSource}</p> : null}
	 </article>
	 <article className="rounded-[1.2rem] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
	 <p className="learn-goal-kicker">{learningReportSections[1]?.title || "教师 / 家长建议"}</p>
	 <ul className="mt-3 space-y-2 pl-5 text-sm leading-7 text-slate-600">
	 <li>{learningReportSections[1]?.detail}</li>
	 <li>建议先围绕 {diagnosisWeakestDimension?.label || "当前薄弱点"} 做一轮课堂追问，再进入练测评估。</li>
	 <li>可结合《静夜思》与相关月意象作品做一次对比阅读，帮助巩固情感辨析。</li>
	 </ul>
	 </article>
	 </SectionCard>
	 </div>
	 </div>
  {!isTeacherMode ? (
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
  ) : null}
	 </section>
	 ) : null}

	 {activeTab === "wrongbook" ? (
	 <section className="flow-md">
 <SectionCard
 className="surface-card card-dense"
 weight="workspace"
 title="错题本工作区"
 subtitle="在列表、统计、趋势与筛选批量之间切换。"
 bodyClassName="flow-sm"
 >
 <div className="flex flex-wrap items-center justify-between gap-2">
 <p className="text-xs" style={{ color: 'var(--neutral)' }}>
 当前模式：{wrongbookWorkspaceSummary.label} · 待复习 {overviewWrongPending} 题 · 趋势净变化 {wrongTrendSummary.net >= 0 ? "+" : ""}
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
 先看待复习
 </button>
 <button type="button" className="text-xs text-slate-500 transition hover:text-ink-700" onClick={openDiagnosisTab}>
 薄弱诊断
 </button>
 <button type="button" className="text-xs text-slate-500 transition hover:text-ink-700" onClick={openPlanTab}>
 复习计划
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
 <p className="text-xs leading-6 text-slate-500">先完成筛选与批量处理，再回到错题处理区继续复盘。</p>
 )}
 </SectionCard>

 {wrongError ? (
 <div className="rounded-xl shadow-[inset_0_0_0_1px_rgba(220,38,38,0.24)] bg-red-50 p-4 text-sm text-red-700">{wrongError}</div>
 ) : null}

 {wrongbookMainView === "operations" ? (
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
 ) : (
 <>
 <WrongbookWorkspaceSummaryCard activeTab={wrongbookWorkspaceTab} activeDescription={wrongbookWorkspaceSummary.description} />

 {wrongbookWorkspaceTab === "insight" ? (
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
 ) : null}

 {wrongbookWorkspaceTab === "trend" ? (
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
 ) : null}

 {wrongbookWorkspaceTab === "list" ? (
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
 ) : null}
 </>
 )}
 </section>
 ) : null}
 {activeTab === "favorites" ? (
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
 ) : null}

 {activeTab === "diagnosis" ? (
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
 ) : null}

 {activeTab === "plan" ? (
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
 ) : null}
 </PageStage>
 </div>
 );
}


