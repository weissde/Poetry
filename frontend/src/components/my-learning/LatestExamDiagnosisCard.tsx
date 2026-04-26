import { Link } from"react-router-dom";
import type { ExamDiagnostics } from"@/types";

type ExamWeakDimension ="questionType" |"dynasty" |"theme";

interface LatestExamDiagnosticsData {
 exists: boolean;
 examType?: string | null;
 score?: number;
 maxScore?: number;
 percent?: number;
 diagnostics?: ExamDiagnostics | null;
}

interface LatestExamDiagnosisCardProps {
 latestExamDiagLoading: boolean;
 latestExamDiagError: string | null;
 latestExamDiag: LatestExamDiagnosticsData | null;
 examDimensionLabelMap: Record<ExamWeakDimension, string>;
 onRefresh: () => void;
 onOpenWrongbookByExam: (dimension: ExamWeakDimension, key: string) => void;
 buildSubjectivePracticeLink: (options: {
 status:"all";
 difficulty:"easy";
 count: number;
 dynasty?: string;
 theme?: string;
 }) => string;
}

export function LatestExamDiagnosisCard({
 latestExamDiagLoading,
 latestExamDiagError,
 latestExamDiag,
 examDimensionLabelMap,
 onRefresh,
 onOpenWrongbookByExam,
 buildSubjectivePracticeLink,
}: LatestExamDiagnosisCardProps): JSX.Element {
 return (
 <article className="surface-card">
 <div className="flex items-center justify-between">
 <h3 className="block-title">最近一次模考诊断</h3>
 <button
 type="button"
 onClick={onRefresh}
 className="btn-secondary-compact"
 >
 刷新
 </button>
 </div>

 {latestExamDiagLoading ? <p className="mt-3 text-sm text-slate-500">诊断加载中...</p> : null}
 {latestExamDiagError ? (
 <p className="mt-3 rounded-lg shadow-[inset_0_0_0_1px_rgba(239,68,68,0.24)] bg-red-50 p-3 text-sm text-red-700">{latestExamDiagError}</p>
 ) : null}
 {!latestExamDiagLoading && latestExamDiag && !latestExamDiag.exists ? (
 <p className="mt-3 text-sm text-slate-500">暂无模考记录，先去考试中心完成一次模考即可生成诊断。</p>
 ) : null}

 {!latestExamDiagLoading && latestExamDiag?.exists ? (
 <div className="mt-3 flow-md">
 <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
 最近模考：{latestExamDiag.examType ||"未知"} · 得分 {Math.round(latestExamDiag.score || 0)}/
 {Math.round(latestExamDiag.maxScore || 0)} · 正确率 {latestExamDiag.percent ?? 0}%
 </div>

 <div>
 <h4 className="text-sm text-slate-600">最弱项</h4>
 {(latestExamDiag.diagnostics?.weakest || []).length === 0 ? (
 <p className="mt-2 text-xs text-slate-500">本次模考暂时没有明显薄弱项。</p>
 ) : (
 <div className="mt-2 flow-sm">
 {(latestExamDiag.diagnostics?.weakest || []).map((item) => (
 <div key={`${item.dimension}-${item.key}`} className="rounded-lg bg-warm-50 p-3">
 <div className="flex items-center justify-between text-sm text-slate-700">
 <span>
 {examDimensionLabelMap[item.dimension as ExamWeakDimension]} · {item.label}
 </span>
 <span>
 错误 {item.wrong}/{item.attempts}
 </span>
 </div>
 <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
 <span>正确率 {Math.round(item.rate * 100)}%</span>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => onOpenWrongbookByExam(item.dimension as ExamWeakDimension, item.key)}
 className="btn-secondary-compact"
 >
 去错题本定位
 </button>
 {item.dimension !=="questionType" || item.key ==="subjective" ? (
 <Link
 to={buildSubjectivePracticeLink({
 status:"all",
 difficulty:"easy",
 count: 8,
 dynasty: item.dimension ==="dynasty" ? item.key : undefined,
 theme: item.dimension ==="theme" ? item.key : undefined,
 })}
 className="btn-secondary-compact text-ink-700 hover:bg-ink-50"
 >
 做主观专项</Link>
 ) : null}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
 <article className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-3">
 <h4 className="text-sm text-slate-600">题型表现</h4>
 <div className="mt-2 flow-sm">
 {(latestExamDiag.diagnostics?.byQuestionType || []).slice(0, 4).map((item) => (
 <button
 key={`qt-${item.key}`}
 type="button"
 onClick={() => onOpenWrongbookByExam("questionType", item.key)}
 className="w-full rounded-lg bg-slate-50 px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100"
 >
 {item.label} · 错误 {item.wrong}/{item.attempts}
 </button>
 ))}
 </div>
 </article>

 <article className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-3">
 <h4 className="text-sm text-slate-600">朝代表现</h4>
 <div className="mt-2 flow-sm">
 {(latestExamDiag.diagnostics?.byDynasty || []).slice(0, 4).map((item) => (
 <button
 key={`dyn-${item.key}`}
 type="button"
 onClick={() => onOpenWrongbookByExam("dynasty", item.key)}
 className="w-full rounded-lg bg-slate-50 px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100"
 >
 {item.label} · 错误 {item.wrong}/{item.attempts}
 </button>
 ))}
 </div>
 </article>

 <article className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] p-3">
 <h4 className="text-sm text-slate-600">题材表现</h4>
 <div className="mt-2 flow-sm">
 {(latestExamDiag.diagnostics?.byTheme || []).slice(0, 4).map((item) => (
 <button
 key={`theme-${item.key}`}
 type="button"
 onClick={() => onOpenWrongbookByExam("theme", item.key)}
 className="w-full rounded-lg bg-slate-50 px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100"
 >
 {item.label} · 错误 {item.wrong}/{item.attempts}
 </button>
 ))}
 </div>
 </article>
 </div>
 </div>
 ) : null}
 </article>
 );
}

