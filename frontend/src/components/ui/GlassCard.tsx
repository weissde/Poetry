import { cn } from "@/lib/cn";
import { type MotionProps, motion } from "framer-motion";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "paper" | "dark";
  goldBorder?: boolean;
  glow?: boolean;
  motion?: MotionProps;
}

const variantStyles = {
  glass:
    "bg-white/80 backdrop-blur-xl border border-ink-100/60",
  paper:
    "bg-paper-0 text-ink-deep border border-paper-200/60",
  dark:
    "bg-white border border-ink-100/60",
};

export function GlassCard({
  variant = "glass",
  goldBorder = false,
  glow = false,
  className,
  children,
  ...p
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl transition duration-300",
        variantStyles[variant],
        goldBorder &&
          "gold-border-subtle hover:gold-border-strong",
        glow && "shadow-gold",
        className,
      )}
      {...p}
    >
      {children}
    </div>
  );
}

export function GlassCardBody({
  className,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...p} />;
}
