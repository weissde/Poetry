interface LearningReportExportProps {
  onExportPdf: () => void;
  onExportMarkdown: () => void;
  className?: string;
}

export function LearningReportExport({
  onExportPdf,
  onExportMarkdown,
  className = "",
}: LearningReportExportProps): JSX.Element {
  return (
    <div className={["flex flex-wrap items-center gap-2", className].filter(Boolean).join(" ")}>
      <button type="button" className="btn-secondary-compact" onClick={onExportPdf}>
        导出学情报告（PDF）
      </button>
      <button type="button" className="btn-secondary-compact" onClick={onExportMarkdown}>
        导出学情报告（Markdown）
      </button>
    </div>
  );
}
