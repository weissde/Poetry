export function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeMarkdown(value: string): string {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function downloadTextFile(filename: string, content: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
  return true;
}

export function openStudyReportPrintWindow(title: string, bodyHtml: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
  if (!popup) {
    return false;
  }
  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 32px; font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif; color: #243b5b; background: #f7f4ee; }
    .report-shell { max-width: 860px; margin: 0 auto; background: #fffdf8; border-radius: 24px; padding: 32px; box-shadow: 0 18px 44px rgba(34,58,94,0.08); }
    .report-kicker { margin: 0; font-size: 12px; letter-spacing: 0.18em; color: #9b6731; text-transform: uppercase; }
    .report-title { margin: 10px 0 0; font-family: "Noto Serif SC", SimSun, serif; font-size: 34px; line-height: 1.2; color: #203754; }
    .report-subtitle { margin: 12px 0 0; font-size: 15px; line-height: 1.9; color: #5d7188; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 24px; }
    .metric-card { border: 1px solid rgba(214,223,231,0.92); border-radius: 18px; padding: 16px; background: #ffffff; }
    .metric-label { margin: 0; font-size: 12px; color: #6a7f94; }
    .metric-value { margin: 8px 0 0; font-family: "Noto Serif SC", SimSun, serif; font-size: 30px; color: #213857; }
    .metric-detail { margin: 8px 0 0; font-size: 13px; line-height: 1.8; color: #5f7389; }
    .section { margin-top: 24px; }
    .section-title { margin: 0 0 10px; font-family: "Noto Serif SC", SimSun, serif; font-size: 24px; color: #203754; }
    .section-copy { margin: 0; font-size: 14px; line-height: 1.9; color: #566b82; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .tag { display: inline-flex; align-items: center; border-radius: 9999px; background: rgba(34,58,94,0.08); padding: 6px 12px; font-size: 12px; color: #294764; }
    .list-card { border-radius: 18px; background: #f8f5ef; padding: 18px; margin-top: 14px; }
    .list-card ul { margin: 10px 0 0; padding-left: 18px; }
    .list-card li { margin-top: 6px; line-height: 1.8; color: #5d7188; }
  </style>
</head>
<body>
  <div class="report-shell">${bodyHtml}</div>
</body>
</html>`);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => {
    popup.print();
  }, 180);
  return true;
}
