import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { BlurText, PillNav, type PillNavItem } from "@/components/react-bits";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import type { TeachingObjectiveItem } from "@/types";

type LearnStageId = "stage1" | "stage2" | "stage3" | "stage4" | "stage5";

interface LearnStageMeta {
  id: LearnStageId;
  index: string;
  title: string;
  note: string;
  summary: string;
}

interface LearnHeroProps {
  title: string;
  author: string;
  dynasty: string;
  poemId: string | undefined;
  isTeacherMode: boolean;
  activeStage: LearnStageId;
  studentObjectiveStage: LearnStageId;
  learnStages: readonly LearnStageMeta[];
  learnStageNavItems: readonly PillNavItem<LearnStageId>[];
  studentStageGoals: Record<LearnStageId, readonly string[]>;
  currentStageMeta: LearnStageMeta;
  studentPreviewStageMeta: LearnStageMeta;
  objective: TeachingObjectiveItem;
  teachingContentError: string | null;
  onStudentObjectiveStageChange: (id: LearnStageId) => void;
  onAdvance: () => void;
}

export default function LearnHero({
  title,
  author,
  dynasty,
  poemId,
  isTeacherMode,
  activeStage,
  studentObjectiveStage,
  learnStages,
  learnStageNavItems,
  studentStageGoals,
  currentStageMeta,
  studentPreviewStageMeta,
  objective,
  teachingContentError,
  onStudentObjectiveStageChange,
  onAdvance,
}: LearnHeroProps) {
  return (
    <>
      <LearnJourneyProgress className="mb-4" />

      {!isTeacherMode ? (
        <div className="mb-4 space-y-3">
          <PillNav
            items={learnStageNavItems}
            value={studentObjectiveStage}
            onChange={(id) => onStudentObjectiveStageChange(id)}
            className="max-w-full bg-white/80 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]"
          />
          <TeachingObjectiveCard
            variant="panel"
            kicker="学习目标（学生）"
            title={`${studentPreviewStageMeta.title} · 本阶段要达成`}
            summary={studentPreviewStageMeta.summary}
            goals={studentStageGoals[studentObjectiveStage]}
            chipLabel={`阶段 ${studentPreviewStageMeta.index} · ${title}`}
            className="shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
          />
        </div>
      ) : null}

      {isTeacherMode ? (
        <TeachingObjectiveCard
          variant="panel"
          kicker="教师目标提示"
          title={objective.title}
          summary={objective.summary}
          goals={objective.goals}
          chipLabel={`当前阶段 · ${currentStageMeta.title}`}
          hint={objective.teacherHint}
          className="shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
        />
      ) : null}

      {teachingContentError ? (
        <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
          教学数据暂未就绪：{teachingContentError}。当前仅展示最小空态提示，不再回退到页面伪目标。
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-[rgba(201,169,110,0.22)] bg-[linear-gradient(135deg,rgba(250,247,240,0.98)_0%,rgba(247,240,226,0.98)_50%,rgba(243,235,220,0.98)_100%)] px-6 py-6 shadow-[0_22px_46px_rgba(34,58,94,0.1)] lg:px-8 lg:py-8">
        <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="flex flex-col justify-center gap-4">
            <p className="text-[12px] font-semibold tracking-[0.22em] text-[#9B6731]">诗词精讲 · 五段课堂流</p>
            <BlurText as="h1" text={title} className="font-display text-5xl text-[#203754]" delayPerChar={0.02} />
            <p className="text-sm leading-7 text-slate-600">
              {author} · {dynasty}
              {poemId ? " · 当前正在精讲具体诗词" : " · 请从探索页选择一首诗词开始精讲"}
            </p>
            <p className="max-w-[60ch] text-base leading-8 text-[#4B627D]">
              这不是工具集合页，而是一首诗的完整教学旅程。先读原文，再做解析、探究、记忆和考点收束，让课堂和自学都能沿着同一条路径前进。
            </p>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={onAdvance}>
                进入解析
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <Link to="/explore" className="btn-secondary">
                去探索选诗
              </Link>
              <Link
                to={`/practice?topic=${encodeURIComponent(title)}&count=6&difficulty=medium&auto=1&source=learn`}
                className="btn-secondary"
              >
                直接练测
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              {learnStages.map((stage) => (
                <span
                  key={stage.id}
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs shadow-[0_8px_18px_rgba(34,58,94,0.05)]",
                    stage.id === activeStage ? "bg-[#223A5E] text-white" : "bg-white/90 text-slate-600",
                  ].join(" ")}
                >
                  {stage.index} · {stage.title}
                </span>
              ))}
            </div>
          </div>

          <TeachingObjectiveCard
            variant="hero"
            kicker="本课教学目标"
            title={objective.title}
            meta={`${title} · ${author}`}
            goals={objective.goals}
            chipLabel={isTeacherMode ? "教师视角" : "学生视角"}
            footer={
              <>
                <span>{currentStageMeta.summary}</span>
                <button type="button" className="overview-inline-link" onClick={onAdvance}>
                  {activeStage === "stage1" ? "从解析开始" : "继续当前学习"}
                </button>
              </>
            }
          />
        </div>
      </section>
    </>
  );
}
