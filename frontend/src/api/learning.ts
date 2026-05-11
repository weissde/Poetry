import { getUserLearningSummary, streamPost } from "@/lib/api";
import type {
  LearningSummaryPayload,
  LearningCoverageItem,
  LearningDailyTrackPoint,
  LearningDimensionScoreItem,
  LearningRateDimension,
  LearningTrendPoint,
} from "@/types/backend";
import type {
  AiReportRequest,
  DimensionKey,
  LearningAiInsightViewModel,
  LearningFallbackViewModel,
  LearningHeatmapCellViewModel,
  LearningHeroViewModel,
  LearningInsightDimensionViewModel,
  LearningInsightGridViewModel,
  LearningInsightNarrativeSectionViewModel,
  LearningInsightSnapshotViewModel,
  LearningQuickStatViewModel,
  LearningSectionState,
  LearningSummary,
  LearningTrendPointViewModel,
  LearningViewModel,
  LearningViewScope,
  LearningWeeklyTrackViewModel,
  LearningTrack,
  RecommendedAction,
  StatBlock,
} from "@/types/learning";

const DEFAULT_NARRATIVE = "学情数据已同步完成，新的总览组件会先基于当前摘要展示个人学习节奏。";
const DEFAULT_WEAK_FOCUS = "待形成稳定薄弱项画像";
const DEFAULT_SCOPE: LearningViewScope = "weekly";

function clampPercent(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function toCount(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.round(numeric));
}

function toSlug(label: string, index: number): string {
  const normalized = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `item-${index + 1}`;
}

function createFallback(title: string, description: string, tone: LearningFallbackViewModel["tone"] = "neutral"): LearningFallbackViewModel {
  return { title, description, tone };
}

function getHeroTitle(accuracy: number, streakDays: number): string {
  if (accuracy >= 85 && streakDays >= 7) {
    return "学习节奏稳定成形";
  }
  if (accuracy >= 70) {
    return "掌握度正在持续抬升";
  }
  if (streakDays >= 3) {
    return "学习习惯已经重新接上";
  }
  return "今天适合把节奏重新拉回正轨";
}

function getHeroBadge(streakDays: number, weeklyPracticeCount: number): string {
  if (streakDays >= 14) {
    return "连续打卡中";
  }
  if (weeklyPracticeCount >= 5) {
    return "本周训练活跃";
  }
  if (streakDays > 0) {
    return "学习节奏恢复中";
  }
  return "建议先从一轮短练开始";
}

function formatRateLabel(rate: number): string {
  return `${clampPercent(rate)}%`;
}

function toSnapshot(dimension?: LearningRateDimension | null): LearningInsightSnapshotViewModel | null {
  if (!dimension?.label) {
    return null;
  }
  const rate = clampPercent(dimension.rate);
  return {
    label: dimension.label,
    bucket: String(dimension.bucket || "").trim(),
    value: rate,
    valueLabel: `${rate}%`,
    attempts: Number.isFinite(Number(dimension.attempts)) ? Math.max(0, Number(dimension.attempts)) : null,
  };
}

function buildHero(payload: LearningSummaryPayload, accuracy: number, weakFocusLabel: string, narrative: string): LearningHeroViewModel {
  const overview = payload.overview;
  const streakDays = toCount(overview?.streakDays);
  const poemCount = toCount(overview?.poemCount);
  const weeklyPracticeCount = toCount(overview?.weeklyPracticeCount);

  return {
    title: getHeroTitle(accuracy, streakDays),
    subtitle: `已连续学习 ${streakDays} 天，累计接触 ${poemCount} 首诗词内容。`,
    summary: narrative,
    badgeLabel: getHeroBadge(streakDays, weeklyPracticeCount),
    ringValue: accuracy,
    ringLabel: `${accuracy}%`,
    streakDays,
    poemCount,
    accuracy30d: accuracy,
    weakFocusLabel,
  };
}

