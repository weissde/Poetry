import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";
import type { ReviewPlan, ReviewPlanProgress } from "@/types";

type PlanPriorityFilter = "all" | "high" | "medium" | "low";

interface PlanEvidencePayload {
  examSummaryCount?: number;
  examSummarySamples?: string[];
  keywordFocusTop?: string[];
  wrongSummaryTop?: string[];
}

interface ReviewPlanPanelProps {
  examDate: string;
  setExamDate: (value: string) => void;
  generatePlan: () => void | Promise<void>;
  isGenerating: boolean;
  planError: string | null;
  plan: ReviewPlan | null;
  planEvidence: PlanEvidencePayload | null | undefined;
  planProgress: ReviewPlanProgress | null;
  planTaskStats: {
    total: number;
    pending: number;
    high: number;
    medium: number;
    low: number;
  };
  planShowOnlyPending: boolean;
  setPlanShowOnlyPending: (value: boolean) => void;
  planReminderEnabled: boolean;
  reminderSupported: boolean;
  planReminderPermission: NotificationPermission;
  planReminderMessage: string;
  togglePlanReminder: () => void | Promise<void>;
  sendPlanReminderTest: () => void | Promise<void>;
  planPriorityFilter: PlanPriorityFilter;
  setPlanPriorityFilter: (value: PlanPriorityFilter) => void;
  reviewPriorityLabelMap: Record<string, string>;
  reviewPriorityClassMap: Record<string, string>;
  completedTaskKeys: Set<string>;
  planSaving: boolean;
  togglePlanTask: (dayIndex: number, taskIndex: number, done: boolean) => void | Promise<void>;
  movePlanTask: (dayIndex: number, taskIndex: number, direction: "up" | "down") => void | Promise<void>;
  reorderPlanTask: (dayIndex: number, fromIndex: number, toIndex: number) => void | Promise<void>;
  movePlanTaskAcrossDays: (fromDayIndex: number, fromIndex: number, toDayIndex: number, toIndex: number) => void | Promise<void>;
  buildPlanTaskPracticeLink: (options: { focus?: string; task?: string; priority?: string }) => string;
  buildSubjectivePracticeLink: (options?: {
    status?: "all" | "pending" | "mastered" | "retry";
    dynasty?: string;
    theme?: string;
    keywordTag?: string;
    difficulty?: "easy" | "medium" | "hard";
    count?: number;
    source?: string;
  }) => string;
  extractWrongSummaryTitle: (sample: string) => string;
  extractExamSummaryTopic: (sample: string) => string;
}

function taskKeyOf(day: string, task: string): string {
  return `${day}::${task}`;
}

