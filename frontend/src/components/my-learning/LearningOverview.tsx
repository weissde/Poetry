import { motion } from "framer-motion";
import { BookCheck, Compass, Heart, Sparkles, Workflow } from "lucide-react";
import { BlurText, Magnet, PillNav, SpotlightCard } from "@/components/react-bits";
import { LearningTimeline } from "@/components/my-learning/LearningTimeline";

export type LearningTab = "overview" | "wrongbook" | "favorites" | "plan" | "diagnosis";

interface LearningOverviewProps {
  activeTab: LearningTab;
  onChangeTab: (tab: LearningTab) => void;
  onStartToday: () => void;
  wrongTotal: number;
  wrongPending: number;
  favoriteTotal: number;
  planPending: number;
  weakFocus: string;
  todayTaskTitle: string;
  todayTaskDescription: string;
  startLabel?: string;
  todayProgress?: number;
  titleText?: string;
}

function ProgressRing({ progress }: { progress: number }): JSX.Element {
  const clamped = Math.max(0, Math.min(100, progress));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative h-36 w-36">
      <svg className="-rotate-90" width="144" height="144" viewBox="0 0 144 144" role="img" aria-label={`今日任务完成 ${clamped}%`}>
        <circle cx="72" cy="72" r={radius} fill="none" stroke="#ECE7DD" strokeWidth="10" />
        <motion.circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke="#C9A96E"
          strokeWidth="10"
          strokeLinecap="round"
          style={{ strokeDasharray: circumference }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.95, ease: "easeOut" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-serif text-3xl leading-none text-[#1A2B4C]">{clamped}%</p>
          <p className="mt-1 font-sans text-[11px] tracking-[0.18em] text-gray-400">今日进度</p>
        </div>
      </div>
    </div>
  );
}

export function LearningOverview({
  activeTab,
  onChangeTab,
  onStartToday,
  wrongTotal,
  wrongPending,
  favoriteTotal,
  planPending,
  weakFocus,
  todayTaskTitle,
  todayTaskDescription,
  startLabel = "立即开始",
  todayProgress = 68,
  titleText = "我的学习",
}: LearningOverviewProps): JSX.Element {
  const tabItems = [
    { id: "overview", label: "学情总览", icon: <Sparkles className="h-3.5 w-3.5" /> },
    { id: "wrongbook", label: "我的错题本", icon: <BookCheck className="h-3.5 w-3.5" /> },
    { id: "favorites", label: "我的收藏", icon: <Heart className="h-3.5 w-3.5" /> },
    { id: "diagnosis", label: "薄弱诊断", icon: <Compass className="h-3.5 w-3.5" /> },
    { id: "plan", label: "AI复习计划", icon: <Workflow className="h-3.5 w-3.5" /> },
  ] as const;

  return (
    <section className="flow-lg">
      <SpotlightCard
        className="relative overflow-hidden rounded-[28px] bg-white p-6 shadow-[0_14px_42px_rgba(26,43,76,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_46px_rgba(26,43,76,0.1)] md:p-7"
        spotlightColor="rgba(26,43,76,0.1)"
      >
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(201,169,110,0.2)_0%,rgba(201,169,110,0)_72%)]" />
        <div className="pointer-events-none absolute -bottom-20 right-5 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(26,43,76,0.12)_0%,rgba(26,43,76,0)_74%)]" />

        <div className="relative z-[2] grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="flow-sm">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-stone-100 px-3 py-1 font-sans text-xs text-gray-500">
              <Sparkles className="h-3.5 w-3.5 text-[#C9A96E]" />
              今日焦点任务
            </span>
            <h1 className="font-serif text-3xl leading-tight text-[#1A2B4C] md:text-4xl">{titleText}</h1>
            <p className="font-serif text-xl leading-snug text-[#1A2B4C]/95">{todayTaskTitle}</p>
            <p className="font-sans text-sm leading-relaxed text-slate-500">{todayTaskDescription}</p>
            <BlurText text="且将新火试新茶，诗酒趁年华。" className="font-serif text-lg leading-relaxed text-[#1A2B4C]/85" />
          </div>

          <div className="flex flex-col items-center gap-5 lg:items-end">
            <ProgressRing progress={todayProgress} />
            <Magnet className="inline-flex">
              <button
                type="button"
                onClick={onStartToday}
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#1A2B4C,#2B4676)] px-6 py-3 font-sans text-sm font-medium text-white shadow-[0_10px_24px_rgba(26,43,76,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(26,43,76,0.36)]"
              >
                {startLabel}
              </button>
            </Magnet>
          </div>
        </div>
      </SpotlightCard>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SpotlightCard className="rounded-2xl bg-white p-4 shadow-[0_6px_22px_rgba(26,43,76,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(26,43,76,0.08)]" spotlightColor="rgba(26,43,76,0.08)">
          <p className="font-sans text-xs text-slate-400">待复习错题</p>
          <p className="mt-2 font-serif text-[36px] leading-none text-[#1A2B4C]">{wrongPending}</p>
          <p className="mt-2 font-sans text-xs text-slate-400">总量 {wrongTotal} 题</p>
        </SpotlightCard>

        <SpotlightCard className="rounded-2xl bg-white p-4 shadow-[0_6px_22px_rgba(26,43,76,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(26,43,76,0.08)]" spotlightColor="rgba(26,43,76,0.08)">
          <p className="font-sans text-xs text-slate-400">收藏诗词</p>
          <p className="mt-2 font-serif text-[36px] leading-none text-[#1A2B4C]">{favoriteTotal}</p>
          <p className="mt-2 font-sans text-xs text-slate-400">持续沉淀高频篇目</p>
        </SpotlightCard>

        <SpotlightCard className="rounded-2xl bg-white p-4 shadow-[0_6px_22px_rgba(26,43,76,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(26,43,76,0.08)]" spotlightColor="rgba(26,43,76,0.08)">
          <p className="font-sans text-xs text-slate-400">计划待完成</p>
          <p className="mt-2 font-serif text-[36px] leading-none text-[#1A2B4C]">{planPending}</p>
          <p className="mt-2 font-sans text-xs text-slate-400">优先高优先任务</p>
        </SpotlightCard>

        <SpotlightCard className="rounded-2xl bg-white p-4 shadow-[0_6px_22px_rgba(26,43,76,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(26,43,76,0.08)]" spotlightColor="rgba(26,43,76,0.08)">
          <p className="font-sans text-xs text-slate-400">当前薄弱点</p>
          <p className="mt-2 font-serif text-[36px] leading-none text-[#1A2B4C]">1</p>
          <p className="mt-2 font-sans text-xs text-slate-400">{weakFocus}</p>
        </SpotlightCard>
      </section>

      <SpotlightCard
        className="rounded-2xl bg-white p-4 shadow-[0_6px_22px_rgba(26,43,76,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(26,43,76,0.08)]"
        spotlightColor="rgba(26,43,76,0.08)"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-sans text-xs tracking-[0.14em] text-slate-400">工作区切换</p>
            <p className="mt-1 font-serif text-xl text-[#1A2B4C]">错题、收藏、诊断与计划统一入口</p>
          </div>
          <PillNav items={tabItems} value={activeTab} onChange={(next) => onChangeTab(next)} className="w-full justify-start md:w-auto" />
        </div>
      </SpotlightCard>

      <LearningTimeline />
    </section>
  );
}
