import { Link } from "react-router-dom";
import { Brain, FileEdit, Sparkles } from "lucide-react";

interface TodaySectionProps {
  memoryCount: number;
  practiceCount: number;
  recommendedPoem: {
    id: string;
    title: string;
  } | null;
}

export function TodaySection({ memoryCount, practiceCount, recommendedPoem }: TodaySectionProps) {
  return (
    <section className="mx-auto w-full max-w-[920px]">
      <div className="grid gap-4 md:grid-cols-3">
        {/* 今日记忆提醒 */}
        <div className="group relative overflow-hidden rounded-[24px] bg-white p-6 shadow-[0_8px_22px_rgba(34,58,94,0.06)] transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Brain className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-medium text-[var(--ink-dark)]">记忆训练</h3>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold text-[var(--ink-dark)]">
                {memoryCount} <span className="text-sm font-normal text-[var(--ink-light)]">首待复习</span>
              </p>
            </div>
            <Link
              to="/memory"
              className="btn-secondary-compact rounded-lg px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50"
            >
              去复习
            </Link>
          </div>
        </div>

        {/* 待完成练习 */}
        <div className="group relative overflow-hidden rounded-[24px] bg-white p-6 shadow-[0_8px_22px_rgba(34,58,94,0.06)] transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <FileEdit className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-medium text-[var(--ink-dark)]">智能练习</h3>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold text-[var(--ink-dark)]">
                {practiceCount} <span className="text-sm font-normal text-[var(--ink-light)]">题待练测</span>
              </p>
            </div>
            <Link
              to="/practice"
              className="btn-secondary-compact rounded-lg px-4 py-2 text-sm text-amber-600 hover:bg-amber-50"
            >
              去练测
            </Link>
          </div>
        </div>

        {/* AI 推荐诗词 */}
        <div className="group relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#fcfaf5_0%,#f0e6d0_100%)] p-6 shadow-[0_8px_22px_rgba(200,169,110,0.15)] transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 text-[var(--warm-deep)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-medium text-[var(--ink-dark)]">AI 推荐诗词</h3>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-xl font-semibold text-[var(--ink-dark)]">
                {recommendedPoem ? `《${recommendedPoem.title}》` : "等待推荐"}
              </p>
            </div>
            <Link
              to={recommendedPoem ? `/learn/${recommendedPoem.id}` : "/explore"}
              className="btn-primary-compact rounded-lg bg-[var(--warm-primary)] px-4 py-2 text-sm text-white hover:bg-[var(--warm-deep)]"
            >
              {recommendedPoem ? "开始精讲" : "去探究"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
