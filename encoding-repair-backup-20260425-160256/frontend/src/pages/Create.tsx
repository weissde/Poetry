﻿﻿import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpenText,
  Brush,
  ChevronDown,
  Download,
  History,
  Loader2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { NextStepRecommendations } from "@/components/common/NextStepRecommendations";
import { PageHeader } from "@/components/common/PageHeader";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import { StateCalloutCard } from "@/components/common/StateCalloutCard";
import { InquiryTaskCard } from "@/components/teaching/InquiryTaskCard";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { TeachingStepBar } from "@/components/teaching/TeachingStepBar";
import { apiGet, apiPost } from "@/lib/api";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { createInquiryTaskCard, teacherHintItems } from "@/content/teachingStatic";
import { BlurText, Magnet, PillNav, SpotlightCard, type PillNavItem } from "@/components/react-bits";
import { ImageryGacha } from "@/components/create/ImageryGacha";
import type { CreationFeedback, CreationRecord, PaginationMeta } from "@/types";

type CreateTab = "review" | "transform" | "history";
type InquiryWorkspaceTab = "dialogue" | "creation";

type DiffPartType = "equal" | "add" | "remove";

interface DiffPart {
  type: DiffPartType;
  text: string;
}

interface CreationResultEnvelope {
  feedback: CreationFeedback;
  creation: CreationRecord;
  source: string;
}

interface CreationHistoryEnvelope {
  items: CreationRecord[];
  pagination: PaginationMeta;
}

const WORKSPACE_TABS: ReadonlyArray<PillNavItem<CreateTab>> = [
  { id: "review", label: "鍒涗綔鐐硅瘎", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "transform", label: "鐧借瘽杞瘲", icon: <WandSparkles className="h-3.5 w-3.5" /> },
  { id: "history", label: "鍘嗗彶娑﹁壊", icon: <History className="h-3.5 w-3.5" /> },
] as const;

const STYLE_OPTIONS = ["娓呴泤", "璞斁", "濠夌害", "杈瑰", "鐢板洯"] as const;

const SCORE_LABELS: Array<{ key: keyof CreationFeedback["scores"]; label: string }> = [
  { key: "imagery", label: "鎰忚薄" },
  { key: "rhythm", label: "鑺傚" },
  { key: "wording", label: "鐐煎瓧" },
];

const createTeachingObjective = {
  title: "鍒涗綔杩佺Щ鐩爣",
  summary: "鎶婅鍫傜悊瑙ｈ浆鎴愪綔鍝佽緭鍑猴細鍏堢偣璇勩€佸啀娑﹁壊銆佸啀瀵煎嚭灞曠ず锛屽苟鍥炴祦鍒板鎯呬腑蹇冨鐩樸€?,
  goals: ["瀹屾垚 1 娆＄偣璇勬垨鐧借瘽杞瘲", "鑷冲皯鐢熸垚 1 涓鼎鑹茬増鏈?, "瀵煎嚭娴锋姤骞跺洖鍒板鎯呭鐩?瀹夋帓宸╁浐"],
  teacherHint: "璇惧爞婕旂ず寤鸿锛氬厛灞曠ず鐐硅瘎缁村害锛屽啀鍋氫竴娆℃鼎鑹插姣旓紝鏈€鍚庡鍑烘捣鎶ヤ綔涓鸿鍫傝緭鍑烘垚鏋溿€?,
};

function clampScore(input: number | null | undefined): number {
  const value = Number(input ?? 0);
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(10, value));
}

