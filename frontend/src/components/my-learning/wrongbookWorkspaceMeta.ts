export type WrongbookWorkspaceTab = "list" | "insight" | "trend";

export const wrongbookWorkspaceLabelMap: Record<WrongbookWorkspaceTab, string> = {
  list: "错题列表处理",
  insight: "结果统计分析",
  trend: "趋势追踪复盘",
};

export const wrongbookWorkspaceDescriptionMap: Record<WrongbookWorkspaceTab, string> = {
  list: "列表视图聚焦处理动作，适合快速复盘并修改状态。",
  insight: "统计视图聚焦高频弱点，适合制定下一轮练习方向。",
  trend: "趋势视图聚焦变化轨迹，适合观察复习是否在产生改善。",
};
