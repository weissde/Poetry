import { BookOpen, Brain, Compass, Heart, PenSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";
import { NextStepRecommendations } from "@/components/common/NextStepRecommendations";
import { SkeletonText } from "@/components/common/Skeleton";
import { formatDateTime } from "@/lib/learn-helpers";

interface Stage5ContentProps {
  examPointText: string;
  examPointBulletPoints: string[];
  title: string;
  author: string;
  content: string;
  graphHighlight: string;
  poemId: string | undefined;
  isFavorited: boolean;
  favoriteSaving: boolean;
  studyStateLoading: boolean;
  onToggleFavorite: () => void;
  noteDraft: string;
  onNoteChange: (value: string) => void;
  noteSaving: boolean;
  noteUpdatedAt: string | null;
  noteMessage: string | null;
  studyStateError: string | null;
  onSaveNote: () => void;
  relatedPoems: Array<{ id: string; title: string; author: string; dynasty: string }>;
  relatedLoading: boolean;
  relatedError: string | null;
}

export default function Stage5Content({
  examPointText,
  examPointBulletPoints,
  title,
  author,
  content,
  graphHighlight,
  poemId,
  isFavorited,
  favoriteSaving,
  studyStateLoading,
  onToggleFavorite,
  noteDraft,
  onNoteChange,
  noteSaving,
  noteUpdatedAt,
  noteMessage,
  studyStateError,
  onSaveNote,
  relatedPoems,
  relatedLoading,
  relatedError,
}: Stage5ContentProps) {
  const createTransferParams = new URLSearchParams();
  createTransferParams.set("source", "learn");
  createTransferParams.set("topic", title);
  createTransferParams.set("poemTitle", title);
  createTransferParams.set("poemAuthor", author);
  if (poemId) {
    createTransferParams.set("poemId", poemId);
  }
  if (content) {
    createTransferParams.set("poemContent", content);
  }
  const createTransferTo = `/create?${createTransferParams.toString()}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <SectionCard
        title="Stage 5 · 高频考点"
        subtitle="讲清考点后，立刻把学生送进练测、图谱和学情闭环。"
        weight="workspace"
        density="roomy"
      >
        <div className="grid gap-4">
          <article className="rounded-2xl bg-[linear-gradient(135deg,#FFF9EE_0%,#F5EAD5_100%)] px-4 py-4 shadow-[0_10px_24px_rgba(26,43,76,0.06)]">
            <p className="text-[11px] tracking-[0.16em] text-[#8A6B32]">考点提示</p>
            <p className="mt-2 text-sm leading-7 text-[#5A4B37]">{examPointText}</p>
            <div className="mt-3 grid gap-2">
              {examPointBulletPoints.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-white/75 px-3 py-2 text-sm leading-7 text-slate-700 shadow-[inset_0_0_0_1px_rgba(201,169,110,0.18)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-3 md:grid-cols-3">
            <Link
              to={`/practice?topic=${encodeURIComponent(title)}&count=6&difficulty=medium&auto=1&source=learn`}
              className="rounded-2xl bg-white px-4 py-4 text-inherit no-underline shadow-[0_10px_24px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5"
            >
              <BookOpen className="h-5 w-5 text-[#1A2B4C]" />
              <h3 className="mt-3 text-sm font-semibold text-[#1A2B4C]">做同诗练习</h3>
              <p className="mt-2 text-xs leading-6 text-slate-500">6 题快速巩固本诗高频考点。</p>
            </Link>
            <Link
              to={`/graph?highlight=${encodeURIComponent(graphHighlight)}`}
              className="rounded-2xl bg-white px-4 py-4 text-inherit no-underline shadow-[0_10px_24px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5"
            >
              <Compass className="h-5 w-5 text-[#1A2B4C]" />
              <h3 className="mt-3 text-sm font-semibold text-[#1A2B4C]">去图谱关联</h3>
              <p className="mt-2 text-xs leading-6 text-slate-500">查看这首诗在诗人、意象与主题网络中的位置。</p>
            </Link>
            <Link
              to="/my-learning?tab=diagnosis"
              className="rounded-2xl bg-white px-4 py-4 text-inherit no-underline shadow-[0_10px_24px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5"
            >
              <Brain className="h-5 w-5 text-[#1A2B4C]" />
              <h3 className="mt-3 text-sm font-semibold text-[#1A2B4C]">看学情反馈</h3>
              <p className="mt-2 text-xs leading-6 text-slate-500">把本轮精讲转成下一步的针对性巩固任务。</p>
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary-compact"
                  disabled={!poemId || favoriteSaving || studyStateLoading}
                  onClick={() => void onToggleFavorite()}
                >
                  <Heart className="h-3.5 w-3.5" fill={isFavorited ? "currentColor" : "none"} />
                  {isFavorited ? "已收藏" : "收藏本诗"}
                </button>
                <button type="button" className="btn-secondary-compact" disabled={!poemId || noteSaving} onClick={() => void onSaveNote()}>
                  <PenSquare className="h-3.5 w-3.5" />
                  {noteSaving ? "保存中..." : "保存札记"}
                </button>
              </div>
              <textarea
                value={noteDraft}
                onChange={(event) => onNoteChange(event.target.value)}
                className="learn-note-textarea mt-4"
                placeholder={poemId ? "把这首诗的板书重点、考点表达或自己的理解记在这里。" : "选择具体诗词后可保存札记。"}
                disabled={!poemId}
              />
              <p className="mt-2 text-xs text-slate-500">{noteUpdatedAt ? `上次保存：${formatDateTime(noteUpdatedAt)}` : "尚未保存札记"}</p>
              {noteMessage ? <p className="mt-2 text-xs text-emerald-700">{noteMessage}</p> : null}
              {studyStateError ? <p className="mt-2 text-xs text-rose-700">{studyStateError}</p> : null}
            </article>

            <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">关联延展</p>
              {relatedLoading ? <SkeletonText lines={2} className="mt-3" /> : null}
              {relatedError ? <p className="mt-3 text-sm text-rose-700">{relatedError}</p> : null}
              {!relatedLoading && relatedPoems.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">当前暂无关联推荐，可先进入图谱继续探索。</p>
              ) : (
                <div className="mt-3 grid gap-3">
                  {relatedPoems.slice(0, 3).map((poem) => (
                    <Link
                      key={poem.id}
                      to={`/learn/${poem.id}`}
                      className="rounded-2xl bg-white px-4 py-3 text-inherit no-underline shadow-[0_6px_18px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5"
                    >
                      <p className="font-display text-lg text-[#1A2B4C]">{poem.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {poem.author} · {poem.dynasty}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </article>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6">
        <SectionCard title="本轮收束" subtitle="让这一页自然过渡到练测、图谱和创作。" weight="summary" density="roomy">
          <div className="grid gap-3">
            <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">本页完成度</p>
              <p className="mt-2 font-display text-4xl text-[#1A2B4C]">100%</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">你已经走完整首诗的初见、解析、探究、记忆和考点五个阶段。</p>
            </article>
            <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
              <p className="text-[11px] tracking-[0.16em] text-slate-500">推荐下一步</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">先做一轮同诗练习，再根据错因进入图谱或学情页继续补薄弱点。</p>
            </article>
          </div>
        </SectionCard>

        <SectionCard title="继续学习" subtitle="保留完整能力闭环，不在这里终止。" weight="support" density="roomy">
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/practice?entry=practice&topic=${encodeURIComponent(title)}&count=6&difficulty=medium&auto=1&source=learn`}
              className="btn-primary"
            >
              去练测中心
            </Link>
            <Link to={createTransferTo} className="btn-secondary">
              开始创作迁移
            </Link>
          </div>
        </SectionCard>

        <NextStepRecommendations
          title="精讲完成后推荐动作"
          subtitle="把一首诗的课堂理解继续送往练测、图谱与创作迁移。"
          items={[
            {
              title: "做同诗练测",
              description: `围绕《${title}》立刻做一轮题组，确认对意象、情感与手法的理解是否稳定。`,
              to: `/practice?topic=${encodeURIComponent(title)}&count=6&difficulty=medium&auto=1&source=learn`,
              ctaLabel: "去练测",
              badge: "巩固",
            },
            {
              title: "打开知识图谱",
              description: "把这首诗放进诗人关系、意象网络和主题迁移中，补足比较阅读视角。",
              to: `/graph?highlight=${encodeURIComponent(graphHighlight)}`,
              ctaLabel: "去图谱",
              badge: "延展",
            },
            {
              title: "开始创作迁移",
              description: "趁理解还热，立刻把诗中的表达方式转成自己的输出，强化迁移。",
              to: createTransferTo,
              ctaLabel: "去创作",
              badge: "输出",
            },
          ]}
          className="mt-2"
        />
      </div>
    </div>
  );
}
