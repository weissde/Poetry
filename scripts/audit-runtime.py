from __future__ import annotations

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
LOGS_DIR = ROOT / "logs"

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
BEARER_TOKEN = os.getenv("PROFILE_BEARER_TOKEN", "").strip()
SUPABASE_URL = os.getenv("PROFILE_SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("PROFILE_SUPABASE_ANON_KEY", "").strip()
PROFILE_EMAIL = os.getenv("PROFILE_EMAIL", "").strip()
PROFILE_PASSWORD = os.getenv("PROFILE_PASSWORD", "").strip()
TIMEOUT_SEC = int(os.getenv("RUNTIME_AUDIT_TIMEOUT_SEC", "10"))
_RESOLVED_TOKEN: Optional[str] = None
_TOKEN_RESOLVE_REASON: str = ""
REQUEST_RETRIES = max(0, int(os.getenv("RUNTIME_AUDIT_RETRIES", "1")))

STEP_TIMEOUT_OVERRIDES: Dict[str, int] = {
    "poems_search": 25,
    "poems_search_grade_primary": 25,
    "graph_poets": 20,
    "graph_imagery": 20,
    "graph_timeline": 20,
}

PUBLIC_STEPS = [
    ("health", "GET", "/api/health"),
    ("poems_search", "GET", "/api/poems/search?page=1&pageSize=1"),
    ("poems_search_grade_primary", "GET", "/api/poems/search?page=1&pageSize=5&gradeLevel=primary"),
    ("graph_poets", "GET", "/api/graph/poets"),
    ("graph_imagery", "GET", "/api/graph/imagery"),
    ("graph_timeline", "GET", "/api/graph/timeline"),
]

AUTH_STEPS = [
    ("weakness_profile", "GET", "/api/weakness/profile"),
    ("memory_stats", "GET", "/api/memory/stats"),
    ("review_plan_latest", "GET", "/api/review-plan/latest"),
    ("nav_pending_summary", "GET", "/api/nav/pending-summary"),
    ("wrongbook_dashboard", "GET", "/api/wrongbook/dashboard?page=1&pageSize=10"),
    ("exam_history", "GET", "/api/exam/history?page=1&pageSize=5"),
    ("create_history", "GET", "/api/create/history?page=1&pageSize=5"),
]

EXAM_TEMPLATE_CHECKS = [
    {
        "name": "exam_template_zhongkao_foundation",
        "payload": {
            "mode": "zhongkao",
            "topic": "古诗词基础巩固",
            "count": 8,
            "durationMinutes": 60,
            "templateId": "zhongkao_foundation",
            "subjectiveRatio": 0.25,
        },
    },
    {
        "name": "exam_template_subjective_repair",
        "payload": {
            "mode": "custom",
            "topic": "主观赏析专项修复",
            "count": 8,
            "durationMinutes": 75,
            "templateId": "subjective_repair",
            "subjectiveRatio": 0.75,
        },
    },
]


def request_json(method: str, path: str, token: str = "", payload: Any = None, timeout_sec: Optional[int] = None) -> Dict[str, Any]:
    url = f"{BACKEND_BASE_URL}{path}"
    effective_timeout = max(3, int(timeout_sec or TIMEOUT_SEC))
    headers = {"Accept": "application/json"}
    body_bytes = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = Request(url=url, method=method, headers=headers, data=body_bytes)
    start = time.perf_counter()
    try:
        with urlopen(req, timeout=effective_timeout) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            status = int(getattr(resp, "status", 200))
            try:
                body = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                body = {}
            ok = isinstance(body, dict) and body.get("code") == 0
            return {
                "ok": ok,
                "status": status,
                "elapsedMs": elapsed_ms,
                "message": "" if ok else "api code != 0",
                "body": body,
                "url": url,
            }
    except HTTPError as exc:
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "ok": False,
            "status": int(exc.code),
            "elapsedMs": elapsed_ms,
            "message": f"HTTPError: {exc.reason}",
            "body": {},
            "url": url,
        }
    except URLError as exc:
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "ok": False,
            "status": 0,
            "elapsedMs": elapsed_ms,
            "message": f"URLError: {exc.reason}",
            "body": {},
            "url": url,
        }
    except Exception as exc:  # noqa: BLE001
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "ok": False,
            "status": 0,
            "elapsedMs": elapsed_ms,
            "message": str(exc),
            "body": {},
            "url": url,
        }


