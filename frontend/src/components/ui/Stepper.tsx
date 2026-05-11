type Step = {
  key: string;
  title: string;
  sub: string;
  status: "done" | "current" | "todo";
};

export function Stepper({
  steps,
  current,
}: {
  steps: Step[];
  current: string;
}) {
  return (
    <ol className="flex items-stretch gap-0">
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-1 items-stretch">
          <div className="flex flex-col items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-[11.5px] font-semibold tabular-nums transition ${
                s.status === "done"
                  ? "bg-teal-500 text-white shadow-[0_0_8px_rgba(26,138,122,0.3)]"
                  : s.status === "current"
                    ? "bg-cinnabar-500 text-white ring-4 ring-cinnabar-100"
                    : "border border-ink-200 text-ink-400 bg-white"
              }`}
            >
              {s.status === "done"
                ? "✓"
                : String(i + 1).padStart(2, "0")}
            </span>
            {i < steps.length - 1 && (
              <span
                className={`flex-1 w-px ${
                  s.status === "done" ? "bg-teal-500/40" : "bg-ink-200"
                }`}
              />
            )}
          </div>
          <div className="-mt-0.5 ml-3 mb-6">
            <div
              className={`text-[13.5px] font-semibold ${
                s.status === "current" ? "text-text-primary" : "text-text-secondary"
              }`}
            >
              {s.title}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-400">{s.sub}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
