export function ProgressRing({ value }: { value: number }): JSX.Element {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative h-40 w-40">
      <svg className="h-40 w-40 -rotate-90" viewBox="0 0 140 140" aria-hidden>
        <circle cx="70" cy="70" r={radius} className="fill-none stroke-white/18" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          className="fill-none stroke-[#C9A96E]"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <p className="font-serif text-4xl text-white">{clamped}%</p>
        <p className="mt-1 text-[11px] font-sans tracking-[0.14em] text-white/70">今日完成度</p>
      </div>
    </div>
  );
}
