import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Compass,
  Heart,
  Pause,
  PenSquare,
  Play,
  Volume2,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { NextStepRecommendations } from "@/components/common/NextStepRecommendations";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import { BlurText, PillNav, type PillNavItem } from "@/components/react-bits";
import { InquiryTaskCard } from "@/components/teaching/InquiryTaskCard";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { TeachingStepBar, type TeachingStepBarItem } from "@/components/teaching/TeachingStepBar";
import { useTeachingMode } from "@/contexts/TeachingModeContext";
import { useAnalysis } from "@/hooks/useAnalysis";
import { usePoemTeachingContent } from "@/hooks/usePoemTeachingContent";
import {
  advanceTeachingSession,
  apiGet,
  apiPatch,
  apiPost,
  createTeachingSession,
  getPoemExamPoints,
} from "@/lib/api";
import type { PoetKey } from "@/lib/prompts";
import type {
  AnalysisDepth,
  PoemExamPointsPayload,
  PoemRecord,
  PoemStudyState,
  TeachingObjectiveItem,
} from "@/types";

type LearnStageId = "stage1" | "stage2" | "stage3" | "stage4" | "stage5";
type InquiryStageMode = "qa" | "poet";

interface LearnStageMeta extends TeachingStepBarItem {
  summary: string;
}

interface MemoryQuestion {
  id: string;
  masked: string;
  answer: string;
  fullLine: string;
  hint: string;
}

const demoPoem: PoemRecord = {
  id: "demo-jingyesi",
  title: "静夜思",
  author: "李白",
  dynasty: "唐",
  content: "床前明月光，疑是地上霜。\n举头望明月，低头思故乡。",
  tags: ["思乡", "月夜", "唐诗"],
  grade_level: ["primary", "middle"],
};

const learnStages: readonly LearnStageMeta[] = [
  {
    id: "stage1",
    index: "01",
    title: "初见",
    note: "原文与背景",
    summary: "先把诗读顺、读懂画面，再进入精讲。",
  },
  {
    id: "stage2",
    index: "02",
    title: "解析",
    note: "AI 多维拆解",
    summary: "从译解、意象、情感和手法四层进入。",
  },
  {
    id: "stage3",
    index: "03",
    title: "探究",
    note: "问答与穿越",
    summary: "把理解转成问题，完成课堂对话推进。",
  },
  {
    id: "stage4",
    index: "04",
    title: "记忆",
    note: "嵌入式填空",
    summary: "不跳页完成一轮嵌入式记忆练习。",
  },
  {
    id: "stage5",
    index: "05",
    title: "考点",
    note: "练测与图谱",
    summary: "收束考点，并跳转练测、图谱和学情。",
  },
];

const studentStageGoals: Record<LearnStageId, readonly string[]> = {
  stage1: ["读通全诗，先说出眼前画面与身体感受", "圈出 1-2 个关键意象，暂不判断主旨", "完成朗读后再进入分层解析"],
  stage2: ["按译解 → 意象 → 情感 → 手法逐层对照原文", "每条结论尽量引用诗句中的词作证据", "记下一条可在练测中复用的答题句式"],
  stage3: ["先用预设问题开口，再让 AI 追问而非代答", "把讨论结论用自己的话写进札记或摘要", "为下一阶段记忆练习预留 2 个重点句"],
  stage4: ["优先练「易错字 + 句序」的短句填空", "正确率稳定后再尝试半句或全篇默写", "把仍卡壳的句子标进错题/复习队列"],
  stage5: ["对照考点清单自查是否覆盖高频角度", "用一轮同诗练测检验迁移效果", "错题与图谱入口二选一补齐薄弱链"],
};

const stageHintMap: Record<LearnStageId, { title: string; detail: string }> = {
  stage1: {
    title: "先让学生看到画面",
    detail: "先读原文、抓意象，再追问“哪一句最先让你感到情绪变化”，不要一上来就讲标准答案。",
  },
  stage2: {
    title: "解析阶段要分层推进",
    detail: "建议按“译解 → 意象 → 情感 → 手法”的顺序推进，课堂上每次只讲一个层次，避免信息一次堆满。",
  },
  stage3: {
    title: "探究不是换一种讲解",
    detail: "优先用预设问题让学生先说，再用 AI 追问，把结论留给学生自己总结出来。",
  },
  stage4: {
    title: "记忆环节先巩固关键句",
    detail: "先做 2-3 个短句填空确认掌握，再决定是否进入全文默写，课堂上不建议一次拉太长。",
  },
  stage5: {
    title: "考点要立刻落到下一步动作",
    detail: "讲清高频考点后，直接引导学生去做同诗练习或进入图谱关联发现，形成闭环。",
  },
};

