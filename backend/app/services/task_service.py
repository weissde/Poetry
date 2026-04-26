from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from ..cache import cache_get_json, cache_set_json
from ..schemas import LessonTaskCreateRequest, LessonTaskStatusUpdateRequest
from ..supabase_client import get_supabase_admin

USER_TODAY_TASKS_CACHE_TTL_SECONDS = 30
LESSON_TASKS_CACHE_TTL_SECONDS = 45
LESSON_TASK_SELECT = (
    "id,teacher_id,created_by,target_user_id,session_id,poem_id,poem_title,"
    "title,detail,task_type,task_config,status,to,due_at,due_date,completed_at,created_at,updated_at"
)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _norm_text(value: Any) -> str:
    return str(value or "").strip()


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_iso_datetime(raw: Any) -> datetime | None:
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _extract_poem_relation(raw: Any) -> dict[str, Any] | None:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        return raw[0]
    return None


def _poem_title_from_relation(raw: Any) -> str:
    relation = _extract_poem_relation(raw)
    if not relation:
        return ""
    return _norm_text(relation.get("title"))


def _fallback_task(task_id: str, *, title: str, detail: str, cta: str, to: str) -> dict[str, Any]:
    return {
        "id": task_id,
        "title": title,
        "status": "todo",
        "detail": detail,
        "cta": cta,
        "to": to,
    }


def _append_query_params(to: str, params: dict[str, Any]) -> str:
    target = _norm_text(to) or "/my-learning?tab=plan"
    parts = urlsplit(target)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    for key, value in params.items():
        text = _norm_text(value)
        if text and key not in query:
            query[key] = text
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _safe_date_string(raw: Any) -> str | None:
    if isinstance(raw, date):
        return raw.isoformat()
    if isinstance(raw, str):
        text = raw.strip()
        if text:
            return text[:10]
    return None


def _to_due_at_iso(raw_due_date: Any) -> str | None:
    date_text = _safe_date_string(raw_due_date)
    if not date_text:
        return None
    return f"{date_text}T23:59:59+00:00"


def _normalize_task_status(value: Any) -> str:
    status = _norm_text(value).lower() or "pending"
    if status == "assigned":
        return "pending"
    if status in {"pending", "in_progress", "completed"}:
        return status
    return "pending"


def _normalize_task_type(value: Any) -> str:
    task_type = _norm_text(value).lower() or "practice"
    if task_type in {"learn", "custom"}:
        return "practice"
    if task_type in {"practice", "memory", "exam", "review"}:
        return task_type
    return "practice"


