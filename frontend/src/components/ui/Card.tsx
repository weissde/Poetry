import { cn } from "@/lib/cn";

type Variant = "plain" | "raised" | "feature";
type CardProps = {
  variant?: Variant;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  contentClassName?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export function Card({
  variant = "plain",
  className,
  children,
  title,
  subtitle,
  contentClassName,
  ...p
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-white transition",
        variant === "plain" && "border border-ink-100/70 shadow-xs hover:shadow-sm",
        variant === "raised" &&
          "border border-ink-100 shadow-sm hover:shadow-md hover:-translate-y-0.5",
        variant === "feature" &&
          "border border-cinnabar-200/60 shadow-md bg-gradient-to-br from-white to-paper-0",
        className,
      )}
      {...p}
    >
      {title || subtitle ? (
        <CardHeader title={title} desc={subtitle} />
      ) : null}
      <div className={cn(title || subtitle ? "p-6 pt-4" : undefined, contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function CardBody({
  className,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...p} />;
}

export function CardHeader({
  title,
  desc,
  extra,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-6">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-text-primary">
          {title}
        </h3>
        {desc && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
            {desc}
          </p>
        )}
      </div>
      {extra}
    </div>
  );
}