function buildQuickStats(payload: LearningSummaryPayload, accuracy: number, weakFocusLabel: string): LearningQuickStatViewModel[] {
  const overview = payload.overview;
  const weeklyWrongCount = toCount(overview?.weeklyWrongCount);
  const dueMemoryCount = toCount(overview?.dueMemoryCount);
  const weeklyPracticeCount = toCount(overview?.weeklyPracticeCount);
  const metrics = Array.isArray(payload.metrics) ? payload.metrics : [];

  return [
    {
      id: "streak-days",
      label: "连续学习",
      value: `${toCount(overview?.streakDays)} 天`,
      detail: "优先保住日常连续性，比一次性做很长训练更重要。",
      tone: "ink",
    },
    {
      id: "accuracy-30d",
      label: "近 30 天掌握率",
      value: `${accuracy}%`,
      detail: metrics[0]?.detail || "综合正确率会直接影响 Hero 环形进度与趋势判断。",
      tone: "gold",
    },
    {
      id: "weekly-practice",
      label: "本周练测次数",
      value: `${weeklyPracticeCount} 次`,
      detail: metrics[1]?.detail || "用于判断当前训练覆盖面是否足够支撑专项诊断。",
      tone: "emerald",
    },
    {
      id: "review-pressure",
      label: "待处理压力",
      value: `${weeklyWrongCount + dueMemoryCount}`,
      detail: weakFocusLabel === DEFAULT_WEAK_FOCUS
        ? `待复习错题 ${weeklyWrongCount} 道，待记忆复习 ${dueMemoryCount} 首。`
        : `先围绕 ${weakFocusLabel} 清理错题 ${weeklyWrongCount} 道，并完成记忆复习 ${dueMemoryCount} 首。`,
      tone: "vermillion",
    },
  ];
}

function toInsightDimension(item: LearningCoverageItem, index: number): LearningInsightDimensionViewModel {
  const value = clampPercent(item.mastery);
  return {
    id: toSlug(item.label, index),
    label: item.label,
    value,
    valueLabel: `${value}%`,
    description: item.description || "当前接口未提供更细解释，将先展示掌握度概览。",
    benchmarkValue: null,
    benchmarkLabel: null,
    attempts: null,
    source: "coverage",
  };
}

function toDimensionScore(item: LearningDimensionScoreItem, index: number): LearningInsightDimensionViewModel {
  const value = clampPercent(item.mastery);
  const benchmarkValue =
    item.classAvg === null || item.classAvg === undefined ? null : clampPercent(item.classAvg);
  return {
    id: toSlug(`${item.bucket || item.label}-${item.label}`, index),
    label: item.label,
    value,
    valueLabel: `${value}%`,
    description: item.description || "当前接口未提供更细解释，将先展示掌握度概览。",
    benchmarkValue,
    benchmarkLabel: benchmarkValue === null ? null : `${benchmarkValue}%`,
    attempts: null,
    source: "coverage",
  };
}

function toRateDimension(dimension: LearningRateDimension, index: number, source: "weakest" | "strongest"): LearningInsightDimensionViewModel {
  const value = clampPercent(dimension.rate);
  const bucket = String(dimension.bucket || "").trim();
  return {
    id: toSlug(`${bucket}-${dimension.label}`, index),
    label: dimension.label,
    value,
    valueLabel: `${value}%`,
    description: bucket ? `${bucket} 维度当前正确率 ${value}%。` : `当前正确率 ${value}%。`,
    benchmarkValue: null,
    benchmarkLabel: null,
    attempts: Number.isFinite(Number(dimension.attempts)) ? Math.max(0, Number(dimension.attempts)) : null,
    source,
  };
}

function buildNarrativeSections(payload: LearningSummaryPayload, narrative: string): LearningInsightNarrativeSectionViewModel[] {
  const sections: LearningInsightNarrativeSectionViewModel[] = [];
  const summaryText = String(payload.reportSeed?.summaryText || "").trim();
  const teacherAdviceText = String(payload.reportSeed?.teacherAdviceText || "").trim();

  if (summaryText) {
    sections.push({
      id: "summary-seed",
      title: String(payload.reportSeed?.summaryTitle || "AI 学情解读"),
      detail: summaryText,
      emphasis: "summary",
    });
  }

  if (teacherAdviceText) {
    sections.push({
      id: "teacher-advice",
      title: String(payload.reportSeed?.teacherAdviceTitle || "教师 / 家长建议"),
      detail: teacherAdviceText,
      emphasis: "action",
    });
  }

  if (narrative && !sections.some((item) => item.detail === narrative)) {
    sections.push({
      id: "aggregated-narrative",
      title: "聚合摘要",
      detail: narrative,
      emphasis: "fallback",
    });
  }

  return sections;
}

