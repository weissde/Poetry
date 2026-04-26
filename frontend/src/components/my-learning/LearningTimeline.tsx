import { motion } from "framer-motion";
import { BookOpen, Brain, PenSquare, Workflow } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits";

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  type: "learn" | "practice" | "create" | "review";
}

const eventIconMap = {
  learn: <BookOpen className="h-4 w-4" />,
  practice: <Brain className="h-4 w-4" />,
  create: <PenSquare className="h-4 w-4" />,
  review: <Workflow className="h-4 w-4" />,
};

const eventColorMap = {
  learn: "bg-blue-50 text-blue-600 border-blue-200",
  practice: "bg-emerald-50 text-emerald-600 border-emerald-200",
  create: "bg-purple-50 text-purple-600 border-purple-200",
  review: "bg-amber-50 text-amber-600 border-amber-200",
};

interface LearningTimelineProps {
  events?: TimelineEvent[];
}

export function LearningTimeline({ events }: LearningTimelineProps): JSX.Element {
  const displayEvents = events || [];

  return (
    <SpotlightCard
      className="mt-4 rounded-[28px] bg-white p-6 shadow-[0_14px_42px_rgba(26,43,76,0.06)] md:p-7"
      spotlightColor="rgba(26,43,76,0.06)"
    >
      <div className="mb-6">
        <p className="text-[11px] font-sans tracking-[0.14em] text-slate-400">LEARNING TRACK</p>
        <h2 className="mt-1 font-serif text-2xl text-[#1A2B4C]">本周学习轨迹</h2>
      </div>

      {displayEvents.length === 0 ? (
        <div className="rounded-[20px] bg-stone-50 px-4 py-8 text-center text-sm text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
          完成精讲、练测或创作后，学习事件将在此展示。
        </div>
      ) : (
        <div className="relative border-l border-slate-100 pl-6 md:pl-8">
          {displayEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="mb-8 last:mb-0 relative"
            >
              <span
                className={`absolute -left-[37px] md:-left-[45px] flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm ${
                  eventColorMap[event.type]
                }`}
              >
                {eventIconMap[event.type]}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-sans text-slate-400">{event.time}</span>
                <h3 className="font-serif text-lg text-[#1A2B4C]">{event.title}</h3>
                <p className="text-sm font-sans text-slate-500">{event.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </SpotlightCard>
  );
}
