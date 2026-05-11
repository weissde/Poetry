import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeTone = "ink" | "gold" | "vermillion" | "emerald" | "stone";

const toneClassMap: Record<BadgeTone, string> = {
  ink: "bg-ink-100/60 text-ink-700",
  gold: "bg-cinnabar-50 text-cinnabar-600",
  vermillion: "bg-cinnabar-100 text-cinnabar-600",
  emerald: "bg-teal-50 text-teal-600",
  stone: "bg-ink-200/50 text-ink-500",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "stone", className, children, ...rest }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-normal",
        toneClassMap[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
