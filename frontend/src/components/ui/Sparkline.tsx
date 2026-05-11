import { cn } from "@/lib/cn";

interface SparklinePoint {
  id: string;
  label: string;
  value: number;
  valueLabel: string;
  emphasis?: boolean;
}

interface SparklineProps {
  points: SparklinePoint[];
  className?: string;
}

export function Sparkline({ points, className }: SparklineProps): JSX.Element {
  const width = 320;
  const height = 120;

  if (points.length === 0) {
    return (
      <div className={cn("rounded-[20px] bg-stone-50 px-4 py-5 text-sm text-slate-500", className)}>
        暂无趋势数据。
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const chartPoints = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const ratio = max === min ? 0.5 : (point.value - min) / (max - min);
    const y = height - ratio * (height - 18) - 10;
    return { ...point, x, y };
  });
  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className={cn("rounded-[20px] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]", className)}>
      <svg viewBox="0 0 320 132" className="w-full">
        <path d="M0 118 H320" stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
        <polyline fill="none" stroke="#C0392B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
        {chartPoints.map((point) => (
          <g key={point.id}>
            <circle cx={point.x} cy={point.y} r={point.emphasis ? "6" : "5"} fill={point.emphasis ? "#C0392B" : "#1A8A7A"} />
            <text x={point.x} y={Math.max(16, point.y - 12)} textAnchor="middle" fontSize="11" fill="#5f7389">
              {point.valueLabel}
            </text>
            <text x={point.x} y="128" textAnchor="middle" fontSize="11" fill="#6b7280">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
