import { Link } from "react-router-dom";
import { SpotlightCard } from "@/components/react-bits";
import type { PoemRecord } from "@/types";

type NodeKind = "poet" | "imagery" | "dynasty" | "theme" | "title" | "error_type";

interface GraphRelatedPoemsProps {
  related: { kind: NodeKind; value: string } | null;
  relatedLoading: boolean;
  relatedPoems: PoemRecord[];
  relatedRecommendation: any;
  relatedKindLabelMap: Record<string, string>;
  openGraphWorkspace: (view: any, detailTab?: any) => void;
  buildWrongbookLink: (related: any) => string;
  buildPracticeLink: (related: any) => string;
  buildPoemWrongbookLink: (title: string) => string;
  buildPoemPracticeLink: (title: string) => string;
}

export function GraphRelatedPoems({
  related,
  relatedLoading,
  relatedPoems,
  relatedRecommendation,
  relatedKindLabelMap,
  openGraphWorkspace,
  buildWrongbookLink,
  buildPracticeLink,
  buildPoemWrongbookLink,
  buildPoemPracticeLink,
}: GraphRelatedPoemsProps) {
  return (
    <section className="surface-card card-cozy flow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink-700">关联诗词</h2>
          <p className="text-xs text-slate-500">
            {related ? `当前节点：${relatedKindLabelMap[related.kind]} · ${related.value}` : "等待选择节点"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => openGraphWorkspace("overview")} className="btn-secondary-compact">
            返回总览
          </button>
          {related ? (
            <Link to={buildWrongbookLink(related)} className="btn-secondary-compact">
              在错题本查看
            </Link>
          ) : null}
          {related ? (
            <Link to={buildPracticeLink(related)} className="btn-secondary-compact">
              一键专项练习
            </Link>
          ) : null}
        </div>
      </div>

      {!related && !relatedLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <article
              key={`related-skeleton-${index}`}
              className="animate-pulse rounded-lg p-3 shadow-[0_10px_24px_rgba(26,43,76,0.08)]"
              style={{ background: "var(--bg-surface)" }}
            >
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
              <div className="mt-3 h-3 w-full rounded bg-slate-100" />
              <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
              <div className="mt-3 h-7 w-20 rounded bg-slate-200" />
            </article>
          ))}
        </div>
      ) : null}

      {!relatedLoading && related && relatedRecommendation ? (
        <div className="rounded-lg bg-amber-50 p-3 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]">
          <p className="text-xs font-medium text-amber-900">{relatedRecommendation.title}</p>
          <p className="mt-1 text-xs leading-5 text-amber-900">{relatedRecommendation.reason}</p>
          {relatedRecommendation.actionPlan.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {relatedRecommendation.actionPlan.map((item: string, index: number) => (
                <li key={`node-rec-step-${index}`} className="text-[11px] leading-5 text-amber-900">
                  {index + 1}. {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {relatedLoading ? <p className="text-sm text-slate-500">加载中...</p> : null}

      {!relatedLoading && related && relatedPoems.length === 0 ? (
        <div
          className="rounded-lg p-4 text-sm text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)]"
          style={{ background: "var(--bg-subtle)" }}
        >
          暂无匹配诗词。
        </div>
      ) : null}

      {!relatedLoading && relatedPoems.length > 0 ? (
        <div className="max-h-[620px] flow-sm overflow-auto">
          {relatedPoems.map((poem) => (
            <SpotlightCard
              key={poem.id}
              className="rounded-lg p-3 shadow-[0_10px_24px_rgba(26,43,76,0.08)]"
              style={{ background: "var(--bg-surface)" }}
              spotlightColor="rgba(26,43,76,0.08)"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm text-ink-700">{poem.title}</h3>
                <span className="text-xs text-slate-500">
                  {poem.author} · {poem.dynasty}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-6" style={{ color: "var(--neutral)" }}>
                {poem.content}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Link to={buildPoemWrongbookLink(poem.title)} className="btn-secondary inline-block text-xs">
                  查看这首错题
                </Link>
                <Link to={`/learn/${poem.id}`} className="btn-secondary inline-block text-xs">
                  进入学习页
                </Link>
                <Link
                  to={buildPoemPracticeLink(poem.title)}
                  className="btn-secondary-compact inline-block text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.26)] hover:bg-ink-50"
                >
                  基于此诗练习
                </Link>
              </div>
            </SpotlightCard>
          ))}
        </div>
      ) : null}
    </section>
  );
}
