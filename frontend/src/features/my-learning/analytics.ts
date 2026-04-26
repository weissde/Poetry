import type {
  WrongDimensionStat,
  WrongQuestionRow,
  WrongTrendDisplayRow,
  WrongTrendPoint,
} from "@/components/my-learning/wrongbookTypes";
import type { WeaknessProfile } from "@/types";

type WeakBucket = Record<string, { attempts: number; correct: number; rate: number }>;

export function metricRate(profile: WeaknessProfile, key: string): number {
  const row = profile.by_question_type?.[key];
  return typeof row?.rate === "number" ? Math.round(row.rate * 100) : 0;
}

export function topWeakRows(
  bucket: WeakBucket,
  limit = 5,
): Array<{ key: string; attempts: number; rate: number }> {
  return Object.entries(bucket || {})
    .map(([key, row]) => ({
      key,
      attempts: row.attempts ?? 0,
      rate: Math.round((row.rate ?? 0) * 100),
    }))
    .filter((item) => item.attempts > 0)
    .sort((a, b) => {
      if (a.rate === b.rate) {
        return b.attempts - a.attempts;
      }
      return a.rate - b.rate;
    })
    .slice(0, limit);
}

export function aggregateWrongDimension(
  rows: WrongQuestionRow[],
  selector: (row: WrongQuestionRow) => string | null,
  limit = 6,
): WrongDimensionStat[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = selector(row)?.trim() || "未分类";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  const total = rows.length || 1;
  return Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      count,
      ratio: count / total,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function toWrongTrendDailyRows(rows: WrongTrendPoint[]): WrongTrendDisplayRow[] {
  return rows.map((item) => ({
    key: item.date,
    label: item.date.slice(5),
    created: Number(item.created || 0),
    mastered: Number(item.mastered || 0),
    startDate: item.date,
    endDate: item.date,
  }));
}

export function toWrongTrendWeeklyRows(rows: WrongTrendPoint[]): WrongTrendDisplayRow[] {
  if (rows.length === 0) return [];
  const sorted = [...rows]
    .map((item) => ({
      date: String(item.date || ""),
      created: Number(item.created || 0),
      mastered: Number(item.mastered || 0),
    }))
    .filter((item) => item.date.length >= 10)
    .sort((a, b) => a.date.localeCompare(b.date));

  const result: WrongTrendDisplayRow[] = [];
  for (let index = 0; index < sorted.length; index += 7) {
    const group = sorted.slice(index, index + 7);
    if (group.length === 0) continue;
    const startDate = group[0].date;
    const endDate = group[group.length - 1].date;
    const created = group.reduce((sum, item) => sum + item.created, 0);
    const mastered = group.reduce((sum, item) => sum + item.mastered, 0);
    const label = startDate === endDate ? startDate.slice(5) : `${startDate.slice(5)}~${endDate.slice(5)}`;
    result.push({
      key: `${startDate}_${endDate}`,
      label,
      created,
      mastered,
      startDate,
      endDate,
    });
  }
  return result;
}

export function summarizeWrongTrend(
  rows: WrongTrendPoint[],
  activeDays: number,
  totalDays: number,
): { created: number; mastered: number; net: number; activeDays: number; totalDays: number } {
  const created = rows.reduce((sum, item) => sum + Number(item.created || 0), 0);
  const mastered = rows.reduce((sum, item) => sum + Number(item.mastered || 0), 0);
  const net = mastered - created;
  return { created, mastered, net, activeDays, totalDays };
}

export function getWrongTrendMax(rows: WrongTrendDisplayRow[]): number {
  let maxValue = 1;
  rows.forEach((item) => {
    if (item.created > maxValue) {
      maxValue = item.created;
    }
    if (item.mastered > maxValue) {
      maxValue = item.mastered;
    }
  });
  return maxValue;
}

export function pickWrongTrendHotspot(rows: WrongTrendDisplayRow[]): WrongTrendDisplayRow | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const aGap = Number(a.created || 0) - Number(a.mastered || 0);
    const bGap = Number(b.created || 0) - Number(b.mastered || 0);
    if (aGap === bGap) {
      return String(b.startDate || "").localeCompare(String(a.startDate || ""));
    }
    return bGap - aGap;
  });
  return sorted[0] || null;
}

export function buildSourceWeakRows(
  bucket: WeakBucket,
  formatter: (key: string) => string,
  limit = 8,
): Array<{ key: string; label: string; attempts: number; correct: number; rate: number }> {
  return Object.entries(bucket)
    .map(([key, row]) => ({
      key,
      label: formatter(key),
      attempts: Number(row?.attempts || 0),
      correct: Number(row?.correct || 0),
      rate: Math.round(Number(row?.rate || 0) * 100),
    }))
    .filter((item) => item.attempts > 0)
    .sort((a, b) => {
      if (a.rate === b.rate) return b.attempts - a.attempts;
      return a.rate - b.rate;
    })
    .slice(0, limit);
}

