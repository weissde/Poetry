﻿﻿import { AnimatePresence, motion } from "framer-motion";
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
import { useTeachingMode } from "@/contexts/useTeachingMode";
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
  title: "闈欏鎬?,
  author: "鏉庣櫧",
  dynasty: "鍞?,
  content: "搴婂墠鏄庢湀鍏夛紝鐤戞槸鍦颁笂闇溿€俓n涓惧ご鏈涙槑鏈堬紝浣庡ご鎬濇晠涔°€?,
  tags: ["鎬濅埂", "鏈堝", "鍞愯瘲"],
  grade_level: ["primary", "middle"],
};

const learnStages: readonly LearnStageMeta[] = [
  {
    id: "stage1",
    index: "01",
    title: "鍒濊",
    note: "鍘熸枃涓庤儗鏅?,
    summary: "鍏堟妸璇楄椤恒€佽鎳傜敾闈紝鍐嶈繘鍏ョ簿璁层€?,
  },
  {
    id: "stage2",
    index: "02",
    title: "瑙ｆ瀽",
    note: "AI 澶氱淮鎷嗚В",
    summary: "浠庤瘧瑙ｃ€佹剰璞°€佹儏鎰熷拰鎵嬫硶鍥涘眰杩涘叆銆?,
  },
  {
    id: "stage3",
    index: "03",
    title: "鎺㈢┒",
    note: "闂瓟涓庣┛瓒?,
    summary: "鎶婄悊瑙ｈ浆鎴愰棶棰橈紝瀹屾垚璇惧爞瀵硅瘽鎺ㄨ繘銆?,
  },
  {
    id: "stage4",
    index: "04",
    title: "璁板繂",
    note: "宓屽叆寮忓～绌?,
    summary: "涓嶈烦椤靛畬鎴愪竴杞祵鍏ュ紡璁板繂缁冧範銆?,
  },
  {
    id: "stage5",
    index: "05",
    title: "鑰冪偣",
    note: "缁冩祴涓庡浘璋?,
    summary: "鏀舵潫鑰冪偣锛屽苟璺宠浆缁冩祴銆佸浘璋卞拰瀛︽儏銆?,
  },
];

