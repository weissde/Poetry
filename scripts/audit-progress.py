from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, List


ROOT = Path(__file__).resolve().parents[1]
BACKEND_MAIN = ROOT / "backend" / "app" / "main.py"
FRONTEND_PAGES = ROOT / "frontend" / "src" / "pages"
MIGRATIONS = ROOT / "backend" / "supabase" / "migrations"
DOCS_DIR = ROOT / "docs"
LOGS_DIR = ROOT / "logs"


@dataclass
class Check:
    id: str
    module: str
    name: str
    check: Callable[[], bool]


def file_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def main_has(snippet: str) -> bool:
    content = file_text(BACKEND_MAIN)
    return snippet in content


def page_exists(filename: str) -> bool:
    return (FRONTEND_PAGES / filename).exists()


def migration_exists(filename: str) -> bool:
    return (MIGRATIONS / filename).exists()


def build_checks() -> List[Check]:
    return [
        # M1
        Check("M1-1", "M1 AI智慧解析", "诗词搜索接口", lambda: main_has("@app.get('/api/poems/search'")),
        Check("M1-2", "M1 AI智慧解析", "诗词详情接口", lambda: main_has("@app.get('/api/poems/{poem_id}'")),
        Check("M1-3", "M1 AI智慧解析", "流式解析接口", lambda: main_has("@app.post('/api/ai/analyze/stream'")),
        Check("M1-4", "M1 AI智慧解析", "前端探索页", lambda: page_exists("Explore.tsx")),
        Check("M1-5", "M1 AI智慧解析", "前端学习页", lambda: page_exists("Learn.tsx")),
        # M2
        Check("M2-1", "M2 对话式AI导师", "流式对话接口", lambda: main_has("@app.post('/api/ai/chat/stream'")),
        Check("M2-2", "M2 对话式AI导师", "对话摘要写入接口", lambda: main_has("@app.post('/api/ai/chat/summary'")),
        Check("M2-3", "M2 对话式AI导师", "对话摘要列表接口", lambda: main_has("@app.get('/api/ai/chat/summaries'")),
        Check("M2-4", "M2 对话式AI导师", "chat_summaries迁移", lambda: migration_exists("010_chat_summaries.sql")),
        Check("M2-5", "M2 对话式AI导师", "学习页（对话入口）", lambda: page_exists("Learn.tsx")),
        # M3
        Check("M3-1", "M3 智能记忆", "记忆入列接口", lambda: main_has("@app.post('/api/memory/enroll'")),
        Check("M3-2", "M3 智能记忆", "今日记忆接口", lambda: main_has("@app.get('/api/memory/today'")),
        Check("M3-3", "M3 智能记忆", "记忆复习接口", lambda: main_has("@app.post('/api/memory/review'")),
        Check("M3-4", "M3 智能记忆", "记忆统计接口", lambda: main_has("@app.get('/api/memory/stats'")),
        Check("M3-5", "M3 智能记忆", "memory_reviews迁移", lambda: migration_exists("005_memory_reviews.sql")),
        Check("M3-6", "M3 智能记忆", "前端记忆页", lambda: page_exists("Memory.tsx")),
        # M4
        Check("M4-1", "M4 练习与考试", "题目生成接口", lambda: main_has("@app.post('/api/practice/questions/generate'")),
        Check("M4-2", "M4 练习与考试", "答题上报接口", lambda: main_has("@app.post('/api/practice/answers'")),
        Check("M4-3", "M4 练习与考试", "弱点画像接口", lambda: main_has("@app.get('/api/weakness/profile'")),
        Check("M4-4", "M4 练习与考试", "组卷接口", lambda: main_has("@app.post('/api/exam/create'")),
        Check("M4-5", "M4 练习与考试", "交卷接口", lambda: main_has("@app.post('/api/exam/submit'")),
        Check("M4-6", "M4 练习与考试", "考试历史接口", lambda: main_has("@app.get('/api/exam/history'")),
        Check("M4-7", "M4 练习与考试", "前端练习页", lambda: page_exists("Practice.tsx")),
        Check("M4-8", "M4 练习与考试", "前端考试页", lambda: page_exists("Exam.tsx")),
        # M5
        Check("M5-1", "M5 错题与复习计划", "错题列表接口", lambda: main_has("@app.get('/api/wrongbook'")),
        Check("M5-2", "M5 错题与复习计划", "错题仪表盘接口", lambda: main_has("@app.get('/api/wrongbook/dashboard'")),
        Check("M5-3", "M5 错题与复习计划", "复习计划生成接口", lambda: main_has("@app.post('/api/review-plan/generate'")),
        Check("M5-4", "M5 错题与复习计划", "复习计划任务更新接口", lambda: main_has("@app.patch('/api/review-plan/{plan_id}/task'")),
        Check("M5-5", "M5 错题与复习计划", "错题维度迁移", lambda: migration_exists("003_wrongbook_dimensions.sql")),
        Check("M5-6", "M5 错题与复习计划", "主观题错题字段迁移", lambda: migration_exists("009_wrongbook_subjective_fields.sql")),
        Check("M5-7", "M5 错题与复习计划", "前端我的学习页", lambda: page_exists("MyLearning.tsx")),
        # M6
        Check("M6-1", "M6 AI创作坊", "创作点评接口", lambda: main_has("@app.post('/api/create/review'")),
        Check("M6-2", "M6 AI创作坊", "创作润色接口", lambda: main_has("@app.post('/api/create/{creation_id}/refine'")),
        Check("M6-3", "M6 AI创作坊", "现代转古体接口", lambda: main_has("@app.post('/api/create/transform'")),
        Check("M6-4", "M6 AI创作坊", "创作历史接口", lambda: main_has("@app.get('/api/create/history'")),
        Check("M6-5", "M6 AI创作坊", "创作公开广场接口", lambda: main_has("@app.get('/api/create/public'")),
        Check("M6-6", "M6 AI创作坊", "创作公开字段迁移", lambda: migration_exists("011_creations_public_visibility.sql")),
        Check("M6-7", "M6 AI创作坊", "点赞迁移", lambda: migration_exists("012_creation_likes.sql")),
        Check("M6-8", "M6 AI创作坊", "前端创作页", lambda: page_exists("Create.tsx")),
        # M7
        Check("M7-1", "M7 知识图谱", "个人图谱接口", lambda: main_has("@app.get('/api/graph/personal'")),
        Check("M7-2", "M7 知识图谱", "诗人图谱接口", lambda: main_has("@app.get('/api/graph/poets'")),
        Check("M7-3", "M7 知识图谱", "时间轴接口", lambda: main_has("@app.get('/api/graph/timeline'")),
        Check("M7-4", "M7 知识图谱", "意象接口", lambda: main_has("@app.get('/api/graph/imagery'")),
        Check("M7-5", "M7 知识图谱", "节点联动诗词接口", lambda: main_has("@app.get('/api/graph/node-poems'")),
        Check("M7-6", "M7 知识图谱", "前端图谱页", lambda: page_exists("Graph.tsx")),
    ]


