import { useCallback, useEffect, useState } from "react";
import { getTodayTasks } from "@/lib/api";
import type { TodayTasksPayload } from "@/types";

interface UseTodayTasksResult {
  data: TodayTasksPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTodayTasks(): UseTodayTasksResult {
  const [data, setData] = useState<TodayTasksPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const next = await getTodayTasks(force);
      setData(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载今日任务失败");
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
