import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from"react";
import { MessageBubble } from"@/components/chat/MessageBubble";
import { useChat } from"@/hooks/useChat";
import type { ChatMode } from"@/hooks/useChat";
import { apiGet, apiPost } from"@/lib/api";
import type { PoetKey } from"@/lib/prompts";
import type { ChatSummaryRecord } from"@/types";

interface ChatWindowProps {
	 poemTitle: string;
	 poemAuthor: string;
	 poemContent: string;
	 queuedPromptText?: string | null;
	 queuedPromptNonce?: string | number | null;
	 externalMode?: ChatMode;
	 externalPoet?: PoetKey;
}

interface ChatSummaryListResponse {
 items: ChatSummaryRecord[];
 pagination?: {
 page: number;
 pageSize: number;
 total: number;
 totalPages: number;
 hasPrev: boolean;
 hasNext: boolean;
 };
}

const POET_OPTIONS: Array<{ value: PoetKey; label: string }> = [
 { value:"libai", label:"李白" },
 { value:"dufu", label:"杜甫" },
 { value:"wangwei", label:"王维" },
 { value:"baijuyi", label:"白居易" },
 { value:"wangchangling", label:"王昌龄" },
 { value:"lishangyin", label:"李商隐" },
 { value:"sushi", label:"苏轼" },
 { value:"xinqiji", label:"辛弃疾" },
 { value:"liqingzhao", label:"李清照" },
 { value:"taoyuanming", label:"陶渊明" },
 { value:"luyou", label:"陆游" },
 { value:"dumu", label:"杜牧" },
 { value:"menghaoran", label:"孟浩然" },
 { value:"censhen", label:"岑参" },
 { value:"gaoshi", label:"高适" },
 { value:"wangbo", label:"王勃" },
 { value:"luobinwang", label:"骆宾王" },
 { value:"hezhizhang", label:"贺知章" },
 { value:"lihe", label:"李贺" },
 { value:"liuyuxi", label:"刘禹锡" },
 { value:"hanyu", label:"韩愈" },
 { value:"liuzongyuan", label:"柳宗元" },
 { value:"yuanzhen", label:"元稹" },
 { value:"wentingyun", label:"温庭筠" },
 { value:"liyu", label:"李煜" },
 { value:"ouyangxiu", label:"欧阳修" },
 { value:"yanshu", label:"晏殊" },
 { value:"wanganshi", label:"王安石" },
 { value:"fanzhongyan", label:"范仲淹" },
 { value:"qinuan", label:"秦观" },
 { value:"hezhu", label:"贺铸" },
 { value:"jiangkui", label:"姜夔" },
 { value:"zhoubangyan", label:"周邦彦" },
];

const QA_PROMPT_TEMPLATES: string[] = [
  "这首诗最核心的情感是什么？请用3点解释。",
  "如果这首诗要应对考试题，最容易考哪些角度？",
  "这首诗和我现在的学习压力有什么共鸣？",
  "请帮我用“意象-情感-主旨”三步法快速理解这首诗。",
  "诗中最难理解的一句是哪一句？请拆成「字面义—语境义—情感义」讲解。",
  "如果把题目改成「分析某联的炼字」，你会从哪两个字切入？为什么？",
  "这首诗在结构上有没有「起承转合」或前后呼应？请各举一处说明。",
  "请列出两个常见的「易错理解」，并说明为什么错、正确理解是什么。",
  "用不超过 80 字写一段「课堂导入提问」，老师可以直接拿来问同学。",
  "帮我设计 3 个由浅入深的追问，用于课堂讨论而不是直接给答案。",
];

const POET_PROMPT_TEMPLATES: string[] = [
  "如果你是诗人本人，你写这首诗时最想表达什么？",
  "请用诗人的口吻，给现在的中学生一句学习建议。",
  "把这首诗和当代生活连接起来，给我一个现实场景。",
  "如果把这首诗写给今天的朋友，你会怎么改一句？",
  "你当时落笔前，眼前最先出现的是哪一个画面？为什么选它开篇？",
  "如果用一句诗概括你一生的追求，会选自己哪句作品？为什么？",
  "你最希望千年后的读者从这首诗里读懂你的哪一种心情？",
  "若穿越到今天，你会用什么现代事物来比喻诗中的核心意象？",
  "请用第一人称写一段 60 字内的「创作手记」，说明本诗最费心思的一处。",
  "如果让年轻读者背下两句，你会推荐哪两句？背诵时有什么诀窍？",
];