def resolve_bearer_token() -> str:
    global _RESOLVED_TOKEN, _TOKEN_RESOLVE_REASON
    if _RESOLVED_TOKEN is not None:
        return _RESOLVED_TOKEN

    if BEARER_TOKEN:
        _RESOLVED_TOKEN = BEARER_TOKEN
        _TOKEN_RESOLVE_REASON = "using PROFILE_BEARER_TOKEN"
        return _RESOLVED_TOKEN

    if not (SUPABASE_URL and SUPABASE_ANON_KEY and PROFILE_EMAIL and PROFILE_PASSWORD):
        _RESOLVED_TOKEN = ""
        missing = []
        if not SUPABASE_URL:
            missing.append("PROFILE_SUPABASE_URL")
        if not SUPABASE_ANON_KEY:
            missing.append("PROFILE_SUPABASE_ANON_KEY")
        if not PROFILE_EMAIL:
            missing.append("PROFILE_EMAIL")
        if not PROFILE_PASSWORD:
            missing.append("PROFILE_PASSWORD")
        _TOKEN_RESOLVE_REASON = f"missing env: {', '.join(missing)}"
        return ""

    url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password"
    payload = json.dumps({"email": PROFILE_EMAIL, "password": PROFILE_PASSWORD}).encode("utf-8")
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    req = Request(url=url, method="POST", headers=headers, data=payload)
    try:
        with urlopen(req, timeout=max(8, TIMEOUT_SEC)) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            body = json.loads(raw) if raw else {}
            token = str(body.get("access_token", "")).strip()
            _RESOLVED_TOKEN = token
            if token:
                _TOKEN_RESOLVE_REASON = "resolved via Supabase password grant"
            else:
                _TOKEN_RESOLVE_REASON = "supabase auth returned empty access_token"
            return _RESOLVED_TOKEN
    except Exception as exc:  # noqa: BLE001
        _RESOLVED_TOKEN = ""
        _TOKEN_RESOLVE_REASON = f"supabase auth request failed: {exc}"
        return ""


def run_step(name: str, method: str, path: str, requires_auth: bool) -> Dict[str, Any]:
    token = resolve_bearer_token()
    if requires_auth and not token:
        reason = _TOKEN_RESOLVE_REASON or "missing PROFILE_BEARER_TOKEN"
        return {
            "name": name,
            "method": method,
            "path": path,
            "requiresAuth": True,
            "status": "SKIPPED",
            "http": 0,
            "elapsedMs": 0,
            "message": f"auth token unavailable ({reason})",
            "url": f"{BACKEND_BASE_URL}{path}",
        }

    step_timeout = STEP_TIMEOUT_OVERRIDES.get(name, TIMEOUT_SEC)
    attempts = max(1, REQUEST_RETRIES + 1)
    out: Dict[str, Any] = {}
    for idx in range(attempts):
        out = request_json(method, path, token=token if requires_auth else "", timeout_sec=step_timeout)
        if out.get("ok") is True:
            break
        if idx >= attempts - 1:
            break
        if out.get("status", 0) != 0:
            break

    return {
        "name": name,
        "method": method,
        "path": path,
        "requiresAuth": requires_auth,
        "status": "OK" if out["ok"] else "FAIL",
        "http": out["status"],
        "elapsedMs": out["elapsedMs"],
        "message": out["message"],
        "url": out["url"],
    }


