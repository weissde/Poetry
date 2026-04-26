import { DOUBAO_MODEL, callDoubaoStream, parseDoubaoAnalysis } from "@/lib/doubao";
import type { AnalysisDepth } from "@/types";

export const CLAUDE_MODEL = DOUBAO_MODEL;

export interface ClaudeStreamRequest {
  poemTitle?: string;
  poemAuthor?: string;
  poemContent: string;
  depth?: AnalysisDepth;
  signal?: AbortSignal;
  onToken?: (token: string, cumulativeText: string) => void;
  onComplete?: (fullText: string) => void;
}

export const callClaudeStream = callDoubaoStream;
export const parseClaudeAnalysis = parseDoubaoAnalysis;
