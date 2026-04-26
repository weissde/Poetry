export function LearningTrend({
  trendPolyline,
  trendChartPoints,
  overviewNarrative,
}: {
  trendPolyline: string;
  trendChartPoints: Array<{ x: number; y: number; value: number; label: string }>;
  overviewNarrative: string;
}): JSX.Element {
  return (
    <article className="rounded-[1.2rem] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
      <p className="learn-goal-kicker">掌握率趋势（近30天）</p>
      <svg viewBox="0 0 320 132" className="mt-4 w-full">
        <path d="M0 118 H320" stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
        <polyline fill="none" stroke="#C9A96E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={trendPolyline} />
        {trendChartPoints.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5.5" fill="#1A2B4C" />
            <text x={point.x} y={Math.max(16, point.y - 12)} textAnchor="middle" fontSize="11" fill="#5f7389">
              {point.value}%
            </text>
            <text x={point.x} y="128" textAnchor="middle" fontSize="11" fill="#6b7280">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-sm leading-7 text-slate-600">{overviewNarrative}</p>
    </article>
  );
}
