import { useCallback, useEffect, useState } from "react";
import { getTeachingUnits } from "@/lib/api";
import type { TeachingUnitsPayload } from "@/types";

interface UseTeachingUnitsResult {
  data: TeachingUnitsPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTeachingUnits(): UseTeachingUnitsResult {
  const [data, setData] = useState<TeachingUnitsPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const next = await getTeachingUnits(force);
      setData(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载教学单元失败");
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
