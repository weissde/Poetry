import type { GraphTimelinePayload } from "@/types";

type NodeKind = "poet" | "imagery" | "dynasty" | "theme" | "title" | "error_type";

interface GraphTimelineViewProps {
  timelineGraph: GraphTimelinePayload | null;
  loadRelatedPoems: (kind: NodeKind, value: string) => void;
}

export function GraphTimelineView({ timelineGraph, loadRelatedPoems }: GraphTimelineViewProps) {
  return (
    <section className="surface-card flow-md">
      <h2 className="font-display text-2xl text-ink-700">朝代时间轴</h2>
      <p className="mt-2 text-xs text-slate-500">
        已收录 {timelineGraph?.totalPoems ?? 0} 首诗词，覆盖 {timelineGraph?.dynastyCount ?? 0} 个朝代。
      </p>

      {Array.isArray(timelineGraph?.items) && timelineGraph.items.length > 0 ? (
        <div className="mt-4 flow-sm">
          {timelineGraph.items.map((item) => {
            const maxCount = Math.max(...timelineGraph.items.map((row) => row.count), 1);
            const width = Math.max(8, Math.round((item.count / maxCount) * 100));
            return (
              <article
                key={`timeline-${item.dynasty}`}
                className="rounded-lg p-3 shadow-[0_10px_24px_rgba(26,43,76,0.08)]"
                style={{ background: "var(--bg-surface)" }}
              >
                <div className="flex items-center justify-between text-sm text-slate-700">
                  <button
                    type="button"
                    onClick={() => loadRelatedPoems("dynasty", item.dynasty)}
                    className="text-left text-ink-700 transition hover:text-ink-900"
                  >
                    {item.dynasty}
                  </button>
                  <span>{item.count} 首</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-ink-700" style={{ width: `${width}%` }} />
                </div>
                {item.topPoets.length > 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    代表诗人：{item.topPoets.map((poet) => `${poet.author}(${poet.count})`).join("、")}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">暂无时间轴数据。</p>
      )}
    </section>
  );
}
