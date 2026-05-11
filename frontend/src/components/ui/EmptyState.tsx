import { Button } from "./Button";

export function EmptyState({
  icon = "🪶",
  title,
  desc,
  description,
  action,
}: {
  icon?: string;
  title: string;
  desc?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const body = desc ?? description ?? "";
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-ink-100/60 text-2xl">
        {icon}
      </div>
      <h4 className="mt-4 font-display text-[17px] font-semibold text-text-primary">
        {title}
      </h4>
      <p className="mt-1.5 max-w-[360px] text-[13px] leading-relaxed text-text-secondary">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