function buildInsightGrid(payload: LearningSummaryPayload, narrative: string): LearningInsightGridViewModel {
  const coverageItems = Array.isArray(payload.coverage) ? payload.coverage.filter((item) => item && item.label) : [];
  const dimensionScoreItems = Array.isArray(payload.dimensionScores)
    ? payload.dimensionScores.filter((item) => item && item.label)
    : [];
  const weakest = payload.weakest ?? null;
  const strongest = payload.strongest ?? null;
  const radarItems = (dimensionScoreItems.length > 0 ? dimensionScoreItems.map(toDimensionScore) : coverageItems.map(toInsightDimension));
  const hasBenchmark = radarItems.some((item) => item.benchmarkValue !== null);

  if (radarItems.length === 0 && weakest?.label) {
    radarItems.push(toRateDimension(weakest, 0, "weakest"));
  }
  if (radarItems.length < 2 && strongest?.label) {
    radarItems.push(toRateDimension(strongest, radarItems.length, "strongest"));
  }

  const narrativeSections = buildNarrativeSections(payload, narrative);
  const radarState: LearningSectionState = radarItems.length >= 3 ? "ready" : radarItems.length > 0 ? "partial" : "empty";
  const narrativeState: LearningSectionState =
    narrativeSections.length >= 2 ? "ready" : narrativeSections.length > 0 ? "partial" : "empty";

  return {
    state: radarState === "empty" && narrativeState === "empty" ? "empty" : radarState === "ready" || narrativeState === "ready" ? "ready" : "partial",
    title: "学习洞察",
    subtitle: "左侧用于维度掌握观察，右侧承接 AI / 聚合文本，字段缺失时走降级说明。",
    radar: {
      state: radarState,
      items: radarItems,
      fallback:
        radarState === "empty"
          ? createFallback("暂时没有维度画像", "当前摘要里没有 coverage 或 rate 字段，InsightGrid 应改为展示空状态卡。")
          : hasBenchmark
            ? null
            : createFallback("暂未接入班级对比", "当前仅有个人维度掌握度，没有 classAvg；InsightGrid 应隐藏对比层，只展示个人曲线。"),
    },
    narrative: {
      state: narrativeState,
      headline: narrative,
      sections: narrativeSections,
      fallback:
        narrativeState === "empty"
          ? createFallback("暂无可读摘要", "如果 narrative 与 reportSeed 都为空，右栏应展示空状态，并保留重试 AI 解读入口。")
          : null,
    },
    weakest: toSnapshot(weakest),
    strongest: toSnapshot(strongest),
    fallback:
      radarState === "empty" && narrativeState === "empty"
        ? createFallback("学习洞察待生成", "当前摘要无法支撑 InsightGrid，组件应回退到提示卡与刷新动作。")
        : null,
  };
}

function toTrendPoint(point: LearningTrendPoint, index: number, peakValue: number): LearningTrendPointViewModel {
  const value = clampPercent(point.value);
  return {
    id: toSlug(point.label, index),
    label: point.label,
    value,
    valueLabel: `${value}%`,
    emphasis: value === peakValue,
  };
}

function toHeatmapCell(point: LearningDailyTrackPoint) {
  const count = toCount(point.count);
  const intensity = count <= 0 ? 0 : count >= 4 ? 4 : count;
  return {
    date: point.date,
    count,
    intensity,
    label:
      point.accuracy === null || point.accuracy === undefined
        ? `${point.date} 完成 ${count} 次练测`
        : `${point.date} 完成 ${count} 次练测，正确率 ${clampPercent(point.accuracy)}%`,
  };
}

function sortHeatmapCells(cells: LearningHeatmapCellViewModel[]): LearningHeatmapCellViewModel[] {
  return [...cells].sort((left, right) => left.date.localeCompare(right.date));
}

function takeRecentHeatmapCells(cells: LearningHeatmapCellViewModel[], maxCount: number): LearningHeatmapCellViewModel[] {
  const sorted = sortHeatmapCells(cells);
  return sorted.slice(Math.max(0, sorted.length - maxCount));
}

function formatShortDateLabel(dateText: string): string {
  const normalized = String(dateText || "").trim();
  if (!normalized) {
    return "当日";
  }
  return normalized.slice(5).replace("-", "/");
}

