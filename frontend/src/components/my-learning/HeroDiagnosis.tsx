import { Sparkles } from "lucide-react";
import { Magnet } from "@/components/react-bits";
import { Badge, Button, Card, InkBrushDecor, RingProgress, StreakBadge } from "@/components/ui";
import type { LearningHeroViewModel } from "@/types/learning";

interface HeroDiagnosisProps {
  hero: LearningHeroViewModel;
  onStartToday: () => void;
  startLabel: string;
}

export function HeroDiagnosis({ hero, onStartToday, startLabel }: HeroDiagnosisProps): JSX.Element {
  return (
    <Card className="mylearning-mast-hero relative overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#FFFFFF_0%,#FCFBF8_100%)] p-0">
      <InkBrushDecor className="right-[-1rem] top-[-1rem]" />
      <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-7">
        <div className="space-y-4">
          <Badge tone="gold" className="gap-2 tracking-[0.12em]">
            <Sparkles className="h-3.5 w-3.5" />
            学情总览
          </Badge>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-[2rem] leading-tight text-ink-700 md:text-[2.35rem]">{hero.title}</h2>
              <StreakBadge days={hero.streakDays} />
            </div>
            <p className="text-sm leading-7 text-slate-500 md:text-[15px]">{hero.subtitle}</p>
          </div>
          <p className="max-w-3xl font-display text-xl leading-9 text-[#1A2B4C]/92">{hero.summary}</p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-stone-100 px-3 py-1.5">连续学习 {hero.streakDays} 天</span>
            <span className="rounded-full bg-stone-100 px-3 py-1.5">累计学习 {hero.poemCount} 首</span>
            <span className="rounded-full bg-stone-100 px-3 py-1.5">当前聚焦 {hero.weakFocusLabel}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-5 lg:items-end">
          <div className="rounded-[24px] bg-stone-50/90 px-5 py-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
            <RingProgress value={hero.ringValue} label={hero.ringLabel} />
          </div>
          <div className="space-y-3 text-center lg:text-right">
            <Badge tone="ink">{hero.badgeLabel}</Badge>
            <div>
              <p className="text-xs tracking-[0.14em] text-slate-400">NEXT STEP</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">先从今日任务入口回到练测或错题收束，继续维持当前节奏。</p>
            </div>
            <Magnet className="inline-flex">
              <Button onClick={onStartToday}>{startLabel}</Button>
            </Magnet>
          </div>
        </div>
      </div>
    </Card>
  );
}
