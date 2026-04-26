import { SpotlightCard } from "@/components/react-bits";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import type { HeatmapCell } from "@/lib/memoryUtils";

export function MemoryHeatmap({
  cells,
  streakDays,
  reviewedToday,
}: {
  cells: HeatmapCell[];
  streakDays: number;
  reviewedToday: number;
}): JSX.Element {
  const startDate = new Date(cells[0].dateKey);
  const endDate = new Date(cells[cells.length - 1].dateKey);
  
  const values = cells.map(cell => ({
    date: cell.dateKey,
    count: cell.level
  }));

  return (
    <SpotlightCard
      className="rounded-[28px] bg-white/95 p-5 shadow-[0_14px_40px_rgba(26,43,76,0.08)] md:p-6"
      spotlightColor="rgba(26,43,76,0.08)"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-sans tracking-[0.14em] text-slate-400">CONTRIBUTION RHYTHM</p>
          <h2 className="mt-1 font-serif text-2xl text-[#1A2B4C]">记忆打卡热力图</h2>
        </div>
        <div className="rounded-2xl bg-stone-100 px-3 py-2 text-right">
          <p className="text-[11px] font-sans text-slate-500">连续打卡</p>
          <p className="font-serif text-2xl text-[#1A2B4C]">{streakDays} 天</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          <CalendarHeatmap
            startDate={startDate}
            endDate={endDate}
            values={values}
            classForValue={(value) => {
              if (!value) {
                return "color-empty";
              }
              return `color-scale-${Math.min(4, Math.max(1, value.count))}`;
            }}
            titleForValue={(value) => {
              const dayCount = Number(value?.count ?? 0);
              return value?.date ? `${value.date} 活跃度: ${dayCount}/4` : "无数据";
            }}
            showWeekdayLabels={true}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-sans text-slate-500">今日完成 {reviewedToday} 条复习，保持节奏比突击更重要。</p>
      </div>
    </SpotlightCard>
  );
}
