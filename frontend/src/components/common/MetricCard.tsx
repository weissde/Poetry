import type { ReactNode } from "react";

type MetricCardVariant = "metric" | "meta";
type MetricCardAlign = "left" | "center";

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  variant?: MetricCardVariant;
  align?: MetricCardAlign;
  className?: string;
  valueClassName?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  variant = "metric",
  align = "left",
  className = "",
  valueClassName = "",
}: MetricCardProps): JSX.Element {
  const isMeta = variant === "meta";

  return (
    <article
      className={[
        isMeta ? "workspace-meta-item" : "metric-card",
        align === "center" ? "text-center" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className={isMeta ? "workspace-meta-label" : "metric-label"}>{label}</p>
      <p className={[isMeta ? "workspace-meta-value" : "metric-value", valueClassName].filter(Boolean).join(" ")}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </article>
  );
}