def run_exam_template_check(name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    token = resolve_bearer_token()
    if not token:
        reason = _TOKEN_RESOLVE_REASON or "missing PROFILE_BEARER_TOKEN"
        return {
            "name": name,
            "method": "POST",
            "path": "/api/exam/create",
            "requiresAuth": True,
            "status": "SKIPPED",
            "http": 0,
            "elapsedMs": 0,
            "message": f"auth token unavailable ({reason})",
            "url": f"{BACKEND_BASE_URL}/api/exam/create",
            "checks": {
                "templateHit": False,
                "subjectiveTargetAchieved": False,
            },
        }

    out = request_json("POST", "/api/exam/create", token=token, payload=payload)
    status = "FAIL"
    message = out.get("message") or ""
    checks = {
        "templateHit": False,
        "subjectiveTargetAchieved": False,
    }

    if out["ok"]:
        body = out.get("body") if isinstance(out.get("body"), dict) else {}
        data = body.get("data") if isinstance(body, dict) else {}
        session = data.get("session") if isinstance(data, dict) else {}
        composition = session.get("composition") if isinstance(session, dict) else {}
        actual_template = str(session.get("templateId", "") or "")
        expected_template = str(payload.get("templateId", "") or "")
        required = int(session.get("subjectiveRequired") or 0)
        subjective_count = int(composition.get("subjectiveCount") or 0)
        total_count = int(composition.get("total") or 0)
        ratio = float(composition.get("subjectiveRatio") or 0.0)

        checks["templateHit"] = bool(actual_template and actual_template == expected_template)
        checks["subjectiveTargetAchieved"] = bool(required >= 0 and subjective_count >= required)
        if checks["templateHit"] and checks["subjectiveTargetAchieved"]:
            status = "OK"
            message = (
                f"template={actual_template}, subjective={subjective_count}/{total_count}, "
                f"required={required}, ratio={round(ratio * 100, 1)}%"
            )
        else:
            status = "FAIL"
            message = (
                f"templateHit={checks['templateHit']}, targetAchieved={checks['subjectiveTargetAchieved']}, "
                f"template={actual_template}, subjective={subjective_count}/{total_count}, required={required}"
            )

    return {
        "name": name,
        "method": "POST",
        "path": "/api/exam/create",
        "requiresAuth": True,
        "status": status,
        "http": out["status"],
        "elapsedMs": out["elapsedMs"],
        "message": message,
        "url": out["url"],
        "checks": checks,
    }


def status_count(rows: List[Dict[str, Any]], target: str) -> int:
    return len([x for x in rows if x["status"] == target])


def build_markdown(now: datetime, rows: List[Dict[str, Any]], json_path: Path) -> str:
    total = len(rows)
    ok = status_count(rows, "OK")
    fail = status_count(rows, "FAIL")
    skipped = status_count(rows, "SKIPPED")
    rate = round((ok / total) * 100, 1) if total else 0.0

    lines: List[str] = []
    lines.append(f"# 运行时验收审计（{now.strftime('%Y-%m-%d')}）")
    lines.append("")
    lines.append("## 概览")
    lines.append("")
    lines.append(f"- 审计时间：{now.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"- 后端地址：`{BACKEND_BASE_URL}`")
    lines.append(f"- 超时设置：`{TIMEOUT_SEC}s`")
    token_ready = bool(resolve_bearer_token())
    lines.append(f"- Token状态：{'已提供/已解析' if token_ready else '未提供'}")
    lines.append(f"- 检查结果：OK {ok} / FAIL {fail} / SKIPPED {skipped} / TOTAL {total}")
    lines.append(f"- 通过率：{rate}%")
    lines.append("")
    lines.append("## 逐项结果")
    lines.append("")
    lines.append("| Step | Status | HTTP | ElapsedMs | Notes |")
    lines.append("| --- | --- | --- | --- | --- |")
    for row in rows:
        lines.append(
            f"| {row['name']} | {row['status']} | {row['http']} | {row['elapsedMs']} | {row['message'] or '-'} |"
        )
    lines.append("")
    lines.append("## 说明")
    lines.append("")
    lines.append(f"- JSON 明细：`{json_path}`")
    lines.append("- 若 health 失败，请先执行 `npm run dev` 启动前后端。")
    lines.append("- 若 Auth 项为 SKIPPED，请配置 `PROFILE_BEARER_TOKEN` 后重跑。")
    exam_rows = [row for row in rows if str(row.get("name", "")).startswith("exam_template_")]
    if exam_rows:
        executable = [row for row in exam_rows if row["status"] != "SKIPPED"]
        template_hit_ok = 0
        target_ok = 0
        for row in executable:
            checks = row.get("checks") if isinstance(row.get("checks"), dict) else {}
            if checks.get("templateHit") is True:
                template_hit_ok += 1
            if checks.get("subjectiveTargetAchieved") is True:
                target_ok += 1
        total_exec = len(executable)
        template_hit_rate = round((template_hit_ok / total_exec) * 100, 1) if total_exec else 0.0
        target_rate = round((target_ok / total_exec) * 100, 1) if total_exec else 0.0
        lines.append("")
        lines.append("## 考试模板质量")
        lines.append("")
        lines.append(f"- 模板命中率：{template_hit_ok}/{total_exec}（{template_hit_rate}%）")
        lines.append(f"- 主观题目标达成率：{target_ok}/{total_exec}（{target_rate}%）")

    return "\n".join(lines) + "\n"


def main() -> int:
    now = datetime.now()
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    token = resolve_bearer_token()
    rows: List[Dict[str, Any]] = []
    for name, method, path in PUBLIC_STEPS:
        rows.append(run_step(name, method, path, requires_auth=False))
    for name, method, path in AUTH_STEPS:
        rows.append(run_step(name, method, path, requires_auth=True))
    for exam_check in EXAM_TEMPLATE_CHECKS:
        rows.append(run_exam_template_check(exam_check["name"], exam_check["payload"]))

    exam_rows = [row for row in rows if str(row.get("name", "")).startswith("exam_template_")]
    executable_exam_rows = [row for row in exam_rows if row.get("status") != "SKIPPED"]
    template_hit_ok = 0
    target_ok = 0
    for row in executable_exam_rows:
        checks = row.get("checks") if isinstance(row.get("checks"), dict) else {}
        if checks.get("templateHit") is True:
            template_hit_ok += 1
        if checks.get("subjectiveTargetAchieved") is True:
            target_ok += 1
    exam_total = len(executable_exam_rows)
    template_hit_rate = round((template_hit_ok / exam_total) * 100, 1) if exam_total else 0.0
    subjective_target_rate = round((target_ok / exam_total) * 100, 1) if exam_total else 0.0

    date_token = now.strftime("%Y-%m-%d")
    ts_token = now.strftime("%Y%m%d-%H%M%S")
    md_path = DOCS_DIR / f"运行时验收审计_{date_token}.md"
    json_path = LOGS_DIR / f"runtime-audit-{ts_token}.json"

    payload = {
        "generatedAt": now.isoformat(),
        "backendBaseUrl": BACKEND_BASE_URL,
        "timeoutSec": TIMEOUT_SEC,
        "tokenProvided": bool(token),
        "steps": rows,
        "summary": {
            "ok": status_count(rows, "OK"),
            "fail": status_count(rows, "FAIL"),
            "skipped": status_count(rows, "SKIPPED"),
            "total": len(rows),
            "examTemplateChecks": exam_total,
            "examTemplateHitRate": template_hit_rate,
            "examSubjectiveTargetRate": subjective_target_rate,
        },
        "outputs": {
            "markdown": str(md_path),
            "json": str(json_path),
        },
    }

    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_markdown(now, rows, json_path), encoding="utf-8")

    print(
        "Runtime audit finished.\n"
        f"Markdown: {md_path}\n"
        f"JSON: {json_path}\n"
        f"Summary: OK={payload['summary']['ok']}, FAIL={payload['summary']['fail']}, SKIPPED={payload['summary']['skipped']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
