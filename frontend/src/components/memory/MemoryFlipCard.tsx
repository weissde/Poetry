import { motion } from "framer-motion";
import { BlurText } from "@/components/react-bits";
import { toPercent } from "@/lib/memoryUtils";
import type { MemoryReviewItem } from "@/types";

export function MemoryFlipCard({
  item,
  flipped,
  onToggle,
}: {
  item: MemoryReviewItem;
  flipped: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group relative h-[280px] w-full cursor-pointer rounded-[24px] text-left [perspective:1200px]"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.52, ease: "easeInOut" }}
        className="relative h-full w-full rounded-[24px] [transform-style:preserve-3d]"
      >
        <div className="absolute inset-0 rounded-[24px] bg-[linear-gradient(145deg,#1A2B4C,#2C4A78)] p-5 text-stone-100 shadow-[0_18px_40px_rgba(26,43,76,0.28)] [backface-visibility:hidden]">
          <p className="text-[11px] font-sans tracking-[0.12em] text-stone-200/80">记忆抽认卡 · 正面</p>
          <h3 className="mt-2 font-serif text-3xl leading-tight">{item.poem?.title || "未命名诗词"}</h3>
          <p className="mt-1 text-xs font-sans text-stone-200/75">
            {item.poem?.author || "未知作者"} · {item.poem?.dynasty || "未知朝代"}
          </p>
          <p className="mt-4 text-sm font-sans leading-7 text-stone-200/90">
            先在脑中默背全诗，再轻点翻面查看原文与关键提示。
          </p>
          <p className="absolute bottom-4 right-5 text-xs font-sans text-stone-200/70">点击翻面</p>
        </div>

        <div className="absolute inset-0 rounded-[24px] bg-[#FDFBF7] p-5 shadow-[0_16px_34px_rgba(26,43,76,0.12)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="text-[11px] font-sans tracking-[0.12em] text-slate-400">记忆抽认卡 · 背面</p>
          <BlurText text={item.poem?.content || "暂无诗词正文。"} className="mt-3 line-clamp-6 font-serif text-lg leading-9 text-[#1A2B4C]" />
          <p className="mt-3 text-xs font-sans text-slate-500">
            复习 {item.reviewCount} 次 · 成功率 {toPercent(item.successRate)}% · 间隔 {item.intervalDays} 天
          </p>
        </div>
      </motion.div>
    </button>
  );
}
