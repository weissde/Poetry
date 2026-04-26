import React, { useState } from "react";

import { useMemoryTab, MemoryItem, DrillState } from "@/hooks/useMemoryTab";
import { masteryLabel, masteryTone } from "@/lib/memoryUtils";

import { MemoryFlipCard } from "@/components/memory/MemoryFlipCard";
import { MemoryHeatmap } from "@/components/memory/MemoryHeatmap";
import { ProgressRing } from "@/components/memory/ProgressRing";
import { MemoryRatingBar } from "@/components/memory/MemoryRatingBar";
import { SectionCard } from "@/components/common/SectionCard";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { PillNav } from "@/components/react-bits";

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Stats dashboard: ring + heatmap + quick stats */
function StatsDashboard({
  stats,
  masteryPct,
  heatmapCells,
  statsLoading,
  achievementsCount,
}: {
  stats: any;
  masteryPct: number;
  heatmapCells: any[];
  statsLoading: boolean;
  achievementsCount: number;
}) {
  if (statsLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!stats) {
    return (
      <EmptyState
        icon="chart"
        title="暂无数据"
        description="开始复习后这里会出现你的记忆统计"
      />
    );
  }

  const label = masteryLabel(masteryPct);
  const tone = masteryTone(masteryPct);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* ring */}
      <SectionCard className="flex flex-col items-center justify-center py-6">
        <ProgressRing value={masteryPct} />
        <p className="mt-3 text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
          {label}
        </p>
        <p className="text-xs" style={{ color: "var(--ink-50)" }}>
          掌握率 {Math.round(masteryPct)}%
        </p>
      </SectionCard>

      {/* heatmap */}
      <SectionCard className="flex flex-col items-center justify-center py-6">
        <p className="mb-2 text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
          热力图
        </p>
        <MemoryHeatmap cells={heatmapCells} streakDays={stats.streak || 0} reviewedToday={stats.todayReviewed || 0} />
      </SectionCard>

      {/* quick stats */}
      <SectionCard className="flex flex-col justify-center gap-2 px-6 py-6">
        <QuickStat label="记忆总量" value={stats.total} />
        <QuickStat label="今日待复习" value={stats.due} accent />
        <QuickStat label="已成熟" value={stats.mature} />
        <QuickStat label="连续打卡" value={`${stats.streak} 天`} />
        {achievementsCount > 0 && (
          <QuickStat label="成就" value={`${achievementsCount} 个`} />
        )}
      </SectionCard>
    </div>
  );
}

function QuickStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--ink-50)" }}>
        {label}
      </span>
      <span
        className="text-sm font-semibold"
        style={{ color: accent ? "var(--brand-ink)" : "var(--brand-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Queue list (paginated)                                            */
/* ------------------------------------------------------------------ */

function QueueSection({
  items,
  total,
  page,
  pageSize,
  dueCount,
  onlyDue,
  queueLoading,
  queueError,
  savingId,
  onPageChange,
  onToggleOnlyDue,
  onSelectItem,
}: {
  items: MemoryItem[];
  total: number;
  page: number;
  pageSize: number;
  dueCount: number;
  onlyDue: boolean;
  queueLoading: boolean;
  queueError: string | null;
  savingId: string | null;
  onPageChange: (p: number) => void;
  onToggleOnlyDue: () => void;
  onSelectItem: (item: MemoryItem) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (queueLoading) {
    return (
      <SectionCard className="space-y-3 p-4">
        <SkeletonText lines={1} />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </SectionCard>
    );
  }

  if (queueError) {
    return (
      <EmptyState
        icon="alert"
        title="加载失败"
        description={queueError}
        action={{ label: "重试", onClick: () => onPageChange(page) }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="book"
        title="记忆库为空"
        description="搜索诗词并加入记忆库，开始你的记忆之旅"
        action={{ label: "去搜索", onClick: () => {} }}
      />
    );
  }

  return (
    <SectionCard className="overflow-hidden p-0">
      {/* filter bar */}
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--warm-50)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
          今日队列{" "}
          <span className="text-xs font-normal" style={{ color: "var(--ink-50)" }}>
            (共 {total}，到期 {dueCount})
          </span>
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-xs" style={{ color: "var(--ink-50)" }}>
          <input
            type="checkbox"
            checked={onlyDue}
            onChange={onToggleOnlyDue}
            className="h-4 w-4 rounded accent-stone-700"
          />
          到期优先
        </label>
      </div>

      {/* list */}
      <div className="divide-y" style={{ borderColor: "var(--warm-50)" }}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={savingId === item.id}
            onClick={() => onSelectItem(item)}
            className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--warm-50)] disabled:opacity-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
                {item.poemTitle}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--ink-50)" }}>
                {item.author} · {item.dynasty}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-xs" style={{ color: "var(--ink-50)" }}>
                间隔 {item.interval}d
              </span>
              {savingId === item.id && (
                <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t px-4 py-3" style={{ borderColor: "var(--warm-50)" }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded px-2 py-1 text-xs transition disabled:opacity-30"
            style={{ color: "var(--brand-ink)" }}
          >
            上一页
          </button>
          <span className="text-xs" style={{ color: "var(--ink-50)" }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded px-2 py-1 text-xs transition disabled:opacity-30"
            style={{ color: "var(--brand-ink)" }}
          >
            下一页
          </button>
        </div>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Review workspace (flip + rate)                                     */
/* ------------------------------------------------------------------ */

function ReviewWorkspace({
  item,
  savingId,
  onSubmitReview,
  onCancel,
}: {
  item: MemoryItem;
  savingId: string | null;
  onSubmitReview: (quality: number) => void;
  onCancel: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => setFlipped(true);
  const handleRate = (quality: number) => {
    onSubmitReview(quality);
    setFlipped(false);
  };

  return (
    <SectionCard className="space-y-4 p-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--brand-ink)" }}>
            {item.poemTitle}
          </h3>
          <p className="text-xs" style={{ color: "var(--ink-50)" }}>
            {item.author} · {item.dynasty}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-1 text-xs transition hover:bg-[var(--warm-50)]"
          style={{ color: "var(--ink-50)" }}
        >
          返回队列
        </button>
      </div>

      {/* flip card */}
      <MemoryFlipCard
        item={
          {
            ...item,
            poem: {
              title: item.poemTitle,
              author: item.author,
              dynasty: item.dynasty,
              content: item.content,
            },
            successRate: item.averageQuality ? item.averageQuality / 5 : 0,
            intervalDays: item.interval,
          } as any
        }
        flipped={flipped}
        onToggle={handleFlip}
      />

      {/* rating bar */}
      {flipped && (
        <MemoryRatingBar
          onRate={handleRate}
          disabled={savingId === item.id}
        />
      )}

      {savingId === item.id && (
        <p className="text-center text-xs" style={{ color: "var(--ink-50)" }}>
          提交中...
        </p>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Drill workspace                                                    */
/* ------------------------------------------------------------------ */

function DrillWorkspace({
  item,
  drill,
  drillError,
  savingId,
  onCancel,
  onReciteNext,
  onUpdateBlank,
  onSubmitBlanks,
  onSelectClue,
  onSelectAnswer,
  onDictationInput,
  onSubmitDictation,
  onComplete,
}: {
  item: MemoryItem;
  drill: DrillState;
  drillError: string | null;
  savingId: string | null;
  onCancel: () => void;
  onReciteNext: () => void;
  onUpdateBlank: (idx: number, val: string) => void;
  onSubmitBlanks: () => void;
  onSelectClue: (key: string) => void;
  onSelectAnswer: (ans: string) => void;
  onDictationInput: (val: string) => void;
  onSubmitDictation: () => void;
  onComplete: (accuracy: number) => void;
}) {
  if (drill.mode === "idle") return null;

  return (
    <SectionCard className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold" style={{ color: "var(--brand-ink)" }}>
          {drillModeLabel(drill.mode)} - {item.poemTitle}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-1 text-xs transition hover:bg-[var(--warm-50)]"
          style={{ color: "var(--ink-50)" }}
        >
          退出练习
        </button>
      </div>

      {drill.mode === "recite" && (
        <RecitePanel state={drill.recite} content={item.content} onNext={onReciteNext} onComplete={onComplete} />
      )}

      {drill.mode === "fillBlanks" && (
        <FillBlanksPanel
          state={drill.fillBlanks}
          onUpdate={onUpdateBlank}
          onSubmit={onSubmitBlanks}
          onComplete={onComplete}
        />
      )}

      {drill.mode === "pairs" && (
        <PairsPanel
          state={drill.pairs}
          onSelectClue={onSelectClue}
          onSelectAnswer={onSelectAnswer}
          onComplete={onComplete}
        />
      )}

      {drill.mode === "dictation" && (
        <DictationPanel
          state={drill.dictation}
          onInput={onDictationInput}
          onSubmit={onSubmitDictation}
          onComplete={onComplete}
        />
      )}

      {drillError && (
        <p className="text-center text-xs text-red-500">{drillError}</p>
      )}
    </SectionCard>
  );
}

function drillModeLabel(mode: string): string {
  const map: Record<string, string> = {
    recite: "背诵",
    fillBlanks: "填空",
    pairs: "配对",
    dictation: "默写",
  };
  return map[mode] ?? mode;
}

/* ---------- Recite ---------- */
function RecitePanel({
  state,
  content,
  onNext,
  onComplete,
}: {
  state: { phase: string };
  content: string;
  onNext: () => void;
  onComplete: (acc: number) => void;
}) {
  return (
    <div className="space-y-4 text-center">
      {state.phase === "preview" && (
        <>
          <div
            className="whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed"
            style={{ backgroundColor: "var(--warm-50)", color: "var(--brand-ink)" }}
          >
            {content}
          </div>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg px-6 py-2 text-sm font-semibold text-white transition"
            style={{ backgroundColor: "var(--brand-ink)" }}
          >
            开始背诵
          </button>
        </>
      )}

      {state.phase === "recall" && (
        <>
          <p className="text-sm" style={{ color: "var(--ink-50)" }}>
            请在心中默背全诗，然后点击下方按钮对照原文
          </p>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg px-6 py-2 text-sm font-semibold text-white transition"
            style={{ backgroundColor: "var(--brand-ink)" }}
          >
            对照原文
          </button>
        </>
      )}

      {state.phase === "check" && (
        <>
          <div
            className="whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed"
            style={{ backgroundColor: "var(--warm-50)", color: "var(--brand-ink)" }}
          >
            {content}
          </div>
          <p className="text-sm" style={{ color: "var(--ink-50)" }}>
            自我评估背诵准确度
          </p>
          <div className="flex justify-center gap-2">
            {[0.25, 0.5, 0.75, 1.0].map((acc) => (
              <button
                key={acc}
                type="button"
                onClick={() => onComplete(acc)}
                className="rounded-lg px-4 py-2 text-xs font-semibold transition hover:opacity-80"
                style={{ backgroundColor: "var(--brand-ink)", color: "#fff" }}
              >
                {Math.round(acc * 100)}%
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Fill Blanks ---------- */
function FillBlanksPanel({
  state,
  onUpdate,
  onSubmit,
  onComplete,
}: {
  state: { phase: string; questions: any[]; userAnswers: string[]; correctCount: number };
  onUpdate: (i: number, v: string) => void;
  onSubmit: () => void;
  onComplete: (acc: number) => void;
}) {
  if (state.phase === "done") {
    const pct = state.questions.length > 0 ? state.correctCount / state.questions.length : 0;
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
          正确 {state.correctCount} / {state.questions.length}
        </p>
        {state.questions.map((q, i) => (
          <div
            key={i}
            className="rounded-lg p-3 text-sm"
            style={{ backgroundColor: "var(--warm-50)", color: "var(--brand-ink)" }}
          >
            <span>{q.sentence.replace(q.blank, `【${q.answer}】`)}</span>
            {state.userAnswers[i] !== q.answer && (
              <span className="ml-2 text-xs text-red-500">(你填的: {state.userAnswers[i] || "空"})</span>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onComplete(pct)}
          className="rounded-lg px-6 py-2 text-sm font-semibold text-white transition"
          style={{ backgroundColor: "var(--brand-ink)" }}
        >
          完成并记录
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state.questions.map((q, i) => (
        <div key={i} className="space-y-1">
          <p className="text-sm" style={{ color: "var(--brand-ink)" }}>
            {q.sentence}
          </p>
          <input
            type="text"
            value={state.userAnswers[i]}
            onChange={(e) => onUpdate(i, e.target.value)}
            placeholder="填入缺失的字词..."
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-stone-400"
            style={{ borderColor: "var(--warm-50)", color: "var(--brand-ink)" }}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={onSubmit}
        className="w-full rounded-lg px-6 py-2 text-sm font-semibold text-white transition"
        style={{ backgroundColor: "var(--brand-ink)" }}
      >
        提交答案
      </button>
    </div>
  );
}

/* ---------- Pairs ---------- */
function PairsPanel({
  state,
  onSelectClue,
  onSelectAnswer,
  onComplete,
}: {
  state: {
    phase: string;
    clueItems: any[];
    answerPool: string[];
    selectedClue: string | null;
    selectedAnswer: string | null;
    matched: Record<string, string>;
    correctCount: number;
  };
  onSelectClue: (k: string) => void;
  onSelectAnswer: (a: string) => void;
  onComplete: (acc: number) => void;
}) {
  if (state.phase === "done") {
    const total = state.clueItems.length;
    const pct = total > 0 ? state.correctCount / total : 0;
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
          正确 {state.correctCount} / {total}
        </p>
        <button
          type="button"
          onClick={() => onComplete(pct)}
          className="rounded-lg px-6 py-2 text-sm font-semibold text-white transition"
          style={{ backgroundColor: "var(--brand-ink)" }}
        >
          完成并记录
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* clues */}
      <div className="grid grid-cols-2 gap-3">
        {state.clueItems.map((c) => {
          const isMatched = state.matched[c.key] !== undefined;
          const isSelected = state.selectedClue === c.key;
          return (
            <button
              key={c.key}
              type="button"
              disabled={isMatched}
              onClick={() => onSelectClue(c.key)}
              className={`rounded-lg border p-3 text-sm transition ${
                isSelected ? "ring-2 ring-stone-500" : ""
              } ${isMatched ? "opacity-50" : "hover:bg-[var(--warm-50)]"}`}
              style={{ borderColor: "var(--warm-50)", color: "var(--brand-ink)" }}
            >
              {c.prompt}
            </button>
          );
        })}
      </div>

      {/* answer pool */}
      <div className="flex flex-wrap gap-2">
        {state.answerPool.map((ans) => {
          const used = Object.values(state.matched).includes(ans);
          return (
            <button
              key={ans}
              type="button"
              disabled={used || !state.selectedClue}
              onClick={() => onSelectAnswer(ans)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                !used && state.selectedClue ? "hover:bg-[var(--warm-50)]" : ""
              } ${used ? "opacity-30" : ""}`}
              style={{ borderColor: "var(--warm-50)", color: "var(--brand-ink)" }}
            >
              {ans}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Dictation ---------- */
function DictationPanel({
  state,
  onInput,
  onSubmit,
  onComplete,
}: {
  state: { phase: string; userInput: string; feedback: string | null };
  onInput: (v: string) => void;
  onSubmit: () => void;
  onComplete: (acc: number) => void;
}) {
  if (state.phase === "check") {
    const correct = state.feedback === "完全正确！";
    return (
      <div className="space-y-4 text-center">
        <p
          className={`text-lg font-semibold ${correct ? "text-green-600" : "text-red-500"}`}
        >
          {state.feedback}
        </p>
        <button
          type="button"
          onClick={() => onComplete(correct ? 1 : 0.5)}
          className="rounded-lg px-6 py-2 text-sm font-semibold text-white transition"
          style={{ backgroundColor: "var(--brand-ink)" }}
        >
          完成并记录
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--ink-50)" }}>
        请从记忆中将全诗默写下来：
      </p>
      <textarea
        value={state.userInput}
        onChange={(e) => onInput(e.target.value)}
        rows={6}
        className="w-full rounded-lg border p-3 text-sm leading-relaxed outline-none transition focus:border-stone-400"
        style={{ borderColor: "var(--warm-50)", color: "var(--brand-ink)" }}
        placeholder="在此默写..."
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!state.userInput.trim()}
        className="w-full rounded-lg px-6 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
        style={{ backgroundColor: "var(--brand-ink)" }}
      >
        提交默写
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Search + Enroll section                                            */
/* ------------------------------------------------------------------ */

function SearchSection({
  query,
  results,
  loading,
  error,
  onQueryChange,
  onSearch,
  onEnroll,
  activeItems,
}: {
  query: string;
  results: any[];
  loading: boolean;
  error: string | null;
  onQueryChange: (q: string) => void;
  onSearch: (q: string) => void;
  onEnroll: (poemId: string) => void;
  activeItems: MemoryItem[];
}) {
  const activeIds = new Set(activeItems.map((it) => it.poemId));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <SectionCard className="space-y-4 p-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
        搜索并添加诗词
      </h3>

      {/* search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入诗词名或作者..."
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-stone-400"
          style={{ borderColor: "var(--warm-50)", color: "var(--brand-ink)" }}
        />
        <button
          type="button"
          onClick={() => query.trim() && onSearch(query.trim())}
          disabled={!query.trim() || loading}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
          style={{ backgroundColor: "var(--brand-ink)" }}
        >
          {loading ? "搜索中..." : "搜索"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* results */}
      {results.length > 0 && (
        <div className="divide-y" style={{ borderColor: "var(--warm-50)" }}>
          {results.map((poem: any) => {
            const enrolled = activeIds.has(poem.id);
            return (
              <div key={poem.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
                    {poem.title}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--ink-50)" }}>
                    {poem.author} · {poem.dynasty}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={enrolled}
                  onClick={() => onEnroll(poem.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    enrolled ? "opacity-40" : "hover:opacity-80"
                  }`}
                  style={{ backgroundColor: "var(--brand-ink)", color: "#fff" }}
                >
                  {enrolled ? "已添加" : "加入记忆"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {results.length === 0 && query && !loading && !error && (
        <p className="text-center text-xs" style={{ color: "var(--ink-50)" }}>
          输入关键词搜索诗词
        </p>
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function MemoryTabContent() {
  const mem = useMemoryTab();
  const [activeReviewItem, setActiveReviewItem] = useState<MemoryItem | null>(null);

  /* When user picks an item from the queue */
  const handleSelectItem = (item: MemoryItem) => {
    setActiveReviewItem(item);
  };

  const handleCancelReview = () => {
    setActiveReviewItem(null);
  };

  const handleSubmitReview = async (quality: number) => {
    if (!activeReviewItem) return;
    const ok = await mem.submitReview(activeReviewItem, quality);
    if (ok) {
      setActiveReviewItem(null);
      mem.loadStats();
    }
  };

  const handleSearch = (keyword: string) => {
    mem.searchPoems(keyword);
  };

  const handleEnroll = async (poemId: string) => {
    await mem.enrollPoem(poemId);
    mem.setSearchQuery("");
  };

  const handleDrillComplete = async (accuracy: number) => {
    if (!mem.selectedMemoryItem) return;
    await mem.completeDrillWithQuality(mem.selectedMemoryItem, accuracy);
    mem.loadStats();
  };

  /* ---- Render ---- */
  if (activeReviewItem) {
    return (
      <div className="space-y-6">
        <ReviewWorkspace
          item={activeReviewItem}
          savingId={mem.savingId}
          onSubmitReview={handleSubmitReview}
          onCancel={handleCancelReview}
        />
      </div>
    );
  }

  if (mem.selectedMemoryItem && mem.drill.mode !== "idle") {
    return (
      <div className="space-y-6">
        <DrillWorkspace
          item={mem.selectedMemoryItem}
          drill={mem.drill}
          drillError={mem.drillError}
          savingId={mem.savingId}
          onCancel={mem.cancelDrill}
          onReciteNext={mem.reciteNextPhase}
          onUpdateBlank={mem.updateBlankAnswer}
          onSubmitBlanks={mem.submitFillBlanks}
          onSelectClue={mem.selectClue}
          onSelectAnswer={mem.selectAnswer}
          onDictationInput={mem.updateDictationInput}
          onSubmitDictation={mem.submitDictation}
          onComplete={handleDrillComplete}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* message toast */}
      {mem.message && (
        <div
          className="rounded-lg px-4 py-2 text-center text-sm font-semibold"
          style={{ backgroundColor: "var(--warm-50)", color: "var(--brand-ink)" }}
        >
          {mem.message}
        </div>
      )}

      {/* stats dashboard */}
      <StatsDashboard
        stats={mem.statsData}
        masteryPct={mem.masteryPct}
        heatmapCells={mem.heatmapCells}
        statsLoading={mem.statsLoading}
        achievementsCount={mem.achievements.filter((a) => a.unlockedAt).length}
      />

      {/* workspace tabs */}
      <PillNav
        items={[
          { id: "review", label: "复习" },
          { id: "digest", label: "回顾" },
        ]}
        value={mem.activeWorkspace}
        onChange={(key: string) => mem.setActiveWorkspace(key as any)}
      />

      {/* drill mode selector for review workspace */}
      {mem.activeWorkspace === "review" && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs self-center mr-2" style={{ color: "var(--ink-50)" }}>
            练习模式:
          </span>
          {(["recite", "fillBlanks", "pairs", "dictation"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                /* user selects an item first, then mode is activated in the queue */
                const first = mem.items[0];
                if (first) {
                  mem.startDrill(first, mode);
                }
              }}
              disabled={mem.items.length === 0}
              className="rounded-full border px-3 py-1 text-xs transition hover:bg-[var(--warm-50)] disabled:opacity-30"
              style={{ borderColor: "var(--warm-50)", color: "var(--brand-ink)" }}
            >
              {drillModeLabel(mode)}
            </button>
          ))}
        </div>
      )}

      {/* today queue */}
      {mem.activeWorkspace === "review" && (
        <QueueSection
          items={mem.items}
          total={mem.total}
          page={mem.page}
          pageSize={mem.pageSize}
          dueCount={mem.dueCount}
          onlyDue={mem.onlyDue}
          queueLoading={mem.queueLoading}
          queueError={mem.queueError}
          savingId={mem.savingId}
          onPageChange={mem.setPage}
          onToggleOnlyDue={mem.toggleOnlyDue}
          onSelectItem={handleSelectItem}
        />
      )}

      {/* digest workspace (achievements / stats detail) */}
      {mem.activeWorkspace === "digest" && (
        <SectionCard className="space-y-4 p-4">
          <h3 className="text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
            成就与回顾
          </h3>

          {mem.achievements.length === 0 ? (
            <EmptyState
              icon="trophy"
              title="暂无成就"
              description="坚持复习，解锁记忆成就"
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {mem.achievements.map((ach) => {
                const unlocked = !!ach.unlockedAt;
                return (
                  <div
                    key={ach.id}
                    className={`rounded-lg border p-3 transition ${unlocked ? "" : "opacity-50"}`}
                    style={{ borderColor: "var(--warm-50)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{ach.icon}</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--brand-ink)" }}>
                          {ach.title}
                        </p>
                        <p className="text-xs" style={{ color: "var(--ink-50)" }}>
                          {ach.description}
                        </p>
                      </div>
                    </div>
                    {!unlocked && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full rounded-full bg-[var(--warm-50)]">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (ach.progress / ach.target) * 100)}%`,
                              backgroundColor: "var(--brand-ink)",
                            }}
                          />
                        </div>
                        <p className="mt-1 text-right text-xs" style={{ color: "var(--ink-50)" }}>
                          {ach.progress} / {ach.target}
                        </p>
                      </div>
                    )}
                    {unlocked && (
                      <p className="mt-1 text-xs" style={{ color: "var(--ink-50)" }}>
                        {ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* search + enroll */}
      <SearchSection
        query={mem.searchQuery}
        results={mem.searchResults}
        loading={mem.searchLoading}
        error={mem.searchError}
        onQueryChange={mem.setSearchQuery}
        onSearch={handleSearch}
        onEnroll={handleEnroll}
        activeItems={mem.items}
      />
    </div>
  );
}
