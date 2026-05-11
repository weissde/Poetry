import { motion } from "framer-motion";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

interface RingProgressProps {
  value: number;
  label: string;
  caption?: string;
}

export function RingProgress({ value, label, caption = "近 30 天掌握率" }: RingProgressProps): JSX.Element {
  const { reduceMotion } = useMotionPreference();
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative h-36 w-36">
      <svg className="-rotate-90" width="144" height="144" viewBox="0 0 144 144" role="img" aria-label={`${caption} ${label}`}>
        <circle cx="72" cy="72" r={radius} fill="none" stroke="rgba(192,57,43,0.08)" strokeWidth="10" />
        <motion.circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke="url(#learning-ring-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          style={{ strokeDasharray: circumference }}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="learning-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C0392B" />
            <stop offset="100%" stopColor="#D85A4A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl leading-none text-cinnabar-500">{label}</p>
          <p className="mt-1 text-[11px] tracking-[0.14em] text-ink-500">{caption}</p>
        </div>
      </div>
    </div>
  );
}
