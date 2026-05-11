import { Card, CardBody } from "./Card";

export function Stat({
  label,
  value,
  unit,
  delta,
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { v: number; positive?: boolean };
  hint?: string;
}) {
  return (
    <Card variant="plain">
      <CardBody>
        <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-gold-500/60">
          {label}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-display text-[32px] font-semibold tabular-nums leading-none text-text-primary">
            {value}
          </span>
          {unit && <span className="text-[13px] text-text-secondary">{unit}</span>}
          {delta && (
            <span
              className={`ml-1 text-[11.5px] tabular-nums ${
                delta.positive ? "text-jade-500" : "text-cinnabar-500"
              }`}
            >
              {delta.positive ? "↑" : "↓"}
              {Math.abs(delta.v)}%
            </span>
          )}
        </div>
        {hint && <div className="mt-2 text-[12px] text-text-secondary">{hint}</div>}
      </CardBody>
    </Card>
  );
}
