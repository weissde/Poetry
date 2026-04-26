import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { BlurText, Magnet } from "@/components/react-bits";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

const STAGES = [
  { id: "explore", index: "01", title: "探索", note: "选诗与背景", to: "/explore" },
  { id: "learn", index: "02", title: "学习", note: "精讲与解析", to: "/learn" },
  { id: "practice", index: "03", title: "练测", note: "练习与测评", to: "/practice" },
  { id: "memory", index: "04", title: "记忆", note: "背诵与巩固", to: "/memory" },
  { id: "mylearning", index: "05", title: "学情", note: "诊断与复习", to: "/my-learning" },
] as const;

export type LearnJourneyStageId = (typeof STAGES)[number]["id"];

function resolveStageIndex(pathname: string): number | null {
  const p = pathname || "";
  if (p === "/explore" || p.startsWith("/explore/")) {
    return 0;
  }
  if (p === "/learn" || p.startsWith("/learn/")) {
    return 1;
  }
  if (p.startsWith("/practice") || p.startsWith("/exam")) {
    return 2;
  }
  if (p.startsWith("/memory")) {
    return 3;
  }
  if (p.startsWith("/my-learning")) {
    return 4;
  }
  return null;
}

interface LearnJourneyProgressProps {
  className?: string;
}

export function LearnJourneyProgress({ className = "" }: LearnJourneyProgressProps): JSX.Element {
  const location = useLocation();
  const { reduceMotion } = useMotionPreference();
  const currentIdx = resolveStageIndex(location.pathname);
  const progressPercent = currentIdx === null ? 0 : Math.round(((currentIdx + 1) / STAGES.length) * 100);

  return (
    <section
      className={[
        "rounded-2xl bg-gradient-to-r from-slate-50 to-stone-50 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="学习旅程"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs tracking-[0.12em] text-slate-500">学习旅程</p>
        {currentIdx === null ? (
          <span className="text-[11px] text-slate-400">点击环节继续学习</span>
        ) : (
          <span className="text-[11px] text-slate-500">
            第 {currentIdx + 1} 步 / 共 {STAGES.length} 步
          </span>
        )}
      </div>

      {currentIdx !== null ? (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
          {reduceMotion ? (
            <div className="h-full rounded-full bg-[#223A5E]" style={{ width: `${progressPercent}%` }} />
          ) : (
            <motion.div
              className="h-full rounded-full bg-[#223A5E]"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
            />
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {STAGES.map((stage, idx) => {
          const isActive = currentIdx !== null && idx === currentIdx;
          const isCompleted = currentIdx !== null && idx < currentIdx;
          const statusLabel = isActive ? "· 当前" : isCompleted ? "已完成" : "待开始";

          const inner = (
            <span
              className={[
                "inline-flex min-h-[2.5rem] flex-col justify-center rounded-2xl px-3 py-2 text-left text-xs transition",
                isActive
                  ? "bg-[#223A5E] text-white shadow-[0_8px_20px_rgba(34,58,94,0.18)]"
                  : isCompleted
                    ? "bg-white/90 text-[#1A2B4C] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)] hover:bg-white"
                    : "bg-white/60 text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]",
              ].join(" ")}
            >
              <span className={`font-semibold tracking-wide ${isActive ? "text-white" : ""}`}>
                {isActive && !reduceMotion ? (
                  <BlurText
                    as="span"
                    text={`${stage.index} ${stage.title}`}
                    className="font-semibold text-white"
                    delayPerChar={0.02}
                  />
                ) : (
                  `${stage.index} ${stage.title}`
                )}
              </span>
              <span
                className={["mt-0.5 text-[10px]", isActive ? "text-stone-200" : "text-slate-400"].join(" ")}
              >
                {statusLabel}
              </span>
            </span>
          );

          return (
            <Link key={stage.id} to={stage.to} className="inline-flex text-inherit no-underline">
              {isCompleted && !reduceMotion ? <Magnet strength={0.22}>{inner}</Magnet> : inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
