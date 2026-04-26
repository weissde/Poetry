import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatedMetricValue } from "@/components/common/AnimatedMetricValue";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { NextStepRecommendations } from "@/components/common/NextStepRecommendations";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import { StaggerFadeUp } from "@/components/effects/StaggerFadeUp";
import { BlurText, Magnet, SpotlightCard } from "@/components/react-bits";
import { CurriculumNav } from "@/components/teaching/CurriculumNav";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { buildHomeNextStepRecommendations } from "@/features/recommendations/personalized";
import { useTeachingUnits } from "@/hooks/useTeachingUnits";
import { useTodayTasks } from "@/hooks/useTodayTasks";
import { useUserSummary } from "@/hooks/useUserSummary";
import { useWeakness } from "@/hooks/useWeakness";
import {
  advanceTeachingSession,
  createTeachingSession,
  endTeachingSession,
  getLatestTeachingSession,
  getClasses,
  getPersonalGraphInsights,
  getPoemDetail,
  getUserRole,
  joinClassByInvite,
  updateLessonTaskStatus,
} from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type {
  CurriculumNavSection,
  ClassRecord,
  PersonalGraphInsightsPayload,
  TeachingSessionRecord,
  TeachingUnitItem,
  TodayTaskItem,
  PoemRecord,
} from "@/types";

interface DiscoverEntry {
  title: string;
  detail: string;
  meta: string;
  to: string;
}

const JOURNEY_INTRO_STORAGE_KEY = "poetry_ai_journey_intro_v1_dismissed";

const discoverEntries: readonly DiscoverEntry[] = [
  {
    title: "探索诗词库",
    detail: "从诗词库、课程单元或主题入口开始今天的新一首诗。",
    meta: "按学段/主题检索",
    to: "/explore",
  },
  {
    title: "知识图谱",
    detail: "查看诗人关系、意象关联和自己的学习版图。",
    meta: "关系可视化",
    to: "/graph",
  },
  {
    title: "创作挑战",
    detail: "把今天学到的表达方式转成仿写与创作输出。",
    meta: "AI 点评",
    to: "/create",
  },
] as const;

const homeLoopRecommendations = [
  {
    title: "做同诗练测",
    description: "完成精讲后立刻过渡到题目训练，验证是否真正掌握课堂内容。",
    to: "/practice?entry=practice&count=8&difficulty=medium&auto=1&source=home",
    ctaLabel: "去练测",
    badge: "学完后",
  },
  {
    title: "查看图谱关联",
    description: "把课堂内容放进诗人关系与意象网络里，补足比较阅读与主题迁移。",
    to: "/graph",
    ctaLabel: "去图谱",
    badge: "理解后",
  },
  {
    title: "回到学情中心",
    description: "把练测、错题、记忆和创作结果收拢到同一视角，形成完整复盘闭环。",
    to: "/my-learning?tab=overview",
    ctaLabel: "看学情",
    badge: "收束时",
  },
] as const;

const teachingStepLabels = ["总览", "精讲", "探究", "练测", "记忆", "学情", "结束"] as const;

const teacherQuickActions = [
  { label: "进入诗词精讲", to: "/learn" },
  { label: "发布即时练习", to: "/practice?entry=practice" },
  { label: "查看教学单元", to: "/explore" },
  { label: "查看学情中心", to: "/my-learning" },
] as const;

function getDisplayName(user: ReturnType<typeof useAuthStore.getState>["user"]): string {
  if (!user) {
    return "同学";
  }
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const candidates = [
    metadata?.display_name,
    metadata?.full_name,
    metadata?.name,
    user.email?.split("@")[0],
  ];

  const match = candidates.find((item) => String(item || "").trim().length > 0);
  return String(match || "同学").trim();
}

function GuestOverview(): JSX.Element {
  return (
    <div className="page-shell">
      <PageStage tone="primary">
        <section className="mx-auto max-w-[760px] rounded-[32px] bg-[linear-gradient(135deg,#1A2B4C_0%,#283F68_62%,#3C567E_100%)] px-6 py-12 text-white shadow-[0_22px_48px_rgba(26,43,76,0.24)] md:px-10">
          <p className="text-xs tracking-[0.18em] text-white/70">诗境通 · 课堂门厅</p>
          <BlurText as="h1" text="把古诗词学习组织成一段清晰的课堂旅程" className="mt-4 text-4xl font-semibold leading-tight md:text-5xl" delayPerChar={0.018} />
          <p className="mt-5 max-w-[560px] text-sm leading-8 text-white/82 md:text-base">
            登录后直接进入今日课程、精讲、练测、图谱与学情工作区，不再停留在长篇产品介绍页。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="btn-primary inline-flex items-center gap-2 bg-white text-[#1A2B4C] hover:bg-stone-100">
              开始学习
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="btn-secondary inline-flex items-center gap-2 border-white/20 bg-white/10 text-white hover:bg-white/16">
              进入演示账号
            </Link>
          </div>
        </section>
      </PageStage>
    </div>
  );
}

