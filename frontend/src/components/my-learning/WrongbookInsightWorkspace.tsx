import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";
import type { WrongDimensionStat, WrongQuestionRow } from "@/components/my-learning/wrongbookTypes";

interface KeywordWeakRow {
  key: string;
  attempts: number;
  rate: number;
}

interface SubjectivePracticeLinkOptions {
  status?: "all" | "pending" | "mastered" | "retry";
  dynasty?: string;
  theme?: string;
  keywordTag?: string;
  difficulty?: "easy" | "medium" | "hard";
  count?: number;
  source?: string;
}

interface WrongSummaryItem {
  title: string;
  count: number;
}

interface WrongbookInsightWorkspaceProps {
  wrongLoading: boolean;
  wrongQuestions: WrongQuestionRow[];
  wrongSummary: WrongSummaryItem[];
  wrongStatusStats: {
    total: number;
    pending: number;
    retry: number;
    mastered: number;
  };
  wrongTypeStats: WrongDimensionStat[];
  wrongDynastyStats: WrongDimensionStat[];
  wrongThemeStats: WrongDimensionStat[];
  keywordMasterySummary: {
    attempts: number;
    rate: number;
  };
  keywordWeakRows: KeywordWeakRow[];
  questionTypeLabelMap: Record<string, string>;
  buildSubjectivePracticeLink: (options?: SubjectivePracticeLinkOptions) => string;
  onOpenKeywordWeakness: (keyword: string) => void;
}

function StatsBlock({ title, items }: { title: string; items: WrongDimensionStat[] }): JSX.Element {
  return (
    <article className="rounded-lg p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
      <h4 className="text-sm text-slate-600">{title}</h4>
      <ul className="mt-2 flow-sm">
        {items.map((item) => (
          <li key={`${title}-${item.value}`} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{item.value}</span>
              <span>{item.count}题</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-ink-700" style={{ width: `${Math.round(item.ratio * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function WrongbookInsightWorkspace({
  wrongLoading,
  wrongQuestions,
  wrongSummary,
  wrongStatusStats,
  wrongTypeStats,
  wrongDynastyStats,
  wrongThemeStats,
  keywordMasterySummary,
  keywordWeakRows,
  questionTypeLabelMap,
  buildSubjectivePracticeLink,
  onOpenKeywordWeakness,
}: WrongbookInsightWorkspaceProps): JSX.Element {
  if (wrongLoading || wrongQuestions.length === 0) {
    return (
      <section className="state-card">
        <p className="text-sm text-slate-600">当前筛选下暂无可统计错题数据，先完成一组训练后再查看分布。</p>
        <div className="mt-3">
          <Link to={buildSubjectivePracticeLink({ status: "pending", difficulty: "easy", count: 6, source: "my_learning" })} className="btn-primary-compact">
            去做一组专项练习
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <SectionCard title="筛选结果统计" subtitle="基于当前筛选快速定位高频薄弱点。" className="result-card" bodyClassName="flow-md">
        <div className="toolbar-surface mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            总错题 {wrongStatusStats.total} · 待复习 {wrongStatusStats.pending} · 需再练 {wrongStatusStats.retry} · 已掌握{" "}
            {wrongStatusStats.mastered}
          </span>
          <span className="rounded-full bg-white px-2 py-1 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">聚焦 TOP 分布与关键词弱点</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <StatsBlock
            title="题型 TOP"
            items={wrongTypeStats.map((item) => ({
              ...item,
              value: questionTypeLabelMap[item.value] || item.value,
            }))}
          />
          <StatsBlock title="朝代 TOP" items={wrongDynastyStats} />
          <StatsBlock title="题材 TOP" items={wrongThemeStats} />

          <article className="rounded-lg p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
            <h4 className="text-sm text-slate-600">关键词掌握度</h4>
            <p className="mt-1 text-[11px] text-slate-500">
              已练 {keywordMasterySummary.attempts} 次，正确率 {keywordMasterySummary.rate}%
            </p>
            {keywordWeakRows.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">暂无关键词记录，先进入专项练习。</p>
            ) : (
              <ul className="mt-2 flow-sm">
                {keywordWeakRows.map((item) => (
                  <li key={`keyword-mastery-${item.key}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <button type="button" onClick={() => onOpenKeywordWeakness(item.key)} className="text-left text-ink-700 transition hover:text-ink-900">
                        {item.key}
                      </button>
                      <span>
                        {item.rate}% · {item.attempts}次
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${item.rate}%` }} />
                    </div>
                    <div>
                      <Link
                        to={buildSubjectivePracticeLink({ keywordTag: item.key, difficulty: "easy", count: 6, status: "all" })}
                        className="text-[11px] text-ink-700 transition hover:text-ink-900"
                      >
                        用“{item.key}”做主观专项
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </SectionCard>

      {wrongSummary.length > 0 ? (
        <section className="rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)]">
          <h3 className="font-display text-lg text-ink-700">错题分布</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {wrongSummary.map((item) => (
              <span key={item.title} className="rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-700">
                {item.title} · {item.count}题
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
