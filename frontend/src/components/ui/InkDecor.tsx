import { cn } from "@/lib/cn";

interface InkDecorProps {
  variant?: "dot" | "smear" | "circle";
  className?: string;
}

export function InkDecor({ variant = "circle", className }: InkDecorProps) {
  if (variant === "dot") {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute w-1 h-1 rounded-full bg-cinnabar-500/20",
          className,
        )}
      />
    );
  }

  if (variant === "smear") {
    return (
      <svg
        aria-hidden
        className={cn("pointer-events-none absolute", className)}
        width="120"
        height="80"
        viewBox="0 0 120 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 40 Q30 10 60 20 Q90 30 110 15"
          stroke="rgba(192,57,43,0.08)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="30" cy="25" r="3" fill="rgba(192,57,43,0.06)" />
        <circle cx="85" cy="22" r="4" fill="rgba(192,57,43,0.05)" />
      </svg>
    );
  }

  // circle variant (default) - ink wash circle
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full",
        "bg-[radial-gradient(circle,rgba(192,57,43,0.06)_0%,rgba(192,57,43,0.03)_40%,transparent_70%)]",
        className,
      )}
    />
  );
}
