import type { ReactNode } from "react";

interface CollapsibleWorkspaceSectionProps {
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
}

export function CollapsibleWorkspaceSection({
  title,
  description,
  badge = "已下沉",
  children,
}: CollapsibleWorkspaceSectionProps): JSX.Element {
  return (
    <details className="surface-card card-cozy">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-display text-xl text-ink-700">{title}</p>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
          <span className="text-xs text-slate-500">{badge}</span>
        </div>
      </summary>

      <div className="mt-4 flow-md">{children}</div>
    </details>
  );
}
