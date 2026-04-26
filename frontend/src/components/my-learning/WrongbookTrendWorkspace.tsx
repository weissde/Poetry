import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";
import type { WrongTrendDisplayRow, WrongTrendPoint } from "@/components/my-learning/wrongbookTypes";

type WrongPeriodValue = "all" | "7" | "30";
type WrongTrendView = "day" | "week";

interface SubjectivePracticeLinkOptions {
  status?: "all" | "pending" | "mastered" | "retry";
  dynasty?: string;
  theme?: string;
  keywordTag?: string;
  difficulty?: "easy" | "medium" | "hard";
  count?: number;
  source?: string;
}

interface WrongbookTrendWorkspaceProps {
  wrongPeriodFilter: WrongPeriodValue;
  wrongTrendView: WrongTrendView;
  wrongTrendShowAllDays: boolean;
  wrongFocusDate: string;
  wrongTrendSummary: {
    created: number;
    mastered: number;
    net: number;
    activeDays: number;
    totalDays: number;
  };
  wrongTrendHotspot: WrongTrendDisplayRow | null;
  wrongTrendLoading: boolean;
  wrongTrend: WrongTrendPoint[];
  wrongTrendDisplayRows: WrongTrendDisplayRow[];
  wrongTrendRowsForRender: WrongTrendDisplayRow[];
  wrongTrendPreviewRows: WrongTrendDisplayRow[];
  wrongTrendExpanded: boolean;
  wrongTrendMax: number;
  buildSubjectivePracticeLink: (options?: SubjectivePracticeLinkOptions) => string;
  onSwitchTrendView: (view: WrongTrendView) => void;
  onToggleShowAllDays: () => void;
  onClearFocusDate: () => void;
  onOpenPendingWrongbook: () => void;
  onToggleExpanded: () => void;
  onToggleFocusDate: (date: string) => void;
}

