import { Badge } from "@/components/ui/Badge";

export function StreakBadge({ days }: { days: number }): JSX.Element {
  const tone = days >= 7 ? "gold" : days > 0 ? "ink" : "stone";
  const label = days >= 14 ? "连续打卡中" : days >= 7 ? "保持节奏" : days > 0 ? "已重新起步" : "等待第一天";
  return <Badge tone={tone}>{label}</Badge>;
}
