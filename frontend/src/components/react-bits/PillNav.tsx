import { motion } from "framer-motion";
import type { ReactNode } from "react";

export interface PillNavItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface PillNavProps<T extends string = string> {
  items: readonly PillNavItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function PillNav<T extends string>({ items, value, onChange, className = "" }: PillNavProps<T>): JSX.Element {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={[
        "inline-flex flex-wrap gap-1 rounded-full bg-stone-100/90 p-1 shadow-[inset_0_1px_1px_rgba(26,43,76,0.06)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={[
              "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              active ? "text-white" : "text-slate-600 hover:text-slate-800",
            ].join(" ")}
          >
            {active ? (
              <motion.span
                layoutId="pill-nav-active-bg"
                className="absolute inset-0 rounded-full bg-[linear-gradient(120deg,#1A2B4C,#2D4572)] shadow-[0_8px_18px_rgba(26,43,76,0.25)]"
                transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.35 }}
              />
            ) : null}
            <span className="relative z-[1] inline-flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