function formatMonthLabel(dateText: string): string {
  const normalized = String(dateText || "").trim();
  if (!normalized) {
    return "当月";
  }
  const [year, month] = normalized.split("-");
  if (!year || !month) {
    return normalized;
  }
  return `${Number(month)}月`;
}

function buildWeeklyScopeTrack(payload: LearningSummaryPayload, heatmapCells: LearningHeatmapCellViewModel[]): LearningWeeklyTrackViewModel {
  const trendItems = Array.isArray(payload.trend?.items) ? payload.trend.items.filter((item) => item && item.label) : [];
  const days = toCount(payload.trend?.days) || 28;
  const rawValues = trendItems.map((item) => clampPercent(item.value));
  const peakValue = rawValues.length > 0 ? Math.max(...rawValues) : 0;
  const averageValue = rawValues.length > 0 ? Math.round(rawValues.reduce((sum, value) => sum + value, 0) / rawValues.length) : 0;
  const points = trendItems.map((item, index) => toTrendPoint(item, index, peakValue));
  const trendState: LearningSectionState = points.length >= 4 ? "ready" : points.length > 0 ? "partial" : "empty";
  const peakPoint = points.find((item) => item.emphasis) ?? null;
  const weeklyHeatmapCells = takeRecentHeatmapCells(heatmapCells, 90);

  return {
    scope: "weekly",
    scopeLabel: "周视图",
    state: trendState,
    title: "Weekly Track",
    subtitle: "聚合查看近 4 周掌握率变化，并保留近 90 天活跃热力图作为背景节奏。",
    summaryLabel:
      points.length > 0
        ? `近 ${days} 天峰值 ${peakPoint?.valueLabel || `${peakValue}%`}，平均 ${averageValue}%。`
        : `近 ${days} 天尚未形成可用趋势。`,
    heatmapTitle: "近 90 天学习热力图",
    heatmapSubtitle: "保留较长观察窗口，帮助识别学习节奏的密集期与空窗期。",
    trend: {
      state: trendState,
      days,
      points,
      averageValue,
      peakPointLabel: peakPoint ? `${peakPoint.label} ${peakPoint.valueLabel}` : null,
      fallback:
        trendState === "empty"
          ? createFallback("暂无周趋势", "当前接口没有返回 trend.items，WeeklyTrack 应展示空状态而不是空图表。")
          : null,
    },
    heatmap: {
      state: weeklyHeatmapCells.length > 0 ? "ready" : "empty",
      cells: weeklyHeatmapCells,
      fallback:
        weeklyHeatmapCells.length > 0
          ? null
          : createFallback(
              "暂未生成每日热力图",
              "当前接口只返回 4 个周桶趋势，没有按日日期与计数；WeeklyTrack 热力图区应展示降级说明。",
            ),
    },
    fallback:
      trendState === "empty"
        ? createFallback("学习轨迹待生成", "如果周趋势也缺失，WeeklyTrack 整块应降级为空状态组件。")
        : null,
  };
}