const depthNavItems: readonly PillNavItem<AnalysisDepth>[] = [
  { id: "lite", label: "轻量" },
  { id: "standard", label: "标准" },
  { id: "exam", label: "考点" },
];

const inquiryModeItems: readonly PillNavItem<InquiryStageMode>[] = [
  { id: "qa", label: "问答模式" },
  { id: "poet", label: "诗人穿越" },
];

function splitPoemLines(input: string): string[] {
  return String(input || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((line) => line.match(/[^，。！？；]+[，。！？；]?/g) || [])
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractStructuredLines(input: string, fallback: string[], limit = 4): string[] {
  const items = String(input || "")
    .split(/[\n。！？；]/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);
  return (items.length > 0 ? items : fallback).slice(0, limit);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}

function normalizeAnswer(value: string): string {
  return String(value || "")
    .replace(/[\s，。！？；、,.!?;:]/g, "")
    .trim()
    .toLowerCase();
}

function buildMemoryQuestions(content: string): MemoryQuestion[] {
  return splitPoemLines(content)
    .map((line, index) => {
      const stripped = line.replace(/[，。！？；、]/g, "").trim();
      if (stripped.length < 4) {
        return null;
      }
      const holeLength = stripped.length >= 6 ? 2 : 1;
      const start = Math.max(1, Math.floor((stripped.length - holeLength) / 2));
      const answer = stripped.slice(start, start + holeLength);
      return {
        id: `memory-${index}`,
        masked: `${stripped.slice(0, start)}${"□".repeat(holeLength)}${stripped.slice(start + holeLength)}`,
        answer,
        fullLine: line,
        hint: `提示：共 ${holeLength} 字，首字是“${answer.charAt(0)}”`,
      };
    })
    .filter((item): item is MemoryQuestion => Boolean(item))
    .slice(0, 3);
}

function inferPoetKey(author: string): PoetKey {
  const normalized = author.trim();
  const mapping: Record<string, PoetKey> = {
    李白: "libai",
    杜甫: "dufu",
    王维: "wangwei",
    白居易: "baijuyi",
    苏轼: "sushi",
    辛弃疾: "xinqiji",
    李清照: "liqingzhao",
    王昌龄: "wangchangling",
    杜牧: "dumu",
    孟浩然: "menghaoran",
  };
  return mapping[normalized] || "libai";
}

export default function LearnPage(): JSX.Element {
  const { poemId } = useParams<{ poemId: string }>();
  const { isTeacherMode, currentSessionId, setCurrentPoemId, setCurrentSessionId, setCurrentStep } = useTeachingMode();
  const { analysis, streamText, isLoading, error, source, analyzePoem, stop } = useAnalysis();

  const [activeStage, setActiveStage] = useState<LearnStageId>("stage1");
  const [studentObjectiveStage, setStudentObjectiveStage] = useState<LearnStageId>("stage1");
  const [inquiryMode, setInquiryMode] = useState<InquiryStageMode>("qa");
  const [queuedPromptText, setQueuedPromptText] = useState<string | null>(null);
  const [queuedPromptNonce, setQueuedPromptNonce] = useState<number>(0);

  const [currentPoem, setCurrentPoem] = useState<PoemRecord | null>(null);
  const [relatedPoems, setRelatedPoems] = useState<PoemRecord[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);

  const [studyStateLoading, setStudyStateLoading] = useState(false);
  const [studyStateError, setStudyStateError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string | null>(null);
  const { data: teachingContent, error: teachingContentError } = usePoemTeachingContent(poemId);
  const [examPoints, setExamPoints] = useState<PoemExamPointsPayload | null>(null);

  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [depth, setDepth] = useState<AnalysisDepth>("standard");
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const stageSyncKeyRef = useRef("");

  const [memoryAnswers, setMemoryAnswers] = useState<Record<string, string>>({});
  const [memorySubmitted, setMemorySubmitted] = useState(false);
  const [showMemoryAnswers, setShowMemoryAnswers] = useState(false);

  const title = currentPoem?.title || demoPoem.title;
  const author = currentPoem?.author || demoPoem.author;
  const content = currentPoem?.content || demoPoem.content;
  const dynasty = currentPoem?.dynasty || demoPoem.dynasty;
  const poemLines = useMemo(() => splitPoemLines(content), [content]);
  const memoryQuestions = useMemo(() => buildMemoryQuestions(content), [content]);
  const inquiryTask = useMemo(
    () => (teachingContent?.inquiryTasks?.length ? teachingContent.inquiryTasks[0] : null),
    [teachingContent?.inquiryTasks],
  );
  const suggestedPoet = useMemo(() => inferPoetKey(author), [author]);
  const currentStageMeta = useMemo(
    () => learnStages.find((stage) => stage.id === activeStage) || learnStages[0],
    [activeStage],
  );
  const studentPreviewStageMeta = useMemo(
    () => learnStages.find((stage) => stage.id === studentObjectiveStage) || learnStages[0],
    [studentObjectiveStage],
  );
  const learnStageNavItems: readonly PillNavItem<LearnStageId>[] = useMemo(
    () =>
      learnStages.map(
        (stage): PillNavItem<LearnStageId> => ({ id: stage.id as LearnStageId, label: `${stage.index} ${stage.title}` }),
      ),
    [],
  );

  const objective = useMemo<TeachingObjectiveItem>(
    () =>
      teachingContent?.teachingObjectives?.[0] || {
        title: "教学数据未准备好",
        summary: "当前诗词尚未配置教学目标与探究任务，请先补齐教学内容数据。",
        goals: ["补齐 teaching_objectives", "补齐 inquiry_tasks", "回到本页后继续精讲流程"],
        teacherHint: "请优先补齐数据库中的教学字段，避免页面回退到伪目标。",
      },
    [teachingContent?.teachingObjectives],
  );

  const translationRows = useMemo(() => {
    const meaningLines = extractStructuredLines(analysis?.annotationsAndTranslation.content || "", [
      "先抓住诗中的景象，再判断情绪从哪里开始变化。",
      "对照原文和译解，找出最关键的一组意象。",
      "把看见的画面说完整，再进入手法和主旨。",
      "解析完成后继续进入探究或练测巩固。",
    ]);
    return poemLines.map((line, index) => ({
      source: line,
      meaning: meaningLines[index] || meaningLines[meaningLines.length - 1] || "",
    }));
  }, [analysis?.annotationsAndTranslation.content, poemLines]);

  const analysisOutline = useMemo(() => {
    if (!analysis) {
      return {
        translation: objective.goals,
        emotion: extractStructuredLines(objective.summary, [objective.summary], 3),
        technique: extractStructuredLines(objective.teacherHint, [objective.teacherHint], 3),
      };
    }

    return {
      translation: extractStructuredLines(analysis.annotationsAndTranslation.content, objective.goals, 4),
      emotion: extractStructuredLines(analysis.themeAndEmotion.content, [objective.summary], 3),
      technique: extractStructuredLines(`${analysis.techniques.content}\n${analysis.examPoints.content}`, [objective.teacherHint], 3),
    };
  }, [analysis, objective.goals, objective.summary, objective.teacherHint]);

  const memoryResults = useMemo(() => {
    return memoryQuestions.map((question) => {
      const input = memoryAnswers[question.id] || "";
      return {
        ...question,
        input,
        isCorrect: normalizeAnswer(input) === normalizeAnswer(question.answer),
      };
    });
  }, [memoryAnswers, memoryQuestions]);

  const memoryCorrectCount = useMemo(
    () => memoryResults.filter((item) => item.isCorrect).length,
    [memoryResults],
  );
  const memoryAccuracy = memoryResults.length > 0 ? Math.round((memoryCorrectCount / memoryResults.length) * 100) : 0;

  useEffect(() => {
    setCurrentPoemId(poemId || null);
    return () => {
      setCurrentPoemId(null);
    };
  }, [poemId, setCurrentPoemId]);

  useEffect(() => {
    setStudentObjectiveStage(activeStage);
  }, [activeStage]);

  useEffect(() => {
    const nextStep = learnStages.findIndex((item) => item.id === activeStage) + 1;
    setCurrentStep(nextStep);
  }, [activeStage, setCurrentStep]);

  useEffect(() => {
    if (!isTeacherMode) {
      return;
    }
    const nextStep = learnStages.findIndex((item) => item.id === activeStage) + 1;
    if (nextStep <= 0) {
      return;
    }

    const syncKey = `${currentSessionId || "new"}:${poemId || "none"}:${nextStep}`;
    if (stageSyncKeyRef.current === syncKey) {
      return;
    }

    let cancelled = false;

    const syncSessionStep = async (): Promise<void> => {
      const payload = {
        currentStep: nextStep,
        poemId: poemId || undefined,
        poemTitle: currentPoem?.title || undefined,
      };

      try {
        let syncedSessionId = currentSessionId || "";
        if (currentSessionId) {
          try {
            const advanced = await advanceTeachingSession(currentSessionId, payload);
            syncedSessionId = advanced.session?.id || currentSessionId;
          } catch {
            const created = await createTeachingSession(payload);
            syncedSessionId = created.session?.id || "";
          }
        } else {
          const created = await createTeachingSession(payload);
          syncedSessionId = created.session?.id || "";
        }

        if (cancelled) {
          return;
        }

        stageSyncKeyRef.current = `${syncedSessionId || "new"}:${poemId || "none"}:${nextStep}`;
        if (syncedSessionId && syncedSessionId !== currentSessionId) {
          setCurrentSessionId(syncedSessionId);
        }
      } catch {
        // Keep local teaching flow available even when session sync fails.
      }
    };

    void syncSessionStep();

    return () => {
      cancelled = true;
    };
  }, [activeStage, currentPoem?.title, currentSessionId, isTeacherMode, poemId, setCurrentSessionId]);

  useEffect(() => {
    setSelectedLineIndex(0);
    setMemoryAnswers({});
    setMemorySubmitted(false);
    setShowMemoryAnswers(false);
    setQueuedPromptText(null);
  }, [content]);

  useEffect(() => {
    let cancelled = false;

    const loadPoem = async (): Promise<void> => {
      if (!poemId) {
        setCurrentPoem(null);
        setRelatedPoems([]);
        setIsFavorited(false);
        setNoteDraft("");
        setNoteUpdatedAt(null);
        setExamPoints(null);
        return;
      }

      setStudyStateLoading(true);
      setRelatedLoading(true);
      setStudyStateError(null);
      setRelatedError(null);

      try {
        const [poemData, studyData, relatedData, examPointsData] = await Promise.allSettled([
          apiGet<PoemRecord>(`/poems/${poemId}`, { cacheTtlMs: 120000 }),
          apiGet<PoemStudyState>(`/poems/${poemId}/study-state`, { cacheTtlMs: 120000 }),
          apiGet<{ items: PoemRecord[] }>(`/poems/${poemId}/related?limit=6`, { cacheTtlMs: 120000 }),
          getPoemExamPoints(poemId),
        ]);

        if (cancelled) {
          return;
        }

        if (poemData.status === "fulfilled") {
          setCurrentPoem(poemData.value);
        }

        if (studyData.status === "fulfilled") {
          setIsFavorited(Boolean(studyData.value.isFavorited));
          setNoteDraft(studyData.value.note || "");
          setNoteUpdatedAt(studyData.value.noteUpdatedAt || null);
        } else {
          setStudyStateError(studyData.reason instanceof Error ? studyData.reason.message : "读取学习状态失败");
        }

        if (relatedData.status === "fulfilled") {
          setRelatedPoems(relatedData.value.items || []);
        } else {
          setRelatedPoems([]);
          setRelatedError(relatedData.reason instanceof Error ? relatedData.reason.message : "读取相关诗词失败");
        }

        if (examPointsData.status === "fulfilled") {
          setExamPoints(examPointsData.value);
        } else {
          setExamPoints(null);
        }
      } finally {
        if (!cancelled) {
          setStudyStateLoading(false);
          setRelatedLoading(false);
        }
      }
    };

    void loadPoem();
    return () => {
      cancelled = true;
    };
  }, [poemId]);

  useEffect(() => {
    if (!content.trim()) {
      return;
    }

    void analyzePoem({
      poemId,
      poemTitle: title,
      poemAuthor: author,
      poemContent: content,
      depth,
    });
  }, [analyzePoem, author, content, depth, poemId, title]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopSpeech = (): void => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    speechRef.current = null;
    setIsSpeaking(false);
  };

  const speakText = (text: string): void => {
    if (!text.trim()) {
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechMessage("当前浏览器不支持朗读功能。");
      return;
    }

    stopSpeech();
    setSpeechMessage(null);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.94;
    utterance.onend = () => {
      setIsSpeaking(false);
      speechRef.current = null;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeechMessage("朗读失败，请稍后重试。");
      speechRef.current = null;
    };

    speechRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const toggleFavorite = async (): Promise<void> => {
    if (!poemId || favoriteSaving) {
      return;
    }
    setFavoriteSaving(true);
    setStudyStateError(null);
    try {
      await apiPost(`/poems/${poemId}/favorite`, { favorited: !isFavorited });
      setIsFavorited((prev) => !prev);
    } catch (err: unknown) {
      setStudyStateError(err instanceof Error ? err.message : "收藏状态更新失败");
    } finally {
      setFavoriteSaving(false);
    }
  };

  const saveNote = async (): Promise<void> => {
    if (!poemId || noteSaving) {
      return;
    }
    setNoteSaving(true);
    setNoteMessage(null);
    setStudyStateError(null);
    try {
      const data = await apiPatch<{ note: string; noteUpdatedAt?: string | null }>(`/poems/${poemId}/note`, {
        note: noteDraft,
      });
      setNoteDraft(data.note || "");
      setNoteUpdatedAt(data.noteUpdatedAt || null);
      setNoteMessage(data.note ? "学习札记已保存。" : "学习札记已清空。");
    } catch (err: unknown) {
      setStudyStateError(err instanceof Error ? err.message : "保存札记失败");
    } finally {
      setNoteSaving(false);
    }
  };

  const currentTranslationRow = translationRows[selectedLineIndex] || translationRows[0];
  const stageHint = stageHintMap[activeStage];
  const graphHighlight = poemId || title;
  const examPointText =
    examPoints?.summary ||
    analysis?.examPoints.content ||
    "先围绕意象、主旨和艺术手法三个方向组织答题，形成“观点 + 依据 + 分析”的稳定表达。";
  const examPointBulletPoints = examPoints?.bulletPoints?.length
    ? examPoints.bulletPoints
    : extractStructuredLines(examPointText, [examPointText], 4);

  const advanceStage = (stageId: LearnStageId): void => {
    setActiveStage(stageId);
  };

  const renderStageContent = (): JSX.Element => {
    if (activeStage === "stage1") {
      return (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard
            title="Stage 1 · 初见"
            subtitle="先把原文读顺，再把你看到的画面和感觉说出来。"
            weight="workspace"
            density="roomy"
          >
            <div className="grid gap-6">
              <div className="rounded-[1.6rem] border border-[rgba(201,169,110,0.2)] bg-[linear-gradient(180deg,#FCFBF8_0%,#F7F3EC_100%)] px-5 py-6 shadow-[inset_0_0_0_1px_rgba(201,169,110,0.12)]">
                {poemLines.map((line, index) => {
                  const active = selectedLineIndex === index;
                  return (
                    <button
                      key={`${line}-${index}`}
                      type="button"
                      onClick={() => setSelectedLineIndex(index)}
                      className={[
                        "block w-full rounded-2xl px-4 py-3 text-left font-display text-[1.65rem] leading-[2.1] tracking-[0.08em] text-[#1A2B4C] transition",
                        active
                          ? "shadow-[0_10px_24px_rgba(26,43,76,0.08)] shadow-[inset_0_0_0_1px_rgba(201,169,110,0.22)]"
                          : "hover:opacity-70",
                      ].join(" ")}
                      style={{ backgroundColor: active ? 'var(--bg-surface)' : 'transparent' }}
                    >
                      {line}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl bg-white px-4 py-4 shadow-[0_10px_24px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">当前句意</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{currentTranslationRow?.meaning || "点击上方诗句查看对应译解。"}</p>
                </article>
                <article className="rounded-2xl bg-white px-4 py-4 shadow-[0_10px_24px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">朗读与导入</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary-compact" onClick={() => speakText(content)}>
                      <Play className="h-3.5 w-3.5" /> 朗读全诗
                    </button>
                    <button type="button" className="btn-secondary-compact" onClick={() => speakText(currentTranslationRow?.source || content)}>
                      <Volume2 className="h-3.5 w-3.5" /> 朗读当前句
                    </button>
                    <button type="button" className="btn-secondary-compact" disabled={!isSpeaking} onClick={stopSpeech}>
                      <Pause className="h-3.5 w-3.5" /> 停止
                    </button>
                  </div>
                  {speechMessage ? <p className="mt-2 text-xs text-slate-500">{speechMessage}</p> : null}
                </article>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-6">
            <SectionCard
              title="背景导入"
              subtitle="把作者、时代和课堂目标放在一起，帮助学生建立理解坐标。"
              weight="support"
              density="roomy"
            >
              <div className="grid gap-3">
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">作者与时代</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {author} · {dynasty}。建议先从“这首诗写下时，诗人站在怎样的情境里”开场，再带学生进入情绪变化。
                  </p>
                </article>
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">本阶段任务</p>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                    <li>先说画面，不急着讲结论。</li>
                    <li>圈出最触动你的一个意象。</li>
                    <li>完成朗读后再进入解析阶段。</li>
                  </ul>
                </article>
              </div>
            </SectionCard>

            <SectionCard
              title="下一步"
              subtitle="确认学生已经读通原文后，再进入 AI 分层解析。"
              weight="summary"
              density="roomy"
            >
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => advanceStage("stage2")}>
                  开始解析 <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <Link to="/explore" className="btn-secondary">
                  去探索换一首
                </Link>
              </div>
            </SectionCard>
          </div>
        </div>
      );
    }

    if (activeStage === "stage2") {
      return (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="grid gap-4">
            <SectionCard title="解析导航" subtitle="按照课堂节奏从易到难进入。" weight="summary" density="roomy">
              <PillNav items={depthNavItems} value={depth} onChange={setDepth} className="w-full" />
              <div className="mt-4 space-y-3">
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">译解抓手</p>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                    {analysisOutline.translation.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">主旨抓手</p>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                    {analysisOutline.emotion.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">手法抓手</p>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                    {analysisOutline.technique.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Stage 2 · AI 多维解析"
            subtitle="保留原有流式解析能力，但布局改成课堂可推进的分层视图。"
            weight="workspace"
            density="roomy"
            actions={
              isLoading ? (
                <button type="button" className="btn-secondary-compact" onClick={stop}>
                  停止解析
                </button>
              ) : (
                <Link
                  to={poemId ? `/explore?poemId=${encodeURIComponent(poemId)}` : "/explore"}
                  className="btn-secondary-compact"
                >
                  去探究
                </Link>
              )
            }
          >
            <AnalysisPanel
              analysis={analysis}
              streamText={streamText}
              isLoading={isLoading}
              error={error}
              source={source}
              poemTitle={title}
              graphHighlight={poemId || title}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to={poemId ? `/explore?poemId=${encodeURIComponent(poemId)}` : "/explore"}
                className="btn-primary-compact"
              >
                继续探究
              </Link>
              <button type="button" className="btn-secondary-compact" onClick={() => advanceStage("stage1")}>
                回到原文
              </button>
            </div>
          </SectionCard>
        </div>
      );
    }

    if (activeStage === "stage3") {
      return (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="grid gap-4">
            {inquiryTask ? (
              <InquiryTaskCard
                data={inquiryTask}
                completionTo={`/practice?entry=practice&topic=${encodeURIComponent(title)}&count=6&difficulty=medium&auto=1&source=learn`}
                onPickQuestion={(question) => {
                  setQueuedPromptText(question);
                  setQueuedPromptNonce((prev) => prev + 1);
                }}
              />
            ) : (
              <SectionCard
                title="探究任务未配置"
                subtitle="当前诗词暂无 inquiry_tasks，请先补齐教学数据。"
                weight="support"
                density="roomy"
              >
                <Link to={poemId ? `/explore?poemId=${encodeURIComponent(poemId)}` : "/explore"} className="btn-secondary-compact">
                  去探究工作台
                </Link>
              </SectionCard>
            )}
            <SectionCard title="探究模式" subtitle="先提问，再跟进，再沉淀。" weight="support" density="roomy">
              <PillNav items={inquiryModeItems} value={inquiryMode} onChange={setInquiryMode} className="w-full" />
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {inquiryMode === "qa"
                  ? "适合围绕主旨、考点和答题表达推进，先用结构化追问把理解讲清楚。"
                  : "适合把诗人、时代和个人表达连起来，帮助学生从作者视角再看一次作品。"}
              </p>
            </SectionCard>
          </div>

          <SectionCard
            title="Stage 3 · 探究对话"
            subtitle="把精讲阶段形成的理解，转成可追问、可迁移的课堂对话。"
            weight="workspace"
            density="roomy"
          >
            <ChatWindow
              poemTitle={title}
              poemAuthor={author}
              poemContent={content}
              queuedPromptText={queuedPromptText}
              queuedPromptNonce={queuedPromptNonce}
              externalMode={inquiryMode}
              externalPoet={suggestedPoet}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-primary-compact" onClick={() => advanceStage("stage4")}>
                去做记忆练习
              </button>
              <Link
                to={`/create?topic=${encodeURIComponent(title)}`}
                className="btn-secondary-compact"
              >
                转入创作迁移
              </Link>
            </div>
          </SectionCard>
        </div>
      );
    }

    if (activeStage === "stage4") {
      return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <SectionCard
            title="Stage 4 · 嵌入式填空"
            subtitle="不跳页完成一轮关键句填空，把刚刚理解的内容转成记忆动作。"
            weight="workspace"
            density="roomy"
          >
            <div className="grid gap-4">
              {memoryResults.map((question, index) => {
                const checked = memorySubmitted || showMemoryAnswers;
                const success = checked && question.isCorrect;
                const failed = checked && !question.isCorrect;
                return (
                  <article
                    key={question.id}
                    className={[
                      "rounded-2xl px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition",
                      success
                        ? "bg-emerald-50"
                        : failed
                          ? "bg-rose-50"
                          : "bg-white",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[11px] tracking-[0.16em] text-slate-500">填空 {index + 1}</p>
                      <span className="text-xs text-slate-500">{question.hint}</span>
                    </div>
                    <p className="mt-2 font-display text-2xl leading-[1.9] text-[#1A2B4C]">{question.masked}</p>
                    <input
                      value={question.input}
                      onChange={(event) =>
                        setMemoryAnswers((prev) => ({
                          ...prev,
                          [question.id]: event.target.value,
                        }))
                      }
                      className="input-main mt-4 w-full"
                      placeholder="填入缺失字词"
                    />
                    {checked ? (
                      <p className={["mt-2 text-xs", success ? "text-emerald-700" : "text-rose-700"].join(" ")}>
                        {success ? "回答正确" : `参考答案：${question.answer} · 原句：${question.fullLine}`}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => setMemorySubmitted(true)}>
                提交记忆练习
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowMemoryAnswers((prev) => !prev)}>
                {showMemoryAnswers ? "隐藏答案" : "显示答案"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setMemoryAnswers({});
                  setMemorySubmitted(false);
                  setShowMemoryAnswers(false);
                }}
              >
                重新来一轮
              </button>
            </div>
          </SectionCard>

          <div className="grid gap-6">
            <SectionCard title="记忆反馈" subtitle="让学生知道自己此刻掌握到了哪一步。" weight="summary" density="roomy">
              <div className="grid gap-3">
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">本轮正确率</p>
                  <p className="mt-2 font-display text-4xl text-[#1A2B4C]">{memoryAccuracy}%</p>
                </article>
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">建议动作</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {memoryAccuracy >= 80
                      ? "已经可以进入考点与练测阶段，巩固答题表达。"
                      : "建议先再做一轮填空，确认关键句已经稳定记住。"}
                  </p>
                </article>
              </div>
            </SectionCard>

            <SectionCard title="下一步" subtitle="记忆结束后立即进入考点与练测，不让理解断掉。" weight="support" density="roomy">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary-compact" onClick={() => advanceStage("stage5")}>
                  去看考点
                </button>
                <Link to="/memory" className="btn-secondary-compact">
                  打开完整记忆中心
                </Link>
              </div>
            </SectionCard>
          </div>
        </div>
      );
    }

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
                    onClick={() => void toggleFavorite()}
                  >
                    <Heart className="h-3.5 w-3.5" fill={isFavorited ? "currentColor" : "none"} />
                    {isFavorited ? "已收藏" : "收藏本诗"}
                  </button>
                  <button type="button" className="btn-secondary-compact" disabled={!poemId || noteSaving} onClick={() => void saveNote()}>
                    <PenSquare className="h-3.5 w-3.5" />
                    {noteSaving ? "保存中..." : "保存札记"}
                  </button>
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
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
                {relatedLoading ? <p className="mt-3 text-sm text-slate-500">正在加载相关诗词...</p> : null}
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
              <Link to={`/create?topic=${encodeURIComponent(title)}`} className="btn-secondary">
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
                to: `/create?topic=${encodeURIComponent(title)}`,
                ctaLabel: "去创作",
                badge: "输出",
              },
            ]}
            className="mt-2"
          />
        </div>
      </div>
    );
  };

  return (
    <div className={["page-shell", isTeacherMode ? "teacher-mode-page" : ""].join(" ")}>
      <PageStage tone="primary">
        <LearnJourneyProgress className="mb-4" />
        {!isTeacherMode ? (
          <div className="mb-4 space-y-3">
            <PillNav
              items={learnStageNavItems}
              value={studentObjectiveStage}
              onChange={(id) => setStudentObjectiveStage(id)}
              className="max-w-full bg-white/80 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]"
            />
            <TeachingObjectiveCard
              variant="panel"
              kicker="学习目标（学生）"
              title={`${studentPreviewStageMeta.title} · 本阶段要达成`}
              summary={studentPreviewStageMeta.summary}
              goals={studentStageGoals[studentObjectiveStage]}
              chipLabel={`阶段 ${studentPreviewStageMeta.index} · ${title}`}
              className="shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
            />
          </div>
        ) : null}
        {isTeacherMode ? (
          <TeachingObjectiveCard
            variant="panel"
            kicker="教师目标提示"
            title={objective.title}
            summary={objective.summary}
            goals={objective.goals}
            chipLabel={`当前阶段 · ${currentStageMeta.title}`}
            hint={objective.teacherHint}
            className="shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
          />
        ) : null}
        {teachingContentError ? (
          <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
            教学数据暂未就绪：{teachingContentError}。当前仅展示最小空态提示，不再回退到页面伪目标。
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-[rgba(201,169,110,0.22)] bg-[linear-gradient(135deg,rgba(250,247,240,0.98)_0%,rgba(247,240,226,0.98)_50%,rgba(243,235,220,0.98)_100%)] px-6 py-6 shadow-[0_22px_46px_rgba(34,58,94,0.1)] lg:px-8 lg:py-8">
          <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="flex flex-col justify-center gap-4">
              <p className="text-[12px] font-semibold tracking-[0.22em] text-[#9B6731]">诗词精讲 · 五段课堂流</p>
              <BlurText as="h1" text={title} className="font-display text-5xl text-[#203754]" delayPerChar={0.02} />
              <p className="text-sm leading-7 text-slate-600">
                {author} · {dynasty}
                {poemId ? " · 当前正在精讲具体诗词" : " · 当前为默认演示诗词，可从探索页切换"}
              </p>
              <p className="max-w-[60ch] text-base leading-8 text-[#4B627D]">
                这不是工具集合页，而是一首诗的完整教学旅程。先读原文，再做解析、探究、记忆和考点收束，让课堂和自学都能沿着同一条路径前进。
              </p>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => advanceStage("stage2")}>
                  进入解析
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <Link to="/explore" className="btn-secondary">
                  去探索选诗
                </Link>
                <Link
                  to={`/practice?topic=${encodeURIComponent(title)}&count=6&difficulty=medium&auto=1&source=learn`}
                  className="btn-secondary"
                >
                  直接练测
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                {learnStages.map((stage) => (
                  <span
                    key={stage.id}
                    className={[
                      "inline-flex items-center rounded-full px-3 py-1 text-xs shadow-[0_8px_18px_rgba(34,58,94,0.05)]",
                      stage.id === activeStage ? "bg-[#223A5E] text-white" : "bg-white/90 text-slate-600",
                    ].join(" ")}
                  >
                    {stage.index} · {stage.title}
                  </span>
                ))}
              </div>
            </div>

            <TeachingObjectiveCard
              variant="hero"
              kicker="本课教学目标"
              title={objective.title}
              meta={`${title} · ${author}`}
              goals={objective.goals}
              chipLabel={isTeacherMode ? "教师视角" : "学生视角"}
              footer={
                <>
                  <span>{currentStageMeta.summary}</span>
                  <button type="button" className="overview-inline-link" onClick={() => advanceStage(activeStage === "stage5" ? "stage1" : "stage2")}>
                    {activeStage === "stage1" ? "从解析开始" : "继续当前学习"}
                  </button>
                </>
              }
            />
          </div>
        </section>
      </PageStage>

      <PageStage tone="secondary">
        <TeachingStepBar
          steps={learnStages}
          activeId={activeStage}
          currentIndex={currentStageMeta.index}
          onStepChange={(id) => advanceStage(id as LearnStageId)}
          kicker={isTeacherMode ? "课堂推进" : "学习推进"}
          caption={isTeacherMode ? "教师可手动推进五个阶段，控制课堂节奏。" : "沿着五个阶段完成这一首诗的完整精讲。"}
          className="sticky top-24 z-20"
        />
      </PageStage>

      <PageStage tone="secondary">
        {isTeacherMode ? (
          <TeacherHintCallout
            title={stageHint.title}
            detail={stageHint.detail}
            action={
              <button
                type="button"
                className="btn-secondary-compact"
                onClick={() => {
                  const currentIndex = learnStages.findIndex((item) => item.id === activeStage);
                  const next = learnStages[Math.min(learnStages.length - 1, currentIndex + 1)];
                  advanceStage(next.id as LearnStageId);
                }}
              >
                推进到下一阶段
              </button>
            }
          />
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="flow-lg"
          >
            {renderStageContent()}
          </motion.div>
        </AnimatePresence>
      </PageStage>
    </div>
  );
}
