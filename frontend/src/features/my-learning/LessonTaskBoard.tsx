import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";
import type { LessonTaskCreatePayload, LessonTaskRecord, LessonTaskStatus, LessonTaskType } from "@/types";

const lessonTaskTypeLabelMap: Record<LessonTaskType, string> = {
  learn: "精讲",
  practice: "练习",
  memory: "记忆",
  review: "复盘",
  custom: "自定义",
};

const lessonTaskStatusLabelMap: Record<LessonTaskStatus, string> = {
  assigned: "待开始",
  in_progress: "进行中",
  completed: "已完成",
};

const lessonTaskStatusClassMap: Record<LessonTaskStatus, string> = {
  assigned: "lesson-task-status-assigned",
  in_progress: "lesson-task-status-progress",
  completed: "lesson-task-status-completed",
};

type LessonTaskBoardMode = "teacher" | "student";

interface LessonTaskBoardProps {
  mode: LessonTaskBoardMode;
  lessonTasks: LessonTaskRecord[];
  lessonTasksLoading: boolean;
  lessonTaskError: string | null;
  lessonTaskMessage: string;
  lessonTaskUpdatingId: string | null;
  onStatusChange: (taskId: string, status: LessonTaskStatus) => void;
  lessonTaskSaving?: boolean;
  lessonTaskDraft?: LessonTaskCreatePayload;
  setLessonTaskDraft?: Dispatch<SetStateAction<LessonTaskCreatePayload>>;
  onCreate?: () => void;
  entryLimit?: number;
}

function normalizeStatus(value: string): LessonTaskStatus {
  if (value === "in_progress" || value === "completed") {
    return value;
  }
  return "assigned";
}

function normalizeTaskType(value: string): LessonTaskType {
  if (value === "learn" || value === "practice" || value === "memory" || value === "review") {
    return value;
  }
  return "custom";
}

