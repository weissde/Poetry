export const QUALITY_OPTIONS = [
  { value: 1, label: "忘记了", tone: "bg-red-50 text-red-700 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.2)]" },
  { value: 2, label: "较模糊", tone: "bg-orange-50 text-orange-700 shadow-[inset_0_0_0_1px_rgba(251,146,60,0.2)]" },
  { value: 3, label: "一般", tone: "bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.2)]" },
  { value: 4, label: "熟练", tone: "bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.2)]" },
  { value: 5, label: "非常熟", tone: "bg-green-50 text-green-700 shadow-[inset_0_0_0_1px_rgba(74,222,128,0.2)]" },
] as const;

interface MemoryRatingBarProps {
  onRate: (quality: number) => void;
  disabled?: boolean;
  submitting?: boolean;
  className?: string;
}

export function MemoryRatingBar({ onRate, disabled = false, submitting = false, className = "" }: MemoryRatingBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {QUALITY_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled || submitting}
          onClick={() => onRate(option.value)}
          className={[
            "rounded-lg px-3 py-1.5 text-xs transition font-sans",
            option.tone,
            (disabled || submitting) ? "cursor-not-allowed opacity-60" : "hover:brightness-95",
          ].join(" ")}
        >
          {submitting ? "提交中..." : option.label}
        </button>
      ))}
    </div>
  );
}
