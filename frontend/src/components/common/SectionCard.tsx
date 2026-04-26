import type { ElementType, ReactNode } from "react";
import { SpotlightCard } from "@/components/react-bits";

type SectionDensity = "dense" | "cozy" | "default" | "roomy";
type SectionWeight = "task" | "summary" | "workspace" | "support";

interface SectionCardProps {
  as?: ElementType;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  density?: SectionDensity;
  weight?: SectionWeight;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

const densityClassMap: Record<SectionDensity, string> = {
  dense: "card-dense",
  cozy: "card-cozy",
  default: "card-default",
  roomy: "card-roomy",
};

const weightClassMap: Record<SectionWeight, string> = {
  task: "section-card-task",
  summary: "section-card-summary",
  workspace: "section-card-workspace",
  support: "section-card-support",
};

export function SectionCard({
  as,
  title,
  subtitle,
  actions,
  density = "default",
  weight = "workspace",
  className = "",
  bodyClassName = "",
  children,
}: SectionCardProps): JSX.Element {
  const Tag = (as || "section") as ElementType;

  return (
    <SpotlightCard
      className={["surface-card", densityClassMap[density], weightClassMap[weight], className].filter(Boolean).join(" ")}
      spotlightColor="rgba(26,43,76,0.08)"
    >
      <Tag data-card-density={density} data-card-weight={weight}>
        {title || actions ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {title ? <h3 className="block-title">{title}</h3> : null}
              {subtitle ? <p className="block-subtitle">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
        <div className={[title || actions ? "mt-3" : "", bodyClassName].filter(Boolean).join(" ")}>{children}</div>
      </Tag>
    </SpotlightCard>
  );
}
