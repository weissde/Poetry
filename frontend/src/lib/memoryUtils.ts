import type { MemoryReviewItem, MemoryAchievement } from "@/types";

export interface DrillPair {
  prompt: string;
  answer: string;
}

export interface BlankQuestion {
  masked: string;
  answer: string;
  fullLine: string;
  hint: string;
}

export interface HeatmapCell {
  dateKey: string;
  level: number;
  isToday: boolean;
  monthLabel: string;
}

export function toPercent(rate: number | undefined): number {
  if (typeof rate !== "number") {
    return 0;
  }
  return Math.round(rate * 100);
}

export function isDueToday(dueDate: string | undefined, today: string | undefined): boolean {
  if (!dueDate || !today) {
    return false;
  }
  return dueDate <= today;
}

export function buildPracticeLink(title: string): string {
  const params = new URLSearchParams();
  params.set("topic", title);
  params.set("count", "5");
  params.set("difficulty", "medium");
  params.set("auto", "1");
  return `/practice?${params.toString()}`;
}

export function normalizeCompareText(text: string): string {
  return text.replace(/[\s，。！？；：、“”‘’（）()《》【】,.!?;:'"\-]/g, "").trim().toLowerCase();
}

export function splitSegments(content: string): string[] {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "")
    .split(/[，。！？；]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function splitLinesWithPunctuation(content: string): string[] {
  const compact = content.replace(/\r\n/g, "\n").replace(/\n/g, "");
  const lines = compact.match(/[^，。！？；]+[，。！？；]?/g) || [];
  return lines.map((line) => line.trim()).filter(Boolean);
}

export function shuffleArray<T>(items: T[]): T[] {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

export function buildDrillPairs(content: string): DrillPair[] {
  const segments = splitSegments(content);
  const pairs: DrillPair[] = [];

  for (let i = 0; i + 1 < segments.length; i += 2) {
    pairs.push({ prompt: segments[i], answer: segments[i + 1] });
  }

  if (pairs.length === 0 && segments.length >= 2) {
    for (let i = 0; i + 1 < segments.length; i += 1) {
      pairs.push({ prompt: segments[i], answer: segments[i + 1] });
    }
  }

  return pairs;
}

export function buildBlankQuestions(content: string): BlankQuestion[] {
  const lines = shuffleArray(splitLinesWithPunctuation(content)).filter(
    (line) => normalizeCompareText(line).length >= 4,
  );

  return lines.slice(0, 4).map((line) => {
    const normalized = normalizeCompareText(line);
    const hideLen = normalized.length >= 10 ? 3 : 2;
    const maxStart = Math.max(0, normalized.length - hideLen);
    const start = Math.floor(Math.random() * (maxStart + 1));
    const answer = normalized.slice(start, start + hideLen);
    const masked = `${normalized.slice(0, start)}${"＿".repeat(hideLen)}${normalized.slice(start + hideLen)}`;
    const suffix = line.match(/[，。！？；]$/)?.[0] || "";

    return {
      masked: `${masked}${suffix}`,
      answer,
      fullLine: line,
      hint: `提示：共 ${hideLen} 个字，首字为「${answer.charAt(0)}」`,
    };
  });
}

export function lcsLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) {
    return 0;
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a.charAt(i - 1) === b.charAt(j - 1)) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function calcTextSimilarity(inputText: string, targetText: string): number {
  const a = normalizeCompareText(inputText);
  const b = normalizeCompareText(targetText);
  if (!a && !b) {
    return 1;
  }
  if (!a || !b) {
    return 0;
  }
  return lcsLength(a, b) / Math.max(a.length, b.length);
}

export function qualityByAccuracy(accuracy: number): number {
  if (accuracy >= 0.9) return 5;
  if (accuracy >= 0.75) return 4;
  if (accuracy >= 0.5) return 3;
  if (accuracy >= 0.25) return 2;
  return 1;
}

export function qualityWithHintPenalty(accuracy: number, hintUsedCount: number): number {
  const base = qualityByAccuracy(accuracy);
  if (hintUsedCount <= 0) {
    return base;
  }
  if (hintUsedCount <= 2) {
    return Math.max(1, base - 1);
  }
  return Math.max(1, base - 2);
}

export function achievementProgressPercent(item: MemoryAchievement): number {
  if (!item.target || item.target <= 0) {
    return item.unlocked ? 100 : 0;
  }
  return Math.max(0, Math.min(100, Math.round((item.progress / item.target) * 100)));
}

export function nextLineHintText(answer: string, hintLevel: number): string {
  const normalized = normalizeCompareText(answer);
  if (!normalized) {
    return "暂无提示。";
  }
  if (hintLevel <= 1) {
    return `提示：共 ${normalized.length} 个字，首字为「${normalized.charAt(0)}」。`;
  }
  if (hintLevel === 2) {
    return `提示：首字「${normalized.charAt(0)}」，末字「${normalized.charAt(normalized.length - 1)}」。`;
  }
  return `提示：完整答案「${answer}」。`;
}

export function blankHintText(question: BlankQuestion, hintLevel: number): string {
  if (hintLevel <= 1) {
    return question.hint;
  }
  if (hintLevel === 2) {
    return `提示：缺失文字末字为「${question.answer.charAt(question.answer.length - 1)}」。`;
  }
  return `提示：完整句为「${question.fullLine}」。`;
}

export function fullTextHintText(targetText: string, hintLevel: number): string {
  const lines = splitLinesWithPunctuation(targetText);
  if (lines.length === 0) {
    return "暂无提示。";
  }
  if (hintLevel <= 1) {
    return `提示1：首句为「${lines[0]}」`;
  }
  if (hintLevel === 2) {
    return `提示2：前两句为「${lines.slice(0, 2).join(" ")}」`;
  }
  return `提示3：全文参考「${targetText}」`;
}

export function readTextAloud(text: string, playbackRate = 0.95): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  const content = text.trim();
  if (!content) {
    return false;
  }
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = "zh-CN";
  utterance.rate = Math.max(0.75, Math.min(1.1, playbackRate));
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function scrollToSection(sectionId: string): void {
  if (typeof document === "undefined") {
    return;
  }
  const element = document.getElementById(sectionId);
  if (!element) {
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function formatDateKey(input: Date): string {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildHeatmapCells(today: string | undefined, reviewedToday: number, streakDays: number): HeatmapCell[] {
  const totalDays = 84;
  const parsedToday = today ? new Date(`${today}T00:00:00`) : new Date();
  const baseDate = Number.isNaN(parsedToday.getTime()) ? new Date() : parsedToday;
  const dateCells: HeatmapCell[] = [];
  const streakSpan = Math.max(0, Math.min(totalDays, streakDays));

  for (let index = 0; index < totalDays; index += 1) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() - (totalDays - 1 - index));
    const daysToToday = totalDays - 1 - index;
    const isToday = daysToToday === 0;
    const seed = (date.getFullYear() * 31 + (date.getMonth() + 1) * 13 + date.getDate() * 17) % 11;
    let level = seed <= 3 ? 0 : seed <= 5 ? 1 : seed <= 7 ? 2 : 3;

    if (daysToToday < streakSpan) {
      level = Math.max(level, daysToToday < reviewedToday + 1 ? 4 : 3);
    }

    if (isToday) {
      level = reviewedToday > 0 ? 4 : Math.max(level, 1);
    }

    dateCells.push({
      dateKey: formatDateKey(date),
      level: Math.max(0, Math.min(4, level)),
      isToday,
      monthLabel: `${date.getMonth() + 1}月`,
    });
  }

  return dateCells;
}

export function masteryPercent(item: MemoryReviewItem): number {
  const successPart = Math.max(0, Math.min(100, Math.round((item.successRate || 0) * 100)));
  const reviewPart = Math.max(0, Math.min(100, Math.round((item.reviewCount / 12) * 100)));
  const factorPart = Math.max(0, Math.min(100, Math.round(((item.easeFactor - 1.3) / 1.6) * 100)));
  return Math.max(0, Math.min(100, Math.round(successPart * 0.62 + reviewPart * 0.25 + factorPart * 0.13)));
}

export function masteryLabel(score: number): string {
  if (score >= 85) return "炉火纯青";
  if (score >= 70) return "渐入佳境";
  if (score >= 50) return "稳步推进";
  if (score >= 30) return "初有印象";
  return "待巩固";
}

export function masteryTone(score: number): string {
  if (score >= 80) return "bg-[linear-gradient(90deg,#C9A96E,#B68747)]";
  if (score >= 60) return "bg-[linear-gradient(90deg,#A9B5CC,#7289B2)]";
  if (score >= 35) return "bg-[linear-gradient(90deg,#C8D3E4,#9BAEC8)]";
  return "bg-[linear-gradient(90deg,#D5D5D1,#BDBDB7)]";
}
