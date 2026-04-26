import type { HTMLAttributes } from "react";
import { useMemo, useRef, useState } from "react";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
}

export function SpotlightCard({
  className = "",
  children,
  spotlightColor = "rgba(26, 43, 76, 0.08)",
  onMouseMove,
  onMouseLeave,
  ...rest
}: SpotlightCardProps): JSX.Element {
  const { reduceMotion } = useMotionPreference();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const spotlightStyle = useMemo(
    () => ({
      background: `radial-gradient(240px circle at ${pointer.x}% ${pointer.y}%, ${spotlightColor}, transparent 70%)`,
      opacity: pointer.active ? 1 : 0,
      transition: "opacity 260ms ease",
    }),
    [pointer.active, pointer.x, pointer.y, spotlightColor],
  );

  if (reduceMotion) {
    return (
      <div ref={cardRef} className={["relative overflow-hidden", className].filter(Boolean).join(" ")} {...rest}>
        <div className="relative z-[2]">{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={["relative overflow-hidden", className].filter(Boolean).join(" ")}
      onMouseMove={(event) => {
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) {
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          setPointer({ x, y, active: true });
        }
        onMouseMove?.(event);
      }}
      onMouseLeave={(event) => {
        setPointer((prev) => ({ ...prev, active: false }));
        onMouseLeave?.(event);
      }}
      {...rest}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[1]" style={spotlightStyle} />
      <div className="relative z-[2]">{children}</div>
    </div>
  );
}

