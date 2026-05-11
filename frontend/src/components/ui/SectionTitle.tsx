export function SectionTitle({
  kicker,
  title,
  desc,
  action,
}: {
  kicker?: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div>
        {kicker && (
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gold-500">
            {kicker}
          </div>
        )}
        <h2 className="font-display text-[26px] font-semibold tracking-tight text-text-primary">
          {title}
        </h2>
        {desc && (
          <p className="mt-1.5 max-w-[640px] text-[13.5px] leading-relaxed text-text-secondary">
            {desc}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
