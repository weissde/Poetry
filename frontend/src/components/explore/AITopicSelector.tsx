import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

export interface ExplorePreset {
  label: string;
  keyword: string;
  description: string;
  mood: string;
}

export const explorePresets: readonly ExplorePreset[] = [
  { label: "李白与杜甫诗风对比", keyword: "李白 杜甫 对比", description: "从仙与圣的角度，分析不同创作风格。", mood: "浪漫与现实" },
  { label: "送别诗意象体系", keyword: "送别 意象", description: "长亭、折柳、酒，拆解送别诗常见意象。", mood: "依依惜别" },
  { label: "边塞诗历史背景", keyword: "边塞 历史", description: "从盛唐到中晚唐，边塞诗的情感变迁。", mood: "金戈铁马" },
  { label: "月亮意象演变", keyword: "月亮 意象", description: "探索月亮在不同朝代诗词中的象征意义。", mood: "清冷幽远" },
] as const;

interface AITopicSelectorProps {
  onSelectTopic: (topic: string) => void;
}

export function AITopicSelector({ onSelectTopic }: AITopicSelectorProps): JSX.Element {
  const [customTopic, setCustomTopic] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTopic.trim()) {
      onSelectTopic(customTopic.trim());
      setCustomTopic("");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-[24px] bg-white p-6 shadow-[0_12px_28px_rgba(26,43,76,0.06)]">
        <div className="flex items-center gap-2 mb-4">
          <span className="rounded-full bg-[#F3E7CE] px-2 py-1 text-[11px] font-medium text-[#8A6330]">
            📌 预设主题
          </span>
          <h2 className="font-serif text-xl text-[#1A2B4C]">发现灵感</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {explorePresets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onSelectTopic(preset.label)}
              className="group flex flex-col items-start justify-between rounded-2xl bg-stone-50 p-4 text-left transition hover:bg-stone-100"
            >
              <div>
                <p className="font-medium text-[#1A2B4C] group-hover:text-[#C9A96E]">{preset.label}</p>
                <p className="mt-1 text-xs text-slate-500">{preset.description}</p>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] text-slate-400 shadow-sm">
                <Sparkles className="h-3 w-3" />
                {preset.mood}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] bg-[linear-gradient(135deg,#1A2B4C_0%,#2C4A78_100%)] p-6 shadow-[0_12px_28px_rgba(26,43,76,0.12)]">
        <div className="flex items-center gap-2 mb-4">
          <span className="rounded-full bg-white/20 px-2 py-1 text-[11px] font-medium text-white">
            ✏️ 自定义主题
          </span>
          <h2 className="font-serif text-xl text-white">开启对话</h2>
        </div>
        <p className="mb-6 text-sm text-stone-200/80">
          输入你感兴趣的文学话题、诗词对比，或是任何关于古代文学的疑问，AI 将为你生成探究工作台。
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="输入你的问题，如：李清照词中的愁..."
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder-stone-300 outline-none focus:bg-white/20 focus:ring-2 focus:ring-white/30"
          />
          <button
            type="submit"
            disabled={!customTopic.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#1A2B4C] transition hover:bg-stone-100 disabled:opacity-50"
          >
            开始探究 <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
