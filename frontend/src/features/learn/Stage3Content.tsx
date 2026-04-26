import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";
import { PillNav } from "@/components/react-bits";
import { InquiryTaskCard } from "@/components/teaching/InquiryTaskCard";
import { ChatWindow } from "@/components/chat/ChatWindow";

type InquiryStageMode = "qa" | "poet";

interface Stage3ContentProps {
  inquiryTask: any;
  inquiryMode: InquiryStageMode;
  onInquiryModeChange: (mode: InquiryStageMode) => void;
  inquiryModeItems: ReadonlyArray<{ id: string; label: string }>;
  queuedPromptText: string | null;
  queuedPromptNonce: number;
  onPickQuestion: (question: string) => void;
  title: string;
  author: string;
  content: string;
  suggestedPoet: string;
  poemId: string | undefined;
  onAdvance: () => void;
}

export default function Stage3Content({
  inquiryTask,
  inquiryMode,
  onInquiryModeChange,
  inquiryModeItems,
  queuedPromptText,
  queuedPromptNonce,
  onPickQuestion,
  title,
  author,
  content,
  suggestedPoet,
  poemId,
  onAdvance,
}: Stage3ContentProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-8">
      {/* LEFT COLUMN */}
      <div className="space-y-6">
        {inquiryTask ? (
          <InquiryTaskCard data={inquiryTask} onPickQuestion={onPickQuestion} />
        ) : (
          <SectionCard title="探究任务" subtitle="选择一个预设问题开始对话">
            <p
              className="text-sm"
              style={{ color: "var(--ink-50)" }}
            >
              暂无可用任务，请直接输入你的问题。
            </p>
          </SectionCard>
        )}

        <SectionCard title="对话模式">
          <PillNav
            items={inquiryModeItems as ReadonlyArray<{ id: InquiryStageMode; label: string }>}
            value={inquiryMode}
            onChange={onInquiryModeChange}
          />
          <p
            className="text-xs mt-3"
            style={{ color: "var(--ink-40)" }}
          >
            {inquiryMode === "qa"
              ? "以问答形式深入解析诗歌内涵"
              : `穿越时空，与${suggestedPoet}展开对话`}
          </p>
        </SectionCard>
      </div>

      {/* RIGHT COLUMN */}
      <div className="space-y-6">
        <SectionCard
          title="Stage 3 · 探究对话"
          subtitle={inquiryMode === "qa" ? "问答模式" : "诗人穿越"}
        >
          <ChatWindow
            poemTitle={title}
            poemAuthor={author}
            poemContent={content}
            externalMode={inquiryMode === "poet" ? "poet" : "qa"}
            queuedPromptText={queuedPromptText}
            queuedPromptNonce={queuedPromptNonce}
            externalPoet={suggestedPoet as any}
          />
        </SectionCard>

        {/* Action buttons */}
        <div className="flex items-center gap-4">
          <Link
            to="/learn/memory"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              background: "rgba(200,155,90,0.12)",
              color: "var(--accent-gold)",
            }}
          >
            进入记忆练习
          </Link>
          <button
            onClick={onAdvance}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ml-auto"
            style={{
              background: "var(--brand-ink)",
              color: "var(--paper-base)",
            }}
          >
            转入创作迁移
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
