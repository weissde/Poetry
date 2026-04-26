import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WrongQuestion {
  id: string;
  poemTitle: string;
  questionContent: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  timestamp: string;
}

interface WrongbookState {
  wrongQuestions: WrongQuestion[];
  addWrongQuestion: (question: WrongQuestion) => void;
  removeWrongQuestion: (id: string) => void;
  clearWrongQuestions: () => void;
}

export const useWrongbookStore = create<WrongbookState>()(
  persist(
    (set) => ({
      wrongQuestions: [],
      addWrongQuestion: (question) => {
        set((state) => {
          const exists = state.wrongQuestions.some(
            (item) =>
              item.questionContent === question.questionContent &&
              item.userAnswer === question.userAnswer &&
              item.correctAnswer === question.correctAnswer,
          );

          if (exists) {
            return state;
          }

          return {
            wrongQuestions: [question, ...state.wrongQuestions],
          };
        });
      },
      removeWrongQuestion: (id) => {
        set((state) => ({
          wrongQuestions: state.wrongQuestions.filter((item) => item.id !== id),
        }));
      },
      clearWrongQuestions: () => {
        set({ wrongQuestions: [] });
      },
    }),
    {
      name: "poetry-ai-wrongbook",
      partialize: (state) => ({ wrongQuestions: state.wrongQuestions }),
    },
  ),
);
