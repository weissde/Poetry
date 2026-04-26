import type { ReactNode } from "react";

type TeachingObjectiveCardVariant = "hero" | "panel";

interface TeachingObjectiveCardProps {
  variant?: TeachingObjectiveCardVariant;
  kicker: string;
  title: string;
  goals: readonly string[];
  meta?: string;
  summary?: string;
  chipLabel?: string;
  hint?: string;
  footer?: ReactNode;
  className?: string;
}

export function TeachingObjectiveCard({
  variant = "panel",
  kicker,
  title,
  goals,
  meta,
  summary,
  chipLabel,
  hint,
  footer,
  className = "",
}: TeachingObjectiveCardProps): JSX.Element {
  if (variant === "hero") {
    return (
      <aside className={["overview-objective-card", className].filter(Boolean).join(" ")}>
        <div className="overview-objective-head">
          <p className="overview-objective-kicker">{kicker}</p>
          {chipLabel ? <span className="overview-objective-chip">{chipLabel}</span> : null}
        </div>

        <h2 className="overview-objective-title">{title}</h2>
        {meta ? <p className="overview-objective-meta">{meta}</p> : null}

        <ul className="overview-objective-list">
          {goals.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        {footer ? <div className="overview-objective-footer">{footer}</div> : null}
      </aside>
    );
  }

  return (
    <article className={["teaching-objective-panel", className].filter(Boolean).join(" ")}>
      <div className="teaching-objective-panel-head">
        <p className="teaching-objective-panel-kicker">{kicker}</p>
        {chipLabel ? <span className="teaching-objective-panel-chip">{chipLabel}</span> : null}
      </div>

      <h3 className="teaching-objective-panel-title">{title}</h3>
      {summary ? <p className="teaching-objective-panel-summary">{summary}</p> : null}
      {meta ? <p className="teaching-objective-panel-meta">{meta}</p> : null}

      <div className="learn-objective-list">
        {goals.map((item) => (
          <div key={item} className="learn-objective-item">
            {item}
          </div>
        ))}
      </div>

      {hint ? (
        <div className="learn-teacher-hint">
          <p className="learn-goal-kicker">教学提示</p>
          <p>{hint}</p>
        </div>
      ) : null}
      {footer ? <div className="teaching-objective-panel-footer">{footer}</div> : null}
    </article>
  );
}
