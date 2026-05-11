import { cn } from "@/lib/cn";

const styles = {
  primary: "bg-cinnabar-500 text-white hover:bg-cinnabar-600 shadow-cinnabar",
  cinnabar: "bg-cinnabar-500 text-white hover:bg-cinnabar-600 shadow-cinnabar",
  secondary: "bg-white border border-ink-100 text-ink-800 hover:border-cinnabar-300 hover:bg-cinnabar-50",
  ghost: "text-text-secondary hover:bg-paper-50 hover:text-ink-deep",
  link: "text-cinnabar-500 hover:text-cinnabar-600 underline underline-offset-4",
} as const;

const sizes = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-5 text-[14px]",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...p
}: {
  variant?: keyof typeof styles;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-40 disabled:cursor-not-allowed",
        styles[variant],
        sizes[size],
        className,
      )}
      {...p}
    >
      {icon}
      {children}
    </button>
  );
}