const studentStageGoals: Record<LearnStageId, readonly string[]> = {
  stage1: ["璇婚€氬叏璇楋紝鍏堣鍑虹溂鍓嶇敾闈笌韬綋鎰熷彈", "鍦堝嚭 1-2 涓叧閿剰璞★紝鏆備笉鍒ゆ柇涓绘棬", "瀹屾垚鏈楄鍚庡啀杩涘叆鍒嗗眰瑙ｆ瀽"],
  stage2: ["鎸夎瘧瑙?鈫?鎰忚薄 鈫?鎯呮劅 鈫?鎵嬫硶閫愬眰瀵圭収鍘熸枃", "姣忔潯缁撹灏介噺寮曠敤璇楀彞涓殑璇嶄綔璇佹嵁", "璁颁笅涓€鏉″彲鍦ㄧ粌娴嬩腑澶嶇敤鐨勭瓟棰樺彞寮?],
  stage3: ["鍏堢敤棰勮闂寮€鍙ｏ紝鍐嶈 AI 杩介棶鑰岄潪浠ｇ瓟", "鎶婅璁虹粨璁虹敤鑷繁鐨勮瘽鍐欒繘鏈鎴栨憳瑕?, "涓轰笅涓€闃舵璁板繂缁冧範棰勭暀 2 涓噸鐐瑰彞"],
  stage4: ["浼樺厛缁冦€屾槗閿欏瓧 + 鍙ュ簭銆嶇殑鐭彞濉┖", "姝ｇ‘鐜囩ǔ瀹氬悗鍐嶅皾璇曞崐鍙ユ垨鍏ㄧ瘒榛樺啓", "鎶婁粛鍗″３鐨勫彞瀛愭爣杩涢敊棰?澶嶄範闃熷垪"],
  stage5: ["瀵圭収鑰冪偣娓呭崟鑷煡鏄惁瑕嗙洊楂橀瑙掑害", "鐢ㄤ竴杞悓璇楃粌娴嬫楠岃縼绉绘晥鏋?, "閿欓涓庡浘璋卞叆鍙ｄ簩閫変竴琛ラ綈钖勫急閾?],
};

const stageHintMap: Record<LearnStageId, { title: string; detail: string }> = {
  stage1: {
    title: "鍏堣瀛︾敓鐪嬪埌鐢婚潰",
    detail: "鍏堣鍘熸枃銆佹姄鎰忚薄锛屽啀杩介棶鈥滃摢涓€鍙ユ渶鍏堣浣犳劅鍒版儏缁彉鍖栤€濓紝涓嶈涓€涓婃潵灏辫鏍囧噯绛旀銆?,
  },
  stage2: {
    title: "瑙ｆ瀽闃舵瑕佸垎灞傛帹杩?,
    detail: "寤鸿鎸夆€滆瘧瑙?鈫?鎰忚薄 鈫?鎯呮劅 鈫?鎵嬫硶鈥濈殑椤哄簭鎺ㄨ繘锛岃鍫備笂姣忔鍙涓€涓眰娆★紝閬垮厤淇℃伅涓€娆″爢婊°€?,
  },
  stage3: {
    title: "鎺㈢┒涓嶆槸鎹竴绉嶈瑙?,
    detail: "浼樺厛鐢ㄩ璁鹃棶棰樿瀛︾敓鍏堣锛屽啀鐢?AI 杩介棶锛屾妸缁撹鐣欑粰瀛︾敓鑷繁鎬荤粨鍑烘潵銆?,
  },
  stage4: {
    title: "璁板繂鐜妭鍏堝珐鍥哄叧閿彞",
    detail: "鍏堝仛 2-3 涓煭鍙ュ～绌虹‘璁ゆ帉鎻★紝鍐嶅喅瀹氭槸鍚﹁繘鍏ュ叏鏂囬粯鍐欙紝璇惧爞涓婁笉寤鸿涓€娆℃媺澶暱銆?,
  },
  stage5: {
    title: "鑰冪偣瑕佺珛鍒昏惤鍒颁笅涓€姝ュ姩浣?,
    detail: "璁叉竻楂橀鑰冪偣鍚庯紝鐩存帴寮曞瀛︾敓鍘诲仛鍚岃瘲缁冧範鎴栬繘鍏ュ浘璋卞叧鑱斿彂鐜帮紝褰㈡垚闂幆銆?,
  },
};

const depthNavItems: readonly PillNavItem<AnalysisDepth>[] = [
  { id: "lite", label: "杞婚噺" },
  { id: "standard", label: "鏍囧噯" },
  { id: "exam", label: "鑰冪偣" },
];

const inquiryModeItems: readonly PillNavItem<InquiryStageMode>[] = [
  { id: "qa", label: "闂瓟妯″紡" },
  { id: "poet", label: "璇椾汉绌胯秺" },
];

function splitPoemLines(input: string): string[] {
  return String(input || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((line) => line.match(/[^锛屻€傦紒锛燂紱]+[锛屻€傦紒锛燂紱]?/g) || [])
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractStructuredLines(input: string, fallback: string[], limit = 4): string[] {
  const items = String(input || "")
    .split(/[\n銆傦紒锛燂紱]/g)
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
    .replace(/[\s锛屻€傦紒锛燂紱銆?.!?;:]/g, "")
    .trim()
    .toLowerCase();
}

function buildMemoryQuestions(content: string): MemoryQuestion[] {
  return splitPoemLines(content)
    .map((line, index) => {
      const stripped = line.replace(/[锛屻€傦紒锛燂紱銆乚/g, "").trim();
      if (stripped.length < 4) {
        return null;
      }
      const holeLength = stripped.length >= 6 ? 2 : 1;
      const start = Math.max(1, Math.floor((stripped.length - holeLength) / 2));
      const answer = stripped.slice(start, start + holeLength);
      return {
        id: `memory-${index}`,
        masked: `${stripped.slice(0, start)}${"鈻?.repeat(holeLength)}${stripped.slice(start + holeLength)}`,
        answer,
        fullLine: line,
        hint: `鎻愮ず锛氬叡 ${holeLength} 瀛楋紝棣栧瓧鏄€?{answer.charAt(0)}鈥漙,
      };
    })
    .filter((item): item is MemoryQuestion => Boolean(item))
    .slice(0, 3);
}

function inferPoetKey(author: string): PoetKey {
  const normalized = author.trim();
  const mapping: Record<string, PoetKey> = {
    鏉庣櫧: "libai",
    鏉滅敨: "dufu",
    鐜嬬淮: "wangwei",
    鐧藉眳鏄? "baijuyi",
    鑻忚郊: "sushi",
    杈涘純鐤? "xinqiji",
    鏉庢竻鐓? "liqingzhao",
    鐜嬫槍榫? "wangchangling",
    鏉滅墽: "dumu",
    瀛熸旦鐒? "menghaoran",
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
        title: "鏁欏鏁版嵁鏈噯澶囧ソ",
        summary: "褰撳墠璇楄瘝灏氭湭閰嶇疆鏁欏鐩爣涓庢帰绌朵换鍔★紝璇峰厛琛ラ綈鏁欏鍐呭鏁版嵁銆?,
        goals: ["琛ラ綈 teaching_objectives", "琛ラ綈 inquiry_tasks", "鍥炲埌鏈〉鍚庣户缁簿璁叉祦绋?],
        teacherHint: "璇蜂紭鍏堣ˉ榻愭暟鎹簱涓殑鏁欏瀛楁锛岄伩鍏嶉〉闈㈠洖閫€鍒颁吉鐩爣銆?,
      },
    [teachingContent?.teachingObjectives],
  );

  const translationRows = useMemo(() => {
    const meaningLines = extractStructuredLines(analysis?.annotationsAndTranslation.content || "", [
      "鍏堟姄浣忚瘲涓殑鏅薄锛屽啀鍒ゆ柇鎯呯华浠庡摢閲屽紑濮嬪彉鍖栥€?,
      "瀵圭収鍘熸枃鍜岃瘧瑙ｏ紝鎵惧嚭鏈€鍏抽敭鐨勪竴缁勬剰璞°€?,
      "鎶婄湅瑙佺殑鐢婚潰璇村畬鏁达紝鍐嶈繘鍏ユ墜娉曞拰涓绘棬銆?,
      "瑙ｆ瀽瀹屾垚鍚庣户缁繘鍏ユ帰绌舵垨缁冩祴宸╁浐銆?,
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
          setStudyStateError(studyData.reason instanceof Error ? studyData.reason.message : "璇诲彇瀛︿範鐘舵€佸け璐?);
        }

        if (relatedData.status === "fulfilled") {
          setRelatedPoems(relatedData.value.items || []);
        } else {
          setRelatedPoems([]);
          setRelatedError(relatedData.reason instanceof Error ? relatedData.reason.message : "璇诲彇鐩稿叧璇楄瘝澶辫触");
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
      setSpeechMessage("褰撳墠娴忚鍣ㄤ笉鏀寔鏈楄鍔熻兘銆?);
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
      setSpeechMessage("鏈楄澶辫触锛岃绋嶅悗閲嶈瘯銆?);
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
      setStudyStateError(err instanceof Error ? err.message : "鏀惰棌鐘舵€佹洿鏂板け璐?);
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
      setNoteMessage(data.note ? "瀛︿範鏈宸蹭繚瀛樸€? : "瀛︿範鏈宸叉竻绌恒€?);
    } catch (err: unknown) {
      setStudyStateError(err instanceof Error ? err.message : "淇濆瓨鏈澶辫触");
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
    "鍏堝洿缁曟剰璞°€佷富鏃ㄥ拰鑹烘湳鎵嬫硶涓変釜鏂瑰悜缁勭粐绛旈锛屽舰鎴愨€滆鐐?+ 渚濇嵁 + 鍒嗘瀽鈥濈殑绋冲畾琛ㄨ揪銆?;
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
            title="Stage 1 路 鍒濊"
            subtitle="鍏堟妸鍘熸枃璇婚『锛屽啀鎶婁綘鐪嬪埌鐨勭敾闈㈠拰鎰熻璇村嚭鏉ャ€?
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
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">褰撳墠鍙ユ剰</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{currentTranslationRow?.meaning || "鐐瑰嚮涓婃柟璇楀彞鏌ョ湅瀵瑰簲璇戣В銆?}</p>
                </article>
                <article className="rounded-2xl bg-white px-4 py-4 shadow-[0_10px_24px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">鏈楄涓庡鍏?</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary-compact" onClick={() => speakText(content)}>
                      <Play className="h-3.5 w-3.5" /> 鏈楄鍏ㄨ瘲
                    </button>
                    <button type="button" className="btn-secondary-compact" onClick={() => speakText(currentTranslationRow?.source || content)}>
                      <Volume2 className="h-3.5 w-3.5" /> 鏈楄褰撳墠鍙?
                    </button>
                    <button type="button" className="btn-secondary-compact" disabled={!isSpeaking} onClick={stopSpeech}>
                      <Pause className="h-3.5 w-3.5" /> 鍋滄
                    </button>
                  </div>
                  {speechMessage ? <p className="mt-2 text-xs text-slate-500">{speechMessage}</p> : null}
                </article>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-6">
            <SectionCard
              title="鑳屾櫙瀵煎叆"
              subtitle="鎶婁綔鑰呫€佹椂浠ｅ拰璇惧爞鐩爣鏀惧湪涓€璧凤紝甯姪瀛︾敓寤虹珛鐞嗚В鍧愭爣銆?
              weight="support"
              density="roomy"
            >
              <div className="grid gap-3">
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">浣滆€呬笌鏃朵唬</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {author} 路 {dynasty}銆傚缓璁厛浠庘€滆繖棣栬瘲鍐欎笅鏃讹紝璇椾汉绔欏湪鎬庢牱鐨勬儏澧冮噷鈥濆紑鍦猴紝鍐嶅甫瀛︾敓杩涘叆鎯呯华鍙樺寲銆?
                  </p>
                </article>
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">鏈樁娈典换鍔?</p>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                    <li>鍏堣鐢婚潰锛屼笉鎬ョ潃璁茬粨璁恒€?</li>
                    <li>鍦堝嚭鏈€瑙﹀姩浣犵殑涓€涓剰璞°€?</li>
                    <li>瀹屾垚鏈楄鍚庡啀杩涘叆瑙ｆ瀽闃舵銆?</li>
                  </ul>
                </article>
              </div>
            </SectionCard>

            <SectionCard
              title="涓嬩竴姝?
              subtitle="纭瀛︾敓宸茬粡璇婚€氬師鏂囧悗锛屽啀杩涘叆 AI 鍒嗗眰瑙ｆ瀽銆?
              weight="summary"
              density="roomy"
            >
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => advanceStage("stage2")}>
                  寮€濮嬭В鏋?<ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <Link to="/explore" className="btn-secondary">
                  鍘绘帰绱㈡崲涓€棣?
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
            <SectionCard title="瑙ｆ瀽瀵艰埅" subtitle="鎸夌収璇惧爞鑺傚浠庢槗鍒伴毦杩涘叆銆? weight="summary" density="roomy">
              <PillNav items={depthNavItems} value={depth} onChange={setDepth} className="w-full" />
              <div className="mt-4 space-y-3">
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">璇戣В鎶撴墜</p>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                    {analysisOutline.translation.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">涓绘棬鎶撴墜</p>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                    {analysisOutline.emotion.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">鎵嬫硶鎶撴墜</p>
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
            title="Stage 2 路 AI 澶氱淮瑙ｆ瀽"
            subtitle="淇濈暀鍘熸湁娴佸紡瑙ｆ瀽鑳藉姏锛屼絾甯冨眬鏀规垚璇惧爞鍙帹杩涚殑鍒嗗眰瑙嗗浘銆?
            weight="workspace"
            density="roomy"
            actions={
              isLoading ? (
                <button type="button" className="btn-secondary-compact" onClick={stop}>
                  鍋滄瑙ｆ瀽
                </button>
              ) : (
                <Link
                  to={poemId ? `/explore?poemId=${encodeURIComponent(poemId)}` : "/explore"}
                  className="btn-secondary-compact"
                >
                  鍘绘帰绌?
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
                缁х画鎺㈢┒
              </Link>
              <button type="button" className="btn-secondary-compact" onClick={() => advanceStage("stage1")}>
                鍥炲埌鍘熸枃
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
                title="鎺㈢┒浠诲姟鏈厤缃?
                subtitle="褰撳墠璇楄瘝鏆傛棤 inquiry_tasks锛岃鍏堣ˉ榻愭暀瀛︽暟鎹€?
                weight="support"
                density="roomy"
              >
                <Link to={poemId ? `/explore?poemId=${encodeURIComponent(poemId)}` : "/explore"} className="btn-secondary-compact">
                  鍘绘帰绌跺伐浣滃彴
                </Link>
              </SectionCard>
            )}
            <SectionCard title="鎺㈢┒妯″紡" subtitle="鍏堟彁闂紝鍐嶈窡杩涳紝鍐嶆矇娣€銆? weight="support" density="roomy">
              <PillNav items={inquiryModeItems} value={inquiryMode} onChange={setInquiryMode} className="w-full" />
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {inquiryMode === "qa"
                  ? "閫傚悎鍥寸粫涓绘棬銆佽€冪偣鍜岀瓟棰樿〃杈炬帹杩涳紝鍏堢敤缁撴瀯鍖栬拷闂妸鐞嗚В璁叉竻妤氥€?
                  : "閫傚悎鎶婅瘲浜恒€佹椂浠ｅ拰涓汉琛ㄨ揪杩炶捣鏉ワ紝甯姪瀛︾敓浠庝綔鑰呰瑙掑啀鐪嬩竴娆′綔鍝併€?}
              </p>
            </SectionCard>
          </div>

          <SectionCard
            title="Stage 3 路 鎺㈢┒瀵硅瘽"
            subtitle="鎶婄簿璁查樁娈靛舰鎴愮殑鐞嗚В锛岃浆鎴愬彲杩介棶銆佸彲杩佺Щ鐨勮鍫傚璇濄€?
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
                鍘诲仛璁板繂缁冧範
              </button>
              <Link
                to={`/create?topic=${encodeURIComponent(title)}`}
                className="btn-secondary-compact"
              >
                杞叆鍒涗綔杩佺Щ
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
            title="Stage 4 路 宓屽叆寮忓～绌?
            subtitle="涓嶈烦椤靛畬鎴愪竴杞叧閿彞濉┖锛屾妸鍒氬垰鐞嗚В鐨勫唴瀹硅浆鎴愯蹇嗗姩浣溿€?
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
                      <p className="text-[11px] tracking-[0.16em] text-slate-500">濉┖ {index + 1}</p>
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
                      placeholder="濉叆缂哄け瀛楄瘝"
                    />
                    {checked ? (
                      <p className={["mt-2 text-xs", success ? "text-emerald-700" : "text-rose-700"].join(" ")}>
                        {success ? "鍥炵瓟姝ｇ‘" : `鍙傝€冪瓟妗堬細${question.answer} 路 鍘熷彞锛?{question.fullLine}`}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => setMemorySubmitted(true)}>
                鎻愪氦璁板繂缁冧範
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowMemoryAnswers((prev) => !prev)}>
                {showMemoryAnswers ? "闅愯棌绛旀" : "鏄剧ず绛旀"}
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
                閲嶆柊鏉ヤ竴杞?
              </button>
            </div>
          </SectionCard>

          <div className="grid gap-6">
            <SectionCard title="璁板繂鍙嶉" subtitle="璁╁鐢熺煡閬撹嚜宸辨鍒绘帉鎻″埌浜嗗摢涓€姝ャ€? weight="summary" density="roomy">
              <div className="grid gap-3">
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">鏈疆姝ｇ‘鐜?</p>
                  <p className="mt-2 font-display text-4xl text-[#1A2B4C]">{memoryAccuracy}%</p>
                </article>
                <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="text-[11px] tracking-[0.16em] text-slate-500">寤鸿鍔ㄤ綔</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {memoryAccuracy >= 80
                      ? "宸茬粡鍙互杩涘叆鑰冪偣涓庣粌娴嬮樁娈碉紝宸╁浐绛旈琛ㄨ揪銆?
                      : "寤鸿鍏堝啀鍋氫竴杞～绌猴紝纭鍏抽敭鍙ュ凡缁忕ǔ瀹氳浣忋€?}
                  </p>
                </article>
              </div>
            </SectionCard>

            <SectionCard title="涓嬩竴姝? subtitle="璁板繂缁撴潫鍚庣珛鍗宠繘鍏ヨ€冪偣涓庣粌娴嬶紝涓嶈鐞嗚В鏂帀銆? weight="support" density="roomy">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary-compact" onClick={() => advanceStage("stage5")}>
                  鍘荤湅鑰冪偣
                </button>
                <Link to="/memory" className="btn-secondary-compact">
                  鎵撳紑瀹屾暣璁板繂涓績
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
          title="Stage 5 路 楂橀鑰冪偣"
          subtitle="璁叉竻鑰冪偣鍚庯紝绔嬪埢鎶婂鐢熼€佽繘缁冩祴銆佸浘璋卞拰瀛︽儏闂幆銆?
          weight="workspace"
          density="roomy"
        >
          <div className="grid gap-4">
            <article className="rounded-2xl bg-[linear-gradient(135deg,#FFF9EE_0%,#F5EAD5_100%)] px-4 py-4 shadow-[0_10px_24px_rgba(26,43,76,0.06)]">
              <p className="text-[11px] tracking-[0.16em] text-[#8A6B32]">鑰冪偣鎻愮ず</p>
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
                <h3 className="mt-3 text-sm font-semibold text-[#1A2B4C]">鍋氬悓璇楃粌涔?</h3>
                <p className="mt-2 text-xs leading-6 text-slate-500">6 棰樺揩閫熷珐鍥烘湰璇楅珮棰戣€冪偣銆?</p>
              </Link>
              <Link
                to={`/graph?highlight=${encodeURIComponent(graphHighlight)}`}
                className="rounded-2xl bg-white px-4 py-4 text-inherit no-underline shadow-[0_10px_24px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5"
              >
                <Compass className="h-5 w-5 text-[#1A2B4C]" />
                <h3 className="mt-3 text-sm font-semibold text-[#1A2B4C]">鍘诲浘璋卞叧鑱?</h3>
                <p className="mt-2 text-xs leading-6 text-slate-500">鏌ョ湅杩欓璇楀湪璇椾汉銆佹剰璞′笌涓婚缃戠粶涓殑浣嶇疆銆?</p>
              </Link>
              <Link
                to="/my-learning?tab=diagnosis"
                className="rounded-2xl bg-white px-4 py-4 text-inherit no-underline shadow-[0_10px_24px_rgba(26,43,76,0.06)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] transition hover:-translate-y-0.5"
              >
                <Brain className="h-5 w-5 text-[#1A2B4C]" />
                <h3 className="mt-3 text-sm font-semibold text-[#1A2B4C]">鐪嬪鎯呭弽棣?</h3>
                <p className="mt-2 text-xs leading-6 text-slate-500">鎶婃湰杞簿璁茶浆鎴愪笅涓€姝ョ殑閽堝鎬у珐鍥轰换鍔°€?</p>
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
                    {isFavorited ? "宸叉敹钘? : "鏀惰棌鏈瘲"}
                  </button>
                  <button type="button" className="btn-secondary-compact" disabled={!poemId || noteSaving} onClick={() => void saveNote()}>
                    <PenSquare className="h-3.5 w-3.5" />
                    {noteSaving ? "淇濆瓨涓?.." : "淇濆瓨鏈"}
                  </button>
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  className="learn-note-textarea mt-4"
                  placeholder={poemId ? "鎶婅繖棣栬瘲鐨勬澘涔﹂噸鐐广€佽€冪偣琛ㄨ揪鎴栬嚜宸辩殑鐞嗚В璁板湪杩欓噷銆? : "閫夋嫨鍏蜂綋璇楄瘝鍚庡彲淇濆瓨鏈銆?}
                  disabled={!poemId}
                />
                <p className="mt-2 text-xs text-slate-500">{noteUpdatedAt ? `涓婃淇濆瓨锛?{formatDateTime(noteUpdatedAt)}` : "灏氭湭淇濆瓨鏈"}</p>
                {noteMessage ? <p className="mt-2 text-xs text-emerald-700">{noteMessage}</p> : null}
                {studyStateError ? <p className="mt-2 text-xs text-rose-700">{studyStateError}</p> : null}
              </article>

              <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                <p className="text-[11px] tracking-[0.16em] text-slate-500">鍏宠仈寤跺睍</p>
                {relatedLoading ? <p className="mt-3 text-sm text-slate-500">姝ｅ湪鍔犺浇鐩稿叧璇楄瘝...</p> : null}
                {relatedError ? <p className="mt-3 text-sm text-rose-700">{relatedError}</p> : null}
                {!relatedLoading && relatedPoems.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">褰撳墠鏆傛棤鍏宠仈鎺ㄨ崘锛屽彲鍏堣繘鍏ュ浘璋辩户缁帰绱€?</p>
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
                          {poem.author} 路 {poem.dynasty}
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
          <SectionCard title="鏈疆鏀舵潫" subtitle="璁╄繖涓€椤佃嚜鐒惰繃娓″埌缁冩祴銆佸浘璋卞拰鍒涗綔銆? weight="summary" density="roomy">
            <div className="grid gap-3">
              <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                <p className="text-[11px] tracking-[0.16em] text-slate-500">鏈〉瀹屾垚搴?</p>
                <p className="mt-2 font-display text-4xl text-[#1A2B4C]">100%</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">浣犲凡缁忚蛋瀹屾暣棣栬瘲鐨勫垵瑙併€佽В鏋愩€佹帰绌躲€佽蹇嗗拰鑰冪偣浜斾釜闃舵銆?</p>
              </article>
              <article className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                <p className="text-[11px] tracking-[0.16em] text-slate-500">鎺ㄨ崘涓嬩竴姝?</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">鍏堝仛涓€杞悓璇楃粌涔狅紝鍐嶆牴鎹敊鍥犺繘鍏ュ浘璋辨垨瀛︽儏椤电户缁ˉ钖勫急鐐广€?</p>
              </article>
            </div>
          </SectionCard>

          <SectionCard title="缁х画瀛︿範" subtitle="淇濈暀瀹屾暣鑳藉姏闂幆锛屼笉鍦ㄨ繖閲岀粓姝€? weight="support" density="roomy">
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/practice?entry=practice&topic=${encodeURIComponent(title)}&count=6&difficulty=medium&auto=1&source=learn`}
                className="btn-primary"
              >
                鍘荤粌娴嬩腑蹇?
              </Link>
              <Link to={`/create?topic=${encodeURIComponent(title)}`} className="btn-secondary">
                寮€濮嬪垱浣滆縼绉?
              </Link>
            </div>
          </SectionCard>

          <NextStepRecommendations
            title="绮捐瀹屾垚鍚庢帹鑽愬姩浣?
            subtitle="鎶婁竴棣栬瘲鐨勮鍫傜悊瑙ｇ户缁€佸線缁冩祴銆佸浘璋变笌鍒涗綔杩佺Щ銆?
            items={[
              {
                title: "鍋氬悓璇楃粌娴?,
                description: `鍥寸粫銆?{title}銆嬬珛鍒诲仛涓€杞缁勶紝纭瀵规剰璞°€佹儏鎰熶笌鎵嬫硶鐨勭悊瑙ｆ槸鍚︾ǔ瀹氥€俙,
                to: `/practice?topic=${encodeURIComponent(title)}&count=6&difficulty=medium&auto=1&source=learn`,
                ctaLabel: "鍘荤粌娴?,
                badge: "宸╁浐",
              },
              {
                title: "鎵撳紑鐭ヨ瘑鍥捐氨",
                description: "鎶婅繖棣栬瘲鏀捐繘璇椾汉鍏崇郴銆佹剰璞＄綉缁滃拰涓婚杩佺Щ涓紝琛ヨ冻姣旇緝闃呰瑙嗚銆?,
                to: `/graph?highlight=${encodeURIComponent(graphHighlight)}`,
                ctaLabel: "鍘诲浘璋?,
                badge: "寤跺睍",
              },
              {
                title: "寮€濮嬪垱浣滆縼绉?,
                description: "瓒佺悊瑙ｈ繕鐑紝绔嬪埢鎶婅瘲涓殑琛ㄨ揪鏂瑰紡杞垚鑷繁鐨勮緭鍑猴紝寮哄寲杩佺Щ銆?,
                to: `/create?topic=${encodeURIComponent(title)}`,
                ctaLabel: "鍘诲垱浣?,
                badge: "杈撳嚭",
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
              kicker="瀛︿範鐩爣锛堝鐢燂級"
              title={`${studentPreviewStageMeta.title} 路 鏈樁娈佃杈炬垚`}
              summary={studentPreviewStageMeta.summary}
              goals={studentStageGoals[studentObjectiveStage]}
              chipLabel={`闃舵 ${studentPreviewStageMeta.index} 路 ${title}`}
              className="shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
            />
          </div>
        ) : null}
        {isTeacherMode ? (
          <TeachingObjectiveCard
            variant="panel"
            kicker="鏁欏笀鐩爣鎻愮ず"
            title={objective.title}
            summary={objective.summary}
            goals={objective.goals}
            chipLabel={`褰撳墠闃舵 路 ${currentStageMeta.title}`}
            hint={objective.teacherHint}
            className="shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
          />
        ) : null}
        {teachingContentError ? (
          <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
            鏁欏鏁版嵁鏆傛湭灏辩华锛歿teachingContentError}銆傚綋鍓嶄粎灞曠ず鏈€灏忕┖鎬佹彁绀猴紝涓嶅啀鍥為€€鍒伴〉闈吉鐩爣銆?
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-[rgba(201,169,110,0.22)] bg-[linear-gradient(135deg,rgba(250,247,240,0.98)_0%,rgba(247,240,226,0.98)_50%,rgba(243,235,220,0.98)_100%)] px-6 py-6 shadow-[0_22px_46px_rgba(34,58,94,0.1)] lg:px-8 lg:py-8">
          <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="flex flex-col justify-center gap-4">
              <p className="text-[12px] font-semibold tracking-[0.22em] text-[#9B6731]">璇楄瘝绮捐 路 浜旀璇惧爞娴?</p>
              <BlurText as="h1" text={title} className="font-display text-5xl text-[#203754]" delayPerChar={0.02} />
              <p className="text-sm leading-7 text-slate-600">
                {author} 路 {dynasty}
                {poemId ? " 路 褰撳墠姝ｅ湪绮捐鍏蜂綋璇楄瘝" : " 路 褰撳墠涓洪粯璁ゆ紨绀鸿瘲璇嶏紝鍙粠鎺㈢储椤靛垏鎹?}
              </p>
              <p className="max-w-[60ch] text-base leading-8 text-[#4B627D]">
                杩欎笉鏄伐鍏烽泦鍚堥〉锛岃€屾槸涓€棣栬瘲鐨勫畬鏁存暀瀛︽梾绋嬨€傚厛璇诲師鏂囷紝鍐嶅仛瑙ｆ瀽銆佹帰绌躲€佽蹇嗗拰鑰冪偣鏀舵潫锛岃璇惧爞鍜岃嚜瀛﹂兘鑳芥部鐫€鍚屼竴鏉¤矾寰勫墠杩涖€?
              </p>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => advanceStage("stage2")}>
                  杩涘叆瑙ｆ瀽
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <Link to="/explore" className="btn-secondary">
                  鍘绘帰绱㈤€夎瘲
                </Link>
                <Link
                  to={`/practice?topic=${encodeURIComponent(title)}&count=6&difficulty=medium&auto=1&source=learn`}
                  className="btn-secondary"
                >
                  鐩存帴缁冩祴
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
                    {stage.index} 路 {stage.title}
                  </span>
                ))}
              </div>
            </div>

            <TeachingObjectiveCard
              variant="hero"
              kicker="鏈鏁欏鐩爣"
              title={objective.title}
              meta={`${title} 路 ${author}`}
              goals={objective.goals}
              chipLabel={isTeacherMode ? "鏁欏笀瑙嗚" : "瀛︾敓瑙嗚"}
              footer={
                <>
                  <span>{currentStageMeta.summary}</span>
                  <button type="button" className="overview-inline-link" onClick={() => advanceStage(activeStage === "stage5" ? "stage1" : "stage2")}>
                    {activeStage === "stage1" ? "浠庤В鏋愬紑濮? : "缁х画褰撳墠瀛︿範"}
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
          kicker={isTeacherMode ? "璇惧爞鎺ㄨ繘" : "瀛︿範鎺ㄨ繘"}
          caption={isTeacherMode ? "鏁欏笀鍙墜鍔ㄦ帹杩涗簲涓樁娈碉紝鎺у埗璇惧爞鑺傚銆? : "娌跨潃浜斾釜闃舵瀹屾垚杩欎竴棣栬瘲鐨勫畬鏁寸簿璁层€?}
          className="sticky top-24 z-20"
        />
      </PageStage>

      <PageStage tone="secondary">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
          {/* 宸︿晶锛氬崟鍏冨鑸?*/}
          <aside className="hidden lg:flex flex-col gap-4">
            <SectionCard title="褰撳墠鍗曞厓" subtitle="閫佸埆绡? density="dense">
              <div className="flex flex-col gap-2 mt-2">
                <div className="rounded-lg bg-[#C9A96E]/10 p-2 text-sm font-medium text-[#8A6330] border border-[#C9A96E]/20">
                  鈻?{title}
                </div>
                <div className="rounded-lg p-2 text-sm text-slate-500 hover:bg-stone-50 cursor-pointer transition">
                  閫佸厓浜屼娇瀹夎タ
                </div>
                <div className="rounded-lg p-2 text-sm text-slate-500 hover:bg-stone-50 cursor-pointer transition">
                  榛勯工妤奸€佸瓱娴╃劧涔嬪箍闄?
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>鍗曞厓杩涘害</span>
                  <span>1 / 3</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-[#C9A96E] w-1/3" />
                </div>
              </div>
            </SectionCard>
          </aside>

          {/* 涓棿锛氫富鍐呭鍖?*/}
          <main className="min-w-0">
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
          </main>

          {/* 鍙充晶锛氭暀瀛﹁緟鍔╅潰鏉?*/}
          <aside className="flex flex-col gap-4">
            {isTeacherMode ? (
              <TeacherHintCallout
                title={stageHint.title}
                detail={stageHint.detail}
                action={
                  <button
                    type="button"
                    className="btn-secondary-compact w-full justify-center mt-2"
                    onClick={() => {
                      const currentIndex = learnStages.findIndex((item) => item.id === activeStage);
                      const next = learnStages[Math.min(learnStages.length - 1, currentIndex + 1)];
                      advanceStage(next.id as LearnStageId);
                    }}
                  >
                    鎺ㄨ嚦涓嬩竴闃舵
                  </button>
                }
              />
            ) : null}

            <TeachingObjectiveCard
              variant="panel"
              kicker="闃舵鐩爣"
              title={objective.title}
              summary={currentStageMeta.summary}
              goals={studentStageGoals[activeStage]}
              chipLabel={isTeacherMode ? "鏁欏笀瑙嗚" : "瀛︾敓瑙嗚"}
              className="shadow-[0_12px_28px_rgba(34,58,94,0.06)]"
            />
            
            <SectionCard title="鎴戠殑绗旇" density="dense" className="flex-1">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="璁板綍鏈樁娈电殑鎬濊€冧笌鐤戦棶..."
                className="w-full min-h-[120px] resize-y rounded-xl bg-stone-50 p-3 text-sm text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#C9A96E]/30 transition"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {noteUpdatedAt ? `宸蹭繚瀛樹簬 ${new Date(noteUpdatedAt).toLocaleTimeString()}` : "灏氭湭淇濆瓨"}
                </span>
                <button 
                  onClick={saveNote} 
                  disabled={noteSaving}
                  className="btn-secondary-compact text-[11px] py-1"
                >
                  {noteSaving ? "淇濆瓨涓?.." : "淇濆瓨"}
                </button>
              </div>
            </SectionCard>
          </aside>
        </div>
      </PageStage>
    </div>
  );
}

