import { useCallback, useEffect, useState } from "react";
import { getUserSummary } from "@/lib/api";
import type { UserSummaryPayload } from "@/types";

interface UseUserSummaryResult {
  data: UserSummaryPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useUserSummary(): UseUserSummaryResult {
  const [data, setData] = useState<UserSummaryPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const next = await getUserSummary(force);
      setData(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载学习摘要失败");
    } finally {
      setLoading(false);
    }
  }, []);

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
