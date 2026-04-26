import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SectionCard } from "@/components/common/SectionCard";
import { Magnet, TiltedCard } from "@/components/react-bits";

export interface NextStepRecommendationItem {
  title: string;
  description: string;
  to: string;
  ctaLabel?: string;
  badge?: string;
}

interface NextStepRecommendationsProps {
  title?: string;
  subtitle?: string;
  items: readonly NextStepRecommendationItem[];
  className?: string;
}

export function NextStepRecommendations({
  title = "下一步推荐",
  subtitle = "完成当前环节后，继续把学习闭环往前推进。",
  items,
  className = "",
}: NextStepRecommendationsProps): JSX.Element {
  if (!items.length) {
    return <></>;
  }

  return (
    <SectionCard title={title} subtitle={subtitle} density="roomy" weight="support" className={className}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <TiltedCard key={`${item.title}-${item.to}`} className="h-full">
            <article className="flex h-full flex-col justify-between rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5">
              <div>
                {item.badge ? (
                  <p className="text-[11px] tracking-[0.16em] text-[#9B6B32]">{item.badge}</p>
                ) : null}
                <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
              <div className="mt-4">
                <Magnet className="inline-flex">
                  <Link to={item.to} className="btn-secondary-compact inline-flex items-center gap-2">
                    {item.ctaLabel || "立即前往"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Magnet>
              </div>
            </article>
          </TiltedCard>
        ))}
      </div>
    </SectionCard>
  );
}
