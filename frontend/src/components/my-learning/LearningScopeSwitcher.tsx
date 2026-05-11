import { cn } from "@/lib/cn";
import type { LearningViewScope } from "@/types/learning";

const scopeOptions: Array<{ value: LearningViewScope; label: string; description: string }> = [
  { value: "daily", label: "日视图", description: "聚焦最近 7 天节奏" },
  { value: "weekly", label: "周视图", description: "默认查看近 4 周走势" },
  { value: "monthly", label: "月视图", description: "回看最近一个季度" },
];

interface LearningScopeSwitcherProps {
  value: LearningViewScope;
  onChange: (value: LearningViewScope) => void;
  className?: string;
}

export function LearningScopeSwitcher({ value, onChange, className }: LearningScopeSwitcherProps): JSX.Element {
  return (
    <section className={cn("rounded-[24px] bg-[linear-gradient(135deg,#FCFBF8_0%,#F6F0E6_100%)] p-4 shadow-[0_14px_30px_rgba(34,58,94,0.06)]", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-[#9A6731]">观察粒度</p>
          <h3 className="mt-1 font-display text-[1.2rem] text-ink-700">切换 AI 解读与学习轨迹</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">日视图更适合盯短周期连续性，周/月视图更适合看阶段趋势与回顾。</p>
        </div>
        <div className="inline-flex flex-wrap gap-2 rounded-full bg-white/88 p-1.5 shadow-[inset_0_0_0_1px_rgba(214,223,231,0.88)]">
          {scopeOptions.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={cn(
                  "rounded-full px-4 py-2 text-left transition-all duration-300",
                  active
                    ? "bg-[linear-gradient(135deg,#1A2B4C_0%,#2B4676_100%)] text-white shadow-[0_12px_24px_rgba(26,43,76,0.24)]"
                    : "text-slate-600 hover:bg-stone-100 hover:text-ink-700",
                )}
                aria-pressed={active}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className={cn("mt-0.5 block text-[11px]", active ? "text-white/76" : "text-slate-400")}>{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
