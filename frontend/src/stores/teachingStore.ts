import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultTeachingMode, type TeachingMode } from "@/content/teachingStatic";

const MAX_TEACHING_STEP = 6;

function clampStep(step: number): number {
  const normalized = Number.isFinite(step) ? Math.trunc(step) : 0;
  if (normalized < 0) {
    return 0;
  }
  if (normalized > MAX_TEACHING_STEP) {
    return MAX_TEACHING_STEP;
  }
  return normalized;
}

function normalizePoemId(poemId: string | null): string | null {
  const text = String(poemId || "").trim();
  return text ? text : null;
}

function normalizeSessionId(sessionId: string | null): string | null {
  const text = String(sessionId || "").trim();
  return text ? text : null;
}

interface TeachingState {
  teachingMode: TeachingMode;
  currentStep: number;
  currentPoemId: string | null;
  currentSessionId: string | null;
  teacherControlPanelOpen: boolean;
  setTeachingMode: (mode: TeachingMode) => void;
  toggleTeachingMode: () => void;
  setCurrentStep: (step: number) => void;
  setCurrentPoemId: (poemId: string | null) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setTeacherControlPanelOpen: (open: boolean) => void;
  toggleTeacherControlPanel: () => void;
}

export const useTeachingStore = create<TeachingState>()(
  persist(
    (set, get) => ({
      teachingMode: defaultTeachingMode,
      currentStep: 0,
      currentPoemId: null,
      currentSessionId: null,
      teacherControlPanelOpen: false,
      setTeachingMode: (mode) =>
        set({
          teachingMode: mode,
          teacherControlPanelOpen: mode === "student" ? false : get().teacherControlPanelOpen,
        }),
      toggleTeachingMode: () => {
        const next = get().teachingMode === "teacher" ? "student" : "teacher";
        set({
          teachingMode: next,
          teacherControlPanelOpen: false,
        });
      },
      setCurrentStep: (step) => set({ currentStep: clampStep(step) }),
      setCurrentPoemId: (poemId) => set({ currentPoemId: normalizePoemId(poemId) }),
      setCurrentSessionId: (sessionId) => set({ currentSessionId: normalizeSessionId(sessionId) }),
      setTeacherControlPanelOpen: (open) => set({ teacherControlPanelOpen: open }),
      toggleTeacherControlPanel: () => set({ teacherControlPanelOpen: !get().teacherControlPanelOpen }),
    }),
    {
      name: "poetry_ai_teaching_state",
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        teachingMode: state.teachingMode,
        currentStep: state.currentStep,
        currentPoemId: state.currentPoemId,
        currentSessionId: state.currentSessionId,
        teacherControlPanelOpen: state.teacherControlPanelOpen,
      }),
    },
  ),
);
