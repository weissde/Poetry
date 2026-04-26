import { Link } from "react-router-dom";
import type { PracticeSessionSummaryRecord } from "@/types";

type TimeRange = "all" | "7" | "30";

interface SourceWeakRow {
  key: string;
  label: string;
  attempts: number;
  correct: number;
  rate: number;
}

interface WeakRow {
  key: string;
  attempts: number;
  rate: number;
}

interface DiagnosisAdvancedPanelProps {
  showDiagnosisAdvanced: boolean;
  onToggleAdvanced: () => void;

  examSummaryKeyword: string;
  setExamSummaryKeyword: (value: string) => void;
  examSummaryDays: TimeRange;
  onChangeExamSummaryDays: (value: TimeRange) => void;
  examSummaryPage: number;
  examSummaryTotalPages: number;
  examSummaryTotal: number;
  examSummaryLogs: PracticeSessionSummaryRecord[];
  examSummaryLogsLoading: boolean;
  examSummaryLogsError: string | null;
  examSummaryDeleteId: string | null;
  onRefreshExamSummaryLogs: (page?: number) => void;
  onSearchExamSummaryLogs: () => void;
  onClearExamSummaryLogs: () => void;
  onDeleteExamSummaryLog: (id: string) => void;
  buildExamSummaryPracticeLink: (item: PracticeSessionSummaryRecord) => string;

  weakDimensions: string[];
  sourceWeakRows: SourceWeakRow[];
  buildPracticeBySourceLink: (sourceKey: string) => { to: string; label: string };

  graphCompareKeyword: string;
  setGraphCompareKeyword: (value: string) => void;
  graphCompareDays: TimeRange;
  onChangeGraphCompareDays: (value: TimeRange) => void;
  graphComparePage: number;
  graphCompareTotalPages: number;
  graphCompareTotal: number;
  graphCompareLogs: PracticeSessionSummaryRecord[];
  graphCompareLogsLoading: boolean;
  graphCompareLogsError: string | null;
  graphCompareDeleteId: string | null;
  onRefreshGraphCompareLogs: (page?: number) => void;
  onSearchGraphCompareLogs: () => void;
  onClearGraphCompareLogs: () => void;
  onDeleteGraphCompareLog: (id: string) => void;
  buildGraphCompareLinkFromTopic: (topic: string | null | undefined) => string;

  dynastyWeakRows: WeakRow[];
  themeWeakRows: WeakRow[];
  buildSubjectivePracticeLink: (options: {
    status?: "all" | "pending" | "mastered" | "retry";
    dynasty?: string;
    theme?: string;
    keywordTag?: string;
    difficulty?: "easy" | "medium" | "hard";
    count?: number;
    source?: "my_learning" | "exam";
  }) => string;
}

function rangeLabel(value: TimeRange): string {
  if (value === "7") return "近 7 天";
  if (value === "30") return "近 30 天";
  return "全部";
}

