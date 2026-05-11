import type { LearningInsightNarrativeViewModel } from "@/types/learning";

export function StreamingInsight({
  narrative,
  loading,
  source,
}: {
  narrative: LearningInsightNarrativeViewModel;
  loading: boolean;
  source: string | null;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <article className="rounded-[1.2rem] bg-[linear-gradient(135deg,#FFF9EE_0%,#F3E7CE_100%)] px-4 py-4 shadow-[0_10px_22px_rgba(34,58,94,0.05)]">
        <p className="learn-goal-kicker">{narrative.sections[0]?.title || "AI 学情解读"}</p>
        <p className="mt-2 text-sm leading-7 text-[#5A4B37]">
          {loading ? "正在流式生成学情解读..." : narrative.sections[0]?.detail || narrative.headline}
        </p>
        {source ? <p className="mt-2 text-xs text-[#8A6B32]">来源：{source}</p> : null}
      </article>
      {narrative.sections.slice(1).map((section) => (
        <article key={section.id} className="rounded-[1.2rem] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
          <p className="learn-goal-kicker">{section.title}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">{section.detail}</p>
        </article>
      ))}
    </div>
  );
}
