import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { teachingFlowSteps } from "@/content/teachingStatic";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { useTeachingStore } from "@/stores/teachingStore";

const GLOBAL_TEACHING_STEPS = [
  { id: "step-0", index: "01", title: "总览", note: "课件导入", to: "/" },
  { id: "step-1", index: "02", title: "精讲", note: "诗词讲解", to: "/learn" },
  { id: "step-2", index: "03", title: "探究", note: "深度对话", to: "/explore" },
  { id: "step-3", index: "04", title: "练测", note: "练习测评", to: "/practice" },
  { id: "step-4", index: "05", title: "记忆", note: "复习打卡", to: "/practice?tab=memory" },
  { id: "step-5", index: "06", title: "学情", note: "复盘分析", to: "/my-learning" },
] as const;

export function inferStepFromRoute(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname.startsWith("/learn")) return 1;
  if (pathname.startsWith("/explore")) return 2;
  if (pathname.startsWith("/practice")) return 3;
  if (pathname.startsWith("/my-learning")) return 5;
  return -1; // graph / create 不归属步骤条
}

export function TeachingStepBarGlobal() {
  const { isTeacherMode } = useTeachingMode();
  const currentStepStore = useTeachingStore(state => state.currentStep);
  const location = useLocation();
  const navigate = useNavigate();

  const inferredStep = inferStepFromRoute(location.pathname);
  const actualCurrentStep = currentStepStore >= 0 ? currentStepStore : inferredStep;

  const [isExpanded, setIsExpanded] = useState(() => {
    if (isTeacherMode) return true;
    return localStorage.getItem('teaching_step_expanded') !== '0';
  });

  useEffect(() => {
    if (isTeacherMode) {
      setIsExpanded(true);
    }
  }, [isTeacherMode]);

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (!isTeacherMode) {
      localStorage.setItem('teaching_step_expanded', next ? '1' : '0');
    }
  };

  const barStyle = {
    height: isExpanded ? 40 : 0,
    backgroundColor: isTeacherMode ? 'var(--warm-50)' : 'var(--ink-50)',
    borderBottom: isExpanded ? `1px solid ${isTeacherMode ? 'var(--warm-100)' : 'var(--ink-100)'}` : 'none',
    overflow: 'hidden',
    transition: 'height 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={barStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', height: '100%', fontSize: '13px' }}>
          {GLOBAL_TEACHING_STEPS.map((step, idx) => {
            const isActive = idx === actualCurrentStep;
            const isCompleted = idx < actualCurrentStep;

            const color = isActive 
              ? (isTeacherMode ? 'var(--warm-700)' : 'var(--ink-700)') 
              : isCompleted 
                ? 'var(--success)' 
                : 'var(--neutral)';
            
            const borderBottom = isActive ? `2px solid ${isTeacherMode ? 'var(--warm-700)' : 'var(--ink-700)'}` : '2px solid transparent';
            const cursor = (isTeacherMode || isActive || isCompleted) ? 'pointer' : 'not-allowed';

            const handleClick = () => {
              if (isTeacherMode || isActive || isCompleted) {
                navigate(step.to);
              }
            };

            return (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div 
                  onClick={handleClick}
                  style={{ 
                    color, 
                    borderBottom, 
                    cursor,
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 4px',
                    boxSizing: 'border-box',
                    fontWeight: isActive ? 600 : 400
                  }}
                >
                  {isCompleted && <span style={{ marginRight: '4px' }}>鉁?</span>}
                  {step.title}
                </div>
                {idx < GLOBAL_TEACHING_STEPS.length - 1 && (
                  <span style={{ color: 'var(--neutral)', opacity: 0.5 }}>鈫?</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!isTeacherMode && (
        <button 
          onClick={toggleExpand}
          style={{
            position: 'absolute',
            right: '24px',
            bottom: isExpanded ? '-24px' : '-24px',
            background: 'var(--ink-50)',
            border: '1px solid var(--ink-100)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: '2px 12px',
            fontSize: '12px',
            color: 'var(--ink-700)',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          {isExpanded ? "收起步骤" : "展开步骤"}
        </button>
      )}
    </div>
  );
}

export interface TeachingStepBarItem {
  id: string;
  index: string;
  title: string;
  note: string;
  to?: string;
}

interface TeachingStepBarProps {
  currentIndex?: string;
  steps?: readonly TeachingStepBarItem[];
  activeId?: string;
  onStepChange?: (id: string) => void;
  kicker?: string;
  caption?: string;
  compact?: boolean;
  className?: string;
}

function toNumber(value: string | undefined): number {
  const parsed = Number(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function TeachingStepBar({
  currentIndex,
  steps,
  activeId,
  onStepChange,
  kicker = "教学步骤",
  caption = "围绕“导入、精讲、探究、练测、记忆、创作”组织学习流程。",
  compact = false,
  className = "",
}: TeachingStepBarProps): JSX.Element {
  const resolvedSteps: readonly TeachingStepBarItem[] =
    steps ||
    teachingFlowSteps.map((step) => ({
      id: step.index,
      index: step.index,
      title: step.title,
      note: step.note,
      to: step.to,
    }));

  const activeStepId =
    activeId ||
    resolvedSteps.find((item) => item.index === currentIndex)?.id ||
    resolvedSteps[0]?.id ||
    "";
  const activeOrder = resolvedSteps.findIndex((item) => item.id === activeStepId);
  const numericCurrent = toNumber(currentIndex);

  return (
    <section
      className={["teaching-step-shell", compact ? "teaching-step-shell-compact" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="teaching-step-header">
        <p className="teaching-step-kicker">{kicker}</p>
        <p className="teaching-step-caption">{caption}</p>
      </div>
      <div className="teaching-step-grid">
        {resolvedSteps.map((step, index) => {
          const active = step.id === activeStepId;
          const completed = numericCurrent > 0 ? toNumber(step.index) < numericCurrent : index < activeOrder;
          const classes = [
            "teaching-step-item",
            active ? "teaching-step-item-active" : "",
            completed ? "teacher-mode-stage-link-completed" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const content = (
            <>
              <span className="teaching-step-index">{step.index}</span>
              <span className="teaching-step-copy">
                <span className="teaching-step-title">{step.title}</span>
                <span className="teaching-step-note">{active ? "当前阶段" : completed ? "已完成" : step.note}</span>
              </span>
            </>
          );

          if (onStepChange) {
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onStepChange(step.id)}
                className={classes}
                aria-pressed={active}
              >
                {content}
              </button>
            );
          }

          if (step.to) {
            return (
              <Link key={step.id} to={step.to} className={classes}>
                {content}
              </Link>
            );
          }

          return (
            <div key={step.id} className={classes}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

