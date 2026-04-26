import type { ComponentProps } from "react";
import { CollapsibleWorkspaceSection } from "@/components/my-learning/CollapsibleWorkspaceSection";
import { DiagnosisPanel } from "@/components/my-learning/DiagnosisPanel";
import { LatestExamDiagnosisCard } from "@/components/my-learning/LatestExamDiagnosisCard";
import { DiagnosisAdvancedPanel } from "@/components/my-learning/DiagnosisAdvancedPanel";

interface DiagnosisWorkspaceProps {
  diagnosisPanelProps: ComponentProps<typeof DiagnosisPanel>;
  latestExamDiagnosisCardProps: ComponentProps<typeof LatestExamDiagnosisCard>;
  diagnosisAdvancedPanelProps: ComponentProps<typeof DiagnosisAdvancedPanel>;
}

export function DiagnosisWorkspace({
  diagnosisPanelProps,
  latestExamDiagnosisCardProps,
  diagnosisAdvancedPanelProps,
}: DiagnosisWorkspaceProps): JSX.Element {
  return (
    <section className="page-shell">
      <DiagnosisPanel {...diagnosisPanelProps} />

      <LatestExamDiagnosisCard {...latestExamDiagnosisCardProps} />

      <CollapsibleWorkspaceSection
        title="诊断历史与高级分析（点击展开）"
        description="模考日志、图谱对比日志、来源维度深挖等深度分析已下沉到这里。"
      >
        <DiagnosisAdvancedPanel {...diagnosisAdvancedPanelProps} />
      </CollapsibleWorkspaceSection>
    </section>
  );
}
