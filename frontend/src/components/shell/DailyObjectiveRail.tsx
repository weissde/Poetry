import { useLocation } from "react-router-dom";
import { useTeachingMode } from "@/contexts/useTeachingMode";

const STEPS = [
  { key: "overview", label: "总览" },
  { key: "learn", label: "精讲" },
  { key: "explore", label: "探究" },
  { key: "practice", label: "练测" },
  { key: "memory", label: "记忆" },
  { key: "my-learning", label: "学情" },
] as const;

const ROUTE_STEP: Record<string, number> = {
  "/learn": 1,
  "/explore": 2,
  "/practice": 3,
  "/create": 4,
  "/graph": 2,
  "/my-learning": 5,
};

export function DailyObjectiveRail() {
  const location = useLocation();
  const { currentStep } = useTeachingMode();

  // Hide on Home
  if (location.pathname === "/") return null;

  const activeIndex = ROUTE_STEP[location.pathname] ?? -1;

  return (
    <div className="flex h-9 items-center border-b border-ink-100/50 bg-paper-0/85 px-6 text-[12px] text-ink-700">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-cinnabar-500" />
        今日目标：
      </span>
      <ol className="ml-2 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1">
            <span
              className={
                i === activeIndex
                  ? "text-cinnabar-600 underline underline-offset-4 font-medium"
                  : i < activeIndex
                    ? "text-teal-600"
                    : "text-ink-300"
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-ink-200 mx-1">→</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
