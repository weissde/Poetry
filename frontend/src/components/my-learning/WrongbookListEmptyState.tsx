import { Link } from "react-router-dom";
import { SpotlightCard } from "@/components/react-bits";

interface WrongbookListEmptyStateProps {
  onResetFilters: () => void;
}

export function WrongbookListEmptyState({ onResetFilters }: WrongbookListEmptyStateProps): JSX.Element {
  return (
    <SpotlightCard
      className="rounded-[22px] bg-stone-50 px-6 py-10 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16)]"
      spotlightColor="rgba(201,169,110,0.12)"
    >
      <div className="mx-auto max-w-lg text-center">
        <p className="text-2xl" aria-hidden>
          📭
        </p>
        <h3 className="mt-3 font-display text-xl text-[#1A2B4C]">错题本还是空的</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          当前筛选下没有错题记录。完成练习后，答错的题目会自动收录到这里；你也可以先重置筛选看看是否有被隐藏的条目。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={onResetFilters} className="btn-secondary-compact">
            重置筛选
          </button>
          <Link
            to={`/practice?entry=practice&topic=${encodeURIComponent("错题预防巩固")}&count=6&difficulty=easy&auto=1&source=my_learning`}
            className="btn-primary-compact"
          >
            去做练习
          </Link>
          <Link to="/" className="btn-secondary-compact">
            返回首页
          </Link>
          <Link to="/exam" className="btn-secondary-compact">
            去考试中心
          </Link>
        </div>
      </div>
    </SpotlightCard>
  );
}