function safeFileToken(value: string): string {
 const normalized = String(value ||"")
 .trim()
 .replace(/[\\/:*?"<>|]/g,"_")
 .replace(/\s+/g,"_");
 return normalized ||"chat-summary";
}

function downloadText(filename: string, content: string): void {
 const blob = new Blob([content], { type:"text/markdown;charset=utf-8" });
 const href = URL.createObjectURL(blob);
 const anchor = document.createElement("a");
 anchor.href = href;
 anchor.download = filename;
 document.body.appendChild(anchor);
 anchor.click();
 document.body.removeChild(anchor);
 URL.revokeObjectURL(href);
}

export function ChatWindow({
	 poemTitle,
	 poemAuthor,
	 poemContent,
	 queuedPromptText,
	 queuedPromptNonce,
	 externalMode,
	 externalPoet,
}: ChatWindowProps): JSX.Element {
 const [mode, setMode] = useState<ChatMode>(externalMode || "qa");
 const [poet, setPoet] = useState<PoetKey>(externalPoet || "libai");
 const [input, setInput] = useState<string>("");
 const [summaryItems, setSummaryItems] = useState<ChatSummaryRecord[]>([]);
 const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
 const [summarySaving, setSummarySaving] = useState<boolean>(false);
 const [summaryNotice, setSummaryNotice] = useState<string>("");
 const [summaryPage, setSummaryPage] = useState<number>(1);
 const [summaryPageSize] = useState<number>(6);
 const [summaryTotalPages, setSummaryTotalPages] = useState<number>(1);
 const [summaryTotal, setSummaryTotal] = useState<number>(0);
 const [summaryFilterMode, setSummaryFilterMode] = useState<"all" |"qa" |"poet">("all");
 const [summaryFilterPoet, setSummaryFilterPoet] = useState<string>("all");
 const [speechSupported, setSpeechSupported] = useState<boolean>(false);
 const [speechListening, setSpeechListening] = useState<boolean>(false);
 const [speechError, setSpeechError] = useState<string>("");

	 const { messages, isStreaming, streamingContent, sendMessage, clearMessages, stopStreaming } = useChat();
	 const scrollRef = useRef<HTMLDivElement | null>(null);
	 const speechRecognitionRef = useRef<any>(null);
	 const processedQueuedPromptRef = useRef<string | number | null>(null);

 const poemContext = useMemo(
 () => `题目：${poemTitle ||"未知"}\n作者：${poemAuthor ||"未知"}\n原文：\n${poemContent ||"（未输入）"}`,
 [poemTitle, poemAuthor, poemContent],
 );

 const quickPrompts = useMemo(() => {
 const templates = mode ==="poet" ? POET_PROMPT_TEMPLATES : QA_PROMPT_TEMPLATES;
 const title = poemTitle.trim();
 const author = poemAuthor.trim();
 return templates.map((template) =>
 template
 .replace("这首诗", title ? `《${title}》` :"这首诗")
 .replace("诗人本人", author ? `${author}本人` :"诗人本人"),
 );
 }, [mode, poemTitle, poemAuthor]);

 const conversationGoal = useMemo(() => {
 const title = poemTitle.trim();
 if (mode ==="poet") {
 return title ? `围绕《${title}》做“写作动机-表达手法-现实迁移”三步追问。` :"围绕当前诗词做“写作动机-表达手法-现实迁移”三步追问。";
 }
 return title ? `围绕《${title}》做“主旨-考点-答题表达”三步追问。` :"围绕当前诗词做“主旨-考点-答题表达”三步追问。";
 }, [mode, poemTitle]);

 const guidedSteps = useMemo(
 () =>
 mode ==="poet"
 ? ["先问诗人写作时的情感和处境。","再追问一处意象如何支撑情感。","最后保存摘要并迁移到现实表达。"]
 : ["先确认情感主线与中心主旨。","再追问手法与考试常见设问。","最后保存摘要并转入练习或错题复盘。"],
 [mode],
 );

 useEffect(() => {
 const container = scrollRef.current;
 if (!container) {
 return;
 }
 container.scrollTop = container.scrollHeight;
 }, [messages, streamingContent]);

 useEffect(() => {
 const hasRecognition =
 typeof window !=="undefined" && ("SpeechRecognition" in window ||"webkitSpeechRecognition" in window);
 setSpeechSupported(Boolean(hasRecognition));
 }, []);

 useEffect(() => {
 return () => {
 if (speechRecognitionRef.current) {
 speechRecognitionRef.current.stop();
 speechRecognitionRef.current = null;
 }
 };
 }, []);

 const loadSummaries = useCallback(
 async (nextPage?: number): Promise<void> => {
 const targetPage = typeof nextPage ==="number" && Number.isFinite(nextPage) ? Math.max(1, Math.floor(nextPage)) : summaryPage;
 setSummaryLoading(true);
 try {
 const query = new URLSearchParams();
 query.set("page", String(targetPage));
 query.set("pageSize", String(summaryPageSize));
 if (poemTitle.trim()) {
 query.set("poemTitle", poemTitle.trim());
 }
 if (summaryFilterMode !=="all") {
 query.set("mode", summaryFilterMode);
 }
 if (summaryFilterPoet !=="all") {
 query.set("poet", summaryFilterPoet);
 }
 const data = await apiGet<ChatSummaryListResponse>(`/ai/chat/summaries?${query.toString()}`, {
 cacheTtlMs: 15000,
 });
 setSummaryItems(data.items || []);
 const pagination = data.pagination;
 if (pagination) {
 setSummaryPage(Math.max(1, pagination.page || targetPage));
 setSummaryTotalPages(Math.max(1, pagination.totalPages || 1));
 setSummaryTotal(Math.max(0, pagination.total || 0));
 } else {
 setSummaryPage(targetPage);
 setSummaryTotalPages(1);
 setSummaryTotal((data.items || []).length);
 }
 } catch {
 // Keep chat interaction smooth even when summary history fails.
 } finally {
 setSummaryLoading(false);
 }
 },
 [poemTitle, summaryFilterMode, summaryFilterPoet, summaryPage, summaryPageSize],
 );

	 useEffect(() => {
	 void loadSummaries(1);
	 }, [loadSummaries]);

 useEffect(() => {
	 const prompt = String(queuedPromptText ||"").trim();
	 if (!prompt || queuedPromptNonce == null || isStreaming || processedQueuedPromptRef.current === queuedPromptNonce) {
	 return;
	 }
	 processedQueuedPromptRef.current = queuedPromptNonce;
	 void sendMessage({
	 text: prompt,
	 mode,
	 poet,
	 poemContext,
	 });
	 }, [queuedPromptNonce, queuedPromptText, isStreaming, mode, poet, poemContext, sendMessage]);

 useEffect(() => {
 if (!externalMode) {
 return;
 }
 setMode(externalMode);
 }, [externalMode]);

 useEffect(() => {
 if (!externalPoet) {
 return;
 }
 setPoet(externalPoet);
 }, [externalPoet]);

	 const handleSaveSummary = useCallback(async (): Promise<void> => {
 if (isStreaming || messages.length < 2) {
 return;
 }
 setSummarySaving(true);
 setSummaryNotice("");
 try {
 const data = await apiPost<{ item: ChatSummaryRecord }>("/ai/chat/summary", {
 mode,
 poet,
 poemTitle,
 poemAuthor,
 poemContext,
 messages,
 forceAi: false,
 });
 if (data.item) {
 await loadSummaries(1);
 }
 setSummaryNotice("对话摘要已保存");
 } catch (error: unknown) {
 setSummaryNotice(error instanceof Error ? error.message :"摘要保存失败，请稍后重试。");
 } finally {
 setSummarySaving(false);
 }
 }, [isStreaming, messages, mode, poet, poemTitle, poemAuthor, poemContext, loadSummaries]);

 const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
 event.preventDefault();
 const text = input.trim();
 if (!text || isStreaming) {
 return;
 }

 setInput("");
 await sendMessage({
 text,
 mode,
 poet,
 poemContext,
 });
 };

 const handleQuickPrompt = async (prompt: string): Promise<void> => {
 if (!prompt.trim() || isStreaming) {
 return;
 }
 await sendMessage({
 text: prompt.trim(),
 mode,
 poet,
 poemContext,
 });
 };

 const toggleSpeechInput = (): void => {
 if (!speechSupported || isStreaming) {
 return;
 }

 const win = window as any;
 const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
 if (!RecognitionCtor) {
 setSpeechError("当前浏览器不支持语音输入。");
 return;
 }

 if (speechListening && speechRecognitionRef.current) {
 speechRecognitionRef.current.stop();
 return;
 }

 setSpeechError("");
 const recognition = new RecognitionCtor();
 recognition.lang ="zh-CN";
 recognition.continuous = false;
 recognition.interimResults = true;
 recognition.maxAlternatives = 1;

 recognition.onstart = () => {
 setSpeechListening(true);
 };

 recognition.onresult = (event: any) => {
 const result = event.results[0];
 if (!result) {
 return;
 }
 const transcript = result[0]?.transcript ||"";
 if (transcript.trim()) {
 setInput((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
 }
 };

 recognition.onerror = (event: any) => {
 if (event.error ==="not-allowed") {
 setSpeechError("语音权限被拒绝，请在浏览器地址栏允许麦克风权限。");
 } else if (event.error ==="no-speech") {
 setSpeechError("未识别到语音，请再试一次。");
 } else {
 setSpeechError(`语音识别失败：${event.error}`);
 }
 };

 recognition.onend = () => {
 setSpeechListening(false);
 speechRecognitionRef.current = null;
 };

 speechRecognitionRef.current = recognition;
 recognition.start();
 };

 const applySummaryToInput = (item: ChatSummaryRecord): void => {
 const lastQuestion = String(item.last_question ||"").trim();
 const keyPoint = Array.isArray(item.key_points) && item.key_points.length > 0 ? String(item.key_points[0] ||"").trim() :"";
 const fallback = String(item.summary ||"").trim();

 const nextInput =
 lastQuestion ||
 (keyPoint ? `请围绕这一点继续展开：${keyPoint}` :"") ||
 (fallback ? `请基于这段摘要继续讲解：${fallback}` :"");

 if (nextInput) {
 setInput(nextInput);
 }

 if (item.mode ==="qa" || item.mode ==="poet") {
 setMode(item.mode);
 }

 const poetValue = String(item.poet ||"").trim();
 if (poetValue && POET_OPTIONS.some((option) => option.value === poetValue)) {
 setPoet(poetValue as PoetKey);
 }
 };

 const summaryHasPrev = summaryPage > 1;
 const summaryHasNext = summaryPage < summaryTotalPages;
 const poetLabelMap = useMemo(() => {
 const map = new Map<string, string>();
 POET_OPTIONS.forEach((item) => {
 map.set(item.value, item.label);
 });
 return map;
 }, []);

 const formatSummaryAsNote = (item: ChatSummaryRecord): string => {
 const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() :"";
 const modeLabel = item.mode ==="poet" ?"诗人对话" :"问答学习";
 const poetLabel = item.mode ==="poet" ? poetLabelMap.get(String(item.poet ||"").trim()) || String(item.poet ||"诗人") :"";
 const titleLine = poemTitle.trim() ? `《${poemTitle.trim()}》` :"当前诗词";
 const lines: string[] = [];
 lines.push(`# 对话学习小结：${titleLine}`);
 lines.push("");
 lines.push(`- 时间：${createdAt ||"-"}`);
 lines.push(`- 模式：${modeLabel}${poetLabel ? `（${poetLabel}）` :""}`);
 lines.push(`- 消息数：${item.message_count}`);
 lines.push("");
 lines.push("## 小结");
 lines.push(item.summary ||"");
 lines.push("");
 if (Array.isArray(item.key_points) && item.key_points.length > 0) {
 lines.push("## 关键要点");
 item.key_points.slice(0, 8).forEach((point) => {
 lines.push(`- ${point}`);
 });
 lines.push("");
 }
 if (item.last_question) {
 lines.push("## 下一问建议");
 lines.push(item.last_question);
 lines.push("");
 }
 return lines.join("\n");
 };

 const copySummaryAsNote = async (item: ChatSummaryRecord): Promise<void> => {
 const text = formatSummaryAsNote(item);
 try {
 if (navigator?.clipboard?.writeText) {
 await navigator.clipboard.writeText(text);
 setSummaryNotice("摘要笔记已复制，可粘贴到学习笔记。");
 return;
 }
 throw new Error("clipboard not supported");
 } catch {
 setSummaryNotice("复制失败，请使用“导出MD”保存后手动粘贴。");
 }
 };

 const exportSummaryAsMarkdown = (item: ChatSummaryRecord): void => {
 const text = formatSummaryAsNote(item);
 const title = poemTitle.trim() ||"poem";
 const filename = `${safeFileToken(title)}_chat_summary_${Date.now()}.md`;
 downloadText(filename, text);
 setSummaryNotice("摘要已导出为 Markdown。");
 };

 return (
 <section className="result-card card-cozy">
 <header className="flex flex-wrap items-center justify-between gap-3 shadow-[inset_0_-1px_0_rgba(148,163,184,0.22)] pb-3">
 <div>
 <h3 className="mt-1 font-display text-2xl text-ink-700">AI 导师对话</h3>
 <p className="mt-1 text-sm text-slate-500">按三步追问法补齐盲点，并把结论沉淀为摘要。</p>
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => {
 void handleSaveSummary();
 }}
 disabled={isStreaming || messages.length < 2 || summarySaving}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
 >
 {summarySaving ?"保存中..." :"保存摘要"}
 </button>
 <button type="button" onClick={clearMessages} className="btn-secondary-compact">
 清空会话
 </button>
 </div>
 </header>

 {summaryNotice ? (
 <p className="mt-3 rounded-lg shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-ink-50 px-3 py-2 text-xs text-ink-700">{summaryNotice}</p>
 ) : null}

 <div className="mt-4 flex flex-wrap items-center gap-2">
 <button
 type="button"
 className={["rounded-lg px-3 py-2 text-sm transition",
 mode ==="qa" ?"bg-ink-700 text-white" :"shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-slate-50/50 text-slate-700",
 ].join("")}
 onClick={() => setMode("qa")}
 >
 问答模式
 </button>
 <button
 type="button"
 className={["rounded-lg px-3 py-2 text-sm transition",
 mode ==="poet" ?"bg-ink-700 text-white" :"shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-slate-50/50 text-slate-700",
 ].join("")}
 onClick={() => setMode("poet")}
 >
 诗人模式
 </button>

 {mode ==="poet" ? (
 <select
 value={poet}
 onChange={(event) => setPoet(event.target.value as PoetKey)}
 className="input-main control-dense ml-0 w-full sm:ml-2 sm:w-auto"
 >
 {POET_OPTIONS.map((item) => (
 <option key={item.value} value={item.value}>
 {item.label}
 </option>
 ))}
 </select>
 ) : null}
 </div>

 <section className="mt-4 rounded-xl shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-ink-50/40 p-3">
 <p className="text-xs font-medium text-ink-700">导师引导</p>
 <p className="mt-1 text-sm leading-7 text-slate-700">{conversationGoal}</p>
 <ol className="mt-2 space-y-1 text-xs leading-6 text-slate-600">
 {guidedSteps.map((step) => (
 <li key={step}>{step}</li>
 ))}
 </ol>
 <div className="mt-3 flex flex-wrap gap-2">
 {quickPrompts.slice(0, 3).map((prompt) => (
 <button
 key={`${mode}-${prompt}`}
 type="button"
 disabled={isStreaming}
 onClick={() => {
 void handleQuickPrompt(prompt);
 }}
 className="rounded-full shadow-[inset_0_0_0_1px_rgba(26,43,76,0.24)] bg-slate-50/50 px-3 py-1.5 text-xs text-ink-700 transition hover:bg-slate-100/50 disabled:cursor-not-allowed disabled:opacity-60"
 >
 {prompt}
 </button>
 ))}
 </div>
 </section>

 <div ref={scrollRef} className="chat-scroll-panel mt-4 space-y-3">
 {messages.length === 0 ? (
 <div className="rounded-xl shadow-[inset_0_0_0_1px_rgba(148,163,184,0.20)] bg-slate-50/50 px-3 py-2 text-sm leading-7 text-slate-500">
 先点一条“引导提问”，完成 2-3 轮追问后再点击“保存摘要”。
 </div>
 ) : null}

 {messages.map((message, index) => (
 <MessageBubble key={`${message.role}-${index}`} role={message.role} content={message.content} />
 ))}

 {isStreaming ? <MessageBubble role="assistant" content={streamingContent ||"思考中"} isStreaming /> : null}
 </div>

 <form className="mt-4 flex flex-wrap items-center gap-2 sm:flex-nowrap" onSubmit={handleSubmit}>
 <input
 value={input}
 onChange={(event) => setInput(event.target.value)}
 className="input-main control-dense min-w-0 flex-1"
 placeholder="输入你的问题..."
 disabled={isStreaming}
 />

 {isStreaming ? (
 <button type="button" onClick={stopStreaming} className="btn-secondary-compact">
 停止
 </button>
 ) : null}

 {speechSupported ? (
 <button
 type="button"
 onClick={toggleSpeechInput}
 disabled={isStreaming}
 className={["btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-60",
 speechListening ?" bg-red-50 text-red-700 hover:bg-red-100" :"",
 ].join("")}
 >
 {speechListening ?"停止语音" :"语音输入"}
 </button>
 ) : null}

 <button
 type="submit"
 disabled={isStreaming || input.trim().length === 0}
 className="btn-primary-compact px-4 disabled:cursor-not-allowed disabled:opacity-60"
 >
 发送
 </button>
 </form>

 {speechError ? (
 <p className="mt-2 rounded-lg shadow-[inset_0_0_0_1px_rgba(245,158,11,0.26)] bg-amber-50 px-3 py-2 text-xs text-amber-700">{speechError}</p>
 ) : null}

 <section className="mt-5 rounded-xl bg-slate-50/40 backdrop-blur-sm p-4">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h4 className="text-sm font-medium text-slate-700">对话摘要与追问历史（{summaryTotal}）</h4>
 <button
 type="button"
 onClick={() => {
 void loadSummaries(summaryPage);
 }}
 className="btn-secondary-compact"
 >
 刷新
 </button>
 </div>

 <div className="mt-3 grid gap-2 sm:grid-cols-2">
 <select
 value={summaryFilterMode}
 onChange={(event) => {
 setSummaryFilterMode(event.target.value as"all" |"qa" |"poet");
 }}
 className="input-main control-compact"
 >
 <option value="all">全部模式</option>
 <option value="qa">问答学习</option>
 <option value="poet">诗人对话</option>
 </select>

 <select
 value={summaryFilterPoet}
 onChange={(event) => {
 setSummaryFilterPoet(event.target.value);
 }}
 className="input-main control-compact"
 >
 <option value="all">全部诗人</option>
 {POET_OPTIONS.map((item) => (
 <option key={`summary-poet-${item.value}`} value={item.value}>
 {item.label}
 </option>
 ))}
 </select>
 </div>

 {summaryLoading ? <p className="mt-3 text-xs text-slate-500">加载中...</p> : null}

 {!summaryLoading && summaryItems.length === 0 ? (
 <p className="mt-3 text-xs text-slate-500">暂无摘要，完成一轮对话后可点击“保存摘要”。</p>
 ) : null}

 {!summaryLoading && summaryItems.length > 0 ? (
 <div className="mt-3 space-y-2">
 {summaryItems.map((item) => (
 <article key={item.id} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-slate-50 p-3">
 <p className="text-xs text-slate-500">
 {new Date(item.created_at).toLocaleString()} · {item.mode ==="poet" ?"诗人对话" :"问答学习"} · {item.message_count} 条
 </p>
 <p className="mt-1 text-sm leading-6 text-slate-700">{item.summary}</p>
 {Array.isArray(item.key_points) && item.key_points.length > 0 ? (
 <div className="mt-2 flex flex-wrap gap-1">
 {item.key_points.slice(0, 3).map((point) => (
 <span
 key={`${item.id}-${point}`}
 className="rounded-full shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-white px-2 py-0.5 text-xs text-ink-700"
 >
 {point}
 </span>
 ))}
 </div>
 ) : null}
 <div className="mt-2 flex flex-wrap gap-2">
 <button
 type="button"
 onClick={() => applySummaryToInput(item)}
 className="rounded-md shadow-[inset_0_0_0_1px_rgba(26,43,76,0.24)] bg-white px-2 py-1 text-xs text-ink-700 transition hover:bg-ink-50"
 >
 继续此话题
 </button>
 <button
 type="button"
 onClick={() => {
 void copySummaryAsNote(item);
 }}
 className="rounded-md shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
 >
 复制摘要
 </button>
 <button
 type="button"
 onClick={() => exportSummaryAsMarkdown(item)}
 className="rounded-md shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
 >
 导出MD
 </button>
 </div>
 </article>
 ))}
 </div>
 ) : null}

 <div className="mt-3 flex items-center justify-between">
 <p className="text-xs text-slate-500">
 第 {summaryPage}/{summaryTotalPages} 页 · 共 {summaryTotal} 条
 </p>
 <div className="flex items-center gap-2">
 <button
 type="button"
 disabled={summaryLoading || !summaryHasPrev}
 onClick={() => {
 void loadSummaries(summaryPage - 1);
 }}
 className="rounded-md shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
 >
 上一页
 </button>
 <button
 type="button"
 disabled={summaryLoading || !summaryHasNext}
 onClick={() => {
 void loadSummaries(summaryPage + 1);
 }}
 className="rounded-md shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
 >
 下一页
 </button>
 </div>
 </div>
 </section>
 </section>
 );
}
