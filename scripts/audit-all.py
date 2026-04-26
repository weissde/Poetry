from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
DOCS_DIR = ROOT / "docs"
LOGS_DIR = ROOT / "logs"


def run_python(script_name: str) -> int:
    script_path = SCRIPTS / script_name
    result = subprocess.run([sys.executable, str(script_path)], cwd=str(ROOT), check=False)
    return int(result.returncode)


def latest_json(prefix: str) -> Optional[Path]:
    files = sorted(LOGS_DIR.glob(f"{prefix}-*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def load_json(path: Optional[Path]) -> Dict[str, Any]:
    if not path or not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main() -> int:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    progress_code = run_python("audit-progress.py")
    runtime_code = run_python("audit-runtime.py")

    progress_path = latest_json("progress-audit")
    runtime_path = latest_json("runtime-audit")

    progress = load_json(progress_path)
    runtime = load_json(runtime_path)

    now = datetime.now()
    date_token = now.strftime("%Y-%m-%d")
    ts_token = now.strftime("%Y%m%d-%H%M%S")

    progress_summary = progress.get("summary", {}) if isinstance(progress, dict) else {}
    runtime_summary = runtime.get("summary", {}) if isinstance(runtime, dict) else {}

    merged = {
        "generatedAt": now.isoformat(),
        "exitCodes": {
            "progress": progress_code,
            "runtime": runtime_code,
        },
        "progress": {
            "report": str(progress_path) if progress_path else "",
            "summary": progress_summary,
        },
        "runtime": {
            "report": str(runtime_path) if runtime_path else "",
            "summary": runtime_summary,
        },
    }

    json_path = LOGS_DIR / f"audit-all-{ts_token}.json"
    json_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")

    total_checks = int(progress_summary.get("totalChecks", 0) or 0)
    total_passed = int(progress_summary.get("totalPassed", 0) or 0)
    completion_rate = float(progress_summary.get("completionRate", 0) or 0)

    runtime_ok = int(runtime_summary.get("ok", 0) or 0)
    runtime_fail = int(runtime_summary.get("fail", 0) or 0)
    runtime_skipped = int(runtime_summary.get("skipped", 0) or 0)
    runtime_total = int(runtime_summary.get("total", 0) or 0)
    runtime_rate = round((runtime_ok / runtime_total) * 100, 1) if runtime_total else 0.0
    exam_template_checks = int(runtime_summary.get("examTemplateChecks", 0) or 0)
    exam_template_hit_rate = float(runtime_summary.get("examTemplateHitRate", 0) or 0)
    exam_subjective_target_rate = float(runtime_summary.get("examSubjectiveTargetRate", 0) or 0)

    lines = []
    lines.append(f"# 综合审计报告（{date_token}）")
    lines.append("")
    lines.append("## 总览")
    lines.append("")
    lines.append(f"- 生成时间：{now.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"- 静态完成度：{total_passed}/{total_checks}（{completion_rate}%）")
    lines.append(f"- 运行时通过率：OK {runtime_ok} / TOTAL {runtime_total}（{runtime_rate}%）")
    lines.append(f"- 运行时失败：{runtime_fail}，跳过：{runtime_skipped}")
    lines.append(f"- 模板命中率：{exam_template_hit_rate}%（样本 {exam_template_checks}）")
    lines.append(f"- 主观题目标达成率：{exam_subjective_target_rate}%（样本 {exam_template_checks}）")
    lines.append("")
    lines.append("## 子报告")
    lines.append("")
    lines.append(f"- 静态审计 JSON：`{progress_path}`")
    lines.append(f"- 运行时审计 JSON：`{runtime_path}`")
    lines.append(f"- 综合审计 JSON：`{json_path}`")
    lines.append("")
    lines.append("## 判定")
    lines.append("")

    if runtime_fail > 0:
        lines.append("- 当前不建议宣称“完全可用”：运行时仍有失败项，请先修复失败接口。")
    elif runtime_skipped > 0:
        lines.append("- 基础可用；但存在需鉴权接口未验收（SKIPPED），建议补充 token 后复测。")
    else:
        lines.append("- 静态与运行时均通过，可作为当前阶段验收基线。")

    md_path = DOCS_DIR / f"综合审计报告_{date_token}.md"
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(
        "All audit finished.\n"
        f"Markdown: {md_path}\n"
        f"JSON: {json_path}\n"
        f"Static: {total_passed}/{total_checks} ({completion_rate}%)\n"
        f"Runtime: OK={runtime_ok}, FAIL={runtime_fail}, SKIPPED={runtime_skipped}"
    )

    return 0 if (progress_code == 0 and runtime_code == 0) else 1


if __name__ == "__main__":
    raise SystemExit(main())