export function ReviewPlanPanel({
  examDate,
  setExamDate,
  generatePlan,
  isGenerating,
  planError,
  plan,
  planEvidence,
  planProgress,
  planTaskStats,
  planShowOnlyPending,
  setPlanShowOnlyPending,
  planReminderEnabled,
  reminderSupported,
  planReminderPermission,
  planReminderMessage,
  togglePlanReminder,
  sendPlanReminderTest,
  planPriorityFilter,
  setPlanPriorityFilter,
  reviewPriorityLabelMap,
  reviewPriorityClassMap,
  completedTaskKeys,
  planSaving,
  togglePlanTask,
  movePlanTask,
  reorderPlanTask,
  movePlanTaskAcrossDays,
  buildPlanTaskPracticeLink,
  buildSubjectivePracticeLink,
  extractWrongSummaryTitle,
  extractExamSummaryTopic,
}: ReviewPlanPanelProps): JSX.Element {
  const [draggingTask, setDraggingTask] = useState<{ dayIndex: number; taskIndex: number } | null>(null);
  const [dragOverTask, setDragOverTask] = useState<{ dayIndex: number; taskIndex: number | null } | null>(null);

  return (
    <section className="page-shell">
      <SectionCard title="AI 专属复习计划" subtitle="基于错题分布自动生成多日复习任务。" className="surface-card" bodyClassName="flow-md">
        <label className="mt-4 block">
          <span className="mb-1 block text-sm text-slate-700">目标考试日期（可选）</span>
          <input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} className="input-main w-full max-w-[260px]" />
        </label>

        <button
          type="button"
          onClick={() => {
            void generatePlan();
          }}
          disabled={isGenerating}
          className="btn-primary mt-4 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? "生成中..." : "一键生成复习计划"}
        </button>

        {planError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.24)]">{planError}</p> : null}
      </SectionCard>

      {plan ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <article className="surface-card xl:order-2">
            <h3 className="block-title">计划概览</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{plan.overview}</p>

            {planEvidence ? (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
                <p className="text-sm text-slate-700">计划依据</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  <li>最近考试小结：{Number(planEvidence.examSummaryCount || 0)} 条</li>
                  <li>
                    关键词重点：
                    {Array.isArray(planEvidence.keywordFocusTop) && planEvidence.keywordFocusTop.length > 0 ? (
                      <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                        {planEvidence.keywordFocusTop.map((keyword) => (
                          <Link
                            key={`plan-evidence-keyword-${keyword}`}
                            to={buildSubjectivePracticeLink({ keywordTag: keyword, difficulty: "easy", count: 8, status: "all", source: "my_learning" })}
                            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-700 transition hover:bg-ink-50 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.24)]"
                          >
                            {keyword}
                          </Link>
                        ))}
                      </span>
                    ) : (
                      " 无"
                    )}
                  </li>
                  <li>
                    错题概况：
                    {Array.isArray(planEvidence.wrongSummaryTop) && planEvidence.wrongSummaryTop.length > 0 ? (
                      <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                        {planEvidence.wrongSummaryTop.map((sample, index) => {
                          const title = extractWrongSummaryTitle(sample);
                          const params = new URLSearchParams();
                          params.set("tab", "wrongbook");
                          params.set("status", "pending");
                          if (title) params.set("keyword", title);
                          return (
                            <Link
                              key={`plan-evidence-wrong-sample-${index}`}
                              to={`/my-learning?${params.toString()}`}
                              className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700 transition hover:bg-slate-50 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)]"
                              title={sample}
                            >
                              {title || sample}
                            </Link>
                          );
                        })}
                      </span>
                    ) : (
                      " 无"
                    )}
                  </li>
                  <li>
                    最近考试样本：
                    {Array.isArray(planEvidence.examSummarySamples) && planEvidence.examSummarySamples.length > 0 ? (
                      <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                        {planEvidence.examSummarySamples.map((sample, index) => {
                          const topic = extractExamSummaryTopic(sample);
                          const params = new URLSearchParams();
                          params.set("tab", "diagnosis");
                          if (topic) params.set("examSummaryKeyword", topic);
                          params.set("examSummaryDays", "all");
                          return (
                            <Link
                              key={`plan-evidence-exam-sample-${index}`}
                              to={`/my-learning?${params.toString()}`}
                              className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700 transition hover:bg-slate-50 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)]"
                              title={sample}
                            >
                              {topic || `样本${index + 1}`}
                            </Link>
                          );
                        })}
                      </span>
                    ) : (
                      " 无"
                    )}
                  </li>
                </ul>
              </div>
            ) : null}

            {Array.isArray(plan.phaseGoals) && plan.phaseGoals.length > 0 ? (
              <div className="mt-4 rounded-lg bg-indigo-50 p-3 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.22)]">
                <p className="text-sm text-indigo-700">阶段目标</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-indigo-800">
                  {plan.phaseGoals.slice(0, 6).map((goal) => (
                    <li key={`phase-goal-${goal}`}>{goal}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            {planProgress ? (
              <div className="mt-4 rounded-lg bg-ink-50 p-3">
                <p className="text-sm text-ink-700">
                  进度：{planProgress.completed}/{planProgress.total}（{Math.round(planProgress.rate * 100)}%）
                </p>
              </div>
            ) : null}

            <div className="mt-4 rounded-lg bg-warm-50 p-3 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.20)]">
              <p className="text-sm text-amber-800">提醒设置</p>
              <p className="mt-1 text-xs text-slate-600">浏览器权限：{planReminderPermission}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => void togglePlanReminder()} className="btn-secondary-compact">
                  {planReminderEnabled ? "关闭提醒" : "开启提醒"}
                </button>
                <button type="button" onClick={() => void sendPlanReminderTest()} disabled={!reminderSupported} className="btn-secondary-compact disabled:opacity-50">
                  发送测试提醒
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">{planReminderMessage}</p>
            </div>
          </article>

          <article className="surface-card xl:order-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="block-title">任务清单</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-50 px-2 py-1 text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">总任务 {planTaskStats.total}</span>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.26)]">未完成 {planTaskStats.pending}</span>
                <span className="rounded-full bg-red-50 px-2 py-1 text-red-700 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.24)]">高优先 {planTaskStats.high}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={planShowOnlyPending} onChange={(event) => setPlanShowOnlyPending(event.target.checked)} className="h-4 w-4 rounded" />
                仅看未完成
              </label>
              {(["all", "high", "medium", "low"] as PlanPriorityFilter[]).map((value) => {
                const active = planPriorityFilter === value;
                return (
                  <button
                    key={`plan-priority-filter-${value}`}
                    type="button"
                    onClick={() => setPlanPriorityFilter(value)}
                    className={[
                      "rounded px-2 py-1 text-xs transition",
                      active ? "bg-ink-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]",
                    ].join(" ")}
                  >
                    {value === "all" ? "全部优先级" : reviewPriorityLabelMap[value] || value}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flow-md">
              {plan.dailyTasks.map((dayItem, dayIndex) => {
                const visibleTasks = dayItem.tasks
                  .map((task, taskIndex) => {
                    const priority = dayItem.taskPriorities?.[taskIndex] || "medium";
                    const key = taskKeyOf(dayItem.day, task);
                    const done = completedTaskKeys.has(key);
                    if (planShowOnlyPending && done) return null;
                    if (planPriorityFilter !== "all" && priority !== planPriorityFilter) return null;
                    return { task, taskIndex, priority, key, done };
                  })
                  .filter(Boolean) as Array<{ task: string; taskIndex: number; priority: string; key: string; done: boolean }>;

                if (visibleTasks.length === 0) return null;

                return (
                  <article key={`${dayItem.day}-${dayItem.focus}`} className="surface-card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-500">{dayItem.day}</p>
                        <h4 className="font-serif text-xl text-ink-700">{dayItem.focus}</h4>
                        {dayItem.stageGoal ? <p className="text-xs text-slate-500">{dayItem.stageGoal}</p> : null}
                      </div>
                      <Link
                        to={buildPlanTaskPracticeLink({ focus: dayItem.focus, priority: "medium" })}
                        className="rounded bg-ink-50 px-2 py-1 text-xs text-ink-700 transition hover:bg-ink-100 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.24)]"
                      >
                        进入本日练习
                      </Link>
                    </div>

                    <ul className="mt-3 flow-sm">
                      {visibleTasks.map(({ task, taskIndex, priority, key, done }) => {
                        const priorityLabel = reviewPriorityLabelMap[priority] || priority;
                        const priorityClass = reviewPriorityClassMap[priority] || "bg-slate-50 text-slate-600";
                        const isDragSource = draggingTask?.dayIndex === dayIndex && draggingTask?.taskIndex === taskIndex;
                        const isDragTarget = dragOverTask?.dayIndex === dayIndex && dragOverTask?.taskIndex === taskIndex;

                        return (
                          <li
                            key={key}
                            draggable
                            onDragStart={() => setDraggingTask({ dayIndex, taskIndex })}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setDragOverTask({ dayIndex, taskIndex });
                            }}
                            onDrop={() => {
                              if (!draggingTask) return;
                              if (draggingTask.dayIndex === dayIndex) {
                                void reorderPlanTask(dayIndex, draggingTask.taskIndex, taskIndex);
                              } else {
                                void movePlanTaskAcrossDays(draggingTask.dayIndex, draggingTask.taskIndex, dayIndex, taskIndex);
                              }
                              setDraggingTask(null);
                              setDragOverTask(null);
                            }}
                            onDragEnd={() => {
                              setDraggingTask(null);
                              setDragOverTask(null);
                            }}
                            className={[
                              "rounded-lg bg-white p-2 transition",
                              isDragSource ? "opacity-50" : "",
                              isDragTarget ? "bg-ink-50" : "",
                              "shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <label className="flex items-start gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={done}
                                  onChange={(event) => {
                                    void togglePlanTask(dayIndex, taskIndex, event.target.checked);
                                  }}
                                  disabled={planSaving}
                                  className="mt-0.5 h-4 w-4 rounded"
                                />
                                <span className={done ? "text-slate-400 line-through" : ""}>{task}</span>
                              </label>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] ${priorityClass}`}>{priorityLabel}</span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Link
                                to={buildPlanTaskPracticeLink({ focus: dayItem.focus, task, priority })}
                                className="rounded bg-white px-1.5 py-0.5 text-[11px] text-ink-700 transition hover:bg-ink-50 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.24)]"
                              >
                                去练习
                              </Link>
                              <button
                                type="button"
                                onClick={() => void movePlanTask(dayIndex, taskIndex, "up")}
                                disabled={taskIndex === 0 || planSaving}
                                className="rounded px-1.5 py-0.5 text-[11px] text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)]"
                              >
                                上移
                              </button>
                              <button
                                type="button"
                                onClick={() => void movePlanTask(dayIndex, taskIndex, "down")}
                                disabled={taskIndex >= dayItem.tasks.length - 1 || planSaving}
                                className="rounded px-1.5 py-0.5 text-[11px] text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)]"
                              >
                                下移
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
            </div>
          </article>
        </div>
      ) : (
        <div className="surface-card card-roomy text-center text-slate-500">
          还没有生成复习计划，点击上方按钮即可开始。
        </div>
      )}
    </section>
  );
}