function buildDailyScopeTrack(heatmapCells: LearningHeatmapCellViewModel[]): LearningWeeklyTrackViewModel {
  const recentCells = takeRecentHeatmapCells(heatmapCells, 7);
  const points = recentCells.map((cell, index) => ({
    id: `daily-${cell.date}-${index}`,
    label: formatShortDateLabel(cell.date),
    value: cell.count,
    valueLabel: `${cell.count}次`,
    emphasis: false,
  }));
  const peakValue = points.length > 0 ? Math.max(...points.map((item) => item.value)) : 0;
  const emphasizedPoints = points.map((item) => ({ ...item, emphasis: item.value === peakValue && peakValue > 0 }));
  const totalCount = recentCells.reduce((sum, cell) => sum + cell.count, 0);
  const averageCount = recentCells.length > 0 ? Math.round(totalCount / recentCells.length) : 0;
  const trendState: LearningSectionState =
    emphasizedPoints.length >= 4 ? "ready" : emphasizedPoints.length > 0 ? "partial" : "empty";
  const peakPoint = emphasizedPoints.find((item) => item.emphasis) ?? null;
  const dailyHeatmapCells = takeRecentHeatmapCells(heatmapCells, 30);

  return {
    scope: "daily",
    scopeLabel: "日视图",
    state: trendState,
    title: "Daily Track",
    subtitle: "按日查看最近 7 天练测活跃度，配合今日 AI 解读判断当前节奏是否连续。",
    summaryLabel:
      emphasizedPoints.length > 0
        ? `近 7 天累计完成 ${totalCount} 次练测，单日均值 ${averageCount} 次。`
        : "近 7 天尚未记录到练测活跃度。",
    heatmapTitle: "近 30 天学习热力图",
    heatmapSubtitle: "缩短观察窗口，更适合盯住最近一轮是否断档。",
    trend: {
      state: trendState,
      days: 7,
      points: emphasizedPoints,
      averageValue: averageCount,
      peakPointLabel: peakPoint ? `${peakPoint.label} ${peakPoint.valueLabel}` : null,
      fallback:
        trendState === "empty"
          ? createFallback("暂无日活跃走势", "当前接口没有返回任何 daily tracks，日视图应展示空状态而不是空图表。")
          : null,
    },
    heatmap: {
      state: dailyHeatmapCells.length > 0 ? "ready" : "empty",
      cells: dailyHeatmapCells,
      fallback:
        dailyHeatmapCells.length > 0
          ? null
          : createFallback("暂未生成近 30 天热力图", "如果没有 daily tracks，日视图热力图区域应展示降级说明。"),
    },
    fallback:
      trendState === "empty"
        ? createFallback("日视图待生成", "当前没有可用的按日活跃度数据，Daily Track 应整体降级为空状态。")
        : null,
  };
}

function buildMonthlyScopeTrack(heatmapCells: LearningHeatmapCellViewModel[]): LearningWeeklyTrackViewModel {
  const monthMap = new Map<string, { count: number; weightedAccuracy: number; accuracyWeight: number }>();
  for (const cell of heatmapCells) {
    const monthKey = cell.date.slice(0, 7);
    const bucket = monthMap.get(monthKey) || { count: 0, weightedAccuracy: 0, accuracyWeight: 0 };
    bucket.count += cell.count;
    const accuracyMatch = cell.label.match(/正确率\s+(\d+)%/);
    if (accuracyMatch) {
      const accuracy = clampPercent(Number(accuracyMatch[1]));
      bucket.weightedAccuracy += accuracy * cell.count;
      bucket.accuracyWeight += cell.count;
    }
    monthMap.set(monthKey, bucket);
  }

  const monthEntries = [...monthMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-3);
  const points = monthEntries.map(([monthKey, bucket], index) => {
    const averageAccuracy = bucket.accuracyWeight > 0 ? Math.round(bucket.weightedAccuracy / bucket.accuracyWeight) : bucket.count;
    return {
      id: `monthly-${monthKey}-${index}`,
      label: formatMonthLabel(monthKey),
      value: averageAccuracy,
      valueLabel: bucket.accuracyWeight > 0 ? `${averageAccuracy}%` : `${bucket.count}次`,
      emphasis: false,
    };
  });
  const peakValue = points.length > 0 ? Math.max(...points.map((item) => item.value)) : 0;
  const emphasizedPoints = points.map((item) => ({ ...item, emphasis: item.value === peakValue && peakValue > 0 }));
  const totalCount = monthEntries.reduce((sum, [, bucket]) => sum + bucket.count, 0);
  const averageValue = emphasizedPoints.length > 0 ? Math.round(emphasizedPoints.reduce((sum, item) => sum + item.value, 0) / emphasizedPoints.length) : 0;
  const trendState: LearningSectionState =
    emphasizedPoints.length >= 2 ? "ready" : emphasizedPoints.length > 0 ? "partial" : "empty";
  const peakPoint = emphasizedPoints.find((item) => item.emphasis) ?? null;
  const monthlyHeatmapCells = takeRecentHeatmapCells(heatmapCells, 90);

  return {
    scope: "monthly",
    scopeLabel: "月视图",
    state: trendState,
    title: "Monthly Track",
    subtitle: "按月汇总最近一个季度的掌握率与活跃度，适合观察阶段性波动。",
    summaryLabel:
      emphasizedPoints.length > 0
        ? `近 3 个月累计完成 ${totalCount} 次练测，月均走势约 ${averageValue}${emphasizedPoints.some((item) => item.valueLabel.endsWith("%")) ? "%" : "次"}。`
        : "近 3 个月尚未形成可读的月度走势。",
    heatmapTitle: "最近一个季度热力图",
    heatmapSubtitle: "继续保留 90 天粒度，帮助把月度判断落回真实学习日期。",
    trend: {
      state: trendState,
      days: 90,
      points: emphasizedPoints,
      averageValue,
      peakPointLabel: peakPoint ? `${peakPoint.label} ${peakPoint.valueLabel}` : null,
      fallback:
        trendState === "empty"
          ? createFallback("暂无月度走势", "当前没有足够的 daily tracks 来聚合月度变化，月视图应展示空状态。")
          : null,
    },
    heatmap: {
      state: monthlyHeatmapCells.length > 0 ? "ready" : "empty",
      cells: monthlyHeatmapCells,
      fallback:
        monthlyHeatmapCells.length > 0
          ? null
          : createFallback("暂未生成季度热力图", "如果 daily tracks 缺失，月视图热力图区也应走降级说明。"),
    },
    fallback:
      trendState === "empty"
        ? createFallback("月视图待生成", "当前没有可用的季度聚合数据，Monthly Track 应整体降级。")
        : null,
  };
}

