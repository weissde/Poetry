import { create } from "zustand";
import { apiPost } from "@/lib/api";

export type PracticeDimension =
  | "memorization"
  | "meaning"
  | "technique"
  | "emotion"
  | "appreciation"
  | "comparison"
  | "context";

export type PracticeDifficulty = "easy" | "medium" | "hard";

export interface PracticeGenerateOptions {
  count?: number;
  difficulty?: PracticeDifficulty;
  types?: PracticeDimension[];
}

export interface PracticeWrongbookPackOptions {
  count?: number;
  difficulty?: PracticeDifficulty;
  status?: "pending" | "retry" | "all";
  dynasty?: string;
  theme?: string;
  keywordTag?: string;
}

export interface PracticeQuestion {
  id?: string;
  type: PracticeDimension;
  content: string;
  options: string[];
  answer: number;
  explanation: string;
  dynasty?: string;
  theme?: string;
  keywordTags?: string[];
  questionSource?: string;
}

export interface PracticeStatItem {
  attempts: number;
  correct: number;
}

export interface PracticeStats {
  memorization: PracticeStatItem;
  meaning: PracticeStatItem;
  technique: PracticeStatItem;
  emotion: PracticeStatItem;
  appreciation: PracticeStatItem;
  comparison: PracticeStatItem;
  context: PracticeStatItem;
}

export interface AnswerRecord {
  questionIndex: number;
  selected: number;
  isCorrect: boolean;
}

interface PracticeStoreState {
  questions: PracticeQuestion[];
  currentIndex: number;
  isFinished: boolean;
  isGenerating: boolean;
  error: string | null;
  answers: AnswerRecord[];
  stats: PracticeStats;
  generateQuestions: (topic: string, options?: PracticeGenerateOptions) => Promise<void>;
  generateWrongbookSubjectivePack: (options?: PracticeWrongbookPackOptions) => Promise<void>;
  submitAnswer: (selected: number) => { isCorrect: boolean; correctAnswer: number } | null;
  reportAnswerResult: (payload: {
    questionType: string;
    isCorrect: boolean;
    dynasty?: string;
    theme?: string;
    keywordTags?: string[];
    questionSource?: string;
  }) => Promise<void>;
  nextQuestion: () => void;
  resetPractice: () => void;
}

function createInitialStats(): PracticeStats {
  return {
    memorization: { attempts: 0, correct: 0 },
    meaning: { attempts: 0, correct: 0 },
    technique: { attempts: 0, correct: 0 },
    emotion: { attempts: 0, correct: 0 },
    appreciation: { attempts: 0, correct: 0 },
    comparison: { attempts: 0, correct: 0 },
    context: { attempts: 0, correct: 0 },
  };
}

function sanitizeQuestion(raw: unknown): PracticeQuestion | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const id = item.id;
  const type = item.type;
  const content = item.content;
  const options = item.options;
  const answer = item.answer;
  const explanation = item.explanation;
  const dynasty = item.dynasty;
  const theme = item.theme;
  const keywordTags = item.keywordTags;
  const questionSource = item.questionSource ?? item.source;

  if (
    type !== "memorization" &&
    type !== "meaning" &&
    type !== "technique" &&
    type !== "emotion" &&
    type !== "appreciation" &&
    type !== "comparison" &&
    type !== "context"
  ) {
    return null;
  }

  if (typeof content !== "string" || !Array.isArray(options) || typeof explanation !== "string") {
    return null;
  }

  const normalizedOptions = options.filter((option): option is string => typeof option === "string");
  if (normalizedOptions.length !== 4) {
    return null;
  }

  if (typeof answer !== "number" || answer < 0 || answer > 3) {
    return null;
  }

  return {
    id: typeof id === "string" ? id : undefined,
    type,
    content,
    options: normalizedOptions,
    answer,
    explanation,
    dynasty: typeof dynasty === "string" ? dynasty : undefined,
    theme: typeof theme === "string" ? theme : undefined,
    keywordTags: Array.isArray(keywordTags) ? keywordTags.filter((entry): entry is string => typeof entry === "string") : [],
    questionSource: typeof questionSource === "string" ? questionSource : undefined,
  };
}

