import { cn } from "@/lib/cn";

export function InkBrushDecor({ className }: { className?: string }): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-auto right-0 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(192,57,43,0.08)_0%,rgba(192,57,43,0)_72%)]",
        className,
      )}
    />
  );
}
