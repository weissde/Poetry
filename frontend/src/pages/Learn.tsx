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
import ContextBanner from "@/components/ContextBanner";
import { BlurText, PillNav, type PillNavItem } from "@/components/react-bits";
import { InquiryTaskCard } from "@/components/teaching/InquiryTaskCard";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { TeachingStepBar, type TeachingStepBarItem } from "@/components/teaching/TeachingStepBar";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import LearnHero from "@/features/learn/LearnHero";
import Stage1Content from "@/features/learn/Stage1Content";
import Stage2Content from "@/features/learn/Stage2Content";
import Stage3Content from "@/features/learn/Stage3Content";
import Stage4Content from "@/features/learn/Stage4Content";
import Stage5Content from "@/features/learn/Stage5Content";
import StageCompleteCard from "@/features/learn/StageCompleteCard";
import CelebrationOverlay from "@/features/learn/CelebrationOverlay";

import { useAnalysis } from "@/hooks/useAnalysis";
import { useDemoMode } from "@/hooks/useDemoMode";
import { usePoemTeachingContent } from "@/hooks/usePoemTeachingContent";
import {
  advanceTeachingSession,
  apiGet,
  apiPatch,
  apiPost,
  createTeachingSession,
  getPoemExamPoints,
  updatePoemStudyState,
} from "@/lib/api";
import {
  buildMemoryQuestions,
  extractStructuredLines,
  inferPoetKey,
  normalizeAnswer,
  splitPoemLines,
} from "@/lib/learn-helpers";
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

  const [completedStages, setCompletedStages] = useState<Set<LearnStageId>>(new Set());
  const [journeyComplete, setJourneyComplete] = useState(false);
  const [showStageComplete, setShowStageComplete] = useState(false);
  const completedStageRef = useRef<LearnStageId | null>(null);

  const title = currentPoem?.title ?? "";
  const author = currentPoem?.author ?? "";
  const content = currentPoem?.content ?? "";
  const dynasty = currentPoem?.dynasty ?? "";
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
        setCompletedStages(new Set());
        setJourneyComplete(false);
        setActiveStage("stage1");
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
          // Restore stage progress
          if (studyData.value.currentStage) {
            setActiveStage(studyData.value.currentStage as LearnStageId);
          }
          const completed = new Set<LearnStageId>();
          if (studyData.value.stage1CompletedAt) completed.add("stage1");
          if (studyData.value.stage2CompletedAt) completed.add("stage2");
          if (studyData.value.stage3CompletedAt) completed.add("stage3");
          if (studyData.value.stage4CompletedAt) completed.add("stage4");
          setCompletedStages(completed);
          if (studyData.value.fullyCompletedAt) {
            setJourneyComplete(true);
          }
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
    "完成精讲与练测后，考点将自动归纳至此。";
  const examPointBulletPoints = examPoints?.bulletPoints?.length
    ? examPoints.bulletPoints
    : extractStructuredLines(examPointText, [examPointText], 4);

    const { isDemoMode, exitDemoMode } = useDemoMode();

  const advanceStage = (stageId: LearnStageId): void => {
    const prevStage = activeStage;
    // Mark previous stage as completed
    if (prevStage !== stageId && prevStage !== "stage5") {
      const stageNum = Number(prevStage.replace("stage", ""));
      const nextCompleted = new Set(completedStages);
      nextCompleted.add(prevStage);
      setCompletedStages(nextCompleted);
      // Show completion card before transitioning
      completedStageRef.current = prevStage;
      setShowStageComplete(true);
      // Persist to backend
      const payload: { current_stage: string; stage_completed?: string } = { current_stage: stageId };
      if (stageNum >= 1 && stageNum <= 4) {
        payload.stage_completed = prevStage;
      }
      updatePoemStudyState(poemId!, payload).catch(() => {});
      // Check if journey is now complete
      const willCompleteAll = stageId === "stage5" && nextCompleted.has("stage1") &&
        nextCompleted.has("stage2") && nextCompleted.has("stage3") && nextCompleted.has("stage4");
      if (willCompleteAll) {
        setJourneyComplete(true);
        updatePoemStudyState(poemId!, { current_stage: "stage5", stage_completed: "stage4" }).catch(() => {});
      }
    }
    setActiveStage(stageId);
  };

  // Auto-dismiss stage complete card after 2s
  useEffect(() => {
    if (!showStageComplete) return;
    const timer = setTimeout(() => {
      setShowStageComplete(false);
      completedStageRef.current = null;
    }, 2000);
    return () => clearTimeout(timer);
  }, [showStageComplete]);

  const renderStageContent = (): JSX.Element => {
    if (activeStage === "stage1") {
      return (
        <Stage1Content
          poemLines={poemLines}
          selectedLineIndex={selectedLineIndex}
          onSelectLine={setSelectedLineIndex}
          translationRows={translationRows}
          content={content}
          author={author}
          dynasty={dynasty}
          isSpeaking={isSpeaking}
          speechMessage={speechMessage}
          onSpeakFull={() => speakText(content)}
          onSpeakCurrent={() => speakText(currentTranslationRow?.source || content)}
          onStopSpeech={stopSpeech}
          onAdvance={() => advanceStage("stage2")}
        />
      );
    }

    if (activeStage === "stage2") {
      return (
        <Stage2Content
          depth={depth}
          onDepthChange={setDepth}
          depthNavItems={depthNavItems}
          analysisOutline={analysisOutline}
          analysis={analysis}
          streamText={streamText}
          isLoading={isLoading}
          error={error}
          source={source}
          title={title}
          poemId={poemId}
          onStop={stop}
          onAdvance={() => advanceStage("stage3")}
          onGoBack={() => advanceStage("stage1")}
        />
      );
    }

    if (activeStage === "stage3") {
      return (
        <Stage3Content
          inquiryTask={inquiryTask}
          inquiryMode={inquiryMode}
          onInquiryModeChange={setInquiryMode}
          inquiryModeItems={inquiryModeItems}
          queuedPromptText={queuedPromptText}
          queuedPromptNonce={queuedPromptNonce}
          onPickQuestion={(question: string) => {
            setQueuedPromptText(question);
            setQueuedPromptNonce((prev) => prev + 1);
          }}
          title={title}
          author={author}
          content={content}
          suggestedPoet={suggestedPoet}
          poemId={poemId}
          onAdvance={() => advanceStage("stage4")}
        />
      );
    }

    if (activeStage === "stage4") {
      return (
        <Stage4Content
          memoryResults={memoryResults}
          memorySubmitted={memorySubmitted}
          showMemoryAnswers={showMemoryAnswers}
          memoryAccuracy={memoryAccuracy}
          onAnswerChange={(id, value) =>
            setMemoryAnswers((prev) => ({ ...prev, [id]: value }))
          }
          onSubmit={() => setMemorySubmitted(true)}
          onToggleAnswers={() => setShowMemoryAnswers((prev) => !prev)}
          onReset={() => {
            setMemoryAnswers({});
            setMemorySubmitted(false);
            setShowMemoryAnswers(false);
          }}
          onAdvance={() => advanceStage("stage5")}
        />
      );
    }

    return (
      <Stage5Content
        examPointText={examPointText}
        examPointBulletPoints={examPointBulletPoints}
        title={title}
        author={author}
        content={content}
        graphHighlight={graphHighlight}
        poemId={poemId}
        isFavorited={isFavorited}
        favoriteSaving={favoriteSaving}
        studyStateLoading={studyStateLoading}
        onToggleFavorite={toggleFavorite}
        noteDraft={noteDraft}
        onNoteChange={setNoteDraft}
        noteSaving={noteSaving}
        noteUpdatedAt={noteUpdatedAt}
        noteMessage={noteMessage}
        studyStateError={studyStateError}
        onSaveNote={saveNote}
        relatedPoems={relatedPoems}
        relatedLoading={relatedLoading}
        relatedError={relatedError}
      />
    );
  };



  return (
    <div className={["page-shell", isTeacherMode ? "teacher-mode-page" : ""].join(" ")}>
      <PageStage tone="primary">
        <ContextBanner />
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
                {poemId ? " · 当前正在精讲具体诗词" : " · 请从探索页选择一首诗词开始精讲"}
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

        <AnimatePresence>
          {showStageComplete && completedStageRef.current ? (
            <StageCompleteCard
              meta={(() => {
                const s = completedStageRef.current;
                if (s === "stage1") return { stage: "stage1", lineCount: poemLines.length };
                if (s === "stage2") {
                  return {
                    stage: "stage2",
                    depth,
                    insightCount:
                      analysisOutline.translation.length +
                      analysisOutline.emotion.length +
                      analysisOutline.technique.length,
                  };
                }
                if (s === "stage3") return { stage: "stage3", mode: inquiryMode };
                return { stage: "stage4", accuracy: memoryAccuracy, itemsTested: memoryQuestions.length };
              })()}
              onDismiss={() => { setShowStageComplete(false); completedStageRef.current = null; }}
            />
          ) : null}
        </AnimatePresence>

        {isDemoMode ? (
          <button
            className="demo-exit-btn inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[rgba(34,58,94,0.9)] text-white text-sm font-medium shadow-lg hover:bg-[rgba(34,58,94,1)] transition-colors"
            onClick={exitDemoMode}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            退出演示
          </button>
        ) : null}

        {journeyComplete ? (
          <CelebrationOverlay
            title={title}
            author={author}
            dynasty={dynasty}
            poemId={poemId!}
            accuracy={memoryAccuracy}
            onDismiss={() => setJourneyComplete(false)}
          />
        ) : null}
      </PageStage>
    </div>
  );
}
