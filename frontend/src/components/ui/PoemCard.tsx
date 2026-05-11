import { Card, CardBody } from "./Card";

const dynastyHue: Record<string, number> = {
  唐: 18,
  宋: 200,
  元: 140,
  明: 280,
  清: 320,
  先秦: 40,
};

export function PoemCard({
  title,
  author,
  dynasty,
  tags,
  excerpt,
  onClick,
}: {
  title: string;
  author: string;
  dynasty: string;
  tags: string[];
  excerpt: string;
  onClick?: () => void;
}) {
  const hue = dynastyHue[dynasty] ?? 0;

  return (
    <Card
      variant="raised"
      className="group relative overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {/* 水墨装饰角 — 按朝代稳定映射 hue */}
      <svg
        aria-hidden
        className="absolute -right-6 -top-6 h-32 w-32 opacity-[0.07] transition group-hover:opacity-[0.12] group-hover:scale-110"
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="40" fill={`hsl(${hue} 30% 30%)`} />
        <circle cx="60" cy="40" r="25" fill="#0E1116" />
      </svg>
      <CardBody>
        <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-300">
          <span className="inline-block h-px w-4 bg-ink-300" /> Poem Entry
        </div>
        <h4 className="mt-3 font-display text-[22px] font-semibold tracking-tight text-ink-900">
          {title}
        </h4>
        <div className="mt-1 text-[12.5px] text-ink-500">
          <span className="font-display">{dynasty}</span> · {author}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] text-ink-700"
            >
              {t}
            </span>
          ))}
        </div>
        <p className="mt-4 line-clamp-2 font-serif text-[13.5px] leading-relaxed text-ink-700">
          {excerpt}
        </p>
        <div className="mt-5 flex items-center justify-between text-[12px]">
          <span className="text-ink-300">点击展开预览图谱</span>
          <span className="text-ink-700 group-hover:text-cinnabar-500 transition">
            展开 →
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
