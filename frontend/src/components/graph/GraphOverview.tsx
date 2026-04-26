import { Link } from "react-router-dom";
import type { GraphNode } from "@/types";

type NodeKind = "poet" | "imagery" | "dynasty" | "theme" | "title" | "error_type";

interface GraphOverviewProps {
  personalGraph: any;
  personalGroups: Record<string, GraphNode[]>;
  insightActions: any[];
  related: { kind: NodeKind; value: string } | null;
  relatedKindLabelMap: Record<string, string>;
  graphWorkspaceStats: any;
  relatedPoemsCount: number;
  openGraphWorkspace: (view: any, detailTab?: any) => void;
  loadRelatedPoems: (kind: NodeKind, value: string) => void;
  renderGroup: (title: string, nodes: GraphNode[]) => JSX.Element;
}

export function GraphOverview({
  personalGraph,
  personalGroups,
  insightActions,
  related,
  relatedKindLabelMap,
  graphWorkspaceStats,
  relatedPoemsCount,
  openGraphWorkspace,
  loadRelatedPoems,
  renderGroup,
}: GraphOverviewProps) {
  return (
    <section className="graph-primary-grid">
      <article className="surface-card flow-md">
        <h2 className="font-display text-2xl text-ink-700">我的薄弱图谱</h2>
        <p className="mt-2 text-xs text-slate-500">基于错题与练习记录自动生成，优先点击高频节点。</p>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <div className="metric-card p-2 text-center">
            <div className="text-[11px] text-slate-500">错题</div>
            <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.wrongCount ?? 0}</div>
          </div>
          <div className="metric-card p-2 text-center">
            <div className="text-[11px] text-slate-500">题型</div>
            <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.typeCount ?? 0}</div>
          </div>
          <div className="metric-card p-2 text-center">
            <div className="text-[11px] text-slate-500">朝代</div>
            <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.dynastyCount ?? 0}</div>
          </div>
          <div className="metric-card p-2 text-center">
            <div className="text-[11px] text-slate-500">题材</div>
            <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.themeCount ?? 0}</div>
          </div>
          <div className="metric-card p-2 text-center">
            <div className="text-[11px] text-slate-500">高频诗</div>
            <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.poemCount ?? 0}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {renderGroup("题型薄弱点", personalGroups.question_type || [])}
          {renderGroup("朝代薄弱点", personalGroups.dynasty || [])}
          {renderGroup("题材薄弱点", personalGroups.theme || [])}
          {renderGroup("高频错题诗名", personalGroups.poem || [])}
        </div>

        <article className="mt-4 rounded-lg bg-amber-50 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]">
          <h3 className="text-xs text-amber-800">今日建议动作</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {insightActions.map((action) => (
              <div key={action.key} className="flex items-center gap-1">
                <Link
                  to={action.to}
                  className="rounded px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100"
                  style={{ background: "var(--bg-surface)" }}
                >
                  {action.label}
                </Link>
                {action.kind && action.value ? (
                  <button
                    type="button"
                    onClick={() => loadRelatedPoems(action.kind as NodeKind, action.value as string)}
                    className="rounded bg-white px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100"
                  >
                    看关联诗词
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => openGraphWorkspace("details", "insights")}
              className="rounded bg-white px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100"
            >
              查看学习洞察
            </button>
          </div>
        </article>
      </article>

      <section className="surface-card card-cozy flow-md">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl text-ink-700">下一步建议</h2>
            <p className="text-xs text-slate-500">
              {related ? `已锁定：${relatedKindLabelMap[related.kind]} · ${related.value}` : "先锁定一个节点"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openGraphWorkspace("related")} className="btn-secondary-compact">
              去看关联诗词
            </button>
            <button type="button" onClick={() => openGraphWorkspace("details")} className="btn-secondary-compact">
              打开图谱详情
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]"
            style={{ background: "var(--bg-surface)" }}
          >
            <div className="text-[11px] text-slate-500">当前焦点</div>
            <div className="mt-1 line-clamp-1 text-sm text-ink-700">{graphWorkspaceStats.focusNode}</div>
          </div>
          <div
            className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]"
            style={{ background: "var(--bg-surface)" }}
          >
            <div className="text-[11px] text-slate-500">关联诗词候选</div>
            <div className="mt-1 text-sm text-ink-700">{relatedPoemsCount} 首</div>
          </div>
        </div>
      </section>
    </section>
  );
}
