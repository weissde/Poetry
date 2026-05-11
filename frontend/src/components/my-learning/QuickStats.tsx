import { AnimatedMetricValue } from "@/components/common/AnimatedMetricValue";
import { Card } from "@/components/ui";
import type { LearningQuickStatViewModel } from "@/types/learning";

const toneClassMap: Record<LearningQuickStatViewModel["tone"], string> = {
  ink: "from-[rgba(34,58,94,0.08)] to-white",
  gold: "from-[rgba(200,155,90,0.12)] to-white",
  vermillion: "from-[rgba(200,85,61,0.12)] to-white",
  emerald: "from-[rgba(46,125,85,0.10)] to-white",
};

export function QuickStats({ items }: { items: LearningQuickStatViewModel[] }): JSX.Element {
  return (
    <section className="mylearning-mast-quickstats grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <Card
          key={item.id}
          className={`mylearning-mast-stat-card min-h-[132px] bg-[linear-gradient(160deg,var(--tw-gradient-from),var(--tw-gradient-to))] ${toneClassMap[item.tone]}`}
          contentClassName="space-y-3"
        >
          <p className="text-xs tracking-[0.08em] text-slate-500">{item.label}</p>
          <AnimatedMetricValue value={item.value} className="font-display text-[2.15rem] leading-none text-ink-700" durationMs={920 + index * 120} />
          <p className="text-xs leading-6 text-slate-500">{item.detail}</p>
        </Card>
      ))}
    </section>
  );
}
