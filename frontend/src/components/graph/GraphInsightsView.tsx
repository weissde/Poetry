import { Link } from "react-router-dom";
import type { PersonalGraphInsightsPayload } from "@/types";

interface GraphInsightsViewProps {
  personalInsights: PersonalGraphInsightsPayload | null;
  activityPeak: number;
  learningBehaviorNodes: {
    key: string;
    label: string;
    value: number;
    to: string;
    colorClass: string;
  }[];
  buildWrongbookLink: (related: any) => string;
  setGraphDetailTab: (tab: "poet") => void;
}

export function GraphInsightsView({
  personalInsights,
  activityPeak,
  learningBehaviorNodes,
  buildWrongbookLink,
  setGraphDetailTab,
}: GraphInsightsViewProps) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <article className="surface-card flow-md">
        <h2 className="font-display text-2xl text-ink-700">学习洞察（近 7 天）</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded bg-ink-50 p-2 text-center">
            <div className="text-[11px] text-slate-500">练习</div>
            <div className="mt-1 text-sm text-ink-700">{personalInsights?.summary?.weeklyPractice ?? 0}</div>
          </div>
          <div className="rounded bg-ink-50 p-2 text-center">
            <div className="text-[11px] text-slate-500">错题新增</div>
            <div className="mt-1 text-sm text-ink-700">{personalInsights?.summary?.weeklyWrongAdded ?? 0}</div>
          </div>
          <div className="rounded bg-ink-50 p-2 text-center">
            <div className="text-[11px] text-slate-500">背诵复习</div>
            <div className="mt-1 text-sm text-ink-700">{personalInsights?.summary?.weeklyMemoryReview ?? 0}</div>
          </div>
          <div className="rounded bg-ink-50 p-2 text-center">
            <div className="text-[11px] text-slate-500">创作发布</div>
            <div className="mt-1 text-sm text-ink-700">{personalInsights?.summary?.weeklyCreations ?? 0}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
            <div className="text-[11px] text-slate-500">收藏诗词</div>
            <div className="mt-1 text-xs text-slate-700">{personalInsights?.summary?.favoritesCount ?? 0}</div>
          </div>
          <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
            <div className="text-[11px] text-slate-500">已掌握</div>
            <div className="mt-1 text-xs text-slate-700">{personalInsights?.summary?.masteredCount ?? 0}</div>
          </div>
          <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
            <div className="text-[11px] text-slate-500">公开作品</div>
            <div className="mt-1 text-xs text-slate-700">{personalInsights?.summary?.publicCreations ?? 0}</div>
          </div>
          <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
            <div className="text-[11px] text-slate-500">累计获赞</div>
            <div className="mt-1 text-xs text-slate-700">{personalInsights?.summary?.receivedLikes ?? 0}</div>
          </div>
        </div>

        <div className="mt-3">
          <h3 className="text-xs text-slate-500">日活跃走势</h3>
          <div className="mt-2 flow-sm">
            {(personalInsights?.activity?.items || []).map((item) => {
              const dayTotal =
                Number(item.practice || 0) + Number(item.wrongAdded || 0) + Number(item.memoryReview || 0) + Number(item.creation || 0);
              const width = Math.max(6, Math.round((dayTotal / Math.max(1, activityPeak)) * 100));
              return (
                <div key={`insight-day-${item.date}`} className="grid grid-cols-[86px_1fr_58px] items-center gap-2 text-[11px]">
                  <span className="text-slate-500">{item.date.slice(5)}</span>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-ink-700" style={{ width: `${width}%` }} />
                  </div>
                  <span className="text-right" style={{ color: 'var(--neutral)' }}>{dayTotal}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded px-2 py-1.5 text-[11px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}>
            题型焦点：{personalInsights?.focus?.questionType?.key || "暂无"}{" "}
            {typeof personalInsights?.focus?.questionType?.rate === "number" ? `(${personalInsights?.focus?.questionType?.rate}%)` : ""}
          </div>
          <div className="rounded px-2 py-1.5 text-[11px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}>
            朝代焦点：{personalInsights?.focus?.dynasty?.key || "暂无"}{" "}
            {typeof personalInsights?.focus?.dynasty?.rate === "number" ? `(${personalInsights?.focus?.dynasty?.rate}%)` : ""}
          </div>
          <div className="rounded px-2 py-1.5 text-[11px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}>
            题材焦点：{personalInsights?.focus?.theme?.key || "暂无"}{" "}
            {typeof personalInsights?.focus?.theme?.rate === "number" ? `(${personalInsights?.focus?.theme?.rate}%)` : ""}
          </div>
        </div>

        <div className="mt-3 rounded bg-amber-50 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]">
          <h3 className="text-xs text-amber-800">本周建议</h3>
          <ul className="mt-1 space-y-1">
            {(personalInsights?.recommendations || []).map((item, index) => (
              <li key={`insight-rec-${index}`} className="text-[11px] leading-5 text-amber-900">
                {index + 1}. {item}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to={buildWrongbookLink(null)} className="rounded px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100" style={{ background: 'var(--bg-surface)' }}>
              查看全部错题
            </Link>
            <button
              type="button"
              onClick={() => setGraphDetailTab("poet")}
              className="rounded bg-white px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100"
            >
              回到诗人网络
            </button>
          </div>
        </div>
      </article>

      <article className="surface-card flow-md">
        <h2 className="font-display text-2xl text-ink-700">学习行为图谱（近7天）</h2>
        <p className="mt-1 text-[11px] text-slate-500">将练习、记忆、创作与错题行为汇总成个人学习节点。</p>
        <div className="mt-3 rounded-lg bg-ink-50 p-3 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.2)]">
          <div className="flex items-center justify-center">
            <div className="rounded-full px-4 py-1.5 text-xs text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.22)]" style={{ background: 'var(--bg-surface)' }}>
              学习中心
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {learningBehaviorNodes.map((node) => (
              <Link
                key={`learning-node-${node.key}`}
                to={node.to}
                className={`rounded-lg px-3 py-2 text-xs transition hover:brightness-95 ${node.colorClass}`}
              >
                <div className="flex items-center justify-between">
                  <span>{node.label}</span>
                  <span>{node.value}</span>
                </div>
                <p className="mt-1 text-[10px] opacity-80">点击进入对应模块</p>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
