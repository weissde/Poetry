import type { LearningSummary } from "@/types/learning";

export const MOCK_LEARNING_SUMMARY: LearningSummary = {
  overallScore: 78,
  aiInsight:
    "你近 7 天在「意象理解」上正确率偏低，建议今日优先做意象专项，再回错题本收束复盘。",
  weakDimension: "imagery",
  streakDays: 7,
  dimensionScores: {
    genre: 82,
    dynasty: 75,
    subject: 80,
    imagery: 62,
    memory: 88,
  },
  classAvg: {
    genre: 70,
    dynasty: 68,
    subject: 72,
    imagery: 71,
    memory: 75,
  },
  stats: {
    wrongbook: { count: 0, trend7d: [], deltaPct: null },
    favorites: { count: 0, trend7d: [], deltaPct: null },
    plan: { count: 0, trend7d: [], deltaPct: null },
    memory: { count: 1, trend7d: [0, 0, 0, 1, 0, 0, 0], deltaPct: 100 },
  },
  recommendedActions: [
    {
      id: "a1",
      title: "意象专项练习",
      cta: "开始",
      to: "/practice?focus=imagery",
      icon: "Target",
    },
    {
      id: "a2",
      title: "回到探索复盘",
      cta: "前往",
      to: "/explore",
      icon: "BookOpen",
    },
    {
      id: "a3",
      title: "AI 对话一轮",
      cta: "对话",
      to: "/my-learning?tab=overview&focus=imagery",
      icon: "Sparkles",
    },
  ],
  tracks: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.now() - (89 - i) * 86400000).toISOString().slice(0, 10),
    count: i % 11 === 0 ? 0 : Math.floor(Math.random() * 5),
  })),
};

