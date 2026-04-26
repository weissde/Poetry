import type { ReactNode } from "react";

type PageHeaderVariant = "hero" | "standard" | "compact";

interface PageHeaderProps {
  kicker?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  variant?: PageHeaderVariant;
  className?: string;
}

const variantRootClassMap: Record<PageHeaderVariant, string> = {
  hero: "page-header-surface page-header-hero flow-md",
  standard: "page-header-surface page-header-standard flow-md",
  compact: "page-header-surface page-header-compact flow-sm",
};

const variantTitleClassMap: Record<PageHeaderVariant, string> = {
  hero: "page-header-title-hero",
  standard: "page-header-title-standard",
  compact: "page-header-title-compact",
};

const variantSubtitleClassMap: Record<PageHeaderVariant, string> = {
  hero: "page-header-subtitle page-header-subtitle-hero",
  standard: "page-header-subtitle page-header-subtitle-standard",
  compact: "page-header-subtitle page-header-subtitle-compact",
};

export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  variant = "standard",
  className = "",
}: PageHeaderProps): JSX.Element {
  return (
    <section data-header-variant={variant} className={[variantRootClassMap[variant], className].filter(Boolean).join(" ")}>
      <div>
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        <h1 className={["mt-1", variantTitleClassMap[variant]].join(" ")}>{title}</h1>
        {subtitle ? <p className={["mt-2 max-w-[760px]", variantSubtitleClassMap[variant]].join(" ")}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
