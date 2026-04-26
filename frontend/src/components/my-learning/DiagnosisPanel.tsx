import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";

export interface DiagnosisDimensionRow {
  key: string;
  label: string;
  rate: number;
  group: string;
}

interface DiagnosisPanelProps {
  diagnosisDimensionRows: DiagnosisDimensionRow[];
  diagnosisWeakestDimension: DiagnosisDimensionRow | null;
  diagnosisStrongestDimension: DiagnosisDimensionRow | null;
  diagnosisAverageRate: number;
  subjectivePracticeLink: string;
  onOpenPendingWrongbook: () => void;
}

export function DiagnosisPanel({
  diagnosisDimensionRows,
  diagnosisWeakestDimension,
  diagnosisStrongestDimension,
  diagnosisAverageRate,
  subjectivePracticeLink,
  onOpenPendingWrongbook,
}: DiagnosisPanelProps): JSX.Element {
  const basicRows = diagnosisDimensionRows.filter((item) => item.group === "基础理解");
  const advancedRows = diagnosisDimensionRows.filter((item) => item.group === "鉴赏表达");

  return (
    <SectionCard title="薄弱诊断" subtitle="依据答题记录统计你当前的薄弱维度。" className="surface-card" bodyClassName="flow-md">
      <div className="mt-1 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-xl bg-gradient-to-r from-ink-50 to-white p-4 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)]">
          <p className="text-xs text-slate-500">主结论</p>
          <p className="mt-1 text-base text-ink-700">
            当前最弱维度：
            <span className="font-semibold text-warm-700">
              {diagnosisWeakestDimension ? `${diagnosisWeakestDimension.label}（${diagnosisWeakestDimension.rate}%）` : "暂无数据"}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            最强维度：
            <span className="font-medium text-green-700">
              {diagnosisStrongestDimension ? `${diagnosisStrongestDimension.label}（${diagnosisStrongestDimension.rate}%）` : "暂无数据"}
            </span>
            {" · "}
            整体均值 <span className="font-medium text-ink-700">{diagnosisAverageRate}%</span>
          </p>
          <div className="mt-3 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-ink-700" style={{ width: `${Math.max(0, Math.min(100, diagnosisAverageRate))}%` }} />
          </div>
        </article>

        <article className="rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
          <p className="text-xs text-slate-500">建议动作</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={onOpenPendingWrongbook} className="btn-secondary-compact">
              先看待复习错题
            </button>
            <Link to={subjectivePracticeLink} className="btn-secondary-compact">
              做一组专项训练
            </Link>
          </div>
        </article>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <article className="rounded-xl p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
          <p className="text-xs text-slate-500">基础理解</p>
          <div className="mt-2 flow-sm">
            {basicRows.map((item) => (
              <div key={`diagnosis-basic-${item.key}`} className="rounded-lg bg-slate-50 p-2">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span>{item.label}</span>
                  <span>{item.rate}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                  <div className="h-1.5 rounded-full bg-ink-700" style={{ width: `${Math.max(0, Math.min(100, item.rate))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
          <p className="text-xs text-slate-500">鉴赏表达</p>
          <div className="mt-2 flow-sm">
            {advancedRows.map((item) => (
              <div key={`diagnosis-advanced-${item.key}`} className="rounded-lg bg-slate-50 p-2">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span>{item.label}</span>
                  <span>{item.rate}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                  <div className="h-1.5 rounded-full bg-ink-700" style={{ width: `${Math.max(0, Math.min(100, item.rate))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {diagnosisDimensionRows.map((item) => (
          <div key={`diagnosis-kpi-${item.key}`} className="metric-card text-center">
            <div className="metric-label">{item.label}</div>
            <div className="metric-value">{item.rate}%</div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-right text-[11px] text-slate-500">维度分仅用于诊断引导，建议结合错题本和模考记录综合判断。</div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="workspace-meta-item">
          <p className="workspace-meta-label">均值</p>
          <p className="workspace-meta-value">{diagnosisAverageRate}%</p>
        </div>
        <div className="workspace-meta-item">
          <p className="workspace-meta-label">最弱</p>
          <p className="workspace-meta-value">{diagnosisWeakestDimension?.label || "--"}</p>
        </div>
        <div className="workspace-meta-item">
          <p className="workspace-meta-label">最强</p>
          <p className="workspace-meta-value">{diagnosisStrongestDimension?.label || "--"}</p>
        </div>
        <div className="workspace-meta-item">
          <p className="workspace-meta-label">建议优先</p>
          <p className="workspace-meta-value">{diagnosisWeakestDimension ? `${diagnosisWeakestDimension.label}专项` : "待生成"}</p>
        </div>
      </div>
    </SectionCard>
  );
}
