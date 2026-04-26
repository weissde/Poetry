import { SectionCard } from"@/components/common/SectionCard";
import { wrongbookWorkspaceLabelMap, type WrongbookWorkspaceTab } from"@/components/my-learning/wrongbookWorkspaceMeta";

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
 title="閿欓宸ヤ綔鍖"
 subtitle="鍏堢瓫閫変笌鎵归噺澶勭悊锛屽啀鍦ㄤ笂鏂圭劍鐐瑰尯鍒囨崲澶勭悊妯″紡銆"
 className="surface-card card-dense"
 bodyClassName="flow-sm"
 >
 <div className="flex flex-wrap items-center gap-2 text-xs">
 {(["list","insight","trend"] as WrongbookWorkspaceTab[]).map((mode) => (
 <span
 key={`workspace-mode-${mode}`}
 className={["rounded-full px-2 py-1",
 activeTab === mode ?" bg-ink-700 text-white" :" bg-slate-50/50 text-slate-500",
 ].join("")}
 >
 {wrongbookWorkspaceLabelMap[mode]}
 </span>
 ))}
 </div>

 <p className="text-xs text-slate-500">{activeDescription}</p>
 <p className="text-[11px] text-slate-400">妯″紡鍒囨崲鍏ュ彛宸查泦涓湪涓婃柟鈥滈敊棰樻湰鐒︾偣鈥濄€</p>
 </SectionCard>
 );
}


