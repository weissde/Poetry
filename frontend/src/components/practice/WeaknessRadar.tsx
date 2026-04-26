﻿﻿﻿import { Radar, RadarChart, PolarAngleAxis, PolarGrid } from"recharts";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { useWeakness } from"@/hooks/useWeakness";
import { usePracticeStore } from"@/stores/practiceStore";

interface RadarDatum {
 dimension: string;
 score: number;
}

function toPercent(correct: number, attempts: number): number {
 if (attempts === 0) {
 return 0;
 }
 return Math.round((correct / attempts) * 100);
}

export function WeaknessRadar(): JSX.Element {
 const { profile } = useWeakness();
 const localStats = usePracticeStore((state) => state.stats);

 const typeProfile = profile.by_question_type || {};

 const data: RadarDatum[] = [
 {
 dimension:"默写",
 score:
 typeof typeProfile.memorization?.rate ==="number"
 ? Math.round(typeProfile.memorization.rate * 100)
 : toPercent(localStats.memorization.correct, localStats.memorization.attempts),
 },
 {
 dimension:"词义",
 score:
 typeof typeProfile.meaning?.rate ==="number"
 ? Math.round(typeProfile.meaning.rate * 100)
 : toPercent(localStats.meaning.correct, localStats.meaning.attempts),
 },
 {
 dimension:"手法",
 score:
 typeof typeProfile.technique?.rate ==="number"
 ? Math.round(typeProfile.technique.rate * 100)
 : toPercent(localStats.technique.correct, localStats.technique.attempts),
 },
 {
 dimension:"情感",
 score:
 typeof typeProfile.emotion?.rate ==="number"
 ? Math.round(typeProfile.emotion.rate * 100)
 : toPercent(localStats.emotion.correct, localStats.emotion.attempts),
 },
 {
 dimension:"赏析",
 score:
 typeof typeProfile.appreciation?.rate ==="number"
 ? Math.round(typeProfile.appreciation.rate * 100)
 : toPercent(localStats.appreciation.correct, localStats.appreciation.attempts),
 },
 {
 dimension:"比较",
 score:
 typeof typeProfile.comparison?.rate ==="number"
 ? Math.round(typeProfile.comparison.rate * 100)
 : toPercent(localStats.comparison.correct, localStats.comparison.attempts),
 },
 {
 dimension:"语境",
 score:
 typeof typeProfile.context?.rate ==="number"
 ? Math.round(typeProfile.context.rate * 100)
 : toPercent(localStats.context.correct, localStats.context.attempts),
 },
 ];

 return (
 <SpotlightCard className="p-4">
 <h3 className="font-display text-xl text-ink-700">弱点雷达</h3>
 <p className="mt-1 text-xs text-slate-500">正确率越低的维度，图形越收缩。</p>

 <div className="mt-4 flex items-center justify-center">
 <RadarChart width={320} height={260} data={data}>
 <PolarGrid stroke="#d4e8f5" />
 <PolarAngleAxis dataKey="dimension" tick={{ fill:"#1B3358", fontSize: 12 }} />
 <Radar dataKey="score" stroke="#2E5F8A" fill="#D4E8F5" fillOpacity={0.65} />
 </RadarChart>
 </div>
 </SpotlightCard>
 );
}