function StudentOverview({ displayName, onSwitchToTeacher }: { displayName: string; onSwitchToTeacher: () => void }): JSX.Element {
  const navigate = useNavigate();
  const { currentPoemId } = useTeachingMode();
  const { data: summary } = useUserSummary();
  const { profile: weaknessProfile } = useWeakness();
  const { data: taskPayload } = useTodayTasks();
  const [showJourneyIntro, setShowJourneyIntro] = useState(false);
  const [heroPoem, setHeroPoem] = useState<PoemRecord | null>(null);
  const [taskActionMessage, setTaskActionMessage] = useState<string | null>(null);
  const [insights, setInsights] = useState<PersonalGraphInsightsPayload | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [studentClasses, setStudentClasses] = useState<ClassRecord[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [classJoinMessage, setClassJoinMessage] = useState<string | null>(null);
  const [classLoading, setClassLoading] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(JOURNEY_INTRO_STORAGE_KEY) !== "1") {
        setShowJourneyIntro(true);
      }
    } catch {
      setShowJourneyIntro(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!currentPoemId) {
      setHeroPoem(null);
      return () => {
        active = false;
      };
    }

    void getPoemDetail(currentPoemId)
      .then((poem) => {
        if (active) {
          setHeroPoem(poem);
        }
      })
      .catch(() => {
        if (active) {
          setHeroPoem(null);
        }
      });

    return () => {
      active = false;
    };
  }, [currentPoemId]);

  useEffect(() => {
    let active = true;
    setInsightsLoading(true);
    void getPersonalGraphInsights()
      .then((data) => {
        if (active) setInsights(data);
      })
      .catch(() => {
        if (active) setInsights(null);
      })
      .finally(() => {
        if (active) setInsightsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setClassLoading(true);
    void getClasses(true)
      .then((data) => {
        if (active) setStudentClasses(data.items || []);
      })
      .catch(() => {
        if (active) setStudentClasses([]);
      })
      .finally(() => {
        if (active) setClassLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const summaryMetrics = useMemo(() => {
    if (!summary) {
      return [
        { label: "连续学习", value: "0", unit: "天", note: "暂无学习摘要数据" },
        { label: "已学诗词", value: "0", unit: "首", note: "等待同步学习数据" },
        { label: "本周练测", value: "0", unit: "题", note: "等待同步学习数据" },
      ] as const;
    }
    return [
      {
        label: "连续学习",
        value: String(summary.streakDays),
        unit: "天",
        note: summary.streakDays > 0 ? "保持打卡节奏" : "今天开始建立连续学习",
      },
      {
        label: "已学诗词",
        value: String(summary.poemCount),
        unit: "首",
        note: summary.weakDimension && summary.weakDimension !== "暂未识别" ? `当前弱项：${summary.weakDimension}` : "覆盖唐诗与宋词",
      },
      {
        label: "本周练测",
        value: String(summary.weeklyPracticeCount),
        unit: "题",
        note: summary.weeklyWrongCount > 0 ? `本周新增错题 ${summary.weeklyWrongCount} 道` : "本周暂无新增错题",
      },
    ] as const;
  }, [summary]);

  const taskItems = taskPayload?.items || [];
  const pendingTaskCount = taskPayload?.summary?.todo ?? taskItems.filter((task) => task.status === "todo").length;

  const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];
  const weekdayActivity = useMemo(() => {
    const activityItems = insights?.activity?.items || [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    return weekdayLabels.map((label, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      const found = activityItems.find((item) => item.date === dateStr);
      const total = found ? (found.practice || 0) + (found.memoryReview || 0) + (found.creation || 0) : 0;
      return { label, value: Math.min(100, total * 12), date: dateStr };
    });
  }, [insights]);

  const recentLessons = useMemo(() => {
    const items: Array<{ title: string; meta: string; to: string }> = [];
    if (heroPoem) {
      items.push({
        title: heroPoem.title,
        meta: "当前课堂诗词",
        to: `/learn/${heroPoem.id}`,
      });
    }
    const topFocus = insights?.focus;
    if (topFocus?.questionType?.key) {
      items.push({
        title: `${topFocus.questionType.key}专项`,
        meta: `正确率 ${Math.round((topFocus.questionType.rate || 0) * 100)}%`,
        to: "/practice?entry=practice&auto=1&source=home",
      });
    }
    if (topFocus?.dynasty?.key && topFocus.dynasty.key !== (heroPoem?.dynasty || "")) {
      items.push({
        title: `${topFocus.dynasty.key}诗词`,
        meta: "近期重点朝代",
        to: `/explore?dynasty=${encodeURIComponent(topFocus.dynasty.key)}`,
      });
    }
    if (items.length < 3 && insights?.activity?.items?.length) {
      items.push({
        title: "学习回顾",
        meta: `最近 ${insights.activity.days} 天有学习记录`,
        to: "/my-learning?tab=overview",
      });
    }
    while (items.length < 3) {
      items.push({
        title: "开始新诗词",
        meta: "探索发现更多诗词",
        to: "/explore",
      });
    }
    return items.slice(0, 3);
  }, [heroPoem, insights]);
  const heroLesson = useMemo(() => {
    if (!heroPoem) {
      return {
        title: "待选择诗词",
        author: "—",
        dynasty: "—",
        summary: "当前未锁定课堂诗词，先去探索或精讲页选择一首诗开始。",
        goals: ["选择今日精讲诗词", "完成精讲与练测衔接", "回到学情页查看结果"],
        to: "/learn",
      };
    }
    return {
      title: heroPoem.title,
      author: heroPoem.author,
      dynasty: heroPoem.dynasty,
      summary: `今天继续学习《${heroPoem.title}》，先完成精讲，再把课堂结果带到练测与学情复盘。`,
      goals: [
        `完成《${heroPoem.title}》的一轮精讲与解析`,
        "把课堂理解迁移到练测或探究任务里",
        "在学情页查看本诗相关表现与下一步建议",
      ],
      to: `/learn/${heroPoem.id}`,
    };
  }, [heroPoem]);

  const homeRecommendations = useMemo(
    () =>
      buildHomeNextStepRecommendations({
        weaknessProfile,
        insights,
        summary,
        heroPoem,
      }),
    [heroPoem, insights, summary, weaknessProfile],
  );

  const dismissJourneyIntro = (): void => {
    try {
      window.localStorage.setItem(JOURNEY_INTRO_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowJourneyIntro(false);
  };

  const handleTodayTaskOpen = async (task: TodayTaskItem): Promise<void> => {
    const lessonTaskId = task.lessonTaskId || (task.source === "lesson_task" ? task.id : "");
    setTaskActionMessage(null);

    if (lessonTaskId && task.status !== "done") {
      try {
        await updateLessonTaskStatus(lessonTaskId, "in_progress");
      } catch (error: unknown) {
        setTaskActionMessage(error instanceof Error ? `任务状态同步失败：${error.message}` : "任务状态同步失败，已继续打开任务入口。");
      }
    }

    navigate(task.to);
  };

  const handleJoinClass = async (): Promise<void> => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setClassJoinMessage("请先输入老师给的邀请码");
      return;
    }
    setClassLoading(true);
    setClassJoinMessage(null);
    try {
      const result = await joinClassByInvite(code);
      const data = await getClasses(true);
      setStudentClasses(data.items || []);
      setInviteCode("");
      setClassJoinMessage(`已加入「${result.item.name}」`);
    } catch (error: unknown) {
      setClassJoinMessage(error instanceof Error ? error.message : "加入班级失败");
    } finally {
      setClassLoading(false);
    }
  };

  return (
    <>
    <div className="page-shell">
      <PageStage tone="primary">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
          <div className="rounded-[32px] bg-[linear-gradient(140deg,#1A2B4C_0%,#274067_56%,#304E7A_100%)] px-6 py-7 text-white shadow-[0_22px_48px_rgba(26,43,76,0.22)] md:px-8">
            <p className="text-xs tracking-[0.18em] text-white/70">今日课程</p>
            <BlurText as="h1" text={`欢迎回来，${displayName}`} className="mt-3 text-4xl font-semibold leading-tight md:text-5xl" delayPerChar={0.016} />
            <p className="mt-4 text-lg text-white/88">今天继续学习《{heroLesson.title}》</p>
            <p className="mt-3 max-w-[640px] text-sm leading-8 text-white/80">{heroLesson.summary}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Magnet className="inline-flex">
                <Link to={heroLesson.to} className="btn-primary inline-flex items-center gap-2 bg-white text-[#1A2B4C] hover:bg-stone-100">
                  进入精讲
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Magnet>
              <Link to="/practice?entry=practice" className="btn-secondary inline-flex items-center gap-2 border-white/20 bg-white/10 text-white hover:bg-white/16">
                今日任务 {pendingTaskCount} 项待完成
              </Link>
              <button type="button" onClick={onSwitchToTeacher} className="btn-secondary inline-flex items-center gap-2 border-white/20 bg-transparent text-white hover:bg-white/10">
                切换教师模式
              </button>
            </div>
          </div>

          <TeachingObjectiveCard
            variant="hero"
            kicker="当前单元"
            chipLabel="课堂入口"
            title={`《${heroLesson.title}》 · ${heroLesson.author}`}
            meta={`${heroLesson.dynasty} · 今日目标：理解意象 + 情感`}
            goals={heroLesson.goals}
            footer={
              <>
                <span>从首页直接进入精讲，再串起练测、图谱和学情。</span>
                <Link to={heroLesson.to} className="overview-inline-link">
                  继续课堂
                </Link>
              </>
            }
          />
        </section>
      </PageStage>

      <PageStage tone="secondary">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <SectionCard
            title="课堂总控台"
            subtitle="把今天这一首诗的课堂推进、任务去向和闭环动作收拢到首页。"
            density="roomy"
            weight="workspace"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <article className="rounded-[22px] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]" style={{ background: 'var(--bg-subtle)' }}>
                <p className="text-[11px] tracking-[0.16em] text-[#9B6B32]">STEP 01</p>
                <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">先进入精讲</h3>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>完成原文、解析与探究，把课堂问题先讲透。</p>
              </article>
              <article className="rounded-[22px] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]" style={{ background: 'var(--bg-subtle)' }}>
                <p className="text-[11px] tracking-[0.16em] text-[#9B6B32]">STEP 02</p>
                <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">再完成练测</h3>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>用 5-10 题快速验证迁移效果，把薄弱题型显性化。</p>
              </article>
              <article className="rounded-[22px] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]" style={{ background: 'var(--bg-subtle)' }}>
                <p className="text-[11px] tracking-[0.16em] text-[#9B6B32]">STEP 03</p>
                <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">最后回到学情</h3>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>把错题、记忆、创作和图谱发现统一收口到复盘视图。</p>
              </article>
            </div>
          </SectionCard>

          <SectionCard title="今日联动摘要" subtitle="不是功能堆叠，而是把今天的学习去向提前说清楚。" density="roomy" weight="summary">
            <div className="space-y-3">
              <article className="rounded-[20px] px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.06)]" style={{ background: 'var(--bg-surface)' }}>
                <p className="text-xs tracking-[0.14em] text-slate-400">精讲 → 练测</p>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>《春望》精讲完成后，可直接进入同诗专项题组。</p>
              </article>
              <article className="rounded-[20px] px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.06)]" style={{ background: 'var(--bg-surface)' }}>
                <p className="text-xs tracking-[0.14em] text-slate-400">解析 → 图谱</p>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>从“家书”“烽火”等意象进入关系图谱，适合课堂延展与比较阅读。</p>
              </article>
              <article className="rounded-[20px] px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.06)]" style={{ background: 'var(--bg-surface)' }}>
                <p className="text-xs tracking-[0.14em] text-slate-400">练测 / 创作 → 学情</p>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>所有阶段结果最终回到学情中心，形成一页式复盘表达。</p>
              </article>
            </div>
          </SectionCard>
        </div>
      </PageStage>

      <PageStage tone="secondary">
        <LearnJourneyProgress />
      </PageStage>

      <PageStage tone="secondary">
        <StaggerFadeUp className="grid gap-4 md:grid-cols-3">
          {summaryMetrics.map((item, index) => (
            <SectionCard key={item.label} density="roomy" weight="summary">
              <p className="text-xs tracking-[0.12em] text-slate-500">{item.label}</p>
              <div className="mt-3 flex items-end gap-2">
                <AnimatedMetricValue value={item.value} className="font-serif text-4xl leading-none text-[#1A2B4C]" durationMs={860 + index * 140} />
                <span className="pb-1 text-sm text-slate-500">{item.unit}</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">{item.note}</p>
            </SectionCard>
          ))}
        </StaggerFadeUp>
      </PageStage>

      <PageStage tone="secondary">
        <SectionCard title="我的班级" subtitle="用老师给的邀请码加入班级任务流" density="roomy" weight="summary">
          {classJoinMessage ? (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.16)]">
              {classJoinMessage}
            </p>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-2">
              {studentClasses.length === 0 ? (
                <p className="rounded-2xl bg-stone-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  当前还没有加入班级。输入老师给的 6 位邀请码后，班级作业会进入今日任务。
                </p>
              ) : (
                studentClasses.map((item) => (
                  <article key={item.id} className="rounded-2xl bg-stone-50 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                    <p className="font-medium text-[#1A2B4C]">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description || "已加入班级"}</p>
                  </article>
                ))
              )}
            </div>
            <div className="rounded-2xl bg-white px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
              <p className="text-xs tracking-[0.14em] text-slate-500">加入班级</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  className="input-main control-dense min-w-0 flex-1"
                  placeholder="邀请码"
                  maxLength={12}
                />
                <button type="button" onClick={() => void handleJoinClass()} disabled={classLoading} className="btn-primary-compact shrink-0 disabled:cursor-not-allowed disabled:opacity-60">
                  加入
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      </PageStage>

      <PageStage tone="secondary">
        <SectionCard
          title="今日任务"
          subtitle="从今天这首诗出发，把精讲、练测和错题复盘串起来。"
          density="roomy"
          weight="workspace"
        >
          {taskActionMessage ? (
            <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
              {taskActionMessage}
            </p>
          ) : null}
          <div className="space-y-3">
            {taskItems.length === 0 ? (
              <article className="rounded-[22px] px-4 py-4 text-sm leading-7 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]" style={{ color: 'var(--neutral)', background: 'var(--bg-subtle)' }}>
                今日任务数据暂未同步，稍后会自动刷新。
              </article>
            ) : (
              taskItems.map((task) => (
                <article key={task.id} className="flex flex-col gap-3 rounded-[22px] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] md:flex-row md:items-center md:justify-between" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: 'var(--ink-900)' }}>
                      <span className={task.status === "done" ? "text-emerald-600" : "text-[#A0622B]"}>{task.status === "done" ? "☑" : "□"}</span>
                      <span className="ml-2 font-medium">{task.title}</span>
                    </p>
                    <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>{task.detail}</p>
                  </div>
                  <button type="button" onClick={() => void handleTodayTaskOpen(task)} className="btn-secondary-compact justify-center md:justify-start">
                    {task.cta}
                  </button>
                </article>
              ))
            )}
          </div>
        </SectionCard>
      </PageStage>

      <PageStage tone="detail">
        <NextStepRecommendations
          title="推荐下一步"
          subtitle="把首页真正变成课堂门厅：从当前课程直接把学习链路往后推。"
          items={homeRecommendations}
        />
      </PageStage>

      <PageStage tone="detail">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <SectionCard title="本周学习进度" subtitle="默认折叠保留轻量感，需要时再展开查看。">
            <details className="group rounded-[22px] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
              <summary className="cursor-pointer list-none text-sm font-medium text-[#1A2B4C]">
                查看 7 天热力图与最近学习的诗词
              </summary>
              <div className="mt-4 space-y-5">
                {insightsLoading ? (
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={`skel-${i}`} className="h-16 rounded-2xl animate-pulse bg-stone-200" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    {weekdayActivity.map((item) => (
                      <div key={item.label} className="text-center">
                        <div className="h-16 rounded-2xl bg-stone-200 p-1">
                          <div
                            className="h-full rounded-[14px] bg-[linear-gradient(180deg,#C9A96E_0%,#1A2B4C_100%)]"
                            style={{ opacity: Math.max(0.15, item.value / 100) }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{item.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-3">
                  {recentLessons.map((item) => (
                    <Link key={item.title} to={item.to} className="rounded-[20px] bg-white px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.06)] transition hover:-translate-y-0.5">
                      <p className="font-serif text-xl text-[#1A2B4C]">{item.title}</p>
                      <p className="mt-2 text-sm text-slate-600">{item.meta}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </details>
          </SectionCard>

          <SectionCard title="发现更多" subtitle="从入口聚合切换到下一段学习旅程，而不是看产品介绍。">
            <div className="grid gap-3">
              {discoverEntries.map((item) => (
                <SpotlightCard key={item.title} className="rounded-[22px] bg-white px-4 py-4 shadow-[0_8px_22px_rgba(34,58,94,0.06)]" spotlightColor="rgba(26,43,76,0.08)">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs tracking-[0.14em] text-slate-400">{item.meta}</p>
                      <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{item.detail}</p>
                    </div>
                    <Link to={item.to} className="btn-secondary-compact">
                      进入
                    </Link>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </SectionCard>
        </div>
      </PageStage>
    </div>

    {showJourneyIntro ? (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-intro-heading"
      >
        <div className="max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-[linear-gradient(160deg,#fffdf8_0%,#f4efe6_100%)] p-6 shadow-[0_24px_60px_rgba(26,43,76,0.22)] md:p-8">
          <p className="text-2xl" aria-hidden>
            👋
          </p>
          <h2 id="journey-intro-heading" className="mt-2 font-display text-2xl text-[#1A2B4C] md:text-3xl">
            <BlurText as="span" text="欢迎来到诗境通" className="font-display text-2xl text-[#1A2B4C] md:text-3xl" delayPerChar={0.022} />
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">让我们花 30 秒了解一下学习旅程：</p>
          <ol className="mt-4 space-y-2.5 text-sm leading-7 text-slate-700">
            <li>① 探索：选择要学习的诗词</li>
            <li>② 学习：AI 精讲 + 探究对话</li>
            <li>③ 练测：专项练习 + 模拟考试</li>
            <li>④ 记忆：填空 + 默写 + 复习</li>
            <li>⑤ 学情：诊断弱点 + 复习计划</li>
          </ol>
          <div className="mt-8 flex flex-wrap gap-2">
            <Magnet className="inline-flex">
              <Link
                to="/explore"
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => {
                  dismissJourneyIntro();
                }}
              >
                开始探索
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnet>
            <button type="button" onClick={dismissJourneyIntro} className="btn-secondary">
              稍后再说
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function TeacherOverviewHome({ onSwitchToStudent }: { onSwitchToStudent: () => void }): JSX.Element {
  const navigate = useNavigate();
  const { currentSessionId, setCurrentPoemId, setCurrentSessionId, setCurrentStep } = useTeachingMode();
  const { data: unitsPayload } = useTeachingUnits();
  const [latestSession, setLatestSession] = useState<TeachingSessionRecord | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [isStartingTeaching, setIsStartingTeaching] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const units = unitsPayload?.items || [];

  useEffect(() => {
    let active = true;

    void Promise.allSettled([getLatestTeachingSession()]).then((results) => {
      if (!active) {
        return;
      }
      const [sessionResult] = results;
      if (sessionResult.status === "fulfilled") {
        const nextSession = sessionResult.value.session || null;
        setLatestSession(nextSession);
        if (nextSession?.status === "active") {
          setCurrentSessionId(nextSession.id || null);
          setCurrentPoemId(nextSession.poemId || null);
          setCurrentStep(nextSession.currentStep || 1);
        } else if (!nextSession) {
          setCurrentSessionId(null);
        }
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelectedUnitId((current) => current || units[0]?.id || "");
  }, [units]);

  const selectedUnit = useMemo(() => units.find((item) => item.id === selectedUnitId) || units[0] || null, [selectedUnitId, units]);

  const unitSections = useMemo<CurriculumNavSection[]>(() => {
    if (!units.length) {
      return [
        {
          title: "课程单元",
          caption: "等待教学单元数据",
          items: [],
        },
      ];
    }
    const groups = new Map<string, TeachingUnitItem[]>();
    for (const unit of units) {
      const key = unit.gradeLevel[0] || "all";
      groups.set(key, [...(groups.get(key) || []), unit]);
    }
    return Array.from(groups.entries()).map(([grade, items]) => ({
      title: `课程单元 · ${grade === "all" ? "全部" : grade}`,
      caption: "数据库驱动的教学单元导航",
      items: items.map((item) => ({
        id: item.id,
        label: item.title,
        keyword: item.title,
        gradeLevel: item.gradeLevel[0] || "all",
      })),
    }));
  }, [units]);

  const sessionStepLabel = teachingStepLabels[Math.max(0, Math.min(teachingStepLabels.length - 1, latestSession?.currentStep ?? 0))] || "总览";
  const startTeachingTo = latestSession?.poemId
    ? `/learn/${latestSession.poemId}`
    : selectedUnit?.poemIds?.[0]
      ? `/learn/${selectedUnit.poemIds[0]}`
      : "/learn";
  const teacherHeroTitle = latestSession?.poemTitle
    ? `当前课堂：《${latestSession.poemTitle}》`
    : selectedUnit?.title
      ? `当前单元：${selectedUnit.title}`
      : "当前课堂：等待选择教学单元";
  const teacherHeroGoals = [
    latestSession?.status ? `当前状态：${latestSession.status === "active" ? "进行中" : latestSession.status}` : "当前状态：尚未创建课堂会话",
    selectedUnit?.curriculumRef ? `课程来源：${selectedUnit.curriculumRef}` : "课程来源：待补充教学单元归属",
    selectedUnit?.masteryTarget ? `掌握目标：${selectedUnit.masteryTarget}%` : "掌握目标：默认 80%",
  ];
  const teacherMetrics = [
    { label: "当前步骤", value: sessionStepLabel, note: latestSession ? `步骤 ${latestSession.currentStep}` : "尚未推进课堂步骤" },
    { label: "单元数量", value: String(units.length || 0), note: "当前可用教学单元" },
    {
      label: "当前诗词",
      value: latestSession?.poemTitle || selectedUnit?.title || "待选择",
      note: latestSession?.startedAt ? "来自最近课堂会话" : "来自教学单元推荐",
    },
    {
      label: "目标掌握",
      value: selectedUnit ? `${selectedUnit.masteryTarget}%` : "--",
      note: selectedUnit?.subtitle || "等待教学单元描述",
    },
  ] as const;

  const canEndActiveSession = Boolean((latestSession?.status === "active" && latestSession.id) || currentSessionId);

  const handleStartTeaching = async (): Promise<void> => {
    if (isStartingTeaching) {
      return;
    }
    const fallbackPoemId = latestSession?.poemId || selectedUnit?.poemIds?.[0] || null;
    const fallbackStep = Math.max(1, latestSession?.currentStep ?? 1);
    const fallbackTarget = fallbackPoemId ? `/learn/${fallbackPoemId}` : startTeachingTo;

    setIsStartingTeaching(true);

    try {
      const commonPayload = {
        poemId: fallbackPoemId || undefined,
        poemTitle: latestSession?.poemTitle || selectedUnit?.title || undefined,
        unitId: latestSession?.unitId || selectedUnit?.id || undefined,
      };
      const nextSession =
        latestSession?.id && latestSession.status === "active"
          ? (await advanceTeachingSession(latestSession.id, { currentStep: fallbackStep, ...commonPayload })).session
          : (await createTeachingSession({ currentStep: fallbackStep, ...commonPayload })).session;

      const syncedSession = nextSession || latestSession;
      const nextPoemId = syncedSession?.poemId || fallbackPoemId;
      const nextStep = Math.max(1, syncedSession?.currentStep ?? fallbackStep);
      const nextTarget = nextPoemId ? `/learn/${nextPoemId}` : "/learn";

      setLatestSession(syncedSession || null);
      setCurrentSessionId(syncedSession?.id || null);
      setCurrentPoemId(nextPoemId || null);
      setCurrentStep(nextStep);
      void navigate(nextTarget);
      return;
    } catch {
    } finally {
      setIsStartingTeaching(false);
    }

    setCurrentPoemId(fallbackPoemId);
    setCurrentStep(fallbackStep);
    void navigate(fallbackTarget);
  };

  const handleEndSession = async (): Promise<void> => {
    const targetSessionId =
      latestSession?.status === "active" && latestSession.id
        ? latestSession.id
        : currentSessionId || latestSession?.id || null;
    if (!targetSessionId || isEndingSession) {
      return;
    }

    setIsEndingSession(true);
    try {
      const ended = await endTeachingSession(targetSessionId, { notes: latestSession?.notes || undefined });
      setLatestSession(ended.session || null);
      setCurrentSessionId(null);
      setCurrentStep(0);
    } catch {
    } finally {
      setIsEndingSession(false);
    }
  };

  return (
    <div className="page-shell">
      <PageStage tone="primary">
        <section className="grid gap-6 rounded-[32px] bg-[linear-gradient(145deg,#F9F2E6_0%,#F4E4C8_100%)] px-6 py-7 shadow-[0_22px_48px_rgba(201,169,110,0.2)] lg:grid-cols-[minmax(0,1fr)_360px] md:px-8">
          <div>
            <p className="text-xs tracking-[0.18em] text-[#9B6B32]">今日教案</p>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-[#1A2B4C]">{teacherHeroTitle}</h1>
            <p className="mt-4 text-sm leading-8 text-slate-700">
              教师模式下首页变成课堂门厅，先看最近课堂会话和教学单元，再进入精讲页推进课堂。
            </p>

            <div className="mt-6 rounded-[24px] bg-white/88 px-5 py-5 shadow-[0_10px_28px_rgba(34,58,94,0.08)]">
              <p className="text-xs tracking-[0.12em] text-[#9B6B32]">教学目标</p>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                {teacherHeroGoals.map((item, index) => (
                  <li key={item}>
                    {index + 1}. {item}
                  </li>
                ))}
              </ul>
              {latestSession?.notes ? <p className="mt-4 text-sm leading-7 text-slate-600">课堂备注：{latestSession.notes}</p> : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate("/my-learning?scope=classroom&board=homework")} className="btn-secondary inline-flex items-center gap-2">
                发布今日任务
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleStartTeaching();
                }}
                className="btn-primary inline-flex items-center gap-2"
                disabled={isStartingTeaching}
              >
                开始教学
                <ArrowRight className="h-4 w-4" />
              </button>
              {canEndActiveSession ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleEndSession();
                  }}
                  className="btn-secondary inline-flex items-center gap-2"
                  disabled={isEndingSession}
                >
                  {isEndingSession ? "Ending class..." : "End class"}
                </button>
              ) : null}
              <button type="button" onClick={onSwitchToStudent} className="btn-secondary inline-flex items-center gap-2">
                切换回学生视角
              </button>
            </div>
          </div>

          <div className="rounded-[28px] bg-white/88 px-5 py-5 shadow-[0_10px_28px_rgba(34,58,94,0.08)]">
            <p className="text-xs tracking-[0.14em] text-slate-500">课程导航</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              当前单元：{selectedUnit?.title || "等待教学单元"}。教师可以先选定单元，再开始精讲或分发任务。
            </p>
            <CurriculumNav
              sections={unitSections}
              selectedLabel={selectedUnit?.title || ""}
              onSelect={(item) => {
                setSelectedUnitId(item.id);
              }}
              className="mt-4"
            />
          </div>
        </section>
      </PageStage>

      <PageStage tone="secondary">
        <div className="grid gap-4 md:grid-cols-4">
          {teacherMetrics.map((item) => (
            <SectionCard key={item.label} density="roomy" weight="summary">
              <p className="text-xs tracking-[0.12em] text-slate-500">{item.label}</p>
              <p className="mt-3 font-serif text-3xl text-[#1A2B4C]">{item.value}</p>
              <p className="mt-2 text-sm text-slate-600">{item.note}</p>
            </SectionCard>
          ))}
        </div>
      </PageStage>

      <PageStage tone="secondary">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <SectionCard
            title="课堂快速入口"
            subtitle="围绕教师演示的主路径组织入口，先教什么、再跳到哪里，一目了然。"
            density="roomy"
            weight="workspace"
          >
            <div className="grid gap-3 md:grid-cols-2">
              {teacherQuickActions.map((action) => (
                <Link key={action.label} to={action.to} className="rounded-[22px] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5">
                  <p className="font-serif text-xl text-[#1A2B4C]">{action.label}</p>
                  <p className="mt-2 text-sm text-slate-600">从首页直接进入该教学环节。</p>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="班级概况"
            subtitle="先用真实课堂会话和教学单元数据表达教师视角，不引入完整班级后台。"
            density="roomy"
            weight="summary"
          >
            <div className="space-y-3">
              {teacherMetrics.slice(0, 3).map((item) => (
                <article key={item.label} className="rounded-[20px] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[#1A2B4C]">{item.label}</p>
                    <p className="font-serif text-2xl text-[#1A2B4C]">{item.value}</p>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.note}</p>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>
      </PageStage>

      <PageStage tone="detail">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(320px,0.94fr)]">
          <SectionCard title="班级总览" subtitle="班级聚合接口待接入，本轮不再展示伪造班级名单。">
            <article className="rounded-[22px] bg-white px-4 py-4 text-sm leading-7 text-slate-600 shadow-[0_8px_22px_rgba(34,58,94,0.06)]">
              当前仅展示真实课堂会话与教学单元数据。班级维度的学生列表、进度排行和导出报表将在班级聚合接口接入后启用。
            </article>
          </SectionCard>

          <SectionCard title="下一步建议" subtitle="把首页从 Landing 改成门厅后，教师在这里就能决定下一步。">
            <div className="space-y-3">
              <div className="rounded-[22px] bg-[linear-gradient(135deg,#FFF9EE_0%,#F3E7CE_100%)] px-4 py-4 text-sm leading-7 text-[#5A4B37] shadow-[0_10px_22px_rgba(34,58,94,0.05)]">
                {latestSession?.poemTitle
                  ? `建议先进入《${latestSession.poemTitle}》对应步骤继续推进，再发布一轮课堂练习，最后回到学情页做复盘。`
                  : selectedUnit?.title
                    ? `建议先从单元「${selectedUnit.title}」中选择一首诗开始精讲，再把练测和学情串成完整课堂闭环。`
                    : "建议先选定教学单元，再进入精讲页启动课堂流程。"}
              </div>
              <Link to="/my-learning" className="btn-primary-compact justify-center">
                打开班级学情页
              </Link>
            </div>
          </SectionCard>
        </div>
      </PageStage>
    </div>
  );
}

export default function HomePage(): JSX.Element {
  const { isTeacherMode, setTeachingMode } = useTeachingMode();
  const { user, initialized, initialize } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    if (!initialized || !user?.id) {
      return;
    }

    let active = true;
    void getUserRole()
      .then((payload) => {
        if (!active) {
          return;
        }
        const role = payload.role === "teacher" ? "teacher" : "student";
        setTeachingMode(role);
      })
      .catch(() => {
        // keep local teaching mode when role API is unavailable
      });

    return () => {
      active = false;
    };
  }, [initialized, setTeachingMode, user?.id]);

  const handleSwitchToStudent = (): void => {
    setTeachingMode("student");
  };

  const handleSwitchToTeacher = (): void => {
    setTeachingMode("teacher");
  };

  if (!initialized) {
    return (
      <div className="page-shell">
        <PageStage tone="primary">
          <section className="rounded-[28px] bg-white px-6 py-8 text-sm text-slate-500 shadow-[0_12px_32px_rgba(26,43,76,0.06)]">
            正在准备课堂门厅...
          </section>
        </PageStage>
      </div>
    );
  }

  if (!user) {
    return <GuestOverview />;
  }

  if (isTeacherMode) {
    return <TeacherOverviewHome onSwitchToStudent={handleSwitchToStudent} />;
  }

  return <StudentOverview displayName={getDisplayName(user)} onSwitchToTeacher={handleSwitchToTeacher} />;
}
