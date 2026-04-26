import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { apiPost } from "@/lib/api";
import type { PracticeQuestion } from "@/stores/practiceStore";
import { usePracticeStore } from "@/stores/practiceStore";
import { useWrongbookStore } from "@/stores/wrongbookStore";

interface QuestionCardProps {
 question: PracticeQuestion;
 index: number;
 total: number;
 poemTitle: string;
 practiceSourceKey?: string;
 onSubmitAnswer: (selected: number) => { isCorrect: boolean; correctAnswer: number } | null;
 onNext: () => void;
 onRetrySamePoint?: (question: PracticeQuestion) => void | Promise<void>;
}

function mergeQuestionSource(baseSource?: string, practiceSourceKey?: string): string | undefined {
 const base = (baseSource ||"").trim();
 const source = (practiceSourceKey ||"").trim();
 if (base && source) {
 return `${base}:${source}`;
 }
 if (base) {
 return base;
 }
 if (source) {
 return source;
 }
 return undefined;
}

function buildWrongReasonTemplate(
 question: PracticeQuestion,
 userAnswer: string,
 correctAnswer: string,
): string[] {
 const typeTips: Record<PracticeQuestion["type"], string[]> = {
 memorization: ["先圈出题干关键词，再在原诗中定位对应句。","优先回忆句序和高频易混字，避免“意思对但字错”。",
 ],
 meaning: ["先解释关键词，再结合上下文判断整句语义。","遇到近义选项时，优先选择“更贴合语境”的表达。",
 ],
 technique: ["先判断修辞/表现手法，再找诗句证据支撑。","答案尽量写成“手法 + 作用/效果”结构。",
 ],
 emotion: ["先找情感词与意象，再判断整体情感基调。","区分“思乡/忧国/惜春”等常见近似情感。",
 ],
 appreciation: ["先给结论，再用关键词句举证，最后点表达效果。","避免空泛评价，尽量写“诗句证据 + 分析”。",
 ],
 comparison: ["先找相同点（意象/情感），再写不同点（手法/语言）。","比较题尽量使用“甲诗…乙诗…”的对照句式。",
 ],
 context: ["先圈出题干情境关键词，再定位最匹配的名句。","语境默写要特别核对易错字和句序。",
 ],
 };

 const keywordHint = (question.keywordTags || []).slice(0, 3);
 const tips = [
 `本题你选了「${userAnswer}」，正确答案是「${correctAnswer}」。`,
 ...typeTips[question.type],
 ];
 if (keywordHint.length > 0) {
 tips.push(`本题重点关键词：${keywordHint.join(" /")}。下次先围绕这些词定位。`);
 }
 return tips;
}

