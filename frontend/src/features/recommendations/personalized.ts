import type { NextStepRecommendationItem } from "@/components/common/NextStepRecommendations";
import type { PracticeDimension } from "@/stores/practiceStore";
import type { PersonalGraphInsightsPayload, PoemRecord, UserSummaryPayload, WeaknessMetric, WeaknessProfile } from "@/types";

const DEFAULT_PRACTICE_TOPICS = ["诗词练习", "词义理解", "手法分析", "意象探究"];

const QUESTION_TYPE_LABELS: Record<string, string> = {
  memorization: "默写",
  meaning: "词义理解",
  technique: "手法分析",
  emotion: "情感把握",
  appreciation: "综合赏析",
  comparison: "比较阅读",
  context: "语境默写",
};

const QUESTION_TYPE_TO_PRACTICE_TYPE: Record<string, PracticeDimension> = {
  memorization: "memorization",
  meaning: "meaning",
  technique: "technique",
  emotion: "emotion",
  appreciation: "appreciation",
  comparison: "comparison",
  context: "context",
};

type MetricEntry = {
  key: string;
  metric: WeaknessMetric;
};

function encode(value: string): string {
  return encodeURIComponent(value.trim());
}

function usableKey(value?: string | null): string | null {
  const key = String(value || "").trim();
  return key.length > 0 ? key : null;
}

function sortWeakEntries(record?: Record<string, WeaknessMetric>, minAttempts = 2): MetricEntry[] {
  const entries = Object.entries(record || {})
    .filter(([key, metric]) => usableKey(key) && metric.attempts >= minAttempts)
    .map(([key, metric]) => ({ key, metric }))
    .sort((a, b) => a.metric.rate - b.metric.rate || b.metric.attempts - a.metric.attempts);

  if (entries.length > 0 || minAttempts <= 0) {
    return entries;
  }
  return sortWeakEntries(record, 0);
}

function uniquePush(items: string[], value?: string | null): void {
  const key = usableKey(value);
  if (key && !items.includes(key)) {
    items.push(key);
  }
}

function buildPracticeLink(topic: string, questionType?: string | null): string {
  const params = new URLSearchParams({
    entry: "practice",
    topic,
    count: "8",
    difficulty: "medium",
    auto: "1",
    source: "weakness",
  });
  const practiceType = questionType ? QUESTION_TYPE_TO_PRACTICE_TYPE[questionType] : null;
  if (practiceType) {
    params.set("types", practiceType);
  }
  return `/practice?${params.toString()}`;
}

export function buildPersonalizedPracticeTopics(profile?: WeaknessProfile | null): string[] {
  const topics: string[] = [];
  sortWeakEntries(profile?.by_theme).slice(0, 4).forEach((entry) => uniquePush(topics, entry.key));
  sortWeakEntries(profile?.by_keyword_tag).slice(0, 2).forEach((entry) => uniquePush(topics, entry.key));
  sortWeakEntries(profile?.by_dynasty).slice(0, 1).forEach((entry) => uniquePush(topics, `${entry.key}诗词`));
  DEFAULT_PRACTICE_TOPICS.forEach((topic) => uniquePush(topics, topic));
  return topics.slice(0, 6);
}

export function getWeakestQuestionType(profile?: WeaknessProfile | null): MetricEntry | null {
  return sortWeakEntries(profile?.by_question_type)[0] || null;
}

export function buildHomeNextStepRecommendations(input: {
  weaknessProfile?: WeaknessProfile | null;
  insights?: PersonalGraphInsightsPayload | null;
  summary?: UserSummaryPayload | null;
  heroPoem?: PoemRecord | null;
}): NextStepRecommendationItem[] {
  const { weaknessProfile, insights, summary, heroPoem } = input;
  const weakQuestion = getWeakestQuestionType(weaknessProfile);
  const weakTheme = sortWeakEntries(weaknessProfile?.by_theme)[0]?.key || usableKey(insights?.focus?.theme?.key);
  const weakDynasty = sortWeakEntries(weaknessProfile?.by_dynasty)[0]?.key || usableKey(insights?.focus?.dynasty?.key);
  const focusQuestion = weakQuestion?.key || usableKey(insights?.focus?.questionType?.key) || summary?.weakDimension;
  const questionLabel = QUESTION_TYPE_LABELS[focusQuestion || ""] || focusQuestion || "综合理解";
  const practiceTopic = weakTheme || heroPoem?.title || weakDynasty || "诗词练习";
  const graphTopic = weakTheme || weakDynasty || heroPoem?.title || "";

  return [
    {
      title: `${questionLabel}专项练习`,
      description: weakQuestion
        ? `最近 ${weakQuestion.metric.attempts} 次相关作答正确率约 ${Math.round(weakQuestion.metric.rate * 100)}%，建议先用 8 题小练习校准。`
        : `从当前学习内容切入，先完成一轮 ${questionLabel} 练习，建立今天的练测基线。`,
      to: buildPracticeLink(practiceTopic, focusQuestion),
      ctaLabel: "去练习",
      badge: "弱项优先",
    },
    {
      title: graphTopic ? `查看「${graphTopic}」图谱` : "查看知识图谱",
      description: weakDynasty
        ? `把 ${weakDynasty} 相关诗人、题材和意象放到同一张图里，补足比较阅读的结构感。`
        : "把课堂诗词、题材和意象关系串起来，补足单首诗之外的结构理解。",
      to: graphTopic ? `/graph?topic=${encode(graphTopic)}&source=home` : "/graph",
      ctaLabel: "去图谱",
      badge: "理解加深",
    },
    {
      title: summary?.weeklyWrongCount && summary.weeklyWrongCount > 0 ? "收束本周错题" : "回到学情中心",
      description:
        summary?.weeklyWrongCount && summary.weeklyWrongCount > 0
          ? `本周新增 ${summary.weeklyWrongCount} 道错题，适合马上转入错题本和复习计划。`
          : "把练习、记忆和创作结果收拢到同一视角，确认下一轮学习重点。",
      to: summary?.weeklyWrongCount && summary.weeklyWrongCount > 0 ? "/my-learning?tab=wrongbook" : "/my-learning?tab=overview",
      ctaLabel: summary?.weeklyWrongCount && summary.weeklyWrongCount > 0 ? "看错题" : "看学情",
      badge: "闭环",
    },
  ];
}
