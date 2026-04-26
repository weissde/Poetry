import type { MessageRole } from"@/hooks/useChat";

interface MessageBubbleProps {
 role: MessageRole;
 content: string;
 isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming = false }: MessageBubbleProps): JSX.Element {
 const isUser = role ==="user";

 return (
 <div className={isUser ?"flex justify-end" :"flex justify-start"}>
 <div
 className={["max-w-[85%] whitespace-pre-wrap break-words px-4 py-3 text-sm leading-7",
 isUser
 ?"rounded-xl rounded-tr-sm bg-ink-700 text-white"
 :"rounded-xl rounded-tl-sm shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-slate-50/50 backdrop-blur-sm text-ink-900",
 ].join("")}
 >
 <span>{content}</span>
 {isStreaming ? <span className="ml-1 inline-block animate-pulse">▌</span> : null}
 </div>
 </div>
 );
}

