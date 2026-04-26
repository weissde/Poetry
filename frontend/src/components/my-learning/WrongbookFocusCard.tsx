import { SectionCard } from "@/components/common/SectionCard";
import type { WrongbookWorkspaceTab } from "@/components/my-learning/wrongbookWorkspaceMeta";

interface WrongbookFocusCardProps {
  total: number;
  pending: number;
  trendNet: number;
  workspaceLabel: string;
  onChangeWorkspace: (tab: WrongbookWorkspaceTab) => void;
}

export function WrongbookFocusCard({
  total,
  pending,
  trendNet,
  workspaceLabel,
  onChangeWorkspace,
}: WrongbookFocusCardProps): JSX.Element {
  return (
    <SectionCard className="surface-card card-dense" title="错题本焦点" subtitle="先决定本轮任务，再进入对应工作模式。" bodyClassName="flow-sm">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
          全量结果：{total} 题，待复习 {pending} 题。
        </p>
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
          趋势净变化：{trendNet >= 0 ? "+" : ""}
          {trendNet}（掌握 - 新增）
        </p>
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">当前模式：{workspaceLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary-compact" onClick={() => onChangeWorkspace("list")}>
          先处理错题列表
        </button>
        <button type="button" className="text-xs text-slate-500 transition hover:text-ink-700" onClick={() => onChangeWorkspace("insight")}>
          看统计弱点
        </button>
        <button type="button" className="text-xs text-slate-500 transition hover:text-ink-700" onClick={() => onChangeWorkspace("trend")}>
          看趋势变化
        </button>
      </div>
    </SectionCard>
  );
}
