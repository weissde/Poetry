import {
  analysisSectionOrder,
  analysisSectionTitleMap,
  createEmptyAnalysisResult,
} from "@/types";
import type { AnalysisResult } from "@/types";

function isValidAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  return analysisSectionOrder.every((key) => {
    const section = (value as Record<string, unknown>)[key];
    if (!section || typeof section !== "object") {
      return false;
    }

    const title = (section as Record<string, unknown>).title;
    const content = (section as Record<string, unknown>).content;
    return typeof title === "string" && typeof content === "string";
  });
}

function extractFirstJsonObject(rawText: string): string | null {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return rawText.slice(start, end + 1);
}

function parseAnalysisFallback(rawText: string): AnalysisResult {
  const fallback = createEmptyAnalysisResult();
  const compact = rawText.trim();

  if (!compact) {
    return fallback;
  }

  const chunks = compact
    .split(/\n(?=\d+[.、]|[一二三四五六七]、|#{1,3}\s)/)
    .map((item) => item.trim())
    .filter(Boolean);

  analysisSectionOrder.forEach((key, index) => {
    const chunk = chunks[index] ?? "";
    fallback[key] = {
      title: analysisSectionTitleMap[key],
      content: chunk.replace(/^([#\d一二三四五六七\s.、]+)/, "").trim(),
    };
  });

  return fallback;
}

export function parseAnalysis(rawText: string): AnalysisResult {
  const jsonText = extractFirstJsonObject(rawText);
  if (!jsonText) {
    return parseAnalysisFallback(rawText);
  }

  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (isValidAnalysisResult(parsed)) {
      return parsed;
    }
  } catch {
    return parseAnalysisFallback(rawText);
  }

  return parseAnalysisFallback(rawText);
}
