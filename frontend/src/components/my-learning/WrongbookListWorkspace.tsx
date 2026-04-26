import { Link } from "react-router-dom";
import { VirtualizedList } from "@/components/common/VirtualizedList";
import { WrongbookListEmptyState } from "@/components/my-learning/WrongbookListEmptyState";
import type { WrongQuestionRow, WrongStatus } from "@/components/my-learning/wrongbookTypes";

interface WrongbookListWorkspaceProps {
  wrongLoading: boolean;
  wrongQuestions: WrongQuestionRow[];
  wrongPage: number;
  wrongTotalPages: number;
  wrongTotal: number;
  wrongPageSize: number;
  selectedIds: string[];
  questionKindLabelMap: Record<string, string>;
  questionTypeLabelMap: Record<string, string>;
  statusMap: Record<WrongStatus, string>;
  onChangePageSize: (value: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleSelect: (id: string) => void;
  onResetFilters: () => void;
  buildWrongRowPracticeLink: (item: WrongQuestionRow) => string;
  onMarkMastered: (id: string) => void;
  onMarkRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

export function WrongbookListWorkspace({
  wrongLoading,
  wrongQuestions,
  wrongPage,
  wrongTotalPages,
  wrongTotal,
  wrongPageSize,
  selectedIds,
  questionKindLabelMap,
  questionTypeLabelMap,
  statusMap,
  onChangePageSize,
  onPrevPage,
  onNextPage,
  onToggleSelect,
  onResetFilters,
  buildWrongRowPracticeLink,
  onMarkMastered,
  onMarkRetry,
  onDelete,
}: WrongbookListWorkspaceProps): JSX.Element {
  if (wrongLoading) {
    return <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)]">正在加载错题...</div>;
  }

  if (wrongQuestions.length === 0) {
    return <WrongbookListEmptyState onResetFilters={onResetFilters} />;
  }

  return (
    <section className="flow-sm">
      <div className="toolbar-surface flex items-center justify-between">
        <p className="text-xs text-slate-600">
          第 {wrongPage}/{wrongTotalPages} 页 · 共 {wrongTotal} 题
        </p>
        <div className="flex items-center gap-2">
          <select value={wrongPageSize} onChange={(event) => onChangePageSize(Number(event.target.value))} className="input-main control-compact">
            <option value={12}>12 / 页</option>
            <option value={24}>24 / 页</option>
            <option value={48}>48 / 页</option>
          </select>
          <button type="button" disabled={wrongPage <= 1} onClick={onPrevPage} className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50">
            上一页
          </button>
          <button type="button" disabled={wrongPage >= wrongTotalPages} onClick={onNextPage} className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50">
            下一页
          </button>
        </div>
      </div>

      <VirtualizedList
        items={wrongQuestions}
        getKey={(item) => item.id}
        height={780}
        estimateHeight={290}
        overscan={4}
        className="rounded-xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)]"
        renderItem={(item) => (
          <div className="pb-4">
            <article className="rounded-xl bg-white p-5 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggleSelect(item.id)} className="h-4 w-4 rounded" />
                  <h3 className="font-display text-xl text-ink-700">{item.poem_title || "未命名诗词"}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {item.question_kind ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">{questionKindLabelMap[item.question_kind] || item.question_kind}</span> : null}
                  {item.error_type ? <span className="rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-700">{questionTypeLabelMap[item.error_type] || item.error_type}</span> : null}
                  {item.dynasty ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{item.dynasty}</span> : null}
                  {item.theme ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{item.theme}</span> : null}
                  <span className="rounded-full bg-warm-50 px-3 py-1 text-xs text-warm-700">{statusMap[item.status]}</span>
                </div>
              </div>

              <p className="mt-3 text-sm leading-7 text-slate-700">{item.question_content}</p>
              <p className="mt-3 text-sm text-red-600">我的答案：{item.user_answer}</p>
              <p className="mt-1 text-sm text-green-700">正确答案：{item.correct_answer}</p>
              <p className="mt-3 rounded-lg bg-warm-50 p-3 text-sm leading-7 text-slate-700">解析：{item.explanation}</p>

              {Array.isArray(item.keyword_tags) && item.keyword_tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.keyword_tags.slice(0, 8).map((tag) => (
                    <span key={`${item.id}-${tag}`} className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">
                      缺失关键词：{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={buildWrongRowPracticeLink(item)} className="btn-primary-compact">
                  做同维度专项
                </Link>
                <button type="button" onClick={() => onMarkMastered(item.id)} className="text-xs text-slate-500 transition hover:text-ink-700">
                  标记已掌握
                </button>
                <button type="button" onClick={() => onMarkRetry(item.id)} className="text-xs text-slate-500 transition hover:text-ink-700">
                  标记需再练
                </button>
                <button type="button" onClick={() => onDelete(item.id)} className="text-xs text-red-500 transition hover:text-red-700">
                  删除
                </button>
              </div>
            </article>
          </div>
        )}
      />
    </section>
  );
}
