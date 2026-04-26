import { createContext, useMemo, type ReactNode } from "react";
import type { TeachingMode } from "@/content/teachingStatic";
import { updateUserRole } from "@/lib/api";
import { useTeachingStore } from "@/stores/teachingStore";

export interface TeachingModeContextValue {
  teachingMode: TeachingMode;
  isTeacherMode: boolean;
  currentStep: number;
  currentPoemId: string | null;
  currentSessionId: string | null;
  setTeachingMode: (mode: TeachingMode) => void;
  toggleTeachingMode: () => void;
  setCurrentStep: (step: number) => void;
  setCurrentPoemId: (poemId: string | null) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
}

export const TeachingModeContext = createContext<TeachingModeContextValue | null>(null);
const TEACHING_MODE_EVENT = "poetry_ai_teaching_mode_changed";

function emitTeachingModeChanged(mode: TeachingMode): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(TEACHING_MODE_EVENT, { detail: { mode } }));
}

function syncTeachingModeRole(mode: TeachingMode): void {
  if (typeof window === "undefined") {
    return;
  }
  const nextRole = mode === "teacher" ? "teacher" : "student";
  void updateUserRole(nextRole).catch(() => {
    // Keep local mode switching available even if role sync fails.
  });
}

export function TeachingModeProvider({ children }: { children: ReactNode }): JSX.Element {
  const teachingMode = useTeachingStore((state) => state.teachingMode);
  const currentStep = useTeachingStore((state) => state.currentStep);
  const currentPoemId = useTeachingStore((state) => state.currentPoemId);
  const currentSessionId = useTeachingStore((state) => state.currentSessionId);
  const setTeachingModeState = useTeachingStore((state) => state.setTeachingMode);
  const toggleTeachingModeState = useTeachingStore((state) => state.toggleTeachingMode);
  const setCurrentStep = useTeachingStore((state) => state.setCurrentStep);
  const setCurrentPoemId = useTeachingStore((state) => state.setCurrentPoemId);
  const setCurrentSessionId = useTeachingStore((state) => state.setCurrentSessionId);

  const setTeachingMode = (mode: TeachingMode): void => {
    setTeachingModeState(mode);
    emitTeachingModeChanged(mode);
    syncTeachingModeRole(mode);
  };

  const toggleTeachingMode = (): void => {
    const nextMode: TeachingMode = teachingMode === "teacher" ? "student" : "teacher";
    toggleTeachingModeState();
    emitTeachingModeChanged(nextMode);
    syncTeachingModeRole(nextMode);
  };

  const value = useMemo<TeachingModeContextValue>(
    () => ({
      teachingMode,
      isTeacherMode: teachingMode === "teacher",
      currentStep,
      currentPoemId,
      currentSessionId,
      setTeachingMode,
      toggleTeachingMode,
      setCurrentStep,
      setCurrentPoemId,
      setCurrentSessionId,
    }),
    [currentPoemId, currentSessionId, currentStep, setCurrentPoemId, setCurrentSessionId, setCurrentStep, teachingMode],
  );

  return <TeachingModeContext.Provider value={value}>{children}</TeachingModeContext.Provider>;
}
