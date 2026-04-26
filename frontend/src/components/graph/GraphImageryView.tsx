import type { GraphNode, GraphEdge } from "@/types";

type NodeKind = "poet" | "imagery" | "dynasty" | "theme" | "title" | "error_type";

interface GraphImageryViewProps {
  imageryKeywords: GraphNode[];
  imageryGraphEdges: GraphEdge[];
  related: { kind: NodeKind; value: string } | null;
  loadRelatedPoems: (kind: NodeKind, value: string) => void;
}

export function GraphImageryView({
  imageryKeywords,
  imageryGraphEdges,
  related,
  loadRelatedPoems,
}: GraphImageryViewProps) {
  return (
    <article className="surface-card flow-md">
      <h2 className="font-display text-2xl text-ink-700">意象节点</h2>
      <p className="mt-2 text-xs text-slate-500">点击意象查看相关诗词。</p>
      <div className="mt-4 max-h-[320px] flow-sm overflow-auto">
        {imageryKeywords.map((node) => {
          const active = related?.kind === "imagery" && related.value === node.label;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => loadRelatedPoems("imagery", node.label)}
              className={[
                "w-full rounded-lg px-3 py-2 text-left text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)] transition",
                active
                  ? "bg-ink-700 text-white shadow-[inset_0_0_0_1px_rgba(26,43,76,0.62)]"
                  : "bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {node.label}
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 text-sm text-slate-500">意象关系（示例）</h3>
      <div className="mt-2 max-h-[180px] flow-sm overflow-auto">
        {imageryGraphEdges.slice(0, 50).map((edge, index) => (
          <button
            key={`${edge.source}-${edge.target}-${index}`}
            type="button"
            onClick={() => loadRelatedPoems("imagery", String(edge.source))}
            className="w-full rounded-lg bg-white px-3 py-2 text-left text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] transition hover:bg-slate-50"
          >
            {edge.source} → {String(edge.target).replace("poem:", "")}
          </button>
        ))}
      </div>
    </article>
  );
}
