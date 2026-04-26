import { useState } from "react";
import { Sparkles, Dices, Plus } from "lucide-react";

const IMAGERY_POOL = [
  "孤舟", "残月", "寒砧", "落花", "飞雪", "长亭", "折柳", "秋风", "白云", "青山",
  "归雁", "夕阳", "流水", "黄叶", "青苔", "晚钟", "晨霜", "疏影", "暗香", "清泉",
  "远帆", "渔火", "古道", "西风", "瘦马", "明月", "清风", "白露", "红叶", "绿水"
];

interface ImageryGachaProps {
  onAppendImagery: (imagery: string) => void;
}

export function ImageryGacha({ onAppendImagery }: ImageryGachaProps): JSX.Element {
  const [cards, setCards] = useState<string[]>([]);
  const [isRolling, setIsRolling] = useState(false);

  const rollGacha = () => {
    if (isRolling) return;
    setIsRolling(true);
    
    // Simulate rolling animation
    setTimeout(() => {
      const shuffled = [...IMAGERY_POOL].sort(() => 0.5 - Math.random());
      setCards(shuffled.slice(0, 3));
      setIsRolling(false);
    }, 500);
  };

  return (
    <div className="mt-4 rounded-2xl bg-stone-50/80 p-4 border border-stone-100">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-[#C9A96E]" />
          灵感枯竭？试试意象抽卡
        </p>
        <button
          type="button"
          onClick={rollGacha}
          disabled={isRolling}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-[#1A2B4C] shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
        >
          <Dices className={`h-3.5 w-3.5 ${isRolling ? "animate-spin" : ""}`} />
          抽取意象
        </button>
      </div>

      {cards.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {cards.map((card, idx) => (
            <div 
              key={`${card}-${idx}`}
              className="group relative overflow-hidden rounded-xl bg-white p-3 text-center shadow-sm border border-[#C9A96E]/20 transition hover:border-[#C9A96E]/50 hover:shadow-md"
            >
              <div className="absolute -right-4 -top-4 h-12 w-12 rounded-full bg-[#C9A96E]/10 transition group-hover:scale-150" />
              <p className="relative font-serif text-lg text-[#1A2B4C]">{card}</p>
              <button
                type="button"
                onClick={() => onAppendImagery(card)}
                className="relative mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-stone-50 py-1 text-[10px] text-slate-500 transition hover:bg-[#C9A96E] hover:text-white"
              >
                <Plus className="h-3 w-3" />
                加入灵感
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
