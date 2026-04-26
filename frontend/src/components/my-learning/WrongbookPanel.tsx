import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";

interface WrongbookMetaOption {
  value: string;
  count: number;
}

interface WrongbookMetaPayload {
  dynasties: WrongbookMetaOption[];
  themes: WrongbookMetaOption[];
  keywordTags: WrongbookMetaOption[];
}

interface WrongbookQuestionLite {
  id: string;
}

type WrongStatusValue = "pending" | "mastered" | "retry";
type WrongStatusFilterValue = "all" | WrongStatusValue;
type WrongPeriodValue = "all" | "7" | "30";

interface WrongbookPanelProps {
  wrongPeriodFilter: WrongPeriodValue;
  wrongStatusFilter: WrongStatusFilterValue;
  wrongTypeFilter: string;
  wrongKeyword: string;
  wrongQuestionKindFilter: string;
  wrongDynastyFilter: string;
  wrongThemeFilter: string;
  wrongKeywordTagFilter: string;
  wrongTypeOptions: string[];
  questionTypeLabelMap: Record<string, string>;
  wrongMeta: WrongbookMetaPayload;
  showWrongAdvancedFilters: boolean;
  wrongMetaLoading: boolean;
  wrongFocusDate: string;
  subjectiveWrongCount: number;
  subjectivePracticeLink: string;
  wrongQuestions: WrongbookQuestionLite[];
  selectedIds: string[];
  batchLoading: boolean;
  setWrongPeriodFilter: (value: WrongPeriodValue) => void;
  setWrongStatusFilter: (value: WrongStatusFilterValue) => void;
  setWrongTypeFilter: (value: string) => void;
  setWrongKeyword: (value: string) => void;
  setWrongPage: (value: number) => void;
  setShowAdvancedWrongFilters: (updater: (prev: boolean) => boolean) => void;
  setWrongQuestionKindFilter: (value: string) => void;
  setWrongDynastyFilter: (value: string) => void;
  setWrongThemeFilter: (value: string) => void;
  setWrongKeywordTagFilter: (value: string) => void;
  setWrongFocusDate: (value: string) => void;
  loadWrongbookDashboard: (filters: Record<string, unknown>) => void | Promise<void>;
  currentWrongFilters: () => Record<string, unknown>;
  toggleSelectAll: () => void;
  runBatchAction: (payload: { ids: string[]; action: "set_status" | "delete"; status?: WrongStatusValue }) => void | Promise<void>;
}

