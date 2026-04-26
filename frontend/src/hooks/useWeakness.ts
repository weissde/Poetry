import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import type { WeaknessProfile } from "@/types";

const defaultProfile: WeaknessProfile = {
  by_question_type: {},
  by_dynasty: {},
  by_theme: {},
  weak_dimensions: [],
};

export function useWeakness(): {
  profile: WeaknessProfile;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [profile, setProfile] = useState<WeaknessProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ profile: WeaknessProfile }>("/weakness/profile");
      setProfile(data.profile || defaultProfile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载弱点画像失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return useMemo(
    () => ({ profile, isLoading, error, refresh }),
    [profile, isLoading, error],
  );
}