export const usePracticeStore = create<PracticeStoreState>((set, get) => ({
  questions: [],
  currentIndex: 0,
  isFinished: false,
  isGenerating: false,
  error: null,
  answers: [],
  stats: createInitialStats(),

  generateQuestions: async (topic: string, options?: PracticeGenerateOptions) => {
    const trimmed = topic.trim();
    const count = Math.min(20, Math.max(3, options?.count ?? 5));
    const difficulty = options?.difficulty ?? "medium";
    const types = options?.types?.length ? options.types : undefined;

    if (!trimmed) {
      set({ error: "请输入要练习的诗词或主题。" });
      return;
    }

    set({
      isGenerating: true,
      error: null,
      questions: [],
      currentIndex: 0,
      isFinished: false,
      answers: [],
      stats: createInitialStats(),
    });

    try {
      const data = await apiPost<{ questions: unknown[] }>("/practice/questions/generate", {
        topic: trimmed,
        count,
        difficulty,
        types,
      }, { timeoutMs: 30000 });

      const parsed = (data.questions || [])
        .map((item) => sanitizeQuestion(item))
        .filter((item): item is PracticeQuestion => item !== null)
        .slice(0, count);

      if (parsed.length === 0) {
        throw new Error("未生成有效题目，请重试。");
      }

      set({
        questions: parsed,
        currentIndex: 0,
        isFinished: false,
        answers: [],
        stats: createInitialStats(),
      });
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : "题目生成失败，请稍后重试。",
      });
    } finally {
      set({ isGenerating: false });
    }
  },

  generateWrongbookSubjectivePack: async (options?: PracticeWrongbookPackOptions) => {
    const count = Math.min(20, Math.max(3, options?.count ?? 8));
    const difficulty = options?.difficulty ?? "medium";

    set({
      isGenerating: true,
      error: null,
      questions: [],
      currentIndex: 0,
      isFinished: false,
      answers: [],
      stats: createInitialStats(),
    });

    try {
      const data = await apiPost<{ questions: unknown[] }>("/practice/wrongbook-subjective/generate", {
        count,
        difficulty,
        status: options?.status ?? "pending",
        dynasty: options?.dynasty || null,
        theme: options?.theme || null,
        keywordTag: options?.keywordTag || null,
      }, { timeoutMs: 30000 });

      const parsed = (data.questions || [])
        .map((item) => sanitizeQuestion(item))
        .filter((item): item is PracticeQuestion => item !== null)
        .slice(0, count);

      if (parsed.length === 0) {
        throw new Error("未生成有效题目，请稍后重试。");
      }

      set({
        questions: parsed,
        currentIndex: 0,
        isFinished: false,
        answers: [],
        stats: createInitialStats(),
      });
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : "专项练习题生成失败，请稍后重试。",
      });
    } finally {
      set({ isGenerating: false });
    }
  },

  submitAnswer: (selected: number) => {
    const state = get();
    const currentQuestion = state.questions[state.currentIndex];

    if (!currentQuestion || state.isFinished) {
      return null;
    }

    const isCorrect = selected === currentQuestion.answer;

    set((prev) => {
      const dimension = currentQuestion.type;
      const currentStat = prev.stats[dimension];

      return {
        answers: [
          ...prev.answers,
          {
            questionIndex: prev.currentIndex,
            selected,
            isCorrect,
          },
        ],
        stats: {
          ...prev.stats,
          [dimension]: {
            attempts: currentStat.attempts + 1,
            correct: currentStat.correct + (isCorrect ? 1 : 0),
          },
        },
      };
    });

    return { isCorrect, correctAnswer: currentQuestion.answer };
  },

  reportAnswerResult: async ({ questionType, isCorrect, dynasty, theme, keywordTags, questionSource }) => {
    try {
      await apiPost("/practice/answers", {
        questionType,
        isCorrect,
        dynasty,
        theme,
        keywordTags: keywordTags || [],
        questionSource: questionSource || null,
      });
    } catch {
      // keep UX smooth even if backend write fails
    }
  },

  nextQuestion: () => {
    const state = get();
    const nextIndex = state.currentIndex + 1;

    if (nextIndex >= state.questions.length) {
      set({ isFinished: true });
      return;
    }

    set({ currentIndex: nextIndex });
  },

  resetPractice: () => {
    set({
      questions: [],
      currentIndex: 0,
      isFinished: false,
      isGenerating: false,
      error: null,
      answers: [],
      stats: createInitialStats(),
    });
  },
}));
