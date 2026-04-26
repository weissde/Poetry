import type { ReactNode } from "react";

interface TeacherHintCalloutProps {
  title: string;
  detail: string;
  action?: ReactNode;
  className?: string;
}

export function TeacherHintCallout({
  title,
  detail,
  action,
  className = "",
}: TeacherHintCalloutProps): JSX.Element {
  return (
    <aside
      className={[
        "rounded-[1.2rem] border-l-4 border-[#A0622B] bg-[linear-gradient(135deg,#FFF9EE_0%,#F5EAD5_100%)] px-4 py-4 text-[#4A3720] shadow-[0_10px_24px_rgba(34,58,94,0.06)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-[#8A6B32]">教师模式提示</p>
          <h3 className="mt-1 font-display text-xl text-[#2E3F5F]">{title}</h3>
          <p className="mt-2 text-sm leading-7 text-[#6B5A43]">{detail}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </aside>
  );
}
