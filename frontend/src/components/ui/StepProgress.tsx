import { cn } from "@/lib/cn";

export interface Step {
  key: string;
  label: string;
  status: "done" | "current" | "todo";
}

interface StepProgressProps {
  steps: Step[];
  className?: string;
}

export function StepProgress({ steps, className }: StepProgressProps) {
  return (
    <div className={cn("flex items-center gap-0", className)}>
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-all duration-300",
                s.status === "done" &&
                  "bg-teal-500 text-white shadow-[0_0_12px_rgba(26,138,122,0.3)]",
                s.status === "current" &&
                  "bg-cinnabar-500 text-white ring-4 ring-cinnabar-100 shadow-cinnabar",
                s.status === "todo" &&
                  "border border-ink-300 text-ink-400 bg-white",
              )}
            >
              {s.status === "done" ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </div>
            <span
              className={cn(
                "mt-1.5 text-[10px] whitespace-nowrap tracking-wider",
                s.status === "done" && "text-teal-500",
                s.status === "current" && "text-cinnabar-500 font-medium",
                s.status === "todo" && "text-ink-400",
              )}
            >
              {s.label}
            </span>
          </div>

          {i < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 h-px mx-2 mt-[-18px]",
                s.status === "done"
                  ? "bg-teal-500/40"
                  : "bg-ink-200",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
