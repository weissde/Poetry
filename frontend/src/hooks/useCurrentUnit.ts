import { useMemo } from "react";
import { useTeachingUnits } from "./useTeachingUnits";

export interface CurrentUnitData {
  name: string;
  poemCount: number;
  targetMastery: number;
}

export function useCurrentUnit(): {
  data: CurrentUnitData | null;
  loading: boolean;
  error: string | null;
  setCurrentUnitById: (id: string) => void;
} {
  const { data: unitsPayload, loading, error: unitsError } = useTeachingUnits();

  const result = useMemo(() => {
    const units = unitsPayload?.items ?? [];
    if (units.length === 0) return null;

    const first = units[0];
    return {
      name: first.title,
      poemCount: first.poemIds?.length ?? 0,
      targetMastery: first.masteryTarget,
    };
  }, [unitsPayload]);

  return {
    data: result,
    loading,
    error: unitsError,
    setCurrentUnitById: () => {
      // TODO: 实现单元选择持久化
    },
  };
}
