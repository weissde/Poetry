import type { CurriculumNavItem, CurriculumNavSection } from "@/types";

interface CurriculumNavProps {
  sections: readonly CurriculumNavSection[];
  selectedLabel?: string;
  onSelect: (item: CurriculumNavItem) => void;
  className?: string;
}

function joinClassNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function CurriculumNav({
  sections,
  selectedLabel,
  onSelect,
  className = "",
}: CurriculumNavProps): JSX.Element {
  return (
    <div className={joinClassNames("learn-unit-sections", className)}>
      {sections.map((section) => (
        <div key={section.title} className="learn-unit-block">
          <p className="learn-unit-title">{section.title}</p>
          <p className="learn-unit-caption">{section.caption}</p>
          <div className="learn-chip-wrap">
            {section.items.map((item) => {
              const active = selectedLabel === item.label;
              return (
                <button
                  key={`${section.title}-${item.label}`}
                  type="button"
                  className={joinClassNames("learn-chip", active && "learn-chip-active")}
                  onClick={() => onSelect(item)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
