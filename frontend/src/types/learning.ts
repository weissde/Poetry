export type LearningSectionState = "ready" | "partial" | "empty";
export type LearningFallbackTone = "neutral" | "caution";
export type LearningViewScope = "daily" | "weekly" | "monthly";

export interface LearningFallbackViewModel {
  title: string;
  description: string;
  tone: LearningFallbackTone;
}

export interface LearningHeroViewModel {
  title: string;
  subtitle: string;
  summary: string;
  badgeLabel: string;
  ringValue: number;
  ringLabel: string;
  streakDays: number;
  poemCount: number;
  accuracy30d: number;
  weakFocusLabel: string;
}

export interface LearningQuickStatViewModel {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "ink" | "gold" | "vermillion" | "emerald";
}

export interface LearningInsightDimensionViewModel {
  id: string;
  label: string;
  value: number;
  valueLabel: string;
  description: string;
  benchmarkValue: number | null;
  benchmarkLabel: string | null;
  attempts: number | null;
  source: "coverage" | "weakest" | "strongest";
}

export interface LearningInsightSnapshotViewModel {
  label: string;
  bucket: string;
  value: number;
  valueLabel: string;
  attempts: number | null;
}

export interface LearningInsightNarrativeSectionViewModel {
  id: string;
  title: string;
  detail: string;
  emphasis: "summary" | "action" | "fallback";
}

export interface LearningInsightRadarViewModel {
  state: LearningSectionState;
  items: LearningInsightDimensionViewModel[];
  fallback: LearningFallbackViewModel | null;
}

export interface LearningInsightNarrativeViewModel {
  state: LearningSectionState;
  headline: string;
  sections: LearningInsightNarrativeSectionViewModel[];
  fallback: LearningFallbackViewModel | null;
}

export interface LearningInsightGridViewModel {
  state: LearningSectionState;
  title: string;
  subtitle: string;
  radar: LearningInsightRadarViewModel;
  narrative: LearningInsightNarrativeViewModel;
  weakest: LearningInsightSnapshotViewModel | null;
  strongest: LearningInsightSnapshotViewModel | null;
  fallback: LearningFallbackViewModel | null;
}

export interface LearningTrendPointViewModel {
  id: string;
  label: string;
  value: number;
  valueLabel: string;
  emphasis: boolean;
}

export interface LearningTrendViewModel {
  state: LearningSectionState;
  days: number;
  points: LearningTrendPointViewModel[];
  averageValue: number;
  peakPointLabel: string | null;
  fallback: LearningFallbackViewModel | null;
}

export interface LearningHeatmapCellViewModel {
  date: string;
  count: number;
  intensity: number;
  label: string;
}

export interface LearningHeatmapViewModel {
  state: LearningSectionState;
  cells: LearningHeatmapCellViewModel[];
  fallback: LearningFallbackViewModel | null;
}

export interface LearningWeeklyTrackViewModel {
  scope: LearningViewScope;
  scopeLabel: string;
  state: LearningSectionState;
  title: string;
  subtitle: string;
  summaryLabel: string;
  heatmapTitle: string;
  heatmapSubtitle: string;
  trend: LearningTrendViewModel;
  heatmap: LearningHeatmapViewModel;
  fallback: LearningFallbackViewModel | null;
}

export interface LearningAiInsightViewModel {
  state: LearningSectionState;
  title: string;
  summaryTitle: string;
  summaryText: string;
  teacherAdviceTitle: string;
  teacherAdviceText: string;
  fallback: LearningFallbackViewModel | null;
}

export interface LearningViewModelMeta {
  source: "learning-summary-payload";
  version: "learning-overview-v1";
  scope: LearningViewScope;
  degradation: {
    missingClassBenchmark: boolean;
    missingHeatmapDates: boolean;
  };
}

export interface LearningViewModel {
  hero: LearningHeroViewModel;
  quickStats: LearningQuickStatViewModel[];
  insightGrid: LearningInsightGridViewModel;
  weeklyTrack: LearningWeeklyTrackViewModel;
  aiInsight: LearningAiInsightViewModel;
  meta: LearningViewModelMeta;
}

/**
 * Handbook contract types (T2)
 * Keep side-by-side with existing view-model types for compatibility.
 */
export type DimensionKey = "genre" | "dynasty" | "subject" | "imagery" | "memory";

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  genre: "题型",
  dynasty: "朝代",
  subject: "题材",
  imagery: "意象",
  memory: "记忆",
};

export type StatKey = "wrongbook" | "favorites" | "plan" | "memory";

export interface StatBlock {
  count: number;
  trend7d: number[];
  deltaPct: number | null;
}

export interface RecommendedAction {
  id: string;
  title: string;
  cta: string;
  to: string;
  icon: "BookOpen" | "Target" | "Sparkles" | "PenLine";
}

export interface LearningTrack {
  date: string;
  count: number;
  breakdown?: { practice?: number; memory?: number; chat?: number };
}

export interface LearningSummary {
  overallScore: number;
  aiInsight: string;
  weakDimension: DimensionKey;
  streakDays: number;
  dimensionScores: Record<DimensionKey, number>;
  classAvg?: Record<DimensionKey, number>;
  stats: Record<StatKey, StatBlock>;
  recommendedActions: RecommendedAction[];
  tracks: LearningTrack[];
}

export interface AiReportRequest {
  scope: "daily" | "weekly" | "monthly";
}