def module_status(rate: float) -> str:
    if rate >= 0.85:
        return "已完成"
    if rate >= 0.5:
        return "部分完成"
    return "未完成"


def run() -> int:
    checks = build_checks()
    results: List[Dict[str, object]] = []

    for item in checks:
        ok = False
        try:
            ok = item.check()
        except Exception:
            ok = False
        results.append(
            {
                "id": item.id,
                "module": item.module,
                "name": item.name,
                "ok": ok,
            }
        )

    module_map: Dict[str, List[Dict[str, object]]] = {}
    for row in results:
        module_map.setdefault(str(row["module"]), []).append(row)

    module_rows: List[Dict[str, object]] = []
    for module, items in sorted(module_map.items()):
        total = len(items)
        done = len([x for x in items if x["ok"]])
        rate = done / total if total else 0
        module_rows.append(
            {
                "module": module,
                "done": done,
                "total": total,
                "rate": round(rate * 100, 1),
                "status": module_status(rate),
            }
        )

    total_checks = len(results)
    total_done = len([x for x in results if x["ok"]])
    total_rate = round((total_done / total_checks) * 100, 1) if total_checks else 0.0

    now = datetime.now()
    date_token = now.strftime("%Y-%m-%d")
    ts_token = now.strftime("%Y%m%d-%H%M%S")

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    md_path = DOCS_DIR / f"项目功能完成度审计_{date_token}.md"
    json_path = LOGS_DIR / f"progress-audit-{ts_token}.json"

    missing_rows = [x for x in results if not x["ok"]]

    lines: List[str] = []
    lines.append(f"# 项目功能完成度自动审计（{date_token}）")
    lines.append("")
    lines.append("## 总览")
    lines.append("")
    lines.append(f"- 审计时间：{now.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("- 审计方式：静态代码证据检查（后端路由 + 前端页面 + Supabase迁移）")
    lines.append(f"- 总检查项：{total_checks}")
    lines.append(f"- 通过项：{total_done}")
    lines.append(f"- 完成率：{total_rate}%")
    lines.append("")

    lines.append("## 模块完成度（M1-M7）")
    lines.append("")
    lines.append("| 模块 | 状态 | 通过/总数 | 完成率 |")
    lines.append("| --- | --- | --- | --- |")
    for row in module_rows:
        lines.append(f"| {row['module']} | {row['status']} | {row['done']}/{row['total']} | {row['rate']}% |")
    lines.append("")

    lines.append("## 未通过检查项")
    lines.append("")
    if not missing_rows:
        lines.append("- 无，所有检查项均通过。")
    else:
        for row in missing_rows:
            lines.append(f"- [{row['id']}] {row['module']} - {row['name']}")
    lines.append("")

    lines.append("## 说明")
    lines.append("")
    lines.append("- 该报告用于快速定位功能缺口，不替代接口联调与人工验收。")
    lines.append("- 如需联调验证，请结合 `npm run smoke:api` 和页面手工走查。")

    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    payload = {
        "generatedAt": now.isoformat(),
        "summary": {
            "totalChecks": total_checks,
            "totalPassed": total_done,
            "completionRate": total_rate,
        },
        "modules": module_rows,
        "checks": results,
        "outputs": {
            "markdown": str(md_path),
            "json": str(json_path),
        },
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Progress audit finished.\nMarkdown: {md_path}\nJSON: {json_path}\nCompletion: {total_done}/{total_checks} ({total_rate}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())

