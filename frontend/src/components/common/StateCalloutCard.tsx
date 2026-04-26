import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits";

export interface StateCalloutAction {
  label: string;
  to: string;
  variant?: "primary" | "secondary";
}

interface StateCalloutCardProps {
  eyebrow?: string;
  title: string;
  description: string;
  tone?: "neutral" | "warm" | "info" | "success";
  actions?: readonly StateCalloutAction[];
  className?: string;
}

const toneClassMap: Record<NonNullable<StateCalloutCardProps["tone"]>, string> = {
  neutral: "bg-stone-50 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16)]",
  warm: "bg-[linear-gradient(135deg,#FFF9EE_0%,#F3E7CE_100%)] shadow-[0_10px_22px_rgba(34,58,94,0.05)]",
  info: "bg-ink-50 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.16)]",
  success: "bg-emerald-50 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]",
};

export function StateCalloutCard({
  eyebrow,
  title,
  description,
  tone = "neutral",
  actions = [],
  className = "",
}: StateCalloutCardProps): JSX.Element {
  return (
    <SpotlightCard
      className={["rounded-[22px] px-5 py-5", toneClassMap[tone], className].filter(Boolean).join(" ")}
      spotlightColor="rgba(201,169,110,0.12)"
    >
      {eyebrow ? <p className="text-[11px] tracking-[0.16em] text-slate-500">{eyebrow}</p> : null}
      <h3 className="mt-1 font-serif text-2xl text-[#1A2B4C]">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
      {actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link
              key={`${action.label}-${action.to}`}
              to={action.to}
              className={[
                action.variant === "primary" ? "btn-primary-compact" : "btn-secondary-compact",
                "inline-flex items-center gap-2",
              ].join(" ")}
            >
              {action.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      ) : null}
    </SpotlightCard>
  );
}

