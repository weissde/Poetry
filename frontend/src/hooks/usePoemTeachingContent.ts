import { useCallback, useEffect, useState } from "react";
import { getPoemTeachingContent } from "@/lib/api";
import type { PoemTeachingContentPayload } from "@/types";

interface UsePoemTeachingContentResult {
  data: PoemTeachingContentPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePoemTeachingContent(poemId?: string | null): UsePoemTeachingContentResult {
  const [data, setData] = useState<PoemTeachingContentPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (force = false): Promise<void> => {
      const target = String(poemId || "").trim();
      if (!target) {
        setData(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const next = await getPoemTeachingContent(target, force);
        setData(next);
      } catch (err: unknown) {
        setData(null);
        setError(err instanceof Error ? err.message : "加载教学内容失败");
      } finally {
        setLoading(false);
      }
    },
    [poemId],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: async () => fetchData(true),
  };
}
