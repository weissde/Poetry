import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

interface TiltedCardProps {
  className?: string;
  children?: ReactNode;
  maxTiltDeg?: number;
  onMouseMove?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

export function TiltedCard({
  className = "",
  children,
  maxTiltDeg = 8,
  onMouseMove,
  onMouseLeave,
}: TiltedCardProps): JSX.Element {
  const { reduceMotion } = useMotionPreference();
  const ref = useRef<HTMLDivElement | null>(null);
  const rotateXRaw = useMotionValue(0);
  const rotateYRaw = useMotionValue(0);
  const rotateX = useSpring(rotateXRaw, { stiffness: 220, damping: 22, mass: 0.4 });
  const rotateY = useSpring(rotateYRaw, { stiffness: 220, damping: 22, mass: 0.4 });

  if (reduceMotion) {
    return (
      <div className={className} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) {
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          rotateYRaw.set((x - 0.5) * maxTiltDeg * 2);
          rotateXRaw.set((0.5 - y) * maxTiltDeg * 2);
        }
        onMouseMove?.(event);
      }}
      onMouseLeave={(event) => {
        rotateXRaw.set(0);
        rotateYRaw.set(0);
        onMouseLeave?.(event);
      }}
    >
      {children}
    </motion.div>
  );
}
