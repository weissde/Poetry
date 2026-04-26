import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import html2canvas from "html2canvas";
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
import { useTeachingMode } from "@/contexts/TeachingModeContext";
import { createInquiryTaskCard, teacherHintItems } from "@/content/teachingStatic";
import { BlurText, Magnet, PillNav, SpotlightCard, type PillNavItem } from "@/components/react-bits";
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
  { id: "review", label: "创作点评", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "transform", label: "白话转诗", icon: <WandSparkles className="h-3.5 w-3.5" /> },
  { id: "history", label: "历史润色", icon: <History className="h-3.5 w-3.5" /> },
] as const;

const STYLE_OPTIONS = ["清雅", "豪放", "婉约", "边塞", "田园"] as const;

const SCORE_LABELS: Array<{ key: keyof CreationFeedback["scores"]; label: string }> = [
  { key: "imagery", label: "意象" },
  { key: "rhythm", label: "节奏" },
  { key: "wording", label: "炼字" },
];

const createTeachingObjective = {
  title: "创作迁移目标",
  summary: "把课堂理解转成作品输出：先点评、再润色、再导出展示，并回流到学情中心复盘。",
  goals: ["完成 1 次点评或白话转诗", "至少生成 1 个润色版本", "导出海报并回到学情复盘/安排巩固"],
  teacherHint: "课堂演示建议：先展示点评维度，再做一次润色对比，最后导出海报作为课堂输出成果。",
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
        {items.length === 0 ? <p className="font-sans text-xs text-slate-400">暂无内容</p> : null}
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
                  <span className="font-sans text-sm text-slate-700">点击查看细节</span>
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
      <p className="font-serif text-2xl text-[#1A2B4C]">还没有历史润色记录</p>
      <p className="max-w-md font-sans text-sm leading-7 text-slate-500">先完成一次点评或白话转诗，这里会自动生成你的创作轨迹与版本迭代。</p>
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
        <h3 className="font-serif text-xl text-[#1A2B4C]">润色差异</h3>
        <div className="flex items-center gap-2 font-sans text-[11px] text-slate-500">
          <span className="rounded-full bg-rose-100/90 px-2 py-1 text-rose-600">删除</span>
          <span className="rounded-full bg-emerald-100/90 px-2 py-1 text-emerald-700">新增</span>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words font-serif text-lg leading-9 text-slate-700">
        {parts.length === 0 ? "暂无可对比文本" : null}
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

export default function CreatePage(): JSX.Element {
  const { isTeacherMode } = useTeachingMode();
  const [searchParams] = useSearchParams();
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const modernRef = useRef<HTMLTextAreaElement | null>(null);

  const [workspaceTab, setWorkspaceTab] = useState<InquiryWorkspaceTab>("creation");
  const [queuedInquiryPrompt, setQueuedInquiryPrompt] = useState<{ nonce: number; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<CreateTab>("review");
  const [style, setStyle] = useState<(typeof STYLE_OPTIONS)[number]>("清雅");
  const [referencePoem, setReferencePoem] = useState<string>("春望");
  const [draftContent, setDraftContent] = useState<string>("山月照寒窗，风过竹影长。\n夜深人未寝，独坐听松凉。");
  const [modernText, setModernText] = useState<string>("放学路上看到傍晚云层很漂亮，突然想起家乡。想把这种情绪写成古风。");
  const [refineInstruction, setRefineInstruction] = useState<string>("在保留原意的前提下，让语言更凝练、节奏更稳定。");

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
    () => [{ id: "all", label: "全部" }, ...STYLE_OPTIONS.map((item) => ({ id: item, label: item }))],
    [],
  );

  const activeInputText = activeTab === "transform" ? modernText : draftContent;

  const textStats = useMemo(() => {
    const compact = (activeInputText || "").replace(/\s+/g, "");
    const rows = activeInputText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const lengths = rows.map((line) => line.replace(/[，。！？；、,.!?;:：\s]/g, "").length).filter((value) => value > 0);
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
        setHistoryError(error instanceof Error ? error.message : "加载历史记录失败，请稍后重试。");
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
    setStatusMessage("已载入历史润色版本，可继续打磨。");
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
      setErrorMessage("请先输入要点评的诗句。");
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
      setStatusMessage(data.source === "fallback_local" ? "点评完成（离线策略）" : "点评完成，可继续润色。");
      void loadHistory(1);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "点评失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }, [draftContent, loadHistory, referencePoem, style]);

  const handleTransform = useCallback(async (): Promise<void> => {
    const content = cleanText(modernText);
    if (!content) {
      setErrorMessage("请先输入白话文本。");
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
      setStatusMessage(data.source === "fallback_local" ? "转写完成（离线策略）" : "转写完成，可继续润色。");
      void loadHistory(1);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "转写失败，请稍后重试。");
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
      setErrorMessage("请先生成或选择一条作品后再润色。");
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
      setStatusMessage(data.source === "fallback_local" ? "润色完成（离线策略）" : "润色完成，已生成新版本。");
      void loadHistory(1);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "润色失败，请稍后重试。");
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
  const exportSucceeded = statusMessage.includes("海报已导出");

  const handleExportPoster = useCallback(async (): Promise<void> => {
    if (!canExportPoster || !resultFeedback) {
      setErrorMessage("请先生成结果后再导出海报。");
      return;
    }

    setIsExporting(true);
    setErrorMessage("");

    try {
      const element = document.getElementById("poster-area");
      if (!element) throw new Error("无法找到海报区域");
      const canvas = await html2canvas(element, { backgroundColor: "#fbfaf6" });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      if (!blob) throw new Error("导出画布失败");
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `诗境通_创作海报_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      
      setStatusMessage("海报已导出到本地。");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "导出失败，请稍后重试。");
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
    activeTab === "review" ? "立即点评" : activeTab === "transform" ? "生成古风" : historyLoading ? "刷新中..." : "刷新历史";

  const selectedHistory = useMemo(
    () => historyItems.find((item) => item.id === selectedHistoryId) || null,
    [historyItems, selectedHistoryId],
  );

  const showHistoryPanel = activeTab === "history";
  const inquiryCard = createInquiryTaskCard;
  const teacherHint = teacherHintItems.find((item) => item.page === "create") || null;
  const inquiryPoemTitle = searchParams.get("poemTitle") || "静夜思";
  const inquiryPoemAuthor = searchParams.get("poemAuthor") || "李白";
  const inquiryPoemContent =
    searchParams.get("poemContent") || "床前明月光，疑是地上霜。\n举头望明月，低头思故乡。";

  return (
    <div className="page-shell">
      <PageStage tone="primary">
        <TeachingStepBar currentIndex="03" />
        <PageHeader
          variant="standard"
          kicker="探究互动"
          title="将 AI 对话与创作迁移收拢到同一探究环节"
          subtitle="保留创作点评、白话转诗和历史润色的原有逻辑，并补齐探究任务、一键提问与完成引导。"
        />
        {isTeacherMode ? (
          <TeachingObjectiveCard
            variant="panel"
            kicker="教师目标提示"
            title={createTeachingObjective.title}
            summary={createTeachingObjective.summary}
            goals={createTeachingObjective.goals}
            chipLabel="当前阶段 · 创作迁移"
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
              <h1 className="mt-2 font-serif text-4xl text-[#1A2B4C] sm:text-5xl">创作坊 · 润色引擎</h1>
              <p className="mt-3 max-w-2xl font-sans text-sm leading-7" style={{ color: 'var(--neutral)' }}>
                让每次创作都形成可追踪的版本进化：先点评、再润色、再导出为海报，形成完整表达闭环。
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/80 px-3 py-1.5 font-sans text-xs text-slate-500">字数 {textStats.charCount}</span>
                <span className="rounded-full bg-white/80 px-3 py-1.5 font-sans text-xs text-slate-500">行数 {textStats.rowCount}</span>
                <span className="rounded-full bg-white/80 px-3 py-1.5 font-sans text-xs text-slate-500">格律齐整 {textStats.neatness}%</span>
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
              <p className="font-sans text-xs tracking-[0.14em] text-slate-500">今日焦点任务进度</p>
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
                  <p className="font-sans text-[11px] text-slate-500">完成度</p>
                </div>
              </div>
              <p className="mt-4 font-sans text-xs leading-6 text-slate-500">建议先完成创作输入，再进行一次点评与润色。</p>
            </div>
          </div>
        </SpotlightCard>

        <SectionCard
          title="创作与学情联动"
          subtitle="把本轮点评、润色与版本记录带回学情中心，和练测、错题放在同一视角复盘。"
          weight="support"
          density="dense"
        >
          <p className="text-sm leading-7" style={{ color: 'var(--neutral)' }}>
            完成一次有效的创作输出后，建议到「我的学情」查看总览与 AI 解读；后续若接入后端，可将创作指标纳入周报与班级看板。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/my-learning?tab=overview&from=create"
              className="btn-primary-compact justify-center"
            >
              查看学情中心
            </Link>
            <Link to="/my-learning?tab=plan" className="btn-secondary-compact justify-center">
              去看复习计划
            </Link>
          </div>
        </SectionCard>

        <NextStepRecommendations
          title="创作完成后做什么"
          subtitle="把作品从单次输出，接到练测、图谱与学情复盘链路中。"
          items={[
            {
              title: "回看学情总览",
              description: "把创作结果与本周练测、错题和记忆状态放到同一视图里复盘。",
              to: "/my-learning?tab=overview&from=create",
              ctaLabel: "查看学情",
              badge: "收束",
            },
            {
              title: "进入图谱找关联",
              description: "把你刚才使用的意象、情绪或主题放进知识图谱，扩展比较阅读素材。",
              to: "/graph?view=imagery",
              ctaLabel: "打开图谱",
              badge: "延展",
            },
            {
              title: "回到练测巩固表达",
              description: "趁创作后的表达敏感度还在，立刻做一轮赏析或情感题巩固迁移。",
              to: "/practice?entry=practice&topic=创作表达迁移&types=emotion,appreciation&count=6&difficulty=medium&auto=1&source=create",
              ctaLabel: "去练测",
              badge: "迁移",
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
              <h2 className="mt-1 font-serif text-3xl text-[#1A2B4C]">探究互动工作区</h2>
              <p className="mt-2 font-sans text-sm text-slate-500">先进行 AI 对话探究，再进入创作迁移，形成完整的互动闭环。</p>
            </div>
            <div className="flex flex-col gap-3 self-start">
              <div className="learn-filter-row">
                <button
                  type="button"
                  className={["learn-chip", workspaceTab === "dialogue" ? "learn-chip-active" : ""].join(" ")}
                  onClick={() => setWorkspaceTab("dialogue")}
                >
                  AI 对话探究
                </button>
                <button
                  type="button"
                  className={["learn-chip", workspaceTab === "creation" ? "learn-chip-active" : ""].join(" ")}
                  onClick={() => setWorkspaceTab("creation")}
                >
                  创作迁移
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
                    转入创作迁移
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
                  <h3 className="mt-1 font-serif text-2xl text-[#1A2B4C]">围绕示例诗词进行多轮探究</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    当前探究对象：{inquiryPoemTitle} · {inquiryPoemAuthor}
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
                <h3 className="font-serif text-2xl text-[#1A2B4C]">输入区</h3>
                <span className="rounded-full bg-white/90 px-3 py-1 font-sans text-xs text-slate-500">自动高度</span>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="font-sans text-xs tracking-[0.12em] text-slate-400">创作风格</p>
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
                  <p className="font-sans text-xs tracking-[0.12em] text-slate-400">参考诗词（可选）</p>
                  <input
                    value={referencePoem}
                    onChange={(event) => setReferencePoem(event.target.value)}
                    placeholder="如：春望"
                    className="mt-2 w-full rounded-2xl bg-white/92 px-4 py-3 font-sans text-sm text-slate-700 shadow-[inset_0_1px_2px_rgba(26,43,76,0.05)] outline-none transition-all duration-300 focus:bg-white"
                  />
                </div>

                {activeTab === "transform" ? (
                  <div>
                    <p className="font-sans text-xs tracking-[0.12em] text-slate-400">白话文本</p>
                    <textarea
                      ref={modernRef}
                      value={modernText}
                      onChange={(event) => setModernText(event.target.value)}
                      placeholder="输入想要转写的现代语句..."
                      className="mt-2 min-h-[190px] w-full resize-none rounded-2xl bg-white/92 px-4 py-3 font-sans text-sm leading-7 text-slate-700 shadow-[inset_0_1px_2px_rgba(26,43,76,0.05)] outline-none transition-all duration-300 focus:bg-white"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="font-sans text-xs tracking-[0.12em] text-slate-400">诗句草稿</p>
                    <textarea
                      ref={draftRef}
                      value={draftContent}
                      onChange={(event) => setDraftContent(event.target.value)}
                      placeholder="输入你要点评或润色的诗句..."
                      className="mt-2 min-h-[190px] w-full resize-none rounded-2xl bg-white/92 px-4 py-3 font-serif text-lg leading-9 text-slate-700 shadow-[inset_0_1px_2px_rgba(26,43,76,0.05)] outline-none transition-all duration-300 focus:bg-white"
                    />
                  </div>
                )}

                <div className="rounded-2xl bg-white/92 px-4 py-3 shadow-[0_4px_14px_rgba(26,43,76,0.04)]">
                  <p className="font-sans text-xs text-slate-500">
                    字数 {textStats.charCount} · 行数 {textStats.rowCount} · 句均字数 {textStats.averageLength} · 格律齐整 {textStats.neatness}%
                  </p>
                </div>

                <div className="rounded-2xl bg-white/92 p-3 shadow-[0_4px_14px_rgba(26,43,76,0.04)]">
                  <p className="font-sans text-xs tracking-[0.12em] text-slate-400">润色要求</p>
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
                <h3 className="font-serif text-2xl text-[#1A2B4C]">结果区</h3>
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
                    继续润色
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
                    导出海报
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
                    eyebrow="完成态 · 课堂输出"
                    title="海报已导出，可以进入复盘与巩固"
                    description="建议把本次创作成果带回学情中心做收口：对照薄弱点决定是去练测巩固、去图谱延展，还是把重点句加入记忆队列。"
                    tone="success"
                    actions={[
                      { label: "回学情复盘", to: "/my-learning?tab=overview&from=create", variant: "primary" },
                      { label: "去练测巩固", to: "/practice?entry=practice&types=emotion,appreciation&count=6&difficulty=medium&auto=1&source=create" },
                      { label: "去图谱延展", to: "/graph?from=create" },
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
                        <p className="font-sans text-xs tracking-[0.14em] text-slate-400">诗句结果</p>
                        <p className="mt-1 font-sans text-xs text-slate-500">
                          {resultCreation.mode === "transform" ? "白话转诗" : resultCreation.mode === "refine" ? "润色版本" : "点评版本"} ·
                          {" "}
                          {formatDateTime(resultCreation.created_at)}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/95 px-3 py-1 font-sans text-xs text-slate-500">平均 {average.toFixed(1)} / 10</span>
                    </div>
                    <div className="mt-3 rounded-2xl bg-white/95 p-4 shadow-[0_4px_12px_rgba(26,43,76,0.04)]">
                      <BlurText text={displayedRevisedText || "结果会显示在这里"} className="whitespace-pre-wrap font-serif text-2xl leading-10 text-[#1A2B4C]" />
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
                    <h3 className="font-serif text-xl text-[#1A2B4C]">点评摘要</h3>
                    <p className="mt-2 font-sans text-sm leading-7" style={{ color: 'var(--neutral)' }}>{resultFeedback.summary || "暂无摘要"}</p>
                  </SpotlightCard>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <InsightAccordion
                      title="亮点标签"
                      tag="亮点"
                      items={resultFeedback.highlights || []}
                      expanded={expandedTags}
                      onToggle={toggleInsight}
                    />
                    <InsightAccordion
                      title="优化建议"
                      tag="建议"
                      items={resultFeedback.suggestions || []}
                      expanded={expandedTags}
                      onToggle={toggleInsight}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-stone-50/95 p-6 text-center shadow-[0_4px_14px_rgba(26,43,76,0.03)]">
                  <BookOpenText className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 font-serif text-2xl text-[#1A2B4C]">等待生成内容</p>
                  <p className="mt-2 font-sans text-sm leading-7 text-slate-500">输入诗句后点击上方 CTA，即可看到评分、Diff 与建议标签。</p>
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
              <h2 className="mt-1 font-serif text-3xl text-[#1A2B4C]">历史润色</h2>
              <p className="mt-2 font-sans text-sm text-slate-500">支持关键词检索与风格筛选，点击即可回填到工作区。</p>
            </div>

            <div className="flex w-full max-w-[520px] items-center gap-2">
              <input
                value={historyKeywordInput}
                onChange={(event) => setHistoryKeywordInput(event.target.value)}
                placeholder="搜索历史内容或参考诗词"
                className="w-full rounded-full bg-stone-100/92 px-4 py-2.5 font-sans text-sm text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setHistoryKeyword(historyKeywordInput.trim());
                }}
                className="rounded-full bg-stone-100 px-4 py-2.5 font-sans text-sm text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-stone-200"
              >
                搜索
              </button>
            </div>
          </div>

          <div className="mt-4">
            <PillNav items={historyStyleItems} value={historyStyleFilter} onChange={setHistoryStyleFilter} />
          </div>

          {historyLoading && historyItems.length === 0 ? (
            <p className="mt-6 font-sans text-sm text-slate-500">历史加载中...</p>
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
                          <h3 className="mt-1 font-serif text-2xl text-[#1A2B4C]">{item.style || "未命名风格"}</h3>
                          <p className="mt-1 font-sans text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                        </div>
                        <span className="rounded-full bg-white/90 px-2.5 py-1 font-sans text-xs text-slate-500">
                          {meanScore(feedback?.scores).toFixed(1)} / 10
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap font-serif text-lg leading-8 text-slate-700">{item.content}</p>
                      <p className="mt-2 font-sans text-xs text-slate-500">参考：{item.reference_poem || "无"}</p>
                    </button>
                  </SpotlightCard>
                );
              })}
            </div>
          )}

          {historyMeta ? (
            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="font-sans text-xs text-slate-500">
                第 {historyMeta.page} / {historyMeta.totalPages} 页 · 共 {historyMeta.total} 条
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
                  上一页
                </button>
                <button
                  type="button"
                  disabled={!historyMeta.hasNext || historyLoading}
                  onClick={() => {
                    void loadHistory(historyPage + 1);
                  }}
                  className="rounded-full bg-stone-100 px-3 py-1.5 font-sans text-xs text-slate-600 transition-all duration-300 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  下一页
                </button>
              </div>
            </div>
          ) : null}

          {showHistoryPanel && selectedHistory ? (
            <p className="mt-4 font-sans text-xs text-slate-500">当前选中：{selectedHistory.style || "未命名风格"} · {formatDateTime(selectedHistory.created_at)}</p>
          ) : null}
        </SpotlightCard>
      </PageStage>
    </div>
  );
}
