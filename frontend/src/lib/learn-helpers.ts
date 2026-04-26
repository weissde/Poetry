import type { PoetKey } from "@/lib/prompts";

export interface MemoryQuestion {
  id: string;
  masked: string;
  answer: string;
  fullLine: string;
  hint: string;
}

export function splitPoemLines(input: string): string[] {
  return String(input || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((line) => line.match(/[^，。！？；]+[，。！？；]?/g) || [])
    .map((line) => line.trim())
    .filter(Boolean);
}

export function extractStructuredLines(input: string, fallback: string[], limit = 4): string[] {
  const items = String(input || "")
    .split(/[\n。！？；]/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);
  return (items.length > 0 ? items : fallback).slice(0, limit);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}

export function normalizeAnswer(value: string): string {
  return String(value || "")
    .replace(/[\s，。！？；、,.!?;:]/g, "")
    .trim()
    .toLowerCase();
}

export function buildMemoryQuestions(content: string): MemoryQuestion[] {
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
        hint: `提示：共 ${holeLength} 字，首字是"${answer.charAt(0)}"`,
      };
    })
    .filter((item): item is MemoryQuestion => Boolean(item))
    .slice(0, 3);
}

export function inferPoetKey(author: string): PoetKey {
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