export function DiagnosisAdvancedPanel({
  showDiagnosisAdvanced,
  onToggleAdvanced,
  examSummaryKeyword,
  setExamSummaryKeyword,
  examSummaryDays,
  onChangeExamSummaryDays,
  examSummaryPage,
  examSummaryTotalPages,
  examSummaryTotal,
  examSummaryLogs,
  examSummaryLogsLoading,
  examSummaryLogsError,
  examSummaryDeleteId,
  onRefreshExamSummaryLogs,
  onSearchExamSummaryLogs,
  onClearExamSummaryLogs,
  onDeleteExamSummaryLog,
  buildExamSummaryPracticeLink,
  weakDimensions,
  sourceWeakRows,
  buildPracticeBySourceLink,
  graphCompareKeyword,
  setGraphCompareKeyword,
  graphCompareDays,
  onChangeGraphCompareDays,
  graphComparePage,
  graphCompareTotalPages,
  graphCompareTotal,
  graphCompareLogs,
  graphCompareLogsLoading,
  graphCompareLogsError,
  graphCompareDeleteId,
  onRefreshGraphCompareLogs,
  onSearchGraphCompareLogs,
  onClearGraphCompareLogs,
  onDeleteGraphCompareLog,
  buildGraphCompareLinkFromTopic,
  dynastyWeakRows,
  themeWeakRows,
  buildSubjectivePracticeLink,
}: DiagnosisAdvancedPanelProps): JSX.Element {
  const ranges: TimeRange[] = ["7", "30", "all"];

  return (
    <section className="flow-md">
      <article className="surface-card card-dense">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="block-title">诊断扩展面板</h3>
            <p className="mt-1 text-xs text-slate-500">模考小结、来源分布、图谱对比与薄弱专题入口。</p>
          </div>
          <button type="button" onClick={onToggleAdvanced} className="btn-secondary-compact">
            {showDiagnosisAdvanced ? "收起扩展分析" : "展开扩展分析"}
          </button>
        </div>
      </article>

      {!showDiagnosisAdvanced ? (
        <article className="state-card">
          <p className="text-sm text-slate-600">当前仅显示核心诊断，点击“展开扩展分析”查看历史日志和专项建议。</p>
        </article>
      ) : null}

      {showDiagnosisAdvanced ? (
        <>
          <article className="surface-card flow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="block-title">模考小结日志</h3>
              <button type="button" onClick={() => onRefreshExamSummaryLogs(examSummaryPage)} className="btn-secondary-compact text-slate-600">
                刷新
              </button>
            </div>

            <form
              className="toolbar-surface mt-2 flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onSearchExamSummaryLogs();
              }}
            >
              <input
                value={examSummaryKeyword}
                onChange={(event) => setExamSummaryKeyword(event.target.value)}
                placeholder="按主题关键词筛选"
                className="input-main h-9 flex-1"
              />
              <button type="submit" className="btn-secondary-compact">
                搜索
              </button>
              <button type="button" onClick={onClearExamSummaryLogs} className="btn-secondary-compact text-slate-500">
                清空
              </button>
            </form>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">时间范围</span>
              {ranges.map((range) => (
                <button
                  key={`exam-summary-range-${range}`}
                  type="button"
                  onClick={() => onChangeExamSummaryDays(range)}
                  className={[
                    "rounded px-2 py-1 text-xs transition",
                    examSummaryDays === range
                      ? "bg-ink-700 text-white"
                      : "shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {rangeLabel(range)}
                </button>
              ))}
            </div>

            {examSummaryLogsLoading ? <p className="text-sm text-slate-500">加载中...</p> : null}
            {examSummaryLogsError ? <p className="text-sm text-red-600">{examSummaryLogsError}</p> : null}
            {!examSummaryLogsLoading && !examSummaryLogsError && examSummaryLogs.length === 0 ? (
              <p className="text-sm text-slate-500">暂无日志记录。</p>
            ) : null}

            {!examSummaryLogsLoading && examSummaryLogs.length > 0 ? (
              <ul className="flow-sm">
                {examSummaryLogs.map((item) => (
                  <li key={item.id} className="rounded-lg bg-warm-50 px-3 py-2 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <span>{item.topic || "模考小结"}</span>
                      <span className="text-xs text-slate-500">
                        正确率 {Math.max(0, Math.min(100, Number(item.accuracy || 0)))}% · {item.correct}/{item.attempts}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{item.summary}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <Link to={buildExamSummaryPracticeLink(item)} className="text-xs text-ink-700 transition hover:text-ink-900">
                        继续对应专项
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDeleteExamSummaryLog(item.id)}
                        disabled={examSummaryDeleteId === item.id}
                        className="text-xs text-red-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:text-red-300"
                      >
                        {examSummaryDeleteId === item.id ? "删除中..." : "删除"}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            ) : null}

            {!examSummaryLogsLoading && !examSummaryLogsError && examSummaryTotal > 0 ? (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  第 {examSummaryPage}/{examSummaryTotalPages} 页 · 共 {examSummaryTotal} 条
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={examSummaryPage <= 1}
                    onClick={() => onRefreshExamSummaryLogs(examSummaryPage - 1)}
                    className="btn-secondary-compact disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={examSummaryPage >= examSummaryTotalPages}
                    onClick={() => onRefreshExamSummaryLogs(examSummaryPage + 1)}
                    className="btn-secondary-compact disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    下一页
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          <article className="surface-card flow-sm">
            <h3 className="block-title">来源薄弱分布</h3>
            {weakDimensions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {weakDimensions.slice(0, 6).map((item) => (
                  <span key={`weak-dimension-${item}`} className="rounded-full bg-warm-50 px-3 py-1 text-xs text-warm-700">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">当前没有明显弱项标签。</p>
            )}

            {sourceWeakRows.length > 0 ? (
              <ul className="flow-sm">
                {sourceWeakRows.map((row) => {
                  const action = buildPracticeBySourceLink(row.key);
                  return (
                    <li key={`source-weak-${row.key}`} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-sm text-slate-700">
                        <span>{row.label}</span>
                        <span>
                          {row.correct}/{row.attempts} · {row.rate}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                        <div className="h-1.5 rounded-full bg-ink-700" style={{ width: `${Math.max(0, Math.min(100, row.rate))}%` }} />
                      </div>
                      <Link to={action.to} className="mt-2 inline-block text-xs text-ink-700 transition hover:text-ink-900">
                        {action.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </article>

          <article className="surface-card flow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="block-title">图谱对比日志</h3>
              <button type="button" onClick={() => onRefreshGraphCompareLogs(graphComparePage)} className="btn-secondary-compact text-slate-600">
                刷新
              </button>
            </div>

            <form
              className="toolbar-surface mt-2 flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onSearchGraphCompareLogs();
              }}
            >
              <input
                value={graphCompareKeyword}
                onChange={(event) => setGraphCompareKeyword(event.target.value)}
                placeholder="按主题或关键词筛选"
                className="input-main h-9 flex-1"
              />
              <button type="submit" className="btn-secondary-compact">
                搜索
              </button>
              <button type="button" onClick={onClearGraphCompareLogs} className="btn-secondary-compact text-slate-500">
                清空
              </button>
            </form>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">时间范围</span>
              {ranges.map((range) => (
                <button
                  key={`graph-compare-range-${range}`}
                  type="button"
                  onClick={() => onChangeGraphCompareDays(range)}
                  className={[
                    "rounded px-2 py-1 text-xs transition",
                    graphCompareDays === range
                      ? "bg-ink-700 text-white"
                      : "shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {rangeLabel(range)}
                </button>
              ))}
            </div>

            {graphCompareLogsLoading ? <p className="text-sm text-slate-500">加载中...</p> : null}
            {graphCompareLogsError ? <p className="text-sm text-red-600">{graphCompareLogsError}</p> : null}

            {!graphCompareLogsLoading && !graphCompareLogsError && graphCompareLogs.length > 0 ? (
              <ul className="flow-sm">
                {graphCompareLogs.map((item) => (
                  <li key={item.id} className="rounded-lg bg-ink-50 p-3">
                    <div className="flex items-center justify-between gap-2 text-sm text-ink-700">
                      <span>{item.topic || "图谱对比"}</span>
                      <span>{item.accuracy}%</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{item.summary}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Link to={buildGraphCompareLinkFromTopic(item.topic)} className="text-xs text-ink-700 transition hover:text-ink-900">
                        去图谱查看
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDeleteGraphCompareLog(item.id)}
                        disabled={graphCompareDeleteId === item.id}
                        className="text-xs text-red-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:text-red-300"
                      >
                        {graphCompareDeleteId === item.id ? "删除中..." : "删除"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {!graphCompareLogsLoading && !graphCompareLogsError && graphCompareTotal > 0 ? (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  第 {graphComparePage}/{graphCompareTotalPages} 页 · 共 {graphCompareTotal} 条
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={graphComparePage <= 1}
                    onClick={() => onRefreshGraphCompareLogs(graphComparePage - 1)}
                    className="btn-secondary-compact disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={graphComparePage >= graphCompareTotalPages}
                    onClick={() => onRefreshGraphCompareLogs(graphComparePage + 1)}
                    className="btn-secondary-compact disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    下一页
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          <article className="surface-card flow-sm">
            <h3 className="block-title">朝代与题材补救入口</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">朝代薄弱</p>
                <ul className="mt-2 flow-sm">
                  {dynastyWeakRows.slice(0, 6).map((row) => (
                    <li key={`dynasty-weak-${row.key}`} className="flex items-center justify-between text-xs text-slate-700">
                      <span>{row.key}</span>
                      <Link
                        to={buildSubjectivePracticeLink({ dynasty: row.key, status: "all", difficulty: "easy", count: 6, source: "my_learning" })}
                        className="text-ink-700 transition hover:text-ink-900"
                      >
                        {row.rate}% · 去补救
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">题材薄弱</p>
                <ul className="mt-2 flow-sm">
                  {themeWeakRows.slice(0, 6).map((row) => (
                    <li key={`theme-weak-${row.key}`} className="flex items-center justify-between text-xs text-slate-700">
                      <span>{row.key}</span>
                      <Link
                        to={buildSubjectivePracticeLink({ theme: row.key, status: "all", difficulty: "easy", count: 6, source: "my_learning" })}
                        className="text-ink-700 transition hover:text-ink-900"
                      >
                        {row.rate}% · 去补救
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}
