import { useCallback, useEffect, useState } from "react";
import { mockTriageClasses } from "@/mocks/classTriage";
import { useAuthStore } from "@/stores/authStore";

export interface ClassTriageItem {
  id: string;
  name: string;
  studentCount: number;
  progress: number;
  risk: "red" | "yellow" | "green";
  stuckStage?: string;
  stuckCount?: number;
  actionableInsight: string;
  primaryActionLabel: string;
  primaryActionHref: string;
}

export interface UseClassTriageReturn {
  classes: ClassTriageItem[];
  topRiskClass: ClassTriageItem | null;
  nextLessonHint?: string;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function sortByRisk(classes: ClassTriageItem[]): ClassTriageItem[] {
  const rank = { red: 0, yellow: 1, green: 2 };
  return [...classes].sort((a, b) => {
    const diff = rank[a.risk] - rank[b.risk];
    if (diff !== 0) return diff;
    return (b.stuckCount ?? 0) - (a.stuckCount ?? 0);
  });
}

export function useClassTriage(): UseClassTriageReturn {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassTriageItem[]>([]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);

    if (import.meta.env.DEV) {
      setClasses(mockTriageClasses);
      setLoading(false);
      return;
    }

    // TODO: 后端实现后替换为真实 API 调用
    // GET /teaching/classes/triage
    setClasses([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [user, fetchData]);

  const sorted = sortByRisk(classes);
  const topRiskClass = sorted[0] ?? null;

  return {
    classes: sorted,
    topRiskClass,
    nextLessonHint: import.meta.env.DEV ? "三班 14:00 / 多媒体教室 2" : undefined,
    loading,
    error,
    refresh: fetchData,
  };
}
