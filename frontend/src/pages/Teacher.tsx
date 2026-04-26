import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock, GraduationCap, LayoutTemplate, Play, Send, UserPlus, Users } from "lucide-react";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import ContextBanner from "@/components/ContextBanner";
import { SkeletonCard, SkeletonText } from "@/components/common/Skeleton";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { useDemoMode } from "@/hooks/useDemoMode";
import { createClass, createClassTask, getClasses, getClassStudents, getClassSummary, getLatestTeachingSession, getTeachingUnits } from "@/lib/api";
import type { ClassRecord, ClassStudentRecord, ClassSummaryPayload, LatestTeachingSessionPayload, TeachingUnitItem } from "@/types";

export default function TeacherPage() {
  const { isTeacherMode, currentStep, currentPoemId, currentSessionId } = useTeachingMode();
  const { isDemoMode, toggleDemoMode } = useDemoMode();

  const [unitsLoading, setUnitsLoading] = useState(false);
  const [units, setUnits] = useState<TeachingUnitItem[]>([]);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  const [sessionLoading, setSessionLoading] = useState(false);
  const [latestSession, setLatestSession] = useState<LatestTeachingSessionPayload | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [classSummaries, setClassSummaries] = useState<Record<string, ClassSummaryPayload>>({});
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState<ClassStudentRecord[]>([]);
  const [classMessage, setClassMessage] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({ name: "", description: "" });
  const [taskForm, setTaskForm] = useState({
    title: "本周诗词专项练习",
    detail: "完成一轮 8 题专项练习，并回到错题本复盘。",
    taskType: "practice",
    to: "/practice?entry=practice&count=8&difficulty=medium&auto=1&source=class",
    dueDate: "",
  });

  const loadUnits = useCallback(async () => {
    setUnitsLoading(true);
    setUnitsError(null);
    try {
      const data = await getTeachingUnits(true);
      setUnits(data.items || []);
    } catch (err: unknown) {
      setUnitsError(err instanceof Error ? err.message : "读取教学单元失败");
    } finally {
      setUnitsLoading(false);
    }
  }, []);

  const loadSession = useCallback(async () => {
    setSessionLoading(true);
    setSessionError(null);
    try {
      const data = await getLatestTeachingSession(true);
      setLatestSession(data);
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : "读取最近课堂失败");
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const loadClasses = useCallback(async () => {
    setClassesLoading(true);
    setClassMessage(null);
    try {
      const data = await getClasses(true);
      const items = data.items || [];
      setClasses(items);
      setSelectedClassId((current) => current || items[0]?.id || "");
      const summaryEntries = await Promise.all(
        items.map(async (item) => {
          try {
            return [item.id, await getClassSummary(item.id, true)] as const;
          } catch {
            return [item.id, null] as const;
          }
        }),
      );
      setClassSummaries(
        summaryEntries.reduce<Record<string, ClassSummaryPayload>>((acc, [id, summary]) => {
          if (summary) {
            acc[id] = summary;
          }
          return acc;
        }, {}),
      );
    } catch (err: unknown) {
      setClassMessage(err instanceof Error ? err.message : "读取班级失败");
    } finally {
      setClassesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnits();
    void loadSession();
    void loadClasses();
  }, [loadUnits, loadSession, loadClasses]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    let active = true;
    void getClassStudents(selectedClassId, true)
      .then((data) => {
        if (active) setStudents(data.items || []);
      })
      .catch(() => {
        if (active) setStudents([]);
      });
    return () => {
      active = false;
    };
  }, [selectedClassId]);

  const activeUnits = useMemo(() => units.filter((u) => u.isActive), [units]);
  const totalPoemCount = useMemo(() => activeUnits.reduce((sum, u) => sum + u.poemIds.length, 0), [activeUnits]);
  const selectedClass = useMemo(() => classes.find((item) => item.id === selectedClassId) || null, [classes, selectedClassId]);
  const selectedSummary = selectedClassId ? classSummaries[selectedClassId] : null;

  const stepLabels = ["总览", "精讲", "解析", "探究", "记忆", "考点"];

  const handleCreateClass = async (): Promise<void> => {
    const name = classForm.name.trim();
    if (!name) {
      setClassMessage("请先填写班级名称");
      return;
    }
    setClassMessage(null);
    try {
      const result = await createClass({ name, description: classForm.description.trim() || null });
      setClassForm({ name: "", description: "" });
      setSelectedClassId(result.item.id);
      setClassMessage(`已创建班级「${result.item.name}」`);
      await loadClasses();
    } catch (err: unknown) {
      setClassMessage(err instanceof Error ? err.message : "创建班级失败");
    }
  };

  const handlePublishClassTask = async (): Promise<void> => {
    if (!selectedClassId) {
      setClassMessage("请先选择班级");
      return;
    }
    const title = taskForm.title.trim();
    if (!title) {
      setClassMessage("请先填写作业标题");
      return;
    }
    setClassMessage(null);
    try {
      const result = await createClassTask(selectedClassId, {
        title,
        detail: taskForm.detail.trim(),
        taskType: taskForm.taskType as "practice" | "memory" | "review" | "custom",
        to: taskForm.to.trim() || null,
        dueDate: taskForm.dueDate || null,
      });
      setClassMessage(`已向 ${result.createdCount} 名学生发布作业`);
      await loadClasses();
    } catch (err: unknown) {
      setClassMessage(err instanceof Error ? err.message : "发布作业失败");
    }
  };

  if (!isTeacherMode) {
    return (
      <div className="page-shell">
        <PageStage tone="primary">
          <ContextBanner />
          <SectionCard title="教师工作台" subtitle="当前为学生模式">
            <p className="text-ink-secondary mb-4">
              教师工作台仅在教师模式下可用。请通过顶部导航切换至教师模式。
            </p>
            <Link
              to="/my-learning?scope=classroom"
              className="inline-flex items-center gap-2 h-10 rounded-xl bg-[rgba(200,155,90,0.12)] text-[#8A6B32] px-4 text-sm font-medium hover:bg-[rgba(200,155,90,0.18)] transition-colors"
            >
              <Users className="w-4 h-4" />
              查看班级学情
            </Link>
          </SectionCard>
        </PageStage>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageStage tone="primary">
        <ContextBanner />
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs tracking-[0.18em] text-[#9b6731] uppercase mb-1">教师工作台</p>
            <h1 className="text-2xl font-serif text-brand-ink">教学管理中心</h1>
          </div>
          <Link
            to="/my-learning?scope=classroom"
            className="inline-flex items-center gap-2 h-10 rounded-xl bg-[rgba(34,58,94,0.06)] text-brand-ink px-4 text-sm font-medium hover:bg-[rgba(34,58,94,0.10)] transition-colors"
          >
            <Users className="w-4 h-4" />
            班级学情
          </Link>
        </div>

        {/* Current Session Panel */}
        <SectionCard title="当前课堂" subtitle={currentSessionId ? "课堂进行中" : "暂无活跃课堂"} className="mb-6">
          {currentSessionId && currentPoemId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(34,58,94,0.04)]">
                  <BookOpen className="w-4 h-4 text-brand-ink" />
                  <span className="text-sm text-brand-ink font-medium">
                    当前诗词 ID: {currentPoemId.slice(0, 8)}...
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(200,155,90,0.08)]">
                  <LayoutTemplate className="w-4 h-4 text-[#8A6B32]" />
                  <span className="text-sm text-[#8A6B32] font-medium">
                    步骤: {stepLabels[currentStep] ?? currentStep}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <Link
                  to={`/learn/${currentPoemId}`}
                  className="inline-flex items-center gap-2 h-10 rounded-xl bg-[#c03b3b] text-white px-5 text-sm font-medium hover:bg-[#d4695a] transition-colors"
                >
                  <Play className="w-4 h-4" />
                  继续教学
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <GraduationCap className="w-10 h-10 text-ink-secondary mx-auto mb-3 opacity-40" />
              <p className="text-ink-secondary mb-4">还没有开始课堂，选择一首诗词开始教学。</p>
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 h-10 rounded-xl bg-[rgba(200,155,90,0.12)] text-[#8A6B32] px-5 text-sm font-medium hover:bg-[rgba(200,155,90,0.18)] transition-colors"
              >
                浏览诗词库
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Recent Activity */}
        <SectionCard title="最近课堂记录" subtitle="上一次教学会话" className="mb-6">
          {sessionLoading ? (
            <SkeletonText lines={2} />
          ) : sessionError ? (
            <p className="text-sm text-ink-secondary">{sessionError}</p>
          ) : latestSession?.session ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[rgba(34,58,94,0.03)] rounded-xl py-3 px-3 text-center">
                  <p className="text-lg font-serif text-brand-ink">{latestSession.session.poemTitle ?? "--"}</p>
                  <p className="text-xs text-ink-secondary mt-1">诗词</p>
                </div>
                <div className="bg-[rgba(34,58,94,0.03)] rounded-xl py-3 px-3 text-center">
                  <p className="text-lg font-serif text-brand-ink">
                    {stepLabels[latestSession.session.currentStep] ?? latestSession.session.currentStep}
                  </p>
                  <p className="text-xs text-ink-secondary mt-1">当前步骤</p>
                </div>
                <div className="bg-[rgba(34,58,94,0.03)] rounded-xl py-3 px-3 text-center">
                  <p className="text-lg font-serif text-brand-ink">
                    {latestSession.session.durationMinutes != null
                      ? `${latestSession.session.durationMinutes} 分钟`
                      : "--"}
                  </p>
                  <p className="text-xs text-ink-secondary mt-1">时长</p>
                </div>
              </div>
              {latestSession.session.status && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-ink-secondary">
                    状态: {latestSession.session.status}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-secondary py-4 text-center">暂无课堂记录，开始教学后将显示在此处。</p>
          )}
        </SectionCard>

        <SectionCard title="班级管理" subtitle="学生加入、班级学情统计和整班作业发布" className="mb-6">
          {classMessage ? (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.16)]">
              {classMessage}
            </p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
            <div className="space-y-3">
              <div className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
                <p className="text-xs tracking-[0.14em] text-slate-500">创建班级</p>
                <div className="mt-3 grid gap-2">
                  <input
                    value={classForm.name}
                    onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="input-main control-dense"
                    placeholder="班级名称，例如：七年级一班"
                  />
                  <input
                    value={classForm.description}
                    onChange={(event) => setClassForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="input-main control-dense"
                    placeholder="班级说明，可选"
                  />
                  <button type="button" onClick={() => void handleCreateClass()} className="btn-primary-compact inline-flex items-center justify-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    创建班级
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {classesLoading ? <SkeletonText lines={3} /> : null}
                {!classesLoading && classes.length === 0 ? (
                  <p className="rounded-2xl bg-stone-50 px-4 py-4 text-sm text-slate-500">暂无班级，创建后会显示邀请码和学情摘要。</p>
                ) : null}
                {classes.map((item) => {
                  const summary = classSummaries[item.id];
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
                          <p className={["mt-1 text-xs", active ? "text-white/70" : "text-slate-500"].join(" ")}>
                            邀请码 {item.inviteCode || "--"}
                          </p>
                        </div>
                        <span className={["rounded-full px-2 py-1 text-xs", active ? "bg-white/14 text-white" : "bg-stone-100 text-slate-600"].join(" ")}>
                          {summary?.studentCount ?? 0} 人
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-white px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs tracking-[0.14em] text-slate-500">当前班级</p>
                  <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">{selectedClass?.name || "未选择班级"}</h3>
                  <p className="mt-1 text-sm text-slate-500">学生可用邀请码加入：{selectedClass?.inviteCode || "--"}</p>
                </div>
                <button type="button" onClick={() => void loadClasses()} className="btn-secondary-compact">
                  刷新
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-stone-50 px-3 py-3 text-center">
                  <p className="font-serif text-3xl text-[#1A2B4C]">{selectedSummary?.studentCount ?? students.length}</p>
                  <p className="mt-1 text-xs text-slate-500">学生</p>
                </div>
                <div className="rounded-xl bg-stone-50 px-3 py-3 text-center">
                  <p className="font-serif text-3xl text-[#1A2B4C]">{selectedSummary?.taskCount ?? 0}</p>
                  <p className="mt-1 text-xs text-slate-500">作业</p>
                </div>
                <div className="rounded-xl bg-stone-50 px-3 py-3 text-center">
                  <p className="font-serif text-3xl text-[#1A2B4C]">{selectedSummary?.taskCompletionRate ?? 0}%</p>
                  <p className="mt-1 text-xs text-slate-500">完成率</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <p className="text-xs tracking-[0.14em] text-slate-500">发布整班作业</p>
                <input
                  value={taskForm.title}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="input-main control-dense"
                  placeholder="作业标题"
                />
                <textarea
                  value={taskForm.detail}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, detail: event.target.value }))}
                  className="input-main min-h-[92px]"
                  placeholder="作业说明"
                />
                <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <select
                    value={taskForm.taskType}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, taskType: event.target.value }))}
                    className="input-main control-dense"
                  >
                    <option value="practice">练测</option>
                    <option value="memory">记忆</option>
                    <option value="review">复盘</option>
                    <option value="custom">自定义</option>
                  </select>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                    className="input-main control-dense"
                  />
                </div>
                <input
                  value={taskForm.to}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, to: event.target.value }))}
                  className="input-main control-dense"
                  placeholder="跳转链接，例如 /practice?entry=practice"
                />
                <button
                  type="button"
                  onClick={() => void handlePublishClassTask()}
                  disabled={!selectedClassId || students.length === 0}
                  className="btn-primary inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  发布给全班
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Unit Overview */}
        <SectionCard
          title="教学单元"
          subtitle={`${activeUnits.length} 个活跃单元，共 ${totalPoemCount} 首诗词`}
          className="mb-6"
        >
          {unitsLoading ? (
            <SkeletonCard />
          ) : unitsError ? (
            <p className="text-sm text-ink-secondary">{unitsError}</p>
          ) : activeUnits.length === 0 ? (
            <p className="text-sm text-ink-secondary py-4 text-center">
              暂无教学单元数据，请联系管理员配置单元内容。
            </p>
          ) : (
            <div className="space-y-3">
              {activeUnits.slice(0, 5).map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-[rgba(34,58,94,0.08)] bg-white hover:border-[rgba(34,58,94,0.14)] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-brand-ink">{unit.title}</p>
                    <p className="text-xs text-ink-secondary mt-0.5">
                      {unit.subtitle} · {unit.poemIds.length} 首诗词 · {unit.gradeLevel.join("、")}
                    </p>
                  </div>
                  {unit.curriculumRef ? (
                    <span className="text-xs text-[#9b6731] bg-[rgba(200,155,90,0.08)] px-3 py-1 rounded-full shrink-0">
                      {unit.curriculumRef}
                    </span>
                  ) : null}
                </div>
              ))}
              {activeUnits.length > 5 ? (
                <p className="text-xs text-ink-secondary text-center">
                  还有 {activeUnits.length - 5} 个单元未显示
                </p>
              ) : null}
            </div>
          )}
        </SectionCard>

        {/* Quick Actions */}
        <SectionCard title="快捷操作" subtitle="常用入口">
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/explore"
              className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(34,58,94,0.08)] bg-white hover:border-[rgba(34,58,94,0.16)] hover:shadow-[0_8px_24px_rgba(34,58,94,0.06)] transition-all"
            >
              <BookOpen className="w-5 h-5 text-brand-ink" />
              <div>
                <p className="text-sm font-medium text-brand-ink">开始新课堂</p>
                <p className="text-xs text-ink-secondary">浏览诗词库选诗</p>
              </div>
            </Link>
            <Link
              to="/practice?entry=exam"
              className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(34,58,94,0.08)] bg-white hover:border-[rgba(34,58,94,0.16)] hover:shadow-[0_8px_24px_rgba(34,58,94,0.06)] transition-all"
            >
              <Clock className="w-5 h-5 text-brand-ink" />
              <div>
                <p className="text-sm font-medium text-brand-ink">发布模拟考试</p>
                <p className="text-xs text-ink-secondary">创建考试任务</p>
              </div>
            </Link>
            <Link
              to="/my-learning?tab=diagnosis"
              className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(34,58,94,0.08)] bg-white hover:border-[rgba(34,58,94,0.16)] hover:shadow-[0_8px_24px_rgba(34,58,94,0.06)] transition-all"
            >
              <GraduationCap className="w-5 h-5 text-brand-ink" />
              <div>
                <p className="text-sm font-medium text-brand-ink">学情诊断</p>
                <p className="text-xs text-ink-secondary">查看薄弱维度分析</p>
              </div>
            </Link>
            <Link
              to="/my-learning?tab=plan"
              className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(34,58,94,0.08)] bg-white hover:border-[rgba(34,58,94,0.16)] hover:shadow-[0_8px_24px_rgba(34,58,94,0.06)] transition-all"
            >
              <LayoutTemplate className="w-5 h-5 text-brand-ink" />
              <div>
                <p className="text-sm font-medium text-brand-ink">复习计划</p>
                <p className="text-xs text-ink-secondary">管理复习提醒</p>
              </div>
            </Link>
            <button
              onClick={toggleDemoMode}
              className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(200,155,90,0.18)] bg-[rgba(200,155,90,0.04)] hover:border-[rgba(200,155,90,0.3)] hover:shadow-[0_8px_24px_rgba(200,155,90,0.08)] transition-all text-left"
            >
              <Play className="w-5 h-5 text-[#8A6B32]" />
              <div>
                <p className="text-sm font-medium text-[#8A6B32]">
                  {isDemoMode ? "退出演示" : "演示模式"}
                </p>
                <p className="text-xs text-ink-secondary">
                  {isDemoMode ? "返回普通视图" : "全屏展示教学内容"}
                </p>
              </div>
            </button>
          </div>
        </SectionCard>
      </PageStage>
    </div>
  );
}
