import type { ElementType, ReactNode } from "react";

type PageStageTone = "primary" | "secondary" | "detail";

interface PageStageProps {
  as?: ElementType;
  tone?: PageStageTone;
  id?: string;
  className?: string;
  children?: ReactNode;
}

const toneClassMap: Record<PageStageTone, string> = {
  primary: "page-stage page-stage-primary",
  secondary: "page-stage page-stage-secondary",
  detail: "page-stage page-stage-detail",
};

export function PageStage({
  as,
  tone = "secondary",
  id,
  className = "",
  children,
}: PageStageProps): JSX.Element {
  const Tag = (as || "section") as ElementType;

  return (
    <Tag id={id} data-page-stage={tone} className={[toneClassMap[tone], className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}
