import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { Card, EmptyState, Sparkline } from "@/components/ui";
import type { LearningWeeklyTrackViewModel } from "@/types/learning";

export function WeeklyTrack({ viewModel }: { viewModel: LearningWeeklyTrackViewModel }): JSX.Element {
  const hasHeatmap = viewModel.heatmap.cells.length > 0;
  const startDate = hasHeatmap ? new Date(viewModel.heatmap.cells[0].date) : new Date();
  const endDate = hasHeatmap ? new Date(viewModel.heatmap.cells[viewModel.heatmap.cells.length - 1].date) : new Date();

  return (
    <section className="mylearning-mast-weekly grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
      <Card title={viewModel.title} subtitle={viewModel.subtitle} contentClassName="space-y-4">
        <div className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs tracking-[0.14em] text-[#8A6B32]">
          {viewModel.scopeLabel}
        </div>
        {viewModel.trend.state === "empty" ? (
          <EmptyState
            title={viewModel.trend.fallback?.title || "暂无周趋势"}
            description={viewModel.trend.fallback?.description || "当前还没有可以绘制的趋势数据。"}
          />
        ) : (
          <>
            <Sparkline points={viewModel.trend.points} />
            <div className="rounded-[18px] bg-stone-50 px-4 py-3 text-sm leading-7 text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
              {viewModel.summaryLabel}
              {viewModel.trend.peakPointLabel ? ` 高点出现在 ${viewModel.trend.peakPointLabel}。` : ""}
            </div>
          </>
        )}
      </Card>

      <Card title={viewModel.heatmapTitle} subtitle={viewModel.heatmapSubtitle} contentClassName="space-y-4">
        {hasHeatmap ? (
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[560px]">
              <CalendarHeatmap
                startDate={startDate}
                endDate={endDate}
                values={viewModel.heatmap.cells.map((cell) => ({ date: cell.date, count: cell.count }))}
                classForValue={(value) => {
                  if (!value) {
                    return "color-empty";
                  }
                  return `color-scale-${Math.min(4, Math.max(1, Number(value.count) || 1))}`;
                }}
                titleForValue={(value) => (value?.date ? `${value.date} 活跃度: ${value.count}` : "无数据")}
                showWeekdayLabels={true}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            title={viewModel.heatmap.fallback?.title || "暂未生成每日热力图"}
            description={viewModel.heatmap.fallback?.description || "当前接口尚未提供每日粒度字段。"}
          />
        )}
      </Card>
    </section>
  );
}
