import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useTeachingUnits } from "./useTeachingUnits";
import { mockTeacherSummary } from "@/mocks/classTriage";

export interface TeacherSummaryData {
  teacherName: string;
  weekOfTerm: number;
  weekTaughtCount: number;
  weekTargetCount: number;
  weekTaughtByDay: number[];
  pendingHomeworkCount: number;
  pendingHomeworkDelta?: number;
  pendingQuestionCount: number;
  avgMasteryPct: number;
  masteryDelta?: number;
}

function computeWeekOfTerm(): number {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  } catch {
    return 1;
  }
}

export function useTeacherSummary(): {
  data: TeacherSummaryData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const user = useAuthStore((s) => s.user);
  const { data: unitsPayload, loading: unitsLoading } = useTeachingUnits();
  const [data, setData] = useState<TeacherSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(unitsLoading);
  }, [unitsLoading]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      setData({
        ...mockTeacherSummary,
        teacherName:
          user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? mockTeacherSummary.teacherName,
        weekOfTerm: computeWeekOfTerm(),
      });
      setLoading(false);
      setError(null);
      return;
    }

    try {
      const units = unitsPayload?.items ?? [];
      const name =
        user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "教师";
      setData({
        teacherName: name,
        weekOfTerm: computeWeekOfTerm(),
        weekTaughtCount: units.length,
        weekTargetCount: Math.max(units.length, 20),
        weekTaughtByDay: [3, 5, 4, 0, 0],
        pendingHomeworkCount: 0,
        pendingQuestionCount: 0,
        avgMasteryPct: 0,
      });
      setError(null);
    } catch {
      setError("加载教师摘要失败");
    } finally {
      setLoading(false);
    }
  }, [user, unitsPayload]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    if (import.meta.env.DEV) {
      setData({
        ...mockTeacherSummary,
        teacherName:
          user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? mockTeacherSummary.teacherName,
        weekOfTerm: computeWeekOfTerm(),
      });
      setLoading(false);
    }
  }, [user]);

  return { data, loading, error, refresh };
}
