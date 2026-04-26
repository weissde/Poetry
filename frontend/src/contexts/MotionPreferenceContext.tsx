import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TeachingMode } from "@/content/teachingStatic";

interface MotionPreferenceContextValue {
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  toggleReduceMotion: () => void;
}

const STORAGE_KEY = "poetry_ai_reduce_motion";
const TEACHING_MODE_STORAGE_KEY = "poetry_ai_teaching_mode";
const TEACHING_STATE_STORAGE_KEY = "poetry_ai_teaching_state";
const TEACHING_MODE_EVENT = "poetry_ai_teaching_mode_changed";

const MotionPreferenceContext = createContext<MotionPreferenceContextValue | null>(null);

interface TeachingStatePayload {
  state?: {
    teachingMode?: TeachingMode;
  };
}

interface TeachingModeChangedEventDetail {
  mode?: TeachingMode;
}

function resolveTeachingModeFromStorage(): TeachingMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const legacyMode = window.localStorage.getItem(TEACHING_MODE_STORAGE_KEY);
  if (legacyMode === "teacher" || legacyMode === "student") {
    return legacyMode;
  }

  const rawState = window.localStorage.getItem(TEACHING_STATE_STORAGE_KEY);
  if (!rawState) {
    return null;
  }

  try {
    const payload = JSON.parse(rawState) as TeachingStatePayload;
    const teachingMode = payload?.state?.teachingMode;
    return teachingMode === "teacher" || teachingMode === "student" ? teachingMode : null;
  } catch {
    return null;
  }
}

function systemReduceMotionPreferred(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function resolveInitialReduceMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "1") {
    return true;
  }
  if (stored === "0") {
    return false;
  }
  if (resolveTeachingModeFromStorage() === "teacher") {
    // Teacher mode defaults to cleaner motion for projection scenarios.
    return true;
  }
  return systemReduceMotionPreferred();
}

export function MotionPreferenceProvider({ children }: { children: ReactNode }): JSX.Element {
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => resolveInitialReduceMotion());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, reduceMotion ? "1" : "0");
    document.documentElement.setAttribute("data-reduce-motion", reduceMotion ? "true" : "false");
  }, [reduceMotion]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncWithTeachingMode = (mode: TeachingMode | null): void => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1" || stored === "0") {
        // User made an explicit motion choice, keep it.
        return;
      }
      setReduceMotionState(mode === "teacher" ? true : systemReduceMotionPreferred());
    };

    const onTeachingModeChanged = (event: Event): void => {
      const customEvent = event as CustomEvent<TeachingModeChangedEventDetail>;
      const nextMode = customEvent?.detail?.mode ?? resolveTeachingModeFromStorage();
      syncWithTeachingMode(nextMode);
    };

    window.addEventListener(TEACHING_MODE_EVENT, onTeachingModeChanged as EventListener);
    return () => {
      window.removeEventListener(TEACHING_MODE_EVENT, onTeachingModeChanged as EventListener);
    };
  }, []);

  const setReduceMotion = (value: boolean): void => {
    setReduceMotionState(Boolean(value));
  };

  const toggleReduceMotion = (): void => {
    setReduceMotionState((prev) => !prev);
  };

  const contextValue = useMemo<MotionPreferenceContextValue>(
    () => ({
      reduceMotion,
      setReduceMotion,
      toggleReduceMotion,
    }),
    [reduceMotion],
  );

  return <MotionPreferenceContext.Provider value={contextValue}>{children}</MotionPreferenceContext.Provider>;
}

export function useMotionPreference(): MotionPreferenceContextValue {
  const context = useContext(MotionPreferenceContext);
  if (!context) {
    throw new Error("useMotionPreference must be used within MotionPreferenceProvider");
  }
  return context;
}
