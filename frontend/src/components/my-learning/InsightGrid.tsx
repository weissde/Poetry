import { Card, EmptyState } from "@/components/ui";
import { StreamingInsight } from "@/components/my-learning/StreamingInsight";
import type { LearningInsightGridViewModel } from "@/types/learning";

interface InsightGridProps {
  viewModel: LearningInsightGridViewModel;
  loading: boolean;
  aiSource: string | null;
  learningSummaryError: string | null;
  aiLearningReportError: string | null;
}

export function InsightGrid({
  viewModel,
  loading,
  aiSource,
  learningSummaryError,
  aiLearningReportError,
}: InsightGridProps): JSX.Element {
  return (
    <section className="mylearning-mast-insights grid gap-5 xl:grid-cols-[minmax(0,0.96fr)_minmax(360px,1.04fr)]">
      <Card className="mylearning-mast-insight-panel" title={viewModel.title} subtitle={viewModel.subtitle} contentClassName="space-y-5">
        {viewModel.radar.state === "empty" ? (
          <EmptyState
            title={viewModel.radar.fallback?.title || "暂无维度画像"}
            description={viewModel.radar.fallback?.description || "当前学情摘要还不能生成维度画像。"}
          />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {viewModel.weakest ? (
                <article className="mylearning-mast-weak-card rounded-[16px] bg-[rgba(200,85,61,0.07)] px-4 py-4">
                  <p className="text-xs text-[#9C3F2C]">当前需要补齐</p>
                  <p className="mt-2 font-display text-2xl text-[#7C2D20]">{viewModel.weakest.label}</p>
                  <p className="mt-1 text-sm text-[#9C3F2C]">{viewModel.weakest.bucket || "维度掌握"} {viewModel.weakest.valueLabel}</p>
                </article>
              ) : null}
              {viewModel.strongest ? (
                <article className="mylearning-mast-strong-card rounded-[16px] bg-[rgba(26,138,122,0.08)] px-4 py-4">
                  <p className="text-xs text-[var(--teal-700)]">相对稳定项</p>
                  <p className="mt-2 font-display text-2xl text-ink-700">{viewModel.strongest.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{viewModel.strongest.bucket || "维度掌握"} {viewModel.strongest.valueLabel}</p>
                </article>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {viewModel.radar.items.map((item) => (
                <article key={item.id} className="mylearning-mast-insight-item rounded-[16px] bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-ink-700">{item.label}</span>
                    <span className="text-sm text-slate-500">{item.valueLabel}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--paper-200)]">
                    <div className="h-full rounded-full bg-[var(--teal-600)]" style={{ width: `${Math.max(4, Math.min(100, item.value))}%` }} />
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{item.description}</p>
                </article>
              ))}
            </div>

            {viewModel.radar.fallback ? (
              <div className="rounded-[16px] bg-stone-50 px-4 py-3 text-sm leading-6 text-slate-500">
                {viewModel.radar.fallback.description}
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card className="mylearning-mast-ai-panel" title="AI 学情解读" subtitle="聚合当前学习状态，直接给出下一步建议。" contentClassName="space-y-4">
        {learningSummaryError ? (
          <div className="rounded-[1rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
            学情总览接口暂不可用，当前已回退到页面内推断结果。原因：{learningSummaryError}
          </div>
        ) : null}
        {aiLearningReportError ? (
          <div className="rounded-[1rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
            AI 学情解读暂不可用，当前展示后端聚合的建议文本。原因：{aiLearningReportError}
          </div>
        ) : null}
        {viewModel.narrative.state === "empty" ? (
          <EmptyState
            title={viewModel.narrative.fallback?.title || "暂无可读摘要"}
            description={viewModel.narrative.fallback?.description || "当前学情摘要还不能生成文字洞察。"}
          />
        ) : (
          <StreamingInsight narrative={viewModel.narrative} loading={loading} source={aiSource} />
        )}
      </Card>
    </section>
  );
}
