import { motion } from "framer-motion";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

interface GoldRingProps {
  value: number;
  label: string;
  caption?: string;
  size?: number;
  strokeWidth?: number;
}

export function GoldRing({
  value,
  label,
  caption = "掌握率",
  size = 144,
  strokeWidth = 8,
}: GoldRingProps): JSX.Element {
  const { reduceMotion } = useMotionPreference();
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="-rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${caption} ${label}`}
      >
        <defs>
          <filter id="cinnabar-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="cinnabar-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C0392B" />
            <stop offset="50%" stopColor="#D85A4A" />
            <stop offset="100%" stopColor="#C0392B" />
          </linearGradient>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(192,57,43,0.08)"
          strokeWidth={strokeWidth}
        />

        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#cinnabar-ring-grad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ strokeDasharray: circumference }}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
        />

        <motion.circle
          cx={center}
          cy={center}
          r={radius - 2}
          fill="none"
          stroke="rgba(192,57,43,0.06)"
          strokeWidth={2}
          style={{ strokeDasharray: circumference }}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl leading-none text-cinnabar-500">{label}</p>
          <p className="mt-1 text-[10px] tracking-[0.14em] text-ink-500">{caption}</p>
        </div>
      </div>
    </div>
  );
}