export function WrongbookTrendWorkspace({
  wrongPeriodFilter,
  wrongTrendView,
  wrongTrendShowAllDays,
  wrongFocusDate,
  wrongTrendSummary,
  wrongTrendHotspot,
  wrongTrendLoading,
  wrongTrend,
  wrongTrendDisplayRows,
  wrongTrendRowsForRender,
  wrongTrendPreviewRows,
  wrongTrendExpanded,
  wrongTrendMax,
  buildSubjectivePracticeLink,
  onSwitchTrendView,
  onToggleShowAllDays,
  onClearFocusDate,
  onOpenPendingWrongbook,
  onToggleExpanded,
  onToggleFocusDate,
}: WrongbookTrendWorkspaceProps): JSX.Element {
  const periodLabel = wrongPeriodFilter === "all" ? "近 90 天" : `近 ${wrongPeriodFilter} 天`;

  return (
    <SectionCard className="result-card" bodyClassName="flow-md">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg text-ink-700">错题趋势</h3>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-white p-0.5 text-xs shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)]">
            <button
              type="button"
              onClick={() => onSwitchTrendView("day")}
              className={`rounded px-2 py-1 transition ${wrongTrendView === "day" ? "bg-ink-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              日
            </button>
            <button
              type="button"
              onClick={() => onSwitchTrendView("week")}
              className={`rounded px-2 py-1 transition ${wrongTrendView === "week" ? "bg-ink-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              周
            </button>
          </div>
          <button type="button" onClick={onToggleShowAllDays} className="btn-secondary-compact text-slate-600">
            {wrongTrendShowAllDays ? "仅看有变化日期" : "查看全部日期"}
          </button>
          {wrongFocusDate ? (
            <button type="button" onClick={onClearFocusDate} className="btn-secondary-compact text-slate-600">
              清除日期筛选
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        {periodLabel} · {wrongTrendView === "week" ? "按周" : "按日"}统计新增与掌握，先看摘要再看明细。
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="metric-card p-2 text-center">
          <div className="text-[11px] text-slate-500">新增错题</div>
          <div className="mt-1 text-base font-semibold text-amber-700">{wrongTrendSummary.created}</div>
        </div>
        <div className="metric-card p-2 text-center">
          <div className="text-[11px] text-slate-500">已掌握</div>
          <div className="mt-1 text-base font-semibold text-green-700">{wrongTrendSummary.mastered}</div>
        </div>
        <div className="metric-card p-2 text-center">
          <div className="text-[11px] text-slate-500">净变化</div>
          <div className={`mt-1 text-base font-semibold ${wrongTrendSummary.net >= 0 ? "text-green-700" : "text-red-700"}`}>
            {wrongTrendSummary.net >= 0 ? "+" : ""}
            {wrongTrendSummary.net}
          </div>
        </div>
        <div className="metric-card p-2 text-center">
          <div className="text-[11px] text-slate-500">活跃日期</div>
          <div className="mt-1 text-base font-semibold text-ink-700">
            {wrongTrendSummary.activeDays}/{wrongTrendSummary.totalDays}
          </div>
        </div>
      </div>

      <div className="toolbar-surface mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          {wrongTrendHotspot
            ? `波动重点：${wrongTrendHotspot.label}（新增 ${wrongTrendHotspot.created}，掌握 ${wrongTrendHotspot.mastered}）`
            : "当前暂无明显波动重点。"}
        </p>
        <div className="flex flex-wrap gap-2">
          {wrongTrendSummary.net < 0 ? (
            <Link
              to={buildSubjectivePracticeLink({ status: "pending", difficulty: "easy", count: 8, source: "my_learning" })}
              className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700 transition hover:bg-red-100 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.24)]"
            >
              做一组纠偏专项
            </Link>
          ) : (
            <Link
              to={buildSubjectivePracticeLink({ status: "all", difficulty: "medium", count: 6, source: "my_learning" })}
              className="rounded bg-green-50 px-2 py-1 text-[11px] text-green-700 transition hover:bg-green-100 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.24)]"
            >
              做一组巩固专项
            </Link>
          )}
          <button
            type="button"
            onClick={onOpenPendingWrongbook}
            className="rounded bg-white px-2 py-1 text-[11px] text-slate-700 transition hover:bg-slate-50 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)]"
          >
            查看待复习错题
          </button>
        </div>
      </div>

      {wrongTrendLoading ? <p className="mt-3 text-sm text-slate-500">趋势加载中...</p> : null}
      {!wrongTrendLoading && wrongTrend.length === 0 ? <p className="mt-3 text-sm text-slate-500">暂无趋势数据。</p> : null}

      {!wrongTrendLoading && wrongTrend.length > 0 && wrongTrendDisplayRows.length === 0 ? (
        <div className="mt-3 rounded-lg bg-white p-4 text-sm text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.28)]">
          当前周期内还没有新增或掌握变化。建议先做一组练习，系统会生成更有效的趋势数据。
          <div className="mt-2">
            <Link to={buildSubjectivePracticeLink({ status: "pending", difficulty: "easy", count: 6 })} className="text-ink-700 transition hover:text-ink-900">
              去做一组专项练习
            </Link>
          </div>
        </div>
      ) : null}

      {!wrongTrendLoading && wrongTrendDisplayRows.length > 0 ? (
        <div className="mt-3 flow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              展示 {wrongTrendRowsForRender.length}/{wrongTrendDisplayRows.length} 条
            </span>
            {wrongTrendDisplayRows.length > wrongTrendPreviewRows.length ? (
              <button
                type="button"
                onClick={onToggleExpanded}
                className="rounded bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.30)]"
              >
                {wrongTrendExpanded ? "收起明细" : "展开明细"}
              </button>
            ) : null}
          </div>

          {wrongTrendRowsForRender.map((item) => {
            const clickable = wrongTrendView === "day";
            const active = clickable && wrongFocusDate === item.startDate;
            const className = [
              "w-full rounded-lg p-2 text-left transition",
              active ? "bg-amber-50" : "bg-white",
              clickable ? "hover:bg-slate-50" : "",
            ].join(" ");

            const content = (
              <>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{item.label}</span>
                  <span>
                    新增 {item.created} · 掌握 {item.mastered}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${Math.round((item.created / wrongTrendMax) * 100)}%` }} />
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-green-600" style={{ width: `${Math.round((item.mastered / wrongTrendMax) * 100)}%` }} />
                  </div>
                </div>
              </>
            );

            if (!clickable) {
              return (
                <div key={item.key} className={className}>
                  {content}
                </div>
              );
            }

            return (
              <button key={item.key} type="button" onClick={() => onToggleFocusDate(item.startDate)} className={className}>
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </SectionCard>
  );
}
