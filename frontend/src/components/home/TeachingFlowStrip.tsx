import { Link } from "react-router-dom";
import { BookOpen, Search, Edit3, Brain, PenTool, BarChart3, ChevronRight } from "lucide-react";

interface FlowStepProps {
  icon: React.ReactNode;
  label: string;
  status: "current" | "next" | "locked" | "done";
  link: string;
  isLast?: boolean;
}

function FlowStep({ icon, label, status, link, isLast }: FlowStepProps) {
  const isClickable = status === "current" || status === "done" || status === "next";

  const getColors = () => {
    switch (status) {
      case "current":
        return "bg-[var(--warm-primary)] text-white border-[var(--warm-primary)] shadow-md";
      case "done":
        return "bg-white text-[var(--ink-dark)] border-emerald-500/30";
      case "next":
        return "bg-white text-[var(--ink-medium)] border-stone-200 hover:border-[var(--warm-primary)]";
      case "locked":
        return "bg-stone-50 text-stone-400 border-stone-100 opacity-60";
    }
  };

  const getIndicator = () => {
    if (status === "done") {
      return <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">✓</div>;
    }
    if (status === "current") {
      return <div className="absolute -top-1 -right-1 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-amber-400 text-[10px] text-white shadow-sm" />;
    }
    return null;
  };

  const content = (
    <div className={`relative flex h-14 min-w-[120px] items-center justify-center gap-2 rounded-xl border px-4 transition-all duration-200 ${getColors()}`}>
      {getIndicator()}
      <div className={status === "current" ? "text-white" : "text-current opacity-80"}>
        {icon}
      </div>
      <span className="font-medium text-sm whitespace-nowrap">{label}</span>
      {status === "current" && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-[var(--warm-primary)]">
          ↑ 当前阶段
        </div>
      )}
    </div>
  );

  return (
    <div className="flex items-center gap-2 md:gap-4">
      {isClickable ? (
        <Link to={link} className="group relative block transition-transform hover:-translate-y-0.5">
          {content}
        </Link>
      ) : (
        <div className="relative block cursor-not-allowed">
          {content}
        </div>
      )}
      {!isLast && (
        <ChevronRight className="h-5 w-5 text-stone-300" />
      )}
    </div>
  );
}

interface TeachingFlowStripProps {
  currentStage?: "explore" | "lecture" | "inquiry" | "practice" | "memory" | "create" | "review";
}

const FLOW_STEPS = [
  { id: "explore", label: "探究发现", icon: <Search className="h-5 w-5" />, link: "/explore" },
  { id: "lecture", label: "诗词精讲", icon: <BookOpen className="h-5 w-5" />, link: "/learn" },
  { id: "practice", label: "练测评估", icon: <Edit3 className="h-5 w-5" />, link: "/practice" },
  { id: "memory", label: "记忆训练", icon: <Brain className="h-5 w-5" />, link: "/memory" },
  { id: "create", label: "创作天地", icon: <PenTool className="h-5 w-5" />, link: "/create" },
  { id: "review", label: "我的学情", icon: <BarChart3 className="h-5 w-5" />, link: "/my-learning" },
] as const;

export function TeachingFlowStrip({ currentStage = "explore" }: TeachingFlowStripProps) {
  const currentIndex = FLOW_STEPS.findIndex(s => s.id === currentStage);

  return (
    <section className="mx-auto w-full max-w-[920px] rounded-[24px] bg-white px-6 py-8 shadow-[0_12px_32px_rgba(26,43,76,0.06)] md:px-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-xl font-medium text-[var(--ink-dark)]">完整教学流</h2>
        <p className="text-sm text-[var(--ink-medium)]">AI 辅助，步步为营</p>
      </div>
      
      <div className="relative mt-4 flex w-full overflow-x-auto pb-8 pt-2 scrollbar-hide">
        <div className="flex min-w-max items-center gap-2 px-2 md:gap-4 md:px-4 mx-auto">
          {FLOW_STEPS.map((step, index) => {
            let status: FlowStepProps["status"] = "locked";
            
            if (index < currentIndex) {
              status = "done";
            } else if (index === currentIndex) {
              status = "current";
            } else if (index === currentIndex + 1) {
              status = "next";
            } else {
              // Usually all steps are clickable in navigation, but let's make them "next" or "locked" 
              // depending on what's available
              status = "next"; 
            }

            return (
              <FlowStep
                key={step.id}
                icon={step.icon}
                label={step.label}
                status={status}
                link={step.link}
                isLast={index === FLOW_STEPS.length - 1}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
