import { useCallback, useEffect, useRef, useState } from "react";
import { streamPost } from "@/lib/api";
import { parseAnalysis } from "@/lib/analysisParser";
import type { AnalysisDepth, AnalysisResult } from "@/types";

interface UseAnalysisParams {
  poemId?: string;
  poemTitle?: string;
  poemAuthor?: string;
  poemContent: string;
  depth?: AnalysisDepth;
}

type AnalysisSource = "ai" | "cache" | null;

interface UseAnalysisReturn {
  streamText: string;
  analysis: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  source: AnalysisSource;
  analyzePoem: (params: UseAnalysisParams) => Promise<void>;
  reset: () => void;
  stop: () => void;
}

export function useAnalysis(): UseAnalysisReturn {
  const [streamText, setStreamText] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<AnalysisSource>(null);

  const stopFlagRef = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    stopFlagRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setStreamText("");
    setAnalysis(null);
    setError(null);
    setSource(null);
    stopFlagRef.current = false;
  }, [stop]);

  const analyzePoem = useCallback(async ({ poemId, poemTitle, poemAuthor, poemContent, depth = "standard" }: UseAnalysisParams) => {
    const normalized = poemContent.trim();
    if (!normalized) {
      setError("请输入要解析的诗词内容");
      return;
    }

    stopFlagRef.current = false;
    setIsLoading(true);
    setError(null);
    setSource(null);
    setAnalysis(null);
    setStreamText("");

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const { text, source: streamSource } = await streamPost({
        path: "/ai/analyze/stream",
        body: {
          poemId,
          poemTitle,
          poemAuthor,
          poemContent: normalized,
          depth,
        },
        signal: controller.signal,
        onToken: (_token, cumulativeText, evtSource) => {
          if (stopFlagRef.current) {
            return;
          }
          setStreamText(cumulativeText);
          if (evtSource === "cache" || evtSource === "ai") {
            setSource(evtSource);
          }
        },
      });

      if (stopFlagRef.current) {
        return;
      }

      const parsed = parseAnalysis(text);
      setAnalysis(parsed);
      if (!streamSource) {
        setSource("ai");
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        setError(err instanceof Error ? err.message : "解析失败，请稍后重试");
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    streamText,
    analysis,
    isLoading,
    error,
    source,
    analyzePoem,
    reset,
    stop,
  };
}

