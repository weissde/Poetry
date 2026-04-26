import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LearningContextState {
  // 当前学习上下文
  currentUnitId: string | null;
  currentUnitName: string | null;
  currentPoemId: string | null;
  currentPoemTitle: string | null;
  currentStage: 'explore' | 'lecture' | 'inquiry' | 'practice' | 'memory' | 'review' | 'create' | 'graph' | null;

  // 课堂 Session（教师模式）
  sessionId: string | null;
  sessionActive: boolean;

  // 教学流程进度
  completedStages: string[]; // poemId 已完成的阶段

  // Actions
  setCurrentPoem: (poemId: string, title: string) => void;
  setCurrentUnit: (unitId: string, name: string) => void;
  setCurrentStage: (stage: LearningContextState['currentStage']) => void;
  markStageComplete: (poemId: string, stage: string) => void;
  startSession: (sessionId: string) => void;
  endSession: () => void;
  reset: () => void;
}

export const useLearningContextStore = create<LearningContextState>()(
  persist(
    (set) => ({
      currentUnitId: null,
      currentUnitName: null,
      currentPoemId: null,
      currentPoemTitle: null,
      currentStage: null,
      sessionId: null,
      sessionActive: false,
      completedStages: [],

      setCurrentPoem: (poemId, title) =>
        set({ currentPoemId: poemId, currentPoemTitle: title }),

      setCurrentUnit: (unitId, name) =>
        set({ currentUnitId: unitId, currentUnitName: name }),

      setCurrentStage: (stage) =>
        set({ currentStage: stage }),

      markStageComplete: (poemId, stage) =>
        set((s) => ({
          completedStages: [...s.completedStages, `${poemId}:${stage}`],
        })),

      startSession: (sessionId) =>
        set({ sessionId, sessionActive: true }),

      endSession: () =>
        set({ sessionId: null, sessionActive: false }),

      reset: () =>
        set({
          currentUnitId: null,
          currentUnitName: null,
          currentPoemId: null,
          currentPoemTitle: null,
          currentStage: null,
          sessionId: null,
          sessionActive: false,
          completedStages: [],
        }),
    }),
    { name: 'learning-context' }
  )
);
