import { ChatWindow } from "@/components/chat/ChatWindow";
import { TiltedCard } from "@/components/react-bits";
import { Link } from "react-router-dom";
import type { PoemRecord } from "@/types";

interface AITopicWorkbenchProps {
  topic: string;
  relatedPoems: PoemRecord[];
  onClose: () => void;
  loadingRelatedPoems: boolean;
}

export function AITopicWorkbench({ topic, relatedPoems, onClose, loadingRelatedPoems }: AITopicWorkbenchProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
      <section className="flex flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_12px_28px_rgba(26,43,76,0.08)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <span className="text-[11px] font-sans tracking-[0.14em] text-slate-400">INQUIRY TOPIC</span>
            <h2 className="font-serif text-xl text-[#1A2B4C]">「{topic}」</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-stone-100 px-3 py-1.5 text-xs text-slate-500 hover:bg-stone-200 hover:text-slate-700"
          >
            退出探究
          </button>
        </div>
        
        <div className="flex-1 bg-stone-50 p-4">
          <ChatWindow
            poemTitle={topic}
            poemAuthor="主题探究"
            poemContent={`探究主题：${topic}`}
            queuedPromptText={`请围绕“${topic}”组织一次探究对话，先帮我梳理核心问题与切入角度。`}
            queuedPromptNonce={topic}
          />
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="rounded-[24px] bg-white p-5 shadow-[0_12px_28px_rgba(26,43,76,0.08)]">
          <h3 className="font-serif text-lg text-[#1A2B4C]">关联诗词</h3>
          <p className="mt-1 text-xs text-slate-500">与当前探究主题相关</p>
          
          <div className="mt-4 space-y-3">
            {loadingRelatedPoems ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))
            ) : relatedPoems.length > 0 ? (
              relatedPoems.map(poem => (
                <TiltedCard key={poem.id} className="block w-full">
                  <Link
                    to={`/explore?poemId=${poem.id}`}
                    className="block rounded-xl bg-stone-50 p-3 transition hover:bg-stone-100"
                  >
                    <p className="font-medium text-[#1A2B4C]">{poem.title}</p>
                    <p className="text-[11px] text-slate-500">{poem.dynasty} · {poem.author}</p>
                  </Link>
                </TiltedCard>
              ))
            ) : (
              <p className="text-sm text-slate-400">暂无关联诗词</p>
            )}
          </div>
        </div>
        
        <button
          type="button"
          className="rounded-xl bg-[#C9A96E] py-3 text-sm font-medium text-white shadow-[0_4px_14px_rgba(201,169,110,0.3)] transition hover:bg-[#B68747]"
        >
          保存探究记录
        </button>
      </aside>
    </div>
  );
}
