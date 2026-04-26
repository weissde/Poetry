import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

interface MagnetProps {
  className?: string;
  children?: ReactNode;
  strength?: number;
  onMouseMove?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

export function Magnet({
  className = "",
  children,
  strength = 0.3,
  onMouseMove,
  onMouseLeave,
}: MagnetProps): JSX.Element {
  const { reduceMotion } = useMotionPreference();
  const ref = useRef<HTMLDivElement | null>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 250, damping: 20, mass: 0.25 });
  const y = useSpring(rawY, { stiffness: 250, damping: 20, mass: 0.25 });

  if (reduceMotion) {
    return (
      <div ref={ref} className={className} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x, y }}
      onMouseMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) {
          const relativeX = event.clientX - (rect.left + rect.width / 2);
          const relativeY = event.clientY - (rect.top + rect.height / 2);
          rawX.set(relativeX * strength);
          rawY.set(relativeY * strength);
        }
        onMouseMove?.(event);
      }}
      onMouseLeave={(event) => {
        rawX.set(0);
        rawY.set(0);
        onMouseLeave?.(event);
      }}
    >
      {children}
    </motion.div>
  );
}