def _lesson_task_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _norm_text(row.get("id")),
        "teacherId": _norm_text(row.get("teacher_id")),
        "createdBy": _norm_text(row.get("created_by")) or _norm_text(row.get("teacher_id")),
        "targetUserId": _norm_text(row.get("target_user_id")),
        "sessionId": _norm_text(row.get("session_id")),
        "poemId": _norm_text(row.get("poem_id")),
        "poemTitle": _norm_text(row.get("poem_title")),
        "title": _norm_text(row.get("title")),
        "detail": _norm_text(row.get("detail")),
        "taskType": _normalize_task_type(row.get("task_type")),
        "taskConfig": row.get("task_config") if isinstance(row.get("task_config"), dict) else {},
        "status": _normalize_task_status(row.get("status")),
        "to": _norm_text(row.get("to")),
        "dueAt": row.get("due_at"),
        "dueDate": _safe_date_string(row.get("due_date")),
        "completedAt": row.get("completed_at"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _lesson_task_to_today_task(row: dict[str, Any]) -> dict[str, Any]:
    task_id = _norm_text(row.get("id")) or "lesson-task"
    status = _norm_text(row.get("status")) or "assigned"
    task_type = _norm_text(row.get("task_type")) or "custom"
    due_date = _safe_date_string(row.get("due_date"))
    detail = _norm_text(row.get("detail")) or "教师已布置新任务，建议优先完成。"
    if due_date:
        detail = f"{detail} 截止日期：{due_date}。"
    to = _append_query_params(
        _norm_text(row.get("to")) or "/my-learning?tab=plan",
        {"source": "lesson_task", "lessonTaskId": task_id},
    )
    return {
        "id": task_id,
        "lessonTaskId": task_id,
        "source": "lesson_task",
        "title": _norm_text(row.get("title")) or "教师布置任务",
        "status": "done" if status == "completed" else "todo",
        "detail": detail,
        "cta": "查看",
        "to": to,
        "dueDate": due_date,
        "taskType": task_type,
    }


async def list_lesson_tasks(
    *,
    user_id: str,
    target_user_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    normalized_target_user_id = _norm_text(target_user_id)
    cache_key = f"lesson-tasks:{user_id}:{normalized_target_user_id or 'self'}:{max(1, limit)}:v1"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    client = get_supabase_admin()
    query = client.table("lesson_tasks").select(LESSON_TASK_SELECT)
    if normalized_target_user_id:
        query = query.eq("teacher_id", user_id).eq("target_user_id", normalized_target_user_id)
    else:
        query = query.eq("target_user_id", user_id)
    result = query.order("created_at", desc=True).limit(max(1, min(100, int(limit)))).execute()
    items = [_lesson_task_payload(row) for row in (result.data or []) if isinstance(row, dict)]
    payload = {"items": items}
    await cache_set_json(cache_key, payload, ttl_seconds=LESSON_TASKS_CACHE_TTL_SECONDS)
    return payload


def create_lesson_task(*, teacher_id: str, payload: LessonTaskCreateRequest) -> dict[str, Any]:
    client = get_supabase_admin()
    now_iso = _now_utc().isoformat()
    normalized_status = _normalize_task_status(payload.status)
    completed_at = now_iso if normalized_status == "completed" else None
    target_user_id = _norm_text(payload.targetUserId) or teacher_id
    record = {
        "teacher_id": teacher_id,
        "created_by": teacher_id,
        "target_user_id": target_user_id,
        "poem_id": _norm_text(payload.poemId) or None,
        "poem_title": None,
        "title": _norm_text(payload.title),
        "detail": _norm_text(payload.detail) or None,
        "task_type": _normalize_task_type(payload.taskType),
        "task_config": {},
        "status": normalized_status,
        "to": _norm_text(payload.to) or None,
        "due_at": _to_due_at_iso(payload.dueDate),
        "due_date": _safe_date_string(payload.dueDate),
        "completed_at": completed_at,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    result = client.table("lesson_tasks").insert(record).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        return {"id": "", "teacherId": teacher_id, "status": normalized_status}
    return _lesson_task_payload(row)


def update_lesson_task_status(*, actor_id: str, task_id: str, payload: LessonTaskStatusUpdateRequest) -> dict[str, Any]:
    client = get_supabase_admin()
    existing_result = client.table("lesson_tasks").select(LESSON_TASK_SELECT).eq("id", task_id).limit(1).execute()
    existing_row = (existing_result.data or [None])[0]
    if not isinstance(existing_row, dict):
        raise ValueError("Lesson task not found")

    teacher_id = _norm_text(existing_row.get("teacher_id")) or _norm_text(existing_row.get("created_by"))
    target_user_id = _norm_text(existing_row.get("target_user_id"))
    if actor_id not in {teacher_id, target_user_id}:
        raise PermissionError("Forbidden")

    normalized_status = _normalize_task_status(payload.status)
    update_payload = {
        "status": normalized_status,
        "updated_at": _now_utc().isoformat(),
        "completed_at": _now_utc().isoformat() if normalized_status == "completed" else None,
    }
    result = client.table("lesson_tasks").update(update_payload).eq("id", task_id).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        refreshed_result = client.table("lesson_tasks").select(LESSON_TASK_SELECT).eq("id", task_id).limit(1).execute()
        row = (refreshed_result.data or [None])[0]
    return _lesson_task_payload(row if isinstance(row, dict) else existing_row)


async def get_today_tasks(user_id: str) -> dict[str, Any]:
    cache_key = f"user-today-tasks:{user_id}:v3"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    client = get_supabase_admin()
    now = _now_utc()
    today_iso = now.date().isoformat()
    since_3d = now - timedelta(days=3)

    tasks: list[dict[str, Any]] = []
    due_memory_count = 0
    pending_wrong_count = 0

    try:
        lesson_task_result = (
            client.table("lesson_tasks")
            .select("id,title,detail,task_type,status,to,due_date")
            .eq("target_user_id", user_id)
            .neq("status", "completed")
            .order("due_date")
            .order("created_at", desc=True)
            .limit(2)
            .execute()
        )
        for row in lesson_task_result.data or []:
            if not isinstance(row, dict):
                continue
            tasks.append(_lesson_task_to_today_task(row))
    except Exception:
        pass

    try:
        recent_answer_result = (
            client.table("user_answers")
            .select("poem_id,created_at,poems(title)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        recent_answer = (recent_answer_result.data or [None])[0]
        if isinstance(recent_answer, dict):
            created_at = _parse_iso_datetime(recent_answer.get("created_at"))
            poem_id = _norm_text(recent_answer.get("poem_id"))
            poem_title = _poem_title_from_relation(recent_answer.get("poems"))
            if created_at is not None and created_at >= since_3d and poem_id:
                tasks.append(
                    {
                        "id": "recent-learn",
                        "title": f"继续《{poem_title or '最近学习诗词'}》精讲",
                        "status": "done",
                        "detail": "最近已经完成一轮学习，可直接回到精讲页继续探究、记忆或考点梳理。",
                        "cta": "继续",
                        "to": f"/learn/{poem_id}",
                    }
                )
    except Exception:
        pass

    try:
        practice_result = (
            client.table("practice_session_summaries")
            .select("topic,accuracy,attempts,weak_type,created_at")
            .eq("user_id", user_id)
            .lt("accuracy", 70)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        practice_row = (practice_result.data or [None])[0]
        if isinstance(practice_row, dict):
            topic = _norm_text(practice_row.get("topic")) or "本周薄弱专题"
            accuracy = _safe_int(practice_row.get("accuracy"))
            attempts = max(5, min(10, _safe_int(practice_row.get("attempts"), default=8)))
            weak_type = _norm_text(practice_row.get("weak_type"))
            detail = f"最近一次练测准确率 {accuracy}%。"
            if weak_type:
                detail += f" 建议优先补强“{weak_type}”。"
            tasks.append(
                {
                    "id": "practice-retry",
                    "title": f"完成《{topic}》练习题 {attempts} 道",
                    "status": "todo",
                    "detail": detail,
                    "cta": "开始",
                    "to": f"/practice?entry=practice&topic={topic}&count={attempts}&difficulty=medium&auto=1",
                }
            )
    except Exception:
        pass

    try:
        wrong_result = (
            client.table("wrong_questions")
            .select("poem_title", count="planned")
            .eq("user_id", user_id)
            .eq("status", "pending")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        pending_wrong_count = max(0, int(wrong_result.count or 0))
        wrong_row = (wrong_result.data or [None])[0]
        wrong_poem_title = _norm_text(wrong_row.get("poem_title")) if isinstance(wrong_row, dict) else ""
        if pending_wrong_count > 0:
            title = "复习错题专项"
            if wrong_poem_title:
                title = f"复习《{wrong_poem_title}》相关错题"
            tasks.append(
                {
                    "id": "wrongbook-review",
                    "title": title,
                    "status": "todo",
                    "detail": f"当前仍有 {pending_wrong_count} 道待消化错题，建议先回到错题本完成一轮整理。",
                    "cta": "开始",
                    "to": "/my-learning?tab=wrongbook",
                }
            )
    except Exception:
        pending_wrong_count = 0

    try:
        memory_result = (
            client.table("memory_reviews")
            .select("poem_id,due_date,poems(title)")
            .eq("user_id", user_id)
            .lte("due_date", today_iso)
            .order("due_date")
            .limit(1)
            .execute()
        )
        due_count_result = (
            client.table("memory_reviews")
            .select("id", count="planned")
            .eq("user_id", user_id)
            .lte("due_date", today_iso)
            .execute()
        )
        due_memory_count = max(0, int(due_count_result.count or 0))
        memory_row = (memory_result.data or [None])[0]
        memory_poem_title = _poem_title_from_relation(memory_row.get("poems")) if isinstance(memory_row, dict) else ""
        if due_memory_count > 0:
            detail = f"今天有 {due_memory_count} 首诗待复习。"
            if memory_poem_title:
                detail += f" 可先从《{memory_poem_title}》开始。"
            tasks.append(
                {
                    "id": "memory-review",
                    "title": "进行记忆训练",
                    "status": "todo",
                    "detail": detail,
                    "cta": "开始",
                    "to": "/memory",
                }
            )
    except Exception:
        due_memory_count = 0

    seen_ids: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in tasks:
        task_id = _norm_text(item.get("id"))
        if not task_id or task_id in seen_ids:
            continue
        seen_ids.add(task_id)
        deduped.append(item)

    fill_items = [
        _fallback_task(
            "learn-entry",
            title="进入今日精讲",
            detail="还没有生成个性化任务时，先回到精讲页启动今天的学习主线。",
            cta="进入",
            to="/learn",
        ),
        _fallback_task(
            "explore-entry",
            title="浏览课程单元",
            detail="从课程单元或主题入口选择下一首诗，继续扩展今天的学习范围。",
            cta="进入",
            to="/explore",
        ),
        _fallback_task(
            "summary-entry",
            title="查看我的学情",
            detail="把练测、错题、记忆和创作结果统一收口到学情页。",
            cta="查看",
            to="/my-learning?tab=overview",
        ),
    ]
    for item in fill_items:
        if len(deduped) >= 3:
            break
        if item["id"] in seen_ids:
            continue
        deduped.append(item)
        seen_ids.add(item["id"])

    payload = {
        "items": deduped[:3],
        "summary": {
            "total": len(deduped[:3]),
            "todo": sum(1 for item in deduped[:3] if _norm_text(item.get("status")) == "todo"),
            "done": sum(1 for item in deduped[:3] if _norm_text(item.get("status")) == "done"),
            "dueMemoryCount": due_memory_count,
            "pendingWrongCount": pending_wrong_count,
        },
    }

    await cache_set_json(cache_key, payload, ttl_seconds=USER_TODAY_TASKS_CACHE_TTL_SECONDS)
    return payload