export function WrongbookPanel({
  wrongPeriodFilter,
  wrongStatusFilter,
  wrongTypeFilter,
  wrongKeyword,
  wrongQuestionKindFilter,
  wrongDynastyFilter,
  wrongThemeFilter,
  wrongKeywordTagFilter,
  wrongTypeOptions,
  questionTypeLabelMap,
  wrongMeta,
  showWrongAdvancedFilters,
  wrongMetaLoading,
  wrongFocusDate,
  subjectiveWrongCount,
  subjectivePracticeLink,
  wrongQuestions,
  selectedIds,
  batchLoading,
  setWrongPeriodFilter,
  setWrongStatusFilter,
  setWrongTypeFilter,
  setWrongKeyword,
  setWrongPage,
  setShowAdvancedWrongFilters,
  setWrongQuestionKindFilter,
  setWrongDynastyFilter,
  setWrongThemeFilter,
  setWrongKeywordTagFilter,
  setWrongFocusDate,
  loadWrongbookDashboard,
  currentWrongFilters,
  toggleSelectAll,
  runBatchAction,
}: WrongbookPanelProps): JSX.Element {
  return (
    <SectionCard
      title="错题筛选与批量操作"
      className="task-card card-dense"
      bodyClassName="flow-md"
      actions={
        <button
          type="button"
          onClick={() => {
            void loadWrongbookDashboard({ ...currentWrongFilters(), force: true });
          }}
          className="btn-secondary"
        >
          刷新
        </button>
      }
    >
      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] lg:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <select
            value={wrongPeriodFilter}
            onChange={(event) => {
              setWrongPeriodFilter(event.target.value as WrongPeriodValue);
              setWrongPage(1);
            }}
            className="input-main control-dense"
          >
            <option value="all">全部时间</option>
            <option value="7">近 7 天</option>
            <option value="30">近 30 天</option>
          </select>

          <select
            value={wrongStatusFilter}
            onChange={(event) => {
              setWrongStatusFilter(event.target.value as WrongStatusFilterValue);
              setWrongPage(1);
            }}
            className="input-main control-dense"
          >
            <option value="all">全部状态</option>
            <option value="pending">待复习</option>
            <option value="retry">需再练</option>
            <option value="mastered">已掌握</option>
          </select>

          <select
            value={wrongTypeFilter}
            onChange={(event) => {
              setWrongTypeFilter(event.target.value);
              setWrongPage(1);
            }}
            className="input-main control-dense"
          >
            <option value="all">全部题型</option>
            {wrongTypeOptions.map((item) => (
              <option key={item} value={item}>
                {questionTypeLabelMap[item] || item}
              </option>
            ))}
          </select>

          <input value={wrongKeyword} onChange={(event) => setWrongKeyword(event.target.value)} placeholder="按关键词筛选错题" className="input-main control-dense xl:col-span-2" />

          <button
            type="button"
            onClick={() => {
              setWrongPage(1);
              void loadWrongbookDashboard({ ...currentWrongFilters(), page: 1 });
            }}
            className="btn-primary btn-dense"
          >
            搜索
          </button>
        </div>

        <div className="flex items-start justify-end gap-2 lg:flex-col lg:items-end">
          <button type="button" onClick={() => setShowAdvancedWrongFilters((prev) => !prev)} className="btn-secondary-compact">
            {showWrongAdvancedFilters ? "收起高级筛选" : "展开高级筛选"}
          </button>
        </div>
      </div>

      {showWrongAdvancedFilters ? (
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] md:grid-cols-2 xl:grid-cols-4">
          <select
            value={wrongQuestionKindFilter}
            onChange={(event) => {
              setWrongQuestionKindFilter(event.target.value);
              setWrongPage(1);
            }}
            className="input-main control-dense"
          >
            <option value="all">全部作答类型</option>
            <option value="subjective">主观题</option>
            <option value="objective">客观题</option>
          </select>

          <select
            value={wrongDynastyFilter}
            onChange={(event) => {
              setWrongDynastyFilter(event.target.value);
              setWrongPage(1);
            }}
            className="input-main control-dense"
          >
            <option value="">全部朝代</option>
            {wrongMeta.dynasties.map((item) => (
              <option key={item.value} value={item.value}>
                {item.value} ({item.count})
              </option>
            ))}
          </select>

          <select
            value={wrongThemeFilter}
            onChange={(event) => {
              setWrongThemeFilter(event.target.value);
              setWrongPage(1);
            }}
            className="input-main control-dense"
          >
            <option value="">全部题材</option>
            {wrongMeta.themes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.value} ({item.count})
              </option>
            ))}
          </select>

          <select
            value={wrongKeywordTagFilter}
            onChange={(event) => {
              setWrongKeywordTagFilter(event.target.value);
              setWrongPage(1);
            }}
            className="input-main control-dense"
          >
            <option value="">主观题关键词标签</option>
            {wrongMeta.keywordTags.slice(0, 80).map((item) => (
              <option key={`keyword-tag-${item.value}`} value={item.value}>
                {item.value} ({item.count})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">基础筛选：时间 / 状态 / 题型 / 关键词</span>
        {showWrongAdvancedFilters ? (
          <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.26)]">高级筛选已开启</span>
        ) : (
          <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">高级筛选默认折叠，页面更清爽</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setWrongQuestionKindFilter("subjective");
            setWrongStatusFilter("pending");
            setWrongKeywordTagFilter("");
            setWrongPage(1);
            void loadWrongbookDashboard({
              ...currentWrongFilters(),
              questionKind: "subjective",
              status: "pending",
              keywordTag: "",
              page: 1,
            });
          }}
          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 transition hover:bg-amber-100 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.26)]"
        >
          主观题专项复习（{subjectiveWrongCount} 题）
        </button>
        <Link to={subjectivePracticeLink} className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs text-ink-700 transition hover:bg-ink-100 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.24)]">
          一键开始专项训练
        </Link>
        {showWrongAdvancedFilters
          ? wrongMeta.keywordTags.slice(0, 8).map((item) => (
              <button
                key={`quick-keyword-${item.value}`}
                type="button"
                onClick={() => {
                  setWrongQuestionKindFilter("subjective");
                  setWrongKeywordTagFilter(item.value);
                  setWrongPage(1);
                  void loadWrongbookDashboard({
                    ...currentWrongFilters(),
                    questionKind: "subjective",
                    keywordTag: item.value,
                    page: 1,
                  });
                }}
                className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]"
              >
                {item.value} ({item.count})
              </button>
            ))
          : null}
      </div>

      {wrongMetaLoading ? <p className="mt-2 text-xs text-slate-400">正在更新筛选项...</p> : null}
      {wrongFocusDate ? (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">按日期筛选：{wrongFocusDate}</span>
          <button
            type="button"
            onClick={() => {
              setWrongFocusDate("");
              setWrongPage(1);
            }}
            className="rounded-full px-2 py-1 text-amber-700 transition hover:bg-amber-50 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.26)]"
          >
            清除日期筛选
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggleSelectAll} className="btn-secondary-compact">
          {selectedIds.length === wrongQuestions.length && wrongQuestions.length > 0 ? "取消全选" : "全选本页"}
        </button>
        <span className="text-xs text-slate-500">已选择 {selectedIds.length} 项</span>
        <button
          type="button"
          disabled={selectedIds.length === 0 || batchLoading}
          onClick={() => void runBatchAction({ ids: selectedIds, action: "set_status", status: "mastered" })}
          className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
        >
          批量标记已掌握
        </button>
        <button
          type="button"
          disabled={selectedIds.length === 0 || batchLoading}
          onClick={() => void runBatchAction({ ids: selectedIds, action: "set_status", status: "retry" })}
          className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
        >
          批量标记需再练
        </button>
        <button
          type="button"
          disabled={selectedIds.length === 0 || batchLoading}
          onClick={() => void runBatchAction({ ids: selectedIds, action: "delete" })}
          className="rounded-lg px-3 py-1.5 text-xs text-red-600 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          批量删除
        </button>
      </div>
    </SectionCard>
  );
}