function buildWeeklyTrack(payload: LearningSummaryPayload, scope: LearningViewScope = DEFAULT_SCOPE): LearningWeeklyTrackViewModel {
  const dailyTrackItems = Array.isArray(payload.tracks?.daily) ? payload.tracks.daily.filter((item) => item && item.date) : [];
  const heatmapCells = dailyTrackItems.map(toHeatmapCell);

  if (scope === "daily") {
    return buildDailyScopeTrack(heatmapCells);
  }
  if (scope === "monthly") {
    return buildMonthlyScopeTrack(heatmapCells);
  }
  return buildWeeklyScopeTrack(payload, heatmapCells);
}

function buildAiInsight(payload: LearningSummaryPayload, narrative: string): LearningAiInsightViewModel {
  const summaryTitle = String(payload.reportSeed?.summaryTitle || "AI 学情解读").trim();
  const summaryText = String(payload.reportSeed?.summaryText || narrative).trim();
  const teacherAdviceTitle = String(payload.reportSeed?.teacherAdviceTitle || "教师 / 家长建议").trim();
  const teacherAdviceText = String(payload.reportSeed?.teacherAdviceText || "").trim();
  const hasSummary = Boolean(summaryText);
  const hasAdvice = Boolean(teacherAdviceText);
  const state: LearningSectionState = hasSummary && hasAdvice ? "ready" : hasSummary || hasAdvice ? "partial" : "empty";

  return {
    state,
    title: "AI Insight",
    summaryTitle,
    summaryText: summaryText || DEFAULT_NARRATIVE,
    teacherAdviceTitle,
    teacherAdviceText: teacherAdviceText || "当前没有额外教师建议，可先围绕薄弱维度安排一轮短练与复盘。",
    fallback:
      state === "empty"
        ? createFallback("暂无 AI 种子文本", "如果 reportSeed 也缺失，AI 卡片应展示空状态并保留重新生成入口。")
        : null,
  };
}

export function toViewModel(payload: LearningSummaryPayload, options?: { scope?: LearningViewScope }): LearningViewModel {
  const overview = payload?.overview ?? {
    streakDays: 0,
    poemCount: 0,
    accuracy30d: 0,
    weeklyWrongCount: 0,
    weeklyPracticeCount: 0,
    dueMemoryCount: 0,
    weakDimension: "",
  };
  const accuracy = clampPercent(overview.accuracy30d);
  const weakestLabel = String(payload?.weakest?.label || overview.weakDimension || "").trim();
  const weakFocusLabel = weakestLabel || DEFAULT_WEAK_FOCUS;
  const narrative = String(payload?.narrative || payload?.reportSeed?.summaryText || DEFAULT_NARRATIVE).trim() || DEFAULT_NARRATIVE;
  const scope = options?.scope || DEFAULT_SCOPE;

  return {
    hero: buildHero({ ...payload, overview }, accuracy, weakFocusLabel, narrative),
    quickStats: buildQuickStats({ ...payload, overview }, accuracy, weakFocusLabel),
    insightGrid: buildInsightGrid({ ...payload, overview }, narrative),
    weeklyTrack: buildWeeklyTrack({ ...payload, overview }, scope),
    aiInsight: buildAiInsight({ ...payload, overview }, narrative),
    meta: {
      source: "learning-summary-payload",
      version: "learning-overview-v1",
      scope,
      degradation: {
        missingClassBenchmark: !(Array.isArray(payload.dimensionScores) && payload.dimensionScores.some((item) => item?.classAvg !== null && item?.classAvg !== undefined)),
        missingHeatmapDates: !(Array.isArray(payload.tracks?.daily) && payload.tracks.daily.length > 0),
      },
    },
  };
}

