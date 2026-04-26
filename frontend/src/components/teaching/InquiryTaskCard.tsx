import { Link } from "react-router-dom";
import type { InquiryTaskItem } from "@/types";

interface InquiryTaskCardProps {
  data: InquiryTaskItem;
  completionTo?: string;
  onPickQuestion: (question: string) => void;
  className?: string;
}

export function InquiryTaskCard({
  data,
  completionTo = "/practice",
  onPickQuestion,
  className = "",
}: InquiryTaskCardProps): JSX.Element {
  return (
    <section
      className={[
        "rounded-3xl bg-[linear-gradient(135deg,#FFFDF7_0%,#F5EDDF_100%)] p-5 shadow-[0_10px_28px_rgba(26,43,76,0.06)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div>
          <p className="learn-goal-kicker">探究任务卡</p>
          <h2 className="mt-2 font-serif text-3xl leading-tight text-[#1A2B4C]">{data.title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{data.prompt}</p>
        </div>
        <div className="flex items-start">
          <Link to={completionTo} className="btn-primary-compact justify-center">
            {data.completionCta}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {data.presetQuestions.map((question) => (
          <button
            key={question}
            type="button"
            className="rounded-2xl bg-white/95 px-4 py-3 text-left text-sm leading-7 text-slate-700 shadow-[0_4px_12px_rgba(26,43,76,0.04)] transition hover:-translate-y-0.5 hover:bg-white"
            onClick={() => onPickQuestion(question)}
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}
