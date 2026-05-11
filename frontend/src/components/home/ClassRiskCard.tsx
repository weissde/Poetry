import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import type { ClassTriageItem } from "@/hooks/useClassTriage";

const riskLabels: Record<ClassTriageItem["risk"], string> = {
  red: "需立即介入",
  yellow: "待关注",
  green: "节奏正常",
} as const;

export function ClassRiskCard({
  item,
  rank,
}: {
  item: ClassTriageItem;
  rank: number;
}) {
  const hasTopRisk = item.risk === "red" && rank === 1;

  return (
    <Link
      to={item.primaryActionHref}
      className={cn(
        "group block rounded-2xl border transition no-underline",
        rank === 1 && item.risk === "red"
          ? "border-ink-200/50 shadow-md bg-gradient-to-br from-paper-0 to-paper-50 hover:shadow-lg hover:-translate-y-0.5"
          : "border-ink-100/70 shadow-sm bg-paper-0 hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      <div className="p-6">
        {/* Risk badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              item.risk === "red" && "bg-cinnabar-500",
              item.risk === "yellow" && "bg-amber-500",
              item.risk === "green" && "bg-jade-500",
            )}
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-300">
            {riskLabels[item.risk]}
          </span>
        </div>

        {/* Class name */}
        <h3 className="mt-3 font-display text-[20px] font-semibold tracking-tight text-ink-900">
          {item.name}
        </h3>
        <div className="mt-0.5 text-[12.5px] text-ink-500">
          {item.studentCount} 人 · 进度 {item.progress}%
        </div>

        {/* Actionable insight */}
        <p className="mt-4 text-[13px] leading-relaxed text-text-secondary line-clamp-2">
          {item.actionableInsight}
        </p>

        {/* Primary action button */}
        <div className="mt-5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
              hasTopRisk
                ? "bg-cinnabar-500 text-paper-0 hover:bg-cinnabar-600 shadow-xs"
                : "border border-gold-500/20 text-gold-400 hover:bg-gold-300/10 bg-transparent",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {item.primaryActionLabel} →
          </span>
        </div>
      </div>
    </Link>
  );
}
