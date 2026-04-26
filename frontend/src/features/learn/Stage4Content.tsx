import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";
import type { MemoryQuestion } from "@/lib/learn-helpers";

interface MemoryResult extends MemoryQuestion {
  input: string;
  isCorrect: boolean;
}

interface Stage4ContentProps {
  memoryResults: MemoryResult[];
  memorySubmitted: boolean;
  showMemoryAnswers: boolean;
  memoryAccuracy: number;
  onAnswerChange: (id: string, value: string) => void;
  onSubmit: () => void;
  onToggleAnswers: () => void;
  onReset: () => void;
  onAdvance: () => void;
}

export default function Stage4Content({
  memoryResults,
  memorySubmitted,
  showMemoryAnswers,
  memoryAccuracy,
  onAnswerChange,
  onSubmit,
  onToggleAnswers,
  onReset,
  onAdvance,
}: Stage4ContentProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
      <SectionCard
        title="Stage 4 · 嵌入式填空"
        subtitle="不跳页完成一轮关键句填空，把刚刚理解的内容转成记忆动作。"
        weight="workspace"
        density="roomy"
      >
        <div className="grid gap-4">
          {memoryResults.map((question, index) => {
            const checked = memorySubmitted || showMemoryAnswers;
            const success = checked && question.isCorrect;
            const failed = checked && !question.isCorrect;
            return (
              <article
                key={question.id}
                className={[
                  "rounded-2xl px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition",
                  success ? "bg-emerald-50" : failed ? "bg-rose-50" : "bg-white",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">填空 {index + 1}</p>
                  <span className="text-xs text-slate-500">{question.hint}</span>
                </div>
                <p className="mt-2 font-display text-2xl leading-[1.9] text-[#1A2B4C]">{question.masked}</p>
                <input
                  value={question.input}
                  onChange={(event) => onAnswerChange(question.id, event.target.value)}
                  className="input-main mt-4 w-full"
                  placeholder="填入缺失字词"
                />
                {checked ? (
                  <p className={["mt-2 text-xs", success ? "text-emerald-700" : "text-rose-700"].join(" ")}>
                    {success ? "回答正确" : `参考答案：${question.answer} · 原句：${question.fullLine}`}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={onSubmit}>
            提交记忆练习
          </button>
          <button type="button" className="btn-secondary" onClick={onToggleAnswers}>
            {showMemoryAnswers ? "隐藏答案" : "显示答案"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onReset}
          >
            重新来一轮
          </button>
        </div>
      </SectionCard>

      <div className="grid gap-6">
        <SectionCard title="记忆反馈" subtitle="让学生知道自己此刻掌握到了哪一步。" weight="summary" density="roomy">
          <div className="grid gap-3">
            <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">本轮正确率</p>
              <p className="mt-2 font-display text-4xl text-[#1A2B4C]">{memoryAccuracy}%</p>
            </article>
            <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">建议动作</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {memoryAccuracy >= 80
                  ? "已经可以进入考点与练测阶段，巩固答题表达。"
                  : "建议先再做一轮填空，确认关键句已经稳定记住。"}
              </p>
            </article>
          </div>
        </SectionCard>

        <SectionCard title="下一步" subtitle="记忆结束后立即进入考点与练测，不让理解断掉。" weight="support" density="roomy">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary-compact" onClick={onAdvance}>
              去看考点
            </button>
            <Link to="/memory" className="btn-secondary-compact">
              打开完整记忆中心
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
