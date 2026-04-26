import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BlurText, Magnet } from "@/components/react-bits";

interface CourseCoverProps {
  title: string;
  subtitle: string;
  primaryAction: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  children?: React.ReactNode;
}

export function CourseCover({ title, subtitle, primaryAction, secondaryAction, children }: CourseCoverProps) {
  return (
    <section className="mx-auto max-w-[860px] rounded-[32px] bg-[linear-gradient(135deg,#1A2B4C_0%,#283F68_62%,#3C567E_100%)] px-6 py-12 text-center text-white shadow-[0_22px_48px_rgba(26,43,76,0.24)] md:px-10">
      <p className="text-xs tracking-[0.18em] text-white/70">唐宋诗词 AI 教学课件</p>
      <BlurText
        as="h1"
        text={title}
        className="mt-6 text-4xl font-semibold leading-tight md:text-5xl"
        delayPerChar={0.018}
      />
      <p className="mx-auto mt-6 max-w-[560px] text-base leading-8 text-white/82 md:text-lg">
        {subtitle}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Magnet className="inline-flex">
          {primaryAction.to ? (
            <Link
              to={primaryAction.to}
              className="btn-primary inline-flex items-center gap-2 bg-white px-6 py-3 text-base text-[#1A2B4C] hover:bg-stone-100"
            >
              {primaryAction.label}
              <ArrowRight className="h-5 w-5" />
            </Link>
          ) : (
            <button
              onClick={primaryAction.onClick}
              className="btn-primary inline-flex items-center gap-2 bg-white px-6 py-3 text-base text-[#1A2B4C] hover:bg-stone-100"
            >
              {primaryAction.label}
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
        </Magnet>

        {secondaryAction && (
          <Magnet className="inline-flex">
            {secondaryAction.to ? (
              <Link
                to={secondaryAction.to}
                className="btn-secondary inline-flex items-center gap-2 border-white/20 bg-white/10 px-6 py-3 text-base text-white hover:bg-white/16"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                onClick={secondaryAction.onClick}
                className="btn-secondary inline-flex items-center gap-2 border-white/20 bg-white/10 px-6 py-3 text-base text-white hover:bg-white/16"
              >
                {secondaryAction.label}
              </button>
            )}
          </Magnet>
        )}
        
        {children}
      </div>
    </section>
  );
}
