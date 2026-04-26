import { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface EmptyStateProps {
  icon: string | ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    to?: string;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warm-50 text-3xl shadow-[0_4px_12px_rgba(200,169,110,0.1)]">
        {typeof icon === "string" ? <span>{icon}</span> : icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mb-6 max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>
      
      {action && (
        action.to ? (
          <Link to={action.to} className="btn-primary">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="btn-primary">
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