export function LessonTaskBoard({
  mode,
  lessonTasks,
  lessonTasksLoading,
  lessonTaskError,
  lessonTaskMessage,
  lessonTaskUpdatingId,
  onStatusChange,
  lessonTaskSaving = false,
  lessonTaskDraft,
  setLessonTaskDraft,
  onCreate,
  entryLimit = 4,
}: LessonTaskBoardProps): JSX.Element {
  if (mode === "teacher") {
    const draft = lessonTaskDraft;
    const setDraft = setLessonTaskDraft;
    if (!draft || !setDraft || !onCreate) {
      return <></>;
    }

    const lessonTaskStats = {
      total: lessonTasks.length,
      completed: lessonTasks.filter((item) => item.status === "completed").length,
      inProgress: lessonTasks.filter((item) => item.status === "in_progress").length,
    };

    return (
      <SectionCard
        className="lesson-task-board-shell"
        title="课堂任务分发"
        subtitle="打通 lesson_tasks 指定用户分发闭环：创建、读取、更新状态全部走真实接口。"
      >
        <div className="lesson-task-board-grid">
          <article className="lesson-task-card lesson-task-card-create">
            <div className="lesson-task-card-head">
              <div>
                <p className="lesson-task-kicker">LESSON TASK</p>
                <h3 className="lesson-task-title">布置今日任务</h3>
              </div>
              <span className="lesson-task-head-chip">指定用户分发</span>
            </div>

            <div className="lesson-task-form">
              <label className="lesson-task-field">
                <span className="lesson-task-label">任务标题</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  className="lesson-task-input"
                  placeholder="例如：今日课堂巩固"
                />
              </label>

              <label className="lesson-task-field">
                <span className="lesson-task-label">任务说明</span>
                <textarea
                  value={draft.detail || ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, detail: event.target.value }))}
                  rows={4}
                  className="lesson-task-textarea"
                  placeholder="给学生/自己看的具体执行说明"
                />
              </label>

              <label className="lesson-task-field">
                <span className="lesson-task-label">目标用户 ID（可选）</span>
                <input
                  value={draft.targetUserId || ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, targetUserId: event.target.value }))}
                  className="lesson-task-input"
                  placeholder="留空则默认分发给自己"
                />
              </label>

              <div className="lesson-task-form-grid">
                <label className="lesson-task-field">
                  <span className="lesson-task-label">类型</span>
                  <select
                    value={draft.taskType || "custom"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, taskType: event.target.value as LessonTaskType }))}
                    className="lesson-task-select"
                  >
                    {Object.entries(lessonTaskTypeLabelMap).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="lesson-task-field">
                  <span className="lesson-task-label">截止日期</span>
                  <input
                    type="date"
                    value={draft.dueDate || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
                    className="lesson-task-input"
                  />
                </label>

                <label className="lesson-task-field">
                  <span className="lesson-task-label">跳转入口</span>
                  <select
                    value={draft.to || "/practice?entry=practice&auto=1&source=lesson_task"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
                    className="lesson-task-select"
                  >
                    <option value="/practice?entry=practice&auto=1&source=lesson_task">练测评估</option>
                    <option value="/learn">诗词精讲</option>
                    <option value="/memory">记忆训练</option>
                    <option value="/my-learning?tab=wrongbook">错题本</option>
                    <option value="/my-learning?tab=plan">复习计划</option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={onCreate}
                disabled={lessonTaskSaving}
                className="btn-primary-compact lesson-task-submit disabled:cursor-not-allowed disabled:opacity-60"
              >
                {lessonTaskSaving ? "正在写入..." : "创建课堂任务"}
              </button>
            </div>
          </article>

          <article className="lesson-task-card lesson-task-card-stream">
            <div className="lesson-task-card-head">
              <div>
                <p className="lesson-task-kicker lesson-task-kicker-muted">TASK STREAM</p>
                <h3 className="lesson-task-title">任务状态流</h3>
              </div>
              <div className="lesson-task-stat-list">
                <span className="lesson-task-stat-chip">总数 {lessonTaskStats.total}</span>
                <span className="lesson-task-stat-chip lesson-task-stat-chip-progress">进行 {lessonTaskStats.inProgress}</span>
                <span className="lesson-task-stat-chip lesson-task-stat-chip-completed">完成 {lessonTaskStats.completed}</span>
              </div>
            </div>

            {lessonTaskError ? <p className="lesson-task-alert lesson-task-alert-error">{lessonTaskError}</p> : null}
            {lessonTaskMessage ? <p className="lesson-task-alert lesson-task-alert-success">{lessonTaskMessage}</p> : null}

            <div className="lesson-task-stream-list">
              {lessonTasksLoading ? (
                <p className="lesson-task-empty">正在读取课堂任务...</p>
              ) : lessonTasks.length === 0 ? (
                <p className="lesson-task-empty">暂无课堂任务。创建后会写入 `lesson_tasks`，并进入首页今日任务数据流。</p>
              ) : (
                lessonTasks.map((task) => {
                  const status = normalizeStatus(task.status);
                  const taskType = normalizeTaskType(task.taskType);
                  return (
                    <article key={task.id} className="lesson-task-item">
                      <div className="lesson-task-item-head">
                        <div>
                          <div className="lesson-task-meta-row">
                            <span className={`lesson-task-status-chip ${lessonTaskStatusClassMap[status]}`}>
                              {lessonTaskStatusLabelMap[status]}
                            </span>
                            <span className="lesson-task-meta-chip">{lessonTaskTypeLabelMap[taskType]}</span>
                            {task.dueDate ? <span className="lesson-task-meta-chip">截止 {task.dueDate}</span> : null}
                          </div>

                          <h4 className="lesson-task-item-title">{task.title || "课堂任务"}</h4>
                          <p className="lesson-task-item-detail">{task.detail || "暂无说明。"}</p>
                          {task.targetUserId && task.targetUserId !== task.teacherId ? (
                            <p className="lesson-task-item-target">目标用户：{task.targetUserId}</p>
                          ) : null}
                        </div>

                        <select
                          value={status}
                          onChange={(event) => onStatusChange(task.id, event.target.value as LessonTaskStatus)}
                          disabled={lessonTaskUpdatingId === task.id}
                          className="lesson-task-status-select disabled:opacity-60"
                        >
                          <option value="assigned">待开始</option>
                          <option value="in_progress">进行中</option>
                          <option value="completed">已完成</option>
                        </select>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </article>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      className="lesson-task-student-shell surface-card card-roomy"
      weight="workspace"
      title="我的课堂任务"
      subtitle="来自 lesson_tasks 的真实任务流，学生侧可直接进入并回写完成状态。"
      bodyClassName="flow-sm"
    >
      {lessonTaskError ? <p className="lesson-task-alert lesson-task-alert-error">{lessonTaskError}</p> : null}
      {lessonTaskMessage ? <p className="lesson-task-alert lesson-task-alert-success">{lessonTaskMessage}</p> : null}
      {lessonTasksLoading ? (
        <p className="lesson-task-empty">正在读取课堂任务...</p>
      ) : lessonTasks.length === 0 ? (
        <p className="lesson-task-empty">暂无课堂任务。教师发布后，会同步进入首页今日任务和这里的任务流。</p>
      ) : (
        <div className="lesson-task-student-grid">
          {lessonTasks.slice(0, entryLimit).map((task) => {
            const status = normalizeStatus(task.status);
            const taskType = normalizeTaskType(task.taskType);
            return (
              <article key={task.id} className="lesson-task-item lesson-task-student-item">
                <div className="lesson-task-meta-row">
                  <span className={`lesson-task-status-chip ${lessonTaskStatusClassMap[status]}`}>
                    {lessonTaskStatusLabelMap[status]}
                  </span>
                  <span className="lesson-task-meta-chip">{lessonTaskTypeLabelMap[taskType]}</span>
                  {task.dueDate ? <span className="lesson-task-meta-chip">截止 {task.dueDate}</span> : null}
                </div>
                <h4 className="lesson-task-item-title">{task.title || "课堂任务"}</h4>
                <p className="lesson-task-item-detail">{task.detail || "暂无说明。"}</p>
                <div className="lesson-task-action-row">
                  <Link to={task.to || "/my-learning?tab=overview"} className="btn-primary-compact lesson-task-action">
                    进入任务
                  </Link>
                  {status !== "completed" ? (
                    <button
                      type="button"
                      onClick={() => onStatusChange(task.id, "completed")}
                      disabled={lessonTaskUpdatingId === task.id}
                      className="btn-secondary-compact lesson-task-action disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {lessonTaskUpdatingId === task.id ? "同步中..." : "标记完成"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
