import type { ReactNode } from "react";

type WorkspaceAsidePosition = "left" | "right";
type WorkspacePreset = "editor" | "analysis" | "control";

interface WorkspaceLayoutProps {
  aside: ReactNode;
  children: ReactNode;
  className?: string;
  asideClassName?: string;
  mainClassName?: string;
  colsClassName?: string;
  asidePosition?: WorkspaceAsidePosition;
  preset?: WorkspacePreset;
}

const presetColsClassMap: Record<WorkspacePreset, string> = {
  editor: "xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]",
  analysis: "xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]",
  control: "xl:grid-cols-[minmax(0,0.94fr)_minmax(360px,1.06fr)]",
};

export function WorkspaceLayout({
  aside,
  children,
  className = "",
  asideClassName = "",
  mainClassName = "",
  colsClassName,
  asidePosition = "left",
  preset = "editor",
}: WorkspaceLayoutProps): JSX.Element {
  const resolvedColsClassName = colsClassName || presetColsClassMap[preset];
  const asideNode = <aside className={["workspace-layout-aside flow-md", asideClassName].filter(Boolean).join(" ")}>{aside}</aside>;
  const mainNode = <main className={["workspace-layout-main flow-md", mainClassName].filter(Boolean).join(" ")}>{children}</main>;

  return (
    <div
      data-workspace-preset={preset}
      className={["workspace-layout grid grid-cols-1 gap-6", resolvedColsClassName, className].filter(Boolean).join(" ")}
    >
      {asidePosition === "left" ? (
        <>
          {asideNode}
          {mainNode}
        </>
      ) : (
        <>
          {mainNode}
          {asideNode}
        </>
      )}
    </div>
  );
}
