import { SectionCard } from "@/components/common/SectionCard";
import { wrongbookWorkspaceLabelMap, type WrongbookWorkspaceTab } from "@/components/my-learning/wrongbookWorkspaceMeta";

interface WrongbookWorkspaceSummaryCardProps {
  activeTab: WrongbookWorkspaceTab;
  activeDescription: string;
}

export function WrongbookWorkspaceSummaryCard({
  activeTab,
  activeDescription,
}: WrongbookWorkspaceSummaryCardProps): JSX.Element {
  return (
    <SectionCard
      title="错题工作区"
      subtitle="在列表、分析和趋势之间切换，把错题处理成下一步行动。"
      className="surface-card card-dense"
      bodyClassName="flow-sm"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(["list", "insight", "trend"] as WrongbookWorkspaceTab[]).map((mode) => (
          <span
            key={`workspace-mode-${mode}`}
            className={[
              "rounded-full px-2 py-1",
              activeTab === mode ? " bg-ink-700 text-white" : " bg-slate-50/50 text-slate-500",
            ].join("")}
          >
            {wrongbookWorkspaceLabelMap[mode]}
          </span>
        ))}
      </div>

      <p className="text-xs text-slate-500">{activeDescription}</p>
      <p className="text-[11px] text-slate-400">根据当前视图集中处理错因、薄弱点和复习节奏。</p>
    </SectionCard>
  );
}