export async function getLearningViewModel(force = false, signal?: AbortSignal): Promise<LearningViewModel> {
  const payload = await getUserLearningSummary(force, signal);
  return toViewModel(payload);
}

function emptyStatBlock(): StatBlock {
  return { count: 0, trend7d: [], deltaPct: null };
}

function detectDimensionKey(raw: string): DimensionKey | null {
  const text = String(raw || "").trim();
  if (!text) {
    return null;
  }
  if (/意象/.test(text)) return "imagery";
  if (/记忆|默写/.test(text)) return "memory";
  if (/朝代/.test(text)) return "dynasty";
  if (/题材|主题/.test(text)) return "subject";
  if (/题型|题目|手法|情感|赏析|比较|语境/.test(text)) return "genre";
  return null;
}

function normalizeTracks(payload: LearningSummaryPayload): LearningTrack[] {
  const rows = Array.isArray(payload.tracks?.daily) ? payload.tracks?.daily : [];
  return rows
    .filter((item): item is LearningDailyTrackPoint => Boolean(item && item.date))
    .map((item) => ({
      date: String(item.date).slice(0, 10),
      count: toCount(item.count),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function sumCounts(items: LearningTrack[]): number {
  return items.reduce((sum, item) => sum + toCount(item.count), 0);
}

function trend7dFromTracks(tracks: LearningTrack[]): number[] {
  if (tracks.length === 0) {
    return [];
  }
  const latest = tracks.slice(-7).map((item) => toCount(item.count));
  if (latest.length >= 7) {
    return latest;
  }
  return [...new Array(7 - latest.length).fill(0), ...latest];
}

function deltaPctFromTracks(tracks: LearningTrack[]): number | null {
  if (tracks.length === 0) {
    return null;
  }
  const recent = tracks.slice(-7);
  const previous = tracks.slice(-14, -7);
  const recentSum = sumCounts(recent);
  const prevSum = sumCounts(previous);
  if (previous.length === 0) {
    return recentSum > 0 ? 100 : null;
  }
  if (prevSum === 0) {
    return recentSum === 0 ? 0 : 100;
  }
  return Math.round(((recentSum - prevSum) / prevSum) * 100);
}

function buildDimensionScores(payload: LearningSummaryPayload): {
  scores: Record<DimensionKey, number>;
  classAvg?: Record<DimensionKey, number>;
} {
  const baseScore = clampPercent(payload.overview?.accuracy30d);
  const scores: Record<DimensionKey, number> = {
    genre: baseScore,
    dynasty: baseScore,
    subject: baseScore,
    imagery: baseScore,
    memory: baseScore,
  };

  const classAvgBuffer = new Map<DimensionKey, number>();
  const ingest = (label: string, bucket: string, mastery: unknown, classAvgValue?: unknown): void => {
    const key = detectDimensionKey(`${label} ${bucket}`);
    if (!key) {
      return;
    }
    scores[key] = clampPercent(mastery);
    const parsedClassAvg = Number(classAvgValue);
    if (Number.isFinite(parsedClassAvg)) {
      classAvgBuffer.set(key, clampPercent(parsedClassAvg));
    }
  };

  const dimensionScores = Array.isArray(payload.dimensionScores) ? payload.dimensionScores : [];
  dimensionScores.forEach((item: LearningDimensionScoreItem) => {
    ingest(item.label, item.bucket || "", item.mastery, item.classAvg);
  });

  const coverage = Array.isArray(payload.coverage) ? payload.coverage : [];
  coverage.forEach((item: LearningCoverageItem) => {
    const key = detectDimensionKey(item.label);
    if (!key) {
      return;
    }
    scores[key] = clampPercent(item.mastery);
  });

  const weakKey = detectDimensionKey(
    `${payload.weakest?.bucket || ""} ${payload.weakest?.label || ""} ${payload.overview?.weakDimension || ""}`,
  );
  const weakRate = Number(payload.weakest?.rate);
  if (weakKey && Number.isFinite(weakRate)) {
    scores[weakKey] = Math.min(scores[weakKey], clampPercent(weakRate));
  }

  const strongKey = detectDimensionKey(`${payload.strongest?.bucket || ""} ${payload.strongest?.label || ""}`);
  const strongRate = Number(payload.strongest?.rate);
  if (strongKey && Number.isFinite(strongRate)) {
    scores[strongKey] = Math.max(scores[strongKey], clampPercent(strongRate));
  }

  if (classAvgBuffer.size === 0) {
    return { scores };
  }

  const classAvg: Record<DimensionKey, number> = { ...scores };
  classAvgBuffer.forEach((value, key) => {
    classAvg[key] = value;
  });
  return { scores, classAvg };
}

function buildRecommendedActions(weakDimension: DimensionKey): RecommendedAction[] {
  const focus = weakDimension;
  const focusLabel = {
    genre: "题型",
    dynasty: "朝代",
    subject: "题材",
    imagery: "意象",
    memory: "记忆",
  }[focus];
  return [
    {
      id: "a1",
      title: `${focusLabel}专项练习`,
      cta: "开始",
      to: `/practice?focus=${encodeURIComponent(focus)}`,
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
      to: `/my-learning?tab=overview&focus=${encodeURIComponent(focus)}`,
      icon: "Sparkles",
    },
  ];
}

function weakDimensionFromPayload(payload: LearningSummaryPayload): DimensionKey {
  const key = detectDimensionKey(
    `${payload.weakest?.bucket || ""} ${payload.weakest?.label || ""} ${payload.overview?.weakDimension || ""}`,
  );
  return key || "imagery";
}

export function adaptSummaryPayloadToLearningSummary(payload: LearningSummaryPayload): LearningSummary {
  const overview = payload.overview || {
    streakDays: 0,
    accuracy30d: 0,
    weeklyWrongCount: 0,
    weeklyPracticeCount: 0,
    dueMemoryCount: 0,
    weakDimension: "",
    poemCount: 0,
  };
  const tracks = normalizeTracks(payload);
  const weakDimension = weakDimensionFromPayload(payload);
  const { scores, classAvg } = buildDimensionScores(payload);
  const memoryTrend7d = trend7dFromTracks(tracks);
  const memoryDelta = deltaPctFromTracks(tracks);
  const aiInsight =
    String(payload.reportSeed?.summaryText || "").trim() ||
    String(payload.narrative || "").trim() ||
    "已同步最新学习数据，建议优先处理薄弱维度并完成当日复盘。";

  return {
    overallScore: clampPercent(overview.accuracy30d),
    aiInsight,
    weakDimension,
    streakDays: toCount(overview.streakDays),
    dimensionScores: scores,
    classAvg,
    stats: {
      wrongbook: {
        ...emptyStatBlock(),
        count: toCount(overview.weeklyWrongCount),
      },
      favorites: emptyStatBlock(),
      plan: {
        ...emptyStatBlock(),
        count: toCount(overview.weeklyPracticeCount),
      },
      memory: {
        count: toCount(overview.dueMemoryCount),
        trend7d: memoryTrend7d,
        deltaPct: memoryDelta,
      },
    },
    recommendedActions: buildRecommendedActions(weakDimension),
    tracks,
  };
}

export async function getLearningSummary(force = false, signal?: AbortSignal): Promise<LearningSummary> {
  const payload = await getUserLearningSummary(force, signal);
  return adaptSummaryPayloadToLearningSummary(payload);
}

export function streamLearningReport(
  req: AiReportRequest,
  onToken: (chunk: string) => void,
  onDone: (full: string) => void,
  onError?: (err: Error) => void,
): () => void {
  const controller = new AbortController();
  let disposed = false;

  void streamPost({
    path: "/ai/learning-report",
    body: req,
    signal: controller.signal,
    onToken: (chunk) => {
      if (!disposed) {
        onToken(chunk || "");
      }
    },
  })
    .then(({ text }) => {
      if (!disposed) {
        onDone(text || "");
      }
    })
    .catch((error: unknown) => {
      if (disposed) {
        return;
      }
      const err = error instanceof Error ? error : new Error("学习报告流式请求失败");
      onError?.(err);
    });

  return () => {
    disposed = true;
    controller.abort();
  };
}