function meanScore(scores?: Record<string, number> | null): number {
  if (!scores) {
    return 0;
  }
  const values = Object.values(scores).filter((value) => typeof value === "number");
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((acc, curr) => acc + curr, 0);
  return sum / values.length;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function cleanText(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

function buildDiffParts(beforeText: string, afterText: string): DiffPart[] {
  const before = Array.from(beforeText || "");
  const after = Array.from(afterText || "");
  const n = before.length;
  const m = after.length;

  if (n === 0 && m === 0) {
    return [];
  }

  const dp = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (before[i - 1] === after[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const reversed: DiffPart[] = [];
  let i = n;
  let j = m;

  while (i > 0 && j > 0) {
    if (before[i - 1] === after[j - 1]) {
      reversed.push({ type: "equal", text: before[i - 1] });
      i -= 1;
      j -= 1;
      continue;
    }

    if (dp[i - 1][j] >= dp[i][j - 1]) {
      reversed.push({ type: "remove", text: before[i - 1] });
      i -= 1;
    } else {
      reversed.push({ type: "add", text: after[j - 1] });
      j -= 1;
    }
  }

  while (i > 0) {
    reversed.push({ type: "remove", text: before[i - 1] });
    i -= 1;
  }
  while (j > 0) {
    reversed.push({ type: "add", text: after[j - 1] });
    j -= 1;
  }

  const merged: DiffPart[] = [];
  reversed.reverse().forEach((part) => {
    const last = merged[merged.length - 1];
    if (last && last.type === part.type) {
      last.text += part.text;
      return;
    }
    merged.push({ ...part });
  });

  return merged;
}

function ScoreRingCard({ label, score }: { label: string; score: number }): JSX.Element {
  const radius = 40;
  const stroke = 8;
  const normalized = clampScore(score);
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - normalized / 10);

  return (
    <SpotlightCard
      className="rounded-2xl bg-white/95 p-4 shadow-[0_4px_20px_rgba(26,43,76,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_26px_rgba(26,43,76,0.08)]"
      spotlightColor="rgba(26,43,76,0.08)"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-sans text-xs tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 font-serif text-4xl text-[#1A2B4C]">{normalized.toFixed(1)}</p>
        </div>
        <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
          <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(26,43,76,0.1)" strokeWidth={stroke} />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#C9A96E"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            transform="rotate(-90 48 48)"
          />
        </svg>
      </div>
    </SpotlightCard>
  );
}

function InsightAccordion({
  title,
  tag,
  items,
  expanded,
  onToggle,
}: {
  title: string;
  tag: string;
  items: string[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
}): JSX.Element {
  return (
    <SpotlightCard
      className="rounded-2xl bg-stone-50/90 p-4 shadow-[0_4px_18px_rgba(0,0,0,0.03)]"
      spotlightColor="rgba(201,169,110,0.12)"
    >
      <h3 className="font-serif text-xl text-[#1A2B4C]">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="font-sans text-xs text-slate-400">鏆傛棤鍐呭</p> : null}
        {items.map((item, index) => {
          const id = `${tag}-${index}`;
          const isOpen = expanded.has(id);
          return (
            <div key={id} className="rounded-xl bg-white/90 px-3 py-2 shadow-[0_3px_12px_rgba(26,43,76,0.04)]">
              <button
                type="button"
                onClick={() => onToggle(id)}
                className="flex w-full items-center justify-between gap-3 text-left transition-all duration-300 hover:-translate-y-0.5"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="rounded-full bg-[#C9A96E]/20 px-2 py-1 font-sans text-[11px] tracking-[0.14em] text-[#8A6B32]">
                    {tag.toUpperCase()} {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-sans text-sm text-slate-700">鐐瑰嚮鏌ョ湅缁嗚妭</span>
                </span>
                <ChevronDown className={["h-4 w-4 text-slate-500 transition", isOpen ? "rotate-180" : ""].join(" ")} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden pt-3 font-sans text-sm leading-7" style={{ color: 'var(--neutral)' }}
                  >
                    {item}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </SpotlightCard>
  );
}

function HistoryEmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <svg width="180" height="120" viewBox="0 0 180 120" className="opacity-80">
        <path d="M16 70 C46 30, 84 96, 122 62 C138 48, 158 52, 170 66" fill="none" stroke="#C9A96E" strokeWidth="4" strokeLinecap="round" />
        <circle cx="48" cy="52" r="8" fill="rgba(26,43,76,0.16)" />
        <circle cx="72" cy="72" r="6" fill="rgba(26,43,76,0.1)" />
        <path d="M126 20 L146 36 L116 58 Z" fill="rgba(26,43,76,0.18)" />
      </svg>
      <p className="font-serif text-2xl text-[#1A2B4C]">杩樻病鏈夊巻鍙叉鼎鑹茶褰?</p>
      <p className="max-w-md font-sans text-sm leading-7 text-slate-500">鍏堝畬鎴愪竴娆＄偣璇勬垨鐧借瘽杞瘲锛岃繖閲屼細鑷姩鐢熸垚浣犵殑鍒涗綔杞ㄨ抗涓庣増鏈凯浠ｃ€?</p>
    </div>
  );
}

function DiffViewer({ sourceText, revisedText }: { sourceText: string; revisedText: string }): JSX.Element {
  const parts = useMemo(() => buildDiffParts(sourceText, revisedText), [sourceText, revisedText]);

  return (
    <SpotlightCard
      className="rounded-2xl bg-stone-50/90 p-4 shadow-[0_4px_18px_rgba(26,43,76,0.03)]"
      spotlightColor="rgba(26,43,76,0.08)"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-xl text-[#1A2B4C]">娑﹁壊宸紓</h3>
        <div className="flex items-center gap-2 font-sans text-[11px] text-slate-500">
          <span className="rounded-full bg-rose-100/90 px-2 py-1 text-rose-600">鍒犻櫎</span>
          <span className="rounded-full bg-emerald-100/90 px-2 py-1 text-emerald-700">鏂板</span>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words font-serif text-lg leading-9 text-slate-700">
        {parts.length === 0 ? "鏆傛棤鍙姣旀枃鏈? : null}
        {parts.map((part, index) => {
          const className =
            part.type === "add"
              ? "rounded bg-emerald-100/90 px-0.5 text-emerald-700"
              : part.type === "remove"
                ? "rounded bg-rose-100/90 px-0.5 text-rose-600 line-through"
                : "";

          return (
            <span key={`${part.type}-${index}`} className={className}>
              {part.text}
            </span>
          );
        })}
      </p>
    </SpotlightCard>
  );
}
type HistoryStyleFilter = "all" | (typeof STYLE_OPTIONS)[number];

type CreateWorkspaceTab = "my_creation" | "plaza";

const createTabNavItems: readonly PillNavItem<CreateWorkspaceTab>[] = [
  { id: "my_creation", label: "鉁嶏笍 鎴戠殑鍒涗綔" },
  { id: "plaza", label: "馃彌 鍒涗綔骞垮満" },
];

export default function CreatePage(): JSX.Element {
  const [activeMainTab, setActiveMainTab] = useState<CreateWorkspaceTab>("my_creation");
  const { isTeacherMode } = useTeachingMode();
  const [searchParams] = useSearchParams();
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const modernRef = useRef<HTMLTextAreaElement | null>(null);

  const [workspaceTab, setWorkspaceTab] = useState<InquiryWorkspaceTab>("creation");
  const [queuedInquiryPrompt, setQueuedInquiryPrompt] = useState<{ nonce: number; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<CreateTab>("review");
  const [style, setStyle] = useState<(typeof STYLE_OPTIONS)[number]>("娓呴泤");
  const [referencePoem, setReferencePoem] = useState<string>("鏄ユ湜");
  const [draftContent, setDraftContent] = useState<string>("灞辨湀鐓у瘨绐楋紝椋庤繃绔瑰奖闀裤€俓n澶滄繁浜烘湭瀵濓紝鐙潗鍚澗鍑夈€?);
  const [modernText, setModernText] = useState<string>("鏀惧璺笂鐪嬪埌鍌嶆櫄浜戝眰寰堟紓浜紝绐佺劧鎯宠捣瀹朵埂銆傛兂鎶婅繖绉嶆儏缁啓鎴愬彜椋庛€?);
  const [refineInstruction, setRefineInstruction] = useState<string>("鍦ㄤ繚鐣欏師鎰忕殑鍓嶆彁涓嬶紝璁╄瑷€鏇村嚌缁冦€佽妭濂忔洿绋冲畾銆?);

  const [resultCreation, setResultCreation] = useState<CreationRecord | null>(null);
  const [resultFeedback, setResultFeedback] = useState<CreationFeedback | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [historyItems, setHistoryItems] = useState<CreationRecord[]>([]);
  const [historyMeta, setHistoryMeta] = useState<PaginationMeta | null>(null);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyKeywordInput, setHistoryKeywordInput] = useState<string>("");
  const [historyKeyword, setHistoryKeyword] = useState<string>("");
  const [historyStyleFilter, setHistoryStyleFilter] = useState<HistoryStyleFilter>("all");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>("");
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [expandedTags, setExpandedTags] = useState<Set<string>>(() => new Set());

  const resizeTextarea = useCallback((element: HTMLTextAreaElement | null): void => {
    if (!element) {
      return;
    }
    element.style.height = "0px";
    const nextHeight = Math.min(460, Math.max(190, element.scrollHeight));
    element.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    resizeTextarea(draftRef.current);
  }, [draftContent, resizeTextarea]);

  useEffect(() => {
    resizeTextarea(modernRef.current);
  }, [modernText, resizeTextarea]);

  const historyStyleItems = useMemo<ReadonlyArray<PillNavItem<HistoryStyleFilter>>>(
    () => [{ id: "all", label: "鍏ㄩ儴" }, ...STYLE_OPTIONS.map((item) => ({ id: item, label: item }))],
    [],
  );

  const activeInputText = activeTab === "transform" ? modernText : draftContent;

  const textStats = useMemo(() => {
    const compact = (activeInputText || "").replace(/\s+/g, "");
    const rows = activeInputText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const lengths = rows.map((line) => line.replace(/[锛屻€傦紒锛燂紱銆?.!?;:锛歕s]/g, "").length).filter((value) => value > 0);
    const average = lengths.length > 0 ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : 0;
    const dispersion =
      lengths.length > 0
        ? Math.sqrt(lengths.reduce((sum, value) => sum + (value - average) * (value - average), 0) / lengths.length)
        : 0;
    const neatness = lengths.length > 0 ? Math.max(0, Math.min(100, Math.round(100 - dispersion * 13))) : 0;

    return {
      charCount: compact.length,
      rowCount: rows.length,
      averageLength: Math.round(average * 10) / 10,
      neatness,
    };
  }, [activeInputText]);

  const heroProgress = Math.min(100, Math.max(6, Math.round((textStats.charCount / 96) * 100)));
  const heroRadius = 34;
  const heroCircumference = 2 * Math.PI * heroRadius;
  const heroOffset = heroCircumference * (1 - heroProgress / 100);

  const loadHistory = useCallback(
    async (targetPage: number): Promise<void> => {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const params = new URLSearchParams();
        params.set("page", String(Math.max(1, targetPage)));
        params.set("pageSize", "8");

        if (historyKeyword.trim()) {
          params.set("q", historyKeyword.trim());
        }
        if (historyStyleFilter !== "all") {
          params.set("style", historyStyleFilter);
        }

        const data = await apiGet<CreationHistoryEnvelope>(`/create/history?${params.toString()}`);
        setHistoryItems(data.items || []);
        setHistoryMeta(data.pagination || null);
        setHistoryPage(Math.max(1, targetPage));

        setSelectedHistoryId((prev) => {
          const hasPrev = (data.items || []).some((item) => item.id === prev);
          if (hasPrev) {
            return prev;
          }
          return data.items?.[0]?.id || "";
        });
      } catch (error: unknown) {
        setHistoryError(error instanceof Error ? error.message : "鍔犺浇鍘嗗彶璁板綍澶辫触锛岃绋嶅悗閲嶈瘯銆?);
      } finally {
        setHistoryLoading(false);
      }
    },
    [historyKeyword, historyStyleFilter],
  );

  useEffect(() => {
    void loadHistory(1);
  }, [loadHistory]);

  const pickHistoryItem = useCallback((item: CreationRecord): void => {
    setSelectedHistoryId(item.id);
    setResultCreation(item);
    setResultFeedback(item.feedback_json || null);
    setStatusMessage("宸茶浇鍏ュ巻鍙叉鼎鑹茬増鏈紝鍙户缁墦纾ㄣ€?);
    setErrorMessage("");

    if (item.style && STYLE_OPTIONS.includes(item.style as (typeof STYLE_OPTIONS)[number])) {
      setStyle(item.style as (typeof STYLE_OPTIONS)[number]);
    }
    setReferencePoem(item.reference_poem || "");

    if (item.mode === "transform") {
      setModernText(item.source_text || "");
    } else {
      setDraftContent(item.source_text || item.content || "");
    }
  }, []);

  const handleReview = useCallback(async (): Promise<void> => {
    const content = cleanText(draftContent);
    if (!content) {
      setErrorMessage("璇峰厛杈撳叆瑕佺偣璇勭殑璇楀彞銆?);
      setStatusMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const data = await apiPost<CreationResultEnvelope>("/create/review", {
        style,
        referencePoem: referencePoem.trim() || null,
        content,
      });

      setResultCreation(data.creation);
      setResultFeedback(data.feedback);
      setSelectedHistoryId(data.creation.id);
      setStatusMessage(data.source === "fallback_local" ? "鐐硅瘎瀹屾垚锛堢绾跨瓥鐣ワ級" : "鐐硅瘎瀹屾垚锛屽彲缁х画娑﹁壊銆?);
      void loadHistory(1);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "鐐硅瘎澶辫触锛岃绋嶅悗閲嶈瘯銆?);
    } finally {
      setIsSubmitting(false);
    }
  }, [draftContent, loadHistory, referencePoem, style]);

  const handleTransform = useCallback(async (): Promise<void> => {
    const content = cleanText(modernText);
    if (!content) {
      setErrorMessage("璇峰厛杈撳叆鐧借瘽鏂囨湰銆?);
      setStatusMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const data = await apiPost<CreationResultEnvelope>("/create/transform", {
        style,
        referencePoem: referencePoem.trim() || null,
        modernText: content,
      });

      setResultCreation(data.creation);
      setResultFeedback(data.feedback);
      setSelectedHistoryId(data.creation.id);
      setStatusMessage(data.source === "fallback_local" ? "杞啓瀹屾垚锛堢绾跨瓥鐣ワ級" : "杞啓瀹屾垚锛屽彲缁х画娑﹁壊銆?);
      void loadHistory(1);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "杞啓澶辫触锛岃绋嶅悗閲嶈瘯銆?);
    } finally {
      setIsSubmitting(false);
    }
  }, [loadHistory, modernText, referencePoem, style]);

  const handlePrimaryAction = useCallback(async (): Promise<void> => {
    if (activeTab === "review") {
      await handleReview();
      return;
    }
    if (activeTab === "transform") {
      await handleTransform();
      return;
    }
    await loadHistory(1);
  }, [activeTab, handleReview, handleTransform, loadHistory]);

  const handleRefine = useCallback(async (): Promise<void> => {
    if (!resultCreation?.id) {
      setErrorMessage("璇峰厛鐢熸垚鎴栭€夋嫨涓€鏉′綔鍝佸悗鍐嶆鼎鑹层€?);
      setStatusMessage("");
      return;
    }

    setIsRefining(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const data = await apiPost<CreationResultEnvelope>(`/create/${resultCreation.id}/refine`, {
        instruction: refineInstruction.trim() || undefined,
        style,
        referencePoem: referencePoem.trim() || null,
      });

      setResultCreation(data.creation);
      setResultFeedback(data.feedback);
      setSelectedHistoryId(data.creation.id);
      setStatusMessage(data.source === "fallback_local" ? "娑﹁壊瀹屾垚锛堢绾跨瓥鐣ワ級" : "娑﹁壊瀹屾垚锛屽凡鐢熸垚鏂扮増鏈€?);
      void loadHistory(1);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "娑﹁壊澶辫触锛岃绋嶅悗閲嶈瘯銆?);
    } finally {
      setIsRefining(false);
    }
  }, [loadHistory, refineInstruction, referencePoem, resultCreation?.id, style]);

  const displayedRevisedText = useMemo(() => {
    const fromFeedback = cleanText(resultFeedback?.revisedContent || "");
    if (fromFeedback) {
      return fromFeedback;
    }
    return cleanText(resultCreation?.content || "");
  }, [resultCreation?.content, resultFeedback?.revisedContent]);

  const displayedSourceText = useMemo(() => {
    const fromCreation = cleanText(resultCreation?.source_text || "");
    if (fromCreation) {
      return fromCreation;
    }
    if (resultCreation?.mode === "transform") {
      return cleanText(modernText);
    }
    return cleanText(draftContent);
  }, [draftContent, modernText, resultCreation?.mode, resultCreation?.source_text]);

  const scoreRows = useMemo(
    () =>
      SCORE_LABELS.map((item) => ({
        key: item.key,
        label: item.label,
        score: clampScore(resultFeedback?.scores?.[item.key]),
      })),
    [resultFeedback?.scores],
  );

  const average = useMemo(() => meanScore(resultFeedback?.scores), [resultFeedback?.scores]);

  const canExportPoster = displayedRevisedText.length > 0 && Boolean(resultFeedback);
  const exportSucceeded = statusMessage.includes("娴锋姤宸插鍑?);

  const handleExportPoster = useCallback(async (): Promise<void> => {
    if (!canExportPoster || !resultFeedback) {
      setErrorMessage("璇峰厛鐢熸垚缁撴灉鍚庡啀瀵煎嚭娴锋姤銆?);
      return;
    }

    setIsExporting(true);
    setErrorMessage("");

    try {
      const element = document.getElementById("poster-area");
      if (!element) throw new Error("鏃犳硶鎵惧埌娴锋姤鍖哄煙");
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(element, { backgroundColor: "#fbfaf6" });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      if (!blob) throw new Error("瀵煎嚭鐢诲竷澶辫触");
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `璇楀閫歘鍒涗綔娴锋姤_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      
      setStatusMessage("娴锋姤宸插鍑哄埌鏈湴銆?);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "瀵煎嚭澶辫触锛岃绋嶅悗閲嶈瘯銆?);
    } finally {
      setIsExporting(false);
    }
  }, [canExportPoster, resultFeedback]);

  const toggleInsight = useCallback((id: string): void => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const primaryCtaText =
    activeTab === "review" ? "绔嬪嵆鐐硅瘎" : activeTab === "transform" ? "鐢熸垚鍙ら" : historyLoading ? "鍒锋柊涓?.." : "鍒锋柊鍘嗗彶";

  const selectedHistory = useMemo(
    () => historyItems.find((item) => item.id === selectedHistoryId) || null,
    [historyItems, selectedHistoryId],
  );

  const showHistoryPanel = activeTab === "history";
  const inquiryCard = createInquiryTaskCard;
  const teacherHint = teacherHintItems.find((item) => item.page === "create") || null;
  const inquiryPoemTitle = searchParams.get("poemTitle") || "闈欏鎬?;
  const inquiryPoemAuthor = searchParams.get("poemAuthor") || "鏉庣櫧";
  const inquiryPoemContent =
    searchParams.get("poemContent") || "搴婂墠鏄庢湀鍏夛紝鐤戞槸鍦颁笂闇溿€俓n涓惧ご鏈涙槑鏈堬紝浣庡ご鎬濇晠涔°€?;

  return (
    <div className="page-shell">
      <PageStage tone="primary">
        <TeachingStepBar currentIndex="03" />
        <PageHeader
          variant="standard"
          kicker="鎺㈢┒浜掑姩"
          title="鍒涗綔澶╁湴"
          subtitle="灏?AI 杈呭姪鍒涗綔涓庡箍鍦轰簰鍔ㄦ敹鎷㈠埌缁熶竴宸ヤ綔鍖?
        />
        <div className="mt-8 flex justify-center">
          <PillNav items={createTabNavItems} value={activeMainTab} onChange={(next) => setActiveMainTab(next)} />
        </div>
      </PageStage>

      {activeMainTab === "my_creation" ? (
        <>
        <PageStage tone="secondary">
          {isTeacherMode ? (
          <TeachingObjectiveCard
            variant="panel"
            kicker="鏁欏笀鐩爣鎻愮ず"
            title={createTeachingObjective.title}
            summary={createTeachingObjective.summary}
            goals={createTeachingObjective.goals}
            chipLabel="褰撳墠闃舵 路 鍒涗綔杩佺Щ"
            hint={createTeachingObjective.teacherHint}
            className="mt-4 shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
          />
        ) : null}
        <SpotlightCard
          className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_18%_20%,rgba(26,43,76,0.14),transparent_56%),radial-gradient(circle_at_90%_18%,rgba(201,169,110,0.26),transparent_44%),linear-gradient(132deg,#fbfaf6,#f5f2ea)] p-6 shadow-[0_12px_34px_rgba(26,43,76,0.08)] sm:p-8"
          spotlightColor="rgba(201,169,110,0.15)"
        >
          {isTeacherMode && teacherHint ? (
            <TeacherHintCallout
              title={teacherHint.title}
              detail={teacherHint.detail}
              className="lg:absolute lg:right-6 lg:top-6 lg:max-w-sm"
            />
          ) : null}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <p className="font-sans text-xs tracking-[0.16em] text-[#1A2B4C]/65">CREATIVE WORKSHOP</p>
              <h1 className="mt-2 font-serif text-4xl text-[#1A2B4C] sm:text-5xl">鍒涗綔鍧?路 娑﹁壊寮曟搸</h1>
              <p className="mt-3 max-w-2xl font-sans text-sm leading-7" style={{ color: 'var(--neutral)' }}>
                璁╂瘡娆″垱浣滈兘褰㈡垚鍙拷韪殑鐗堟湰杩涘寲锛氬厛鐐硅瘎銆佸啀娑﹁壊銆佸啀瀵煎嚭涓烘捣鎶ワ紝褰㈡垚瀹屾暣琛ㄨ揪闂幆銆?
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/80 px-3 py-1.5 font-sans text-xs text-slate-500">瀛楁暟 {textStats.charCount}</span>
                <span className="rounded-full bg-white/80 px-3 py-1.5 font-sans text-xs text-slate-500">琛屾暟 {textStats.rowCount}</span>
                <span className="rounded-full bg-white/80 px-3 py-1.5 font-sans text-xs text-slate-500">鏍煎緥榻愭暣 {textStats.neatness}%</span>
              </div>

              <div className="mt-7">
                <Magnet className="inline-flex">
                  <button
                    type="button"
                    onClick={() => {
                      void handlePrimaryAction();
                    }}
                    disabled={isSubmitting || historyLoading}
                    className="inline-flex items-center gap-2 rounded-full bg-[#1A2B4C] px-6 py-3 font-sans text-sm text-white shadow-[0_14px_30px_rgba(26,43,76,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(26,43,76,0.34)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting || historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {primaryCtaText}
                  </button>
                </Magnet>
              </div>
            </div>

            <div className="rounded-3xl bg-white/72 p-4 shadow-[0_6px_22px_rgba(26,43,76,0.08)]">
              <p className="font-sans text-xs tracking-[0.14em] text-slate-500">浠婃棩鐒︾偣浠诲姟杩涘害</p>
              <div className="relative mt-4 flex items-center justify-center">
                <svg width="108" height="108" viewBox="0 0 108 108">
                  <circle cx="54" cy="54" r={heroRadius} fill="none" stroke="rgba(26,43,76,0.12)" strokeWidth="8" />
                  <circle
                    cx="54"
                    cy="54"
                    r={heroRadius}
                    fill="none"
                    stroke="#C9A96E"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={heroCircumference}
                    strokeDashoffset={heroOffset}
                    transform="rotate(-90 54 54)"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="font-serif text-3xl text-[#1A2B4C]">{heroProgress}%</p>
                  <p className="font-sans text-[11px] text-slate-500">瀹屾垚搴?</p>
                </div>
              </div>
              <p className="mt-4 font-sans text-xs leading-6 text-slate-500">寤鸿鍏堝畬鎴愬垱浣滆緭鍏ワ紝鍐嶈繘琛屼竴娆＄偣璇勪笌娑﹁壊銆?</p>
            </div>
          </div>
        </SpotlightCard>

        <SectionCard
          title="鍒涗綔涓庡鎯呰仈鍔?
          subtitle="鎶婃湰杞偣璇勩€佹鼎鑹蹭笌鐗堟湰璁板綍甯﹀洖瀛︽儏涓績锛屽拰缁冩祴銆侀敊棰樻斁鍦ㄥ悓涓€瑙嗚澶嶇洏銆?
          weight="support"
          density="dense"
        >
          <p className="text-sm leading-7" style={{ color: 'var(--neutral)' }}>
            瀹屾垚涓€娆℃湁鏁堢殑鍒涗綔杈撳嚭鍚庯紝寤鸿鍒般€屾垜鐨勫鎯呫€嶆煡鐪嬫€昏涓?AI 瑙ｈ锛涘悗缁嫢鎺ュ叆鍚庣锛屽彲灏嗗垱浣滄寚鏍囩撼鍏ュ懆鎶ヤ笌鐝骇鐪嬫澘銆?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/my-learning?tab=overview&from=create"
              className="btn-primary-compact justify-center"
            >
              鏌ョ湅瀛︽儏涓績
            </Link>
            <Link to="/my-learning?tab=plan" className="btn-secondary-compact justify-center">
              鍘荤湅澶嶄範璁″垝
            </Link>
          </div>
        </SectionCard>

        <NextStepRecommendations
          title="鍒涗綔瀹屾垚鍚庡仛浠€涔?
          subtitle="鎶婁綔鍝佷粠鍗曟杈撳嚭锛屾帴鍒扮粌娴嬨€佸浘璋变笌瀛︽儏澶嶇洏閾捐矾涓€?
          items={[
            {
              title: "鍥炵湅瀛︽儏鎬昏",
              description: "鎶婂垱浣滅粨鏋滀笌鏈懆缁冩祴銆侀敊棰樺拰璁板繂鐘舵€佹斁鍒板悓涓€瑙嗗浘閲屽鐩樸€?,
              to: "/my-learning?tab=overview&from=create",
              ctaLabel: "鏌ョ湅瀛︽儏",
              badge: "鏀舵潫",
            },
            {
              title: "杩涘叆鍥捐氨鎵惧叧鑱?,
              description: "鎶婁綘鍒氭墠浣跨敤鐨勬剰璞°€佹儏缁垨涓婚鏀捐繘鐭ヨ瘑鍥捐氨锛屾墿灞曟瘮杈冮槄璇荤礌鏉愩€?,
              to: "/graph?view=imagery",
              ctaLabel: "鎵撳紑鍥捐氨",
              badge: "寤跺睍",
            },
            {
              title: "鍥炲埌缁冩祴宸╁浐琛ㄨ揪",
              description: "瓒佸垱浣滃悗鐨勮〃杈炬晱鎰熷害杩樺湪锛岀珛鍒诲仛涓€杞祻鏋愭垨鎯呮劅棰樺珐鍥鸿縼绉汇€?,
              to: "/practice?entry=practice&topic=鍒涗綔琛ㄨ揪杩佺Щ&types=emotion,appreciation&count=6&difficulty=medium&auto=1&source=create",
              ctaLabel: "鍘荤粌娴?,
              badge: "杩佺Щ",
            },
          ]}
          className="mt-4"
        />
      </PageStage>

      <PageStage tone="secondary">
        <InquiryTaskCard
          data={inquiryCard}
          completionTo="/practice"
          onPickQuestion={(question) => {
            setWorkspaceTab("dialogue");
            setQueuedInquiryPrompt({ nonce: Date.now(), text: question });
          }}
        />

        <SpotlightCard
          className="rounded-3xl bg-white/95 p-4 shadow-[0_8px_28px_rgba(26,43,76,0.06)] sm:p-6"
          spotlightColor="rgba(26,43,76,0.08)"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-sans text-xs tracking-[0.14em] text-slate-400">WORKSPACE</p>
              <h2 className="mt-1 font-serif text-3xl text-[#1A2B4C]">鎺㈢┒浜掑姩宸ヤ綔鍖?</h2>
              <p className="mt-2 font-sans text-sm text-slate-500">鍏堣繘琛?AI 瀵硅瘽鎺㈢┒锛屽啀杩涘叆鍒涗綔杩佺Щ锛屽舰鎴愬畬鏁寸殑浜掑姩闂幆銆?</p>
            </div>
            <div className="flex flex-col gap-3 self-start">
              <div className="learn-filter-row">
                <button
                  type="button"
                  className={["learn-chip", workspaceTab === "dialogue" ? "learn-chip-active" : ""].join(" ")}
                  onClick={() => setWorkspaceTab("dialogue")}
                >
                  AI 瀵硅瘽鎺㈢┒
                </button>
                <button
                  type="button"
                  className={["learn-chip", workspaceTab === "creation" ? "learn-chip-active" : ""].join(" ")}
                  onClick={() => setWorkspaceTab("creation")}
                >
                  鍒涗綔杩佺Щ
                </button>
              </div>
              {workspaceTab === "creation" ? (
                <PillNav items={WORKSPACE_TABS} value={activeTab} onChange={setActiveTab} className="self-start" />
              ) : null}
            </div>
          </div>

          {workspaceTab === "dialogue" ? (
            <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
              <SpotlightCard
                className="rounded-2xl bg-stone-50/95 p-4 shadow-[0_4px_18px_rgba(26,43,76,0.04)] sm:p-5"
                spotlightColor="rgba(201,169,110,0.12)"
              >
                <p className="font-sans text-xs tracking-[0.14em] text-slate-400">DIALOGUE TASK</p>
                <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">{inquiryCard.title}</h3>
                <p className="mt-3 text-sm leading-7" style={{ color: 'var(--neutral)' }}>{inquiryCard.prompt}</p>
                <div className="mt-4 space-y-2">
                  {inquiryCard.presetQuestions.map((question) => (
                    <div key={question} className="rounded-2xl bg-white/95 px-4 py-3 text-sm leading-7 text-slate-700 shadow-[0_4px_12px_rgba(26,43,76,0.04)]">
                      {question}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary-compact"
                    onClick={() => {
                      setWorkspaceTab("creation");
                      setActiveTab("review");
                    }}
                  >
                    杞叆鍒涗綔杩佺Щ
                  </button>
                  <Link to="/practice" className="btn-primary-compact justify-center">
                    {inquiryCard.completionCta}
                  </Link>
                </div>
              </SpotlightCard>

              <SpotlightCard
                className="rounded-2xl bg-white/98 p-4 shadow-[0_4px_18px_rgba(26,43,76,0.04)] sm:p-5"
                spotlightColor="rgba(26,43,76,0.08)"
              >
                <div className="mb-4">
                  <p className="font-sans text-xs tracking-[0.14em] text-slate-400">AI DIALOGUE</p>
                  <h3 className="mt-1 font-serif text-2xl text-[#1A2B4C]">鍥寸粫绀轰緥璇楄瘝杩涜澶氳疆鎺㈢┒</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    褰撳墠鎺㈢┒瀵硅薄锛歿inquiryPoemTitle} 路 {inquiryPoemAuthor}
                  </p>
                </div>
                <ChatWindow
                  poemTitle={inquiryPoemTitle}
                  poemAuthor={inquiryPoemAuthor}
                  poemContent={inquiryPoemContent}
                  queuedPromptText={queuedInquiryPrompt?.text || null}
                  queuedPromptNonce={queuedInquiryPrompt?.nonce || null}
                />
              </SpotlightCard>
            </div>
          ) : null}

          {workspaceTab === "creation" ? (
          <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <SpotlightCard
              className="rounded-2xl bg-stone-50/95 p-4 shadow-[0_4px_18px_rgba(26,43,76,0.04)] sm:p-5"
              spotlightColor="rgba(201,169,110,0.12)"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-serif text-2xl text-[#1A2B4C]">杈撳叆鍖?</h3>
                <span className="rounded-full bg-white/90 px-3 py-1 font-sans text-xs text-slate-500">鑷姩楂樺害</span>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="font-sans text-xs tracking-[0.12em] text-slate-400">鍒涗綔椋庢牸</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STYLE_OPTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setStyle(item)}
                        className={[
                          "rounded-full px-3 py-1.5 font-sans text-xs transition-all duration-300",
                          style === item
                            ? "bg-[#1A2B4C] text-white shadow-[0_10px_24px_rgba(26,43,76,0.25)]"
                            : "bg-white/90 text-slate-600 hover:-translate-y-0.5 hover:bg-white",
                        ].join(" ")}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-sans text-xs tracking-[0.12em] text-slate-400">鍙傝€冭瘲璇嶏紙鍙€夛級</p>
                  <input
                    value={referencePoem}
                    onChange={(event) => setReferencePoem(event.target.value)}
                    placeholder="濡傦細鏄ユ湜"
                    className="mt-2 w-full rounded-2xl bg-white/92 px-4 py-3 font-sans text-sm text-slate-700 shadow-[inset_0_1px_2px_rgba(26,43,76,0.05)] outline-none transition-all duration-300 focus:bg-white"
                  />
                </div>

                {activeTab === "transform" ? (
                  <div>
                    <p className="font-sans text-xs tracking-[0.12em] text-slate-400">鐧借瘽鏂囨湰</p>
                    <textarea
                      ref={modernRef}
                      value={modernText}
                      onChange={(event) => setModernText(event.target.value)}
                      placeholder="杈撳叆鎯宠杞啓鐨勭幇浠ｈ鍙?.."
                      className="mt-2 min-h-[190px] w-full resize-none rounded-2xl bg-white/92 px-4 py-3 font-sans text-sm leading-7 text-slate-700 shadow-[inset_0_1px_2px_rgba(26,43,76,0.05)] outline-none transition-all duration-300 focus:bg-white"
                    />
                    <ImageryGacha onAppendImagery={(val) => setModernText(prev => prev + (prev ? "锛? : "") + val)} />
                  </div>
                ) : (
                  <div>
                    <p className="font-sans text-xs tracking-[0.12em] text-slate-400">璇楀彞鑽夌</p>
                    <textarea
                      ref={draftRef}
                      value={draftContent}
                      onChange={(event) => setDraftContent(event.target.value)}
                      placeholder="杈撳叆浣犺鐐硅瘎鎴栨鼎鑹茬殑璇楀彞..."
                      className="mt-2 min-h-[190px] w-full resize-none rounded-2xl bg-white/92 px-4 py-3 font-serif text-lg leading-9 text-slate-700 shadow-[inset_0_1px_2px_rgba(26,43,76,0.05)] outline-none transition-all duration-300 focus:bg-white"
                    />
                  </div>
                )}

                <div className="rounded-2xl bg-white/92 px-4 py-3 shadow-[0_4px_14px_rgba(26,43,76,0.04)]">
                  <p className="font-sans text-xs text-slate-500">
                    瀛楁暟 {textStats.charCount} 路 琛屾暟 {textStats.rowCount} 路 鍙ュ潎瀛楁暟 {textStats.averageLength} 路 鏍煎緥榻愭暣 {textStats.neatness}%
                  </p>
                </div>

                <div className="rounded-2xl bg-white/92 p-3 shadow-[0_4px_14px_rgba(26,43,76,0.04)]">
                  <p className="font-sans text-xs tracking-[0.12em] text-slate-400">娑﹁壊瑕佹眰</p>
                  <textarea
                    value={refineInstruction}
                    onChange={(event) => setRefineInstruction(event.target.value)}
                    className="mt-2 h-20 w-full resize-none rounded-xl bg-stone-50/90 px-3 py-2 font-sans text-sm leading-6 text-slate-600 outline-none"
                  />
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard
              className="rounded-2xl bg-white/98 p-4 shadow-[0_4px_18px_rgba(26,43,76,0.04)] sm:p-5"
              spotlightColor="rgba(26,43,76,0.08)"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-serif text-2xl text-[#1A2B4C]">缁撴灉鍖?</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleRefine();
                    }}
                    disabled={isRefining || !resultCreation}
                    className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 font-sans text-xs text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRefining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brush className="h-3.5 w-3.5" />}
                    缁х画娑﹁壊
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleExportPoster();
                    }}
                    disabled={isExporting || !canExportPoster}
                    className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 font-sans text-xs text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    瀵煎嚭娴锋姤
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {statusMessage ? (
                  <motion.p
                    key={statusMessage}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="mt-3 rounded-xl bg-emerald-100/70 px-3 py-2 font-sans text-xs text-emerald-700"
                  >
                    {statusMessage}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              {exportSucceeded ? (
                <div className="mt-3">
                  <StateCalloutCard
                    eyebrow="瀹屾垚鎬?路 璇惧爞杈撳嚭"
                    title="娴锋姤宸插鍑猴紝鍙互杩涘叆澶嶇洏涓庡珐鍥?
                    description="寤鸿鎶婃湰娆″垱浣滄垚鏋滃甫鍥炲鎯呬腑蹇冨仛鏀跺彛锛氬鐓ц杽寮辩偣鍐冲畾鏄幓缁冩祴宸╁浐銆佸幓鍥捐氨寤跺睍锛岃繕鏄妸閲嶇偣鍙ュ姞鍏ヨ蹇嗛槦鍒椼€?
                    tone="success"
                    actions={[
                      { label: "鍥炲鎯呭鐩?, to: "/my-learning?tab=overview&from=create", variant: "primary" },
                      { label: "鍘荤粌娴嬪珐鍥?, to: "/practice?entry=practice&types=emotion,appreciation&count=6&difficulty=medium&auto=1&source=create" },
                      { label: "鍘诲浘璋卞欢灞?, to: "/graph?from=create" },
                    ]}
                  />
                </div>
              ) : null}

              <AnimatePresence>
                {errorMessage ? (
                  <motion.p
                    key={errorMessage}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="mt-3 rounded-xl bg-rose-100/80 px-3 py-2 font-sans text-xs text-rose-600"
                  >
                    {errorMessage}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              {resultCreation && resultFeedback ? (
                <div id="poster-area" className="mt-4 space-y-4 p-4 -m-4 rounded-3xl bg-[#fbfaf6]">
                  <SpotlightCard
                    className="rounded-2xl bg-stone-50/90 p-4 shadow-[0_4px_16px_rgba(26,43,76,0.03)]"
                    spotlightColor="rgba(201,169,110,0.12)"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-sans text-xs tracking-[0.14em] text-slate-400">璇楀彞缁撴灉</p>
                        <p className="mt-1 font-sans text-xs text-slate-500">
                          {resultCreation.mode === "transform" ? "鐧借瘽杞瘲" : resultCreation.mode === "refine" ? "娑﹁壊鐗堟湰" : "鐐硅瘎鐗堟湰"} 路
                          {" "}
                          {formatDateTime(resultCreation.created_at)}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/95 px-3 py-1 font-sans text-xs text-slate-500">骞冲潎 {average.toFixed(1)} / 10</span>
                    </div>
                    <div className="mt-3 rounded-2xl bg-white/95 p-4 shadow-[0_4px_12px_rgba(26,43,76,0.04)]">
                      <BlurText text={displayedRevisedText || "缁撴灉浼氭樉绀哄湪杩欓噷"} className="whitespace-pre-wrap font-serif text-2xl leading-10 text-[#1A2B4C]" />
                    </div>
                  </SpotlightCard>

                  <DiffViewer sourceText={displayedSourceText} revisedText={displayedRevisedText} />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {scoreRows.map((row) => (
                      <ScoreRingCard key={row.key} label={row.label} score={row.score} />
                    ))}
                  </div>

                  <SpotlightCard
                    className="rounded-2xl bg-stone-50/90 p-4 shadow-[0_4px_16px_rgba(26,43,76,0.03)]"
                    spotlightColor="rgba(26,43,76,0.08)"
                  >
                    <h3 className="font-serif text-xl text-[#1A2B4C]">鐐硅瘎鎽樿</h3>
                    <p className="mt-2 font-sans text-sm leading-7" style={{ color: 'var(--neutral)' }}>{resultFeedback.summary || "鏆傛棤鎽樿"}</p>
                  </SpotlightCard>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <InsightAccordion
                      title="浜偣鏍囩"
                      tag="浜偣"
                      items={resultFeedback.highlights || []}
                      expanded={expandedTags}
                      onToggle={toggleInsight}
                    />
                    <InsightAccordion
                      title="浼樺寲寤鸿"
                      tag="寤鸿"
                      items={resultFeedback.suggestions || []}
                      expanded={expandedTags}
                      onToggle={toggleInsight}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-stone-50/95 p-6 text-center shadow-[0_4px_14px_rgba(26,43,76,0.03)]">
                  <BookOpenText className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 font-serif text-2xl text-[#1A2B4C]">绛夊緟鐢熸垚鍐呭</p>
                  <p className="mt-2 font-sans text-sm leading-7 text-slate-500">杈撳叆璇楀彞鍚庣偣鍑讳笂鏂?CTA锛屽嵆鍙湅鍒拌瘎鍒嗐€丏iff 涓庡缓璁爣绛俱€?</p>
                </div>
              )}
            </SpotlightCard>
          </div>
          ) : null}
        </SpotlightCard>
      </PageStage>

      <PageStage tone="detail">
        <SpotlightCard
          className="rounded-3xl bg-white/95 p-4 shadow-[0_8px_28px_rgba(26,43,76,0.06)] sm:p-6"
          spotlightColor="rgba(201,169,110,0.12)"
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="font-sans text-xs tracking-[0.14em] text-slate-400">ARCHIVE</p>
              <h2 className="mt-1 font-serif text-3xl text-[#1A2B4C]">鍘嗗彶娑﹁壊</h2>
              <p className="mt-2 font-sans text-sm text-slate-500">鏀寔鍏抽敭璇嶆绱笌椋庢牸绛涢€夛紝鐐瑰嚮鍗冲彲鍥炲～鍒板伐浣滃尯銆?</p>
            </div>

            <div className="flex w-full max-w-[520px] items-center gap-2">
              <input
                value={historyKeywordInput}
                onChange={(event) => setHistoryKeywordInput(event.target.value)}
                placeholder="鎼滅储鍘嗗彶鍐呭鎴栧弬鑰冭瘲璇?
                className="w-full rounded-full bg-stone-100/92 px-4 py-2.5 font-sans text-sm text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setHistoryKeyword(historyKeywordInput.trim());
                }}
                className="rounded-full bg-stone-100 px-4 py-2.5 font-sans text-sm text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-stone-200"
              >
                鎼滅储
              </button>
            </div>
          </div>

          <div className="mt-4">
            <PillNav items={historyStyleItems} value={historyStyleFilter} onChange={setHistoryStyleFilter} />
          </div>

          {historyLoading && historyItems.length === 0 ? (
            <p className="mt-6 font-sans text-sm text-slate-500">鍘嗗彶鍔犺浇涓?..</p>
          ) : null}

          {historyError ? <p className="mt-6 rounded-xl bg-rose-100/80 px-3 py-2 font-sans text-xs text-rose-600">{historyError}</p> : null}

          {!historyLoading && historyItems.length === 0 ? (
            <HistoryEmptyState />
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {historyItems.map((item) => {
                const feedback = item.feedback_json;
                const active = item.id === selectedHistoryId;
                return (
                  <SpotlightCard
                    key={item.id}
                    className={[
                      "rounded-2xl bg-stone-50/95 p-4 shadow-[0_4px_16px_rgba(26,43,76,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(26,43,76,0.07)]",
                      active ? "bg-[linear-gradient(140deg,rgba(26,43,76,0.08),rgba(201,169,110,0.12))]" : "",
                    ].join(" ")}
                    spotlightColor="rgba(26,43,76,0.08)"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        pickHistoryItem(item);
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-sans text-[11px] tracking-[0.14em] text-slate-400">{item.mode || "review"}</p>
                          <h3 className="mt-1 font-serif text-2xl text-[#1A2B4C]">{item.style || "鏈懡鍚嶉鏍?}</h3>
                          <p className="mt-1 font-sans text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                        </div>
                        <span className="rounded-full bg-white/90 px-2.5 py-1 font-sans text-xs text-slate-500">
                          {meanScore(feedback?.scores).toFixed(1)} / 10
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap font-serif text-lg leading-8 text-slate-700">{item.content}</p>
                      <p className="mt-2 font-sans text-xs text-slate-500">鍙傝€冿細{item.reference_poem || "鏃?}</p>
                    </button>
                  </SpotlightCard>
                );
              })}
            </div>
          )}

          {historyMeta ? (
            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="font-sans text-xs text-slate-500">
                绗?{historyMeta.page} / {historyMeta.totalPages} 椤?路 鍏?{historyMeta.total} 鏉?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!historyMeta.hasPrev || historyLoading}
                  onClick={() => {
                    void loadHistory(Math.max(1, historyPage - 1));
                  }}
                  className="rounded-full bg-stone-100 px-3 py-1.5 font-sans text-xs text-slate-600 transition-all duration-300 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  涓婁竴椤?
                </button>
                <button
                  type="button"
                  disabled={!historyMeta.hasNext || historyLoading}
                  onClick={() => {
                    void loadHistory(historyPage + 1);
                  }}
                  className="rounded-full bg-stone-100 px-3 py-1.5 font-sans text-xs text-slate-600 transition-all duration-300 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  涓嬩竴椤?
                </button>
              </div>
            </div>
          ) : null}

          {showHistoryPanel && selectedHistory ? (
            <p className="mt-4 font-sans text-xs text-slate-500">褰撳墠閫変腑锛歿selectedHistory.style || "鏈懡鍚嶉鏍?} 路 {formatDateTime(selectedHistory.created_at)}</p>
          ) : null}
        </SpotlightCard>
      </PageStage>
      </>
      ) : (
        <PageStage tone="secondary">
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50">
            <p className="text-sm text-stone-500">鍒涗綔骞垮満鍔熻兘鍗冲皢涓婄嚎锛屾暚璇锋湡寰?</p>
          </div>
        </PageStage>
      )}
    </div>
  );
}

