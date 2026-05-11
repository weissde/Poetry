type TagProps = {
  children: string;
  tone?: "ink" | "cinnabar" | "teal" | "jade";
};

const toneClass: Record<NonNullable<TagProps["tone"]>, string> = {
  ink: "bg-ink-900/5 text-ink-700",
  cinnabar: "bg-cinnabar-100 text-cinnabar-600",
  teal: "bg-ink-100 text-ink-700",
  jade: "bg-jade-500/10 text-jade-500",
};

export function Tag({ children, tone = "ink" }: TagProps) {
  return (
    <span
      className={`inline-flex h-6 px-2 rounded text-[12px] items-center font-medium ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

// 兼容旧接口
export { Tag as Badge };