export function QuestionCard({
 question,
 index,
 total,
 poemTitle,
 practiceSourceKey,
 onSubmitAnswer,
 onNext,
 onRetrySamePoint,
}: QuestionCardProps): JSX.Element {
 const [selected, setSelected] = useState<number | null>(null);
 const [submitted, setSubmitted] = useState<boolean>(false);
 const [result, setResult] = useState<{ isCorrect: boolean; correctAnswer: number } | null>(null);
 const [feedbackSaving, setFeedbackSaving] = useState<boolean>(false);
 const [feedbackNotice, setFeedbackNotice] = useState<string>("");

 const addWrongQuestion = useWrongbookStore((state) => state.addWrongQuestion);
 const reportAnswerResult = usePracticeStore((state) => state.reportAnswerResult);

 useEffect(() => {
 setSelected(null);
 setSubmitted(false);
 setResult(null);
 setFeedbackSaving(false);
 setFeedbackNotice("");
 }, [index]);

 const submitQuestionFeedback = async (): Promise<void> => {
 if (feedbackSaving) {
 return;
 }
 const comment = window.prompt("请简要描述你认为题目存在的问题（最多500字）：","");
 if (comment === null) {
 return;
 }
 const trimmed = comment.trim();
 if (!trimmed) {
 setFeedbackNotice("反馈已取消：未填写内容。");
 return;
 }

 setFeedbackSaving(true);
 setFeedbackNotice("");
 try {
 await apiPost("/practice/questions/feedback", {
 topic: poemTitle,
 questionType: question.type,
 questionContent: question.content,
 options: question.options,
 selectedIndex: selected,
 correctIndex: result?.correctAnswer ?? question.answer,
 comment: trimmed,
 source: mergeQuestionSource(question.questionSource, practiceSourceKey),
 });
 setFeedbackNotice("已提交题目反馈，感谢你的建议。");
 } catch (error: unknown) {
 setFeedbackNotice(error instanceof Error ? error.message :"反馈提交失败，请稍后重试。");
 } finally {
 setFeedbackSaving(false);
 }
 };

 const handleSubmit = (): void => {
 if (selected === null || submitted) {
 return;
 }

 const submitResult = onSubmitAnswer(selected);
 if (!submitResult) {
 return;
 }

 setSubmitted(true);
 setResult(submitResult);

 void reportAnswerResult({
 questionType: question.type,
 isCorrect: submitResult.isCorrect,
 dynasty: question.dynasty,
 theme: question.theme,
 keywordTags: question.keywordTags || [],
 questionSource: mergeQuestionSource(question.questionSource, practiceSourceKey),
 });

 if (!submitResult.isCorrect) {
 const userAnswer = question.options[selected] ??"未作答";
 const correctAnswer = question.options[submitResult.correctAnswer] ??"未知";
 const reasonTips = buildWrongReasonTemplate(question, userAnswer, correctAnswer);
 const explanationWithReason = [
 question.explanation,"错因复盘模板：",
 ...reasonTips.map((item, reasonIndex) => `${reasonIndex + 1}. ${item}`),
 ].join("\n");

 const wrongItem = {
 id: crypto.randomUUID(),
 poemTitle: poemTitle ||"未命名练习",
 questionContent: question.content,
 userAnswer,
 correctAnswer,
 explanation: explanationWithReason,
 timestamp: new Date().toISOString(),
 };

 addWrongQuestion(wrongItem);

 void apiPost("/wrongbook", {
 questionId: question.id || null,
 poemTitle: wrongItem.poemTitle,
 questionContent: wrongItem.questionContent,
 userAnswer: wrongItem.userAnswer,
 correctAnswer: wrongItem.correctAnswer,
 explanation: wrongItem.explanation,
 errorType: question.type,
 questionKind:"objective",
 keywordTags: question.keywordTags || [],
 dynasty: question.dynasty,
 theme: question.theme,
 status:"pending",
 }).catch(() => {
 // ignore network error and keep local copy
 });
 }
 };

 return (
 <SpotlightCard className="p-6">
 <header className="flex items-center justify-between shadow-[inset_0_-1px_0_rgba(26,43,76,0.14)] pb-4">
 <h3 className="font-display text-2xl text-ink-700">练习题</h3>
 <span className="rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-700">
 第 {index + 1} / {total} 题
 </span>
 </header>

 <div className="mt-5">
 <p className="text-base leading-8 text-slate-800">{question.content}</p>

 <div className="mt-5 space-y-3">
 {question.options.map((option, optionIndex) => {
 const isSelected = selected === optionIndex;
 const isCorrectOption = submitted && result?.correctAnswer === optionIndex;
 const isWrongSelected = submitted && isSelected && !result?.isCorrect;

 const className = ["w-full rounded-lg px-4 py-3 text-left text-sm transition",
 isSelected ?" bg-ink-700 text-white" :" bg-white/60 text-slate-700 hover:bg-slate-50/80 backdrop-blur-sm",
 submitted && !isSelected ?"opacity-90" :"",
 isCorrectOption ?" bg-green-50 text-green-800" :"",
 isWrongSelected ?" bg-red-50 text-red-700" :"",
 ]
 .filter(Boolean)
 .join("");

 return (
 <button
 key={`${option}-${optionIndex}`}
 type="button"
 onClick={() => {
 if (!submitted) {
 setSelected(optionIndex);
 }
 }}
 className={className}
 >
 {String.fromCharCode(65 + optionIndex)}. {option}
 </button>
 );
 })}
 </div>

 {!submitted ? (
 <button
 type="button"
 onClick={handleSubmit}
 disabled={selected === null}
 className="mt-6 rounded-lg bg-ink-700 px-4 py-2 text-sm text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
 >
 确认答案
 </button>
 ) : (
 <div className="mt-6 rounded-lg shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-warm-50 p-4">
 <p className={result?.isCorrect ?"text-sm text-green-700" :"text-sm text-red-700"}>
 {result?.isCorrect ?"回答正确" :"回答错误"}
 </p>
 <p className="mt-2 text-sm text-slate-700">
 正确答案：{String.fromCharCode(65 + (result?.correctAnswer ?? 0))}
 </p>
 <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
 AI 解析：{question.explanation}
 </p>
 <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
 <span className="font-medium text-slate-500">相关知识点：</span>
 <Link
 to={`/graph?highlight=${encodeURIComponent(poemTitle.trim() || "古诗词综合")}`}
 className="rounded-full bg-white/90 px-3 py-1 text-[#223A5E] no-underline shadow-[inset_0_0_0_1px_rgba(26,43,76,0.18)] transition hover:bg-white"
 >
 查看知识点图谱
 </Link>
 </div>
 {!result?.isCorrect ? (
 <div className="mt-3 rounded-lg shadow-[inset_0_0_0_1px_rgba(251,146,60,0.28)] bg-orange-50 p-3">
 <p className="text-sm font-medium text-orange-800">错因复盘模板</p>
 <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-orange-900">
 {buildWrongReasonTemplate(
 question,
 question.options[selected ?? 0] ??"未作答",
 question.options[result?.correctAnswer ?? 0] ??"未知",
 ).map((tip) => (
 <li key={tip}>{tip}</li>
 ))}
 </ul>
 </div>
 ) : null}

 <div className="mt-4 flex flex-wrap gap-2">
 {!result?.isCorrect && onRetrySamePoint ? (
 <button
 type="button"
 onClick={() => {
 void onRetrySamePoint(question);
 }}
 className="rounded-lg shadow-[inset_0_0_0_1px_rgba(26,43,76,0.24)] bg-white/60 backdrop-blur-sm px-4 py-2 text-sm text-ink-700 transition hover:bg-slate-50/80"
 >
 同知识点再练
 </button>
 ) : null}
 <button
 type="button"
 disabled={feedbackSaving}
 onClick={() => {
 void submitQuestionFeedback();
 }}
 className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
 >
 {feedbackSaving ?"提交中..." :"题目有误"}
 </button>
 <button
 type="button"
 onClick={onNext}
 className="btn-primary"
 >
 下一题
 </button>
 </div>
 {feedbackNotice ? (
 <p className="mt-3 rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white/60 backdrop-blur-sm px-3 py-2 text-xs text-slate-600">{feedbackNotice}</p>
 ) : null}
 </div>
 )}
 </div>
 </SpotlightCard>
 );
}
