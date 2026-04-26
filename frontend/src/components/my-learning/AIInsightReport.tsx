import { Magnet } from "@/components/react-bits";
import { SectionCard } from "@/components/common/SectionCard";
import { LearningReportExport } from "@/components/teaching/LearningReportExport";

interface AIInsightReportProps {
  learningSummaryError: string | null;
  aiLearningReportError: string | null;
  aiLearningReportLoading: boolean;
  aiLearningReportSource: string | null;
  learningReportSections: Array<{ title: string; detail: string }>;
  diagnosisWeakestDimension: { label: string; rate: number } | null;
  handleExportStudyReportPdf: () => void;
  handleExportStudyReportMarkdown: () => void;
}

export function AIInsightReport({
  learningSummaryError,
  aiLearningReportError,
  aiLearningReportLoading,
  aiLearningReportSource,
  learningReportSections,
  diagnosisWeakestDimension,
  handleExportStudyReportPdf,
  handleExportStudyReportMarkdown,
}: AIInsightReportProps): JSX.Element {
  return (
    <div id="my-learning-report-export" className="scroll-mt-28">
      <SectionCard
        className="surface-card card-roomy"
        weight="summary"
        title="AI 学情解读"
        subtitle="用自然语言概括当前学习状态，并给出面向教师 / 家长的建议。"
        bodyClassName="flow-lg"
        actions={
          <Magnet className="inline-flex">
            <LearningReportExport onExportPdf={handleExportStudyReportPdf} onExportMarkdown={handleExportStudyReportMarkdown} />
          </Magnet>
        }
      >
        {learningSummaryError ? (
          <div className="rounded-[1rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
            学情总览接口暂不可用，当前已回退到页面内推断结果。原因：{learningSummaryError}
          </div>
        ) : null}
        {aiLearningReportError ? (
          <div className="rounded-[1rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
            AI 学情解读暂不可用，当前展示后端聚合的建议文本。原因：{aiLearningReportError}
          </div>
        ) : null}
        <article className="rounded-[1.2rem] bg-[linear-gradient(135deg,#FFF9EE_0%,#F3E7CE_100%)] px-4 py-4 shadow-[0_10px_22px_rgba(34,58,94,0.05)]">
          <p className="learn-goal-kicker">{learningReportSections[0]?.title || "AI 学情解读"}</p>
          <p className="mt-2 text-sm leading-7 text-[#5A4B37]">
            {aiLearningReportLoading ? "正在流式生成学情解读..." : learningReportSections[0]?.detail}
          </p>
          {aiLearningReportSource ? <p className="mt-2 text-xs text-[#8A6B32]">来源：{aiLearningReportSource}</p> : null}
        </article>
        <article className="rounded-[1.2rem] bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
          <p className="learn-goal-kicker">{learningReportSections[1]?.title || "教师 / 家长建议"}</p>
          <ul className="mt-3 space-y-2 pl-5 text-sm leading-7 text-slate-600">
            <li>{learningReportSections[1]?.detail}</li>
            <li>建议先围绕 {diagnosisWeakestDimension?.label || "当前薄弱点"} 做一轮课堂追问，再进入练测评估。</li>
            <li>可结合《静夜思》与相关月意象作品做一次对比阅读，帮助巩固情感辨析。</li>
          </ul>
        </article>
      </SectionCard>
    </div>
  );
}
