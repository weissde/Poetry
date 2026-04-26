from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from ..schemas import (
    TeachingSessionCreateRequest,
    TeachingSessionEndRequest,
    TeachingSessionStepUpdateRequest,
    TeachingUnitCreateRequest,
    TeachingUnitUpdateRequest,
)
from ..supabase_client import get_supabase_admin

TEACHING_UNIT_SELECT = (
    "id,title,subtitle,category,grade_level,poem_ids,curriculum_ref,"
    "mastery_target,display_order,is_active,created_at,updated_at"
)
CLASS_SESSION_SELECT = (
    "id,teacher_id,poem_id,poem_title,poem_author,unit_id,current_step,status,notes,"
    "duration_minutes,started_at,ended_at,created_at,updated_at"
)
POEM_TEACHING_SELECT = (
    "id,title,curriculum_unit,teaching_objectives,inquiry_tasks,exam_points,"
    "difficulty_level,period_estimate_minutes,updated_at"
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm_text(value: Any) -> str:
    return str(value or "").strip()


def _safe_text_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if isinstance(item, str) and str(item).strip()]


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_uuid_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item or "").strip()]


def _normalize_teaching_objectives(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, str):
            detail = _norm_text(item)
            if detail:
                normalized.append(
                    {
                        "title": "教学目标",
                        "summary": detail,
                        "goals": [detail],
                        "teacherHint": "",
                    }
                )
            continue

        row = _safe_dict(item)
        if not row:
            continue

        title = _norm_text(row.get("title")) or "教学目标"
        summary = (
            _norm_text(row.get("summary"))
            or _norm_text(row.get("detail"))
            or _norm_text(row.get("description"))
        )
        goals = _safe_text_list(row.get("goals"))
        if not goals and summary:
            goals = [summary]
        teacher_hint = _norm_text(row.get("teacherHint")) or _norm_text(row.get("hint"))

        normalized.append(
            {
                "title": title,
                "summary": summary,
                "goals": goals,
                "teacherHint": teacher_hint,
            }
        )

    return normalized


def _normalize_inquiry_tasks(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, str):
            prompt = _norm_text(item)
            if prompt:
                normalized.append(
                    {
                        "title": "探究任务",
                        "prompt": prompt,
                        "presetQuestions": [],
                        "completionCta": "进入练习",
                    }
                )
            continue

        row = _safe_dict(item)
        if not row:
            continue

        title = _norm_text(row.get("title")) or "探究任务"
        prompt = (
            _norm_text(row.get("prompt"))
            or _norm_text(row.get("detail"))
            or _norm_text(row.get("description"))
        )
        preset_questions = _safe_text_list(row.get("presetQuestions"))
        if not preset_questions:
            preset_questions = _safe_text_list(row.get("questions"))
        completion_cta = _norm_text(row.get("completionCta")) or "进入练习"

        normalized.append(
            {
                "title": title,
                "prompt": prompt,
                "presetQuestions": preset_questions,
                "completionCta": completion_cta,
            }
        )

    return normalized


def _normalize_exam_points(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, str]] = []
    for item in value:
        if isinstance(item, dict):
            point_type = _norm_text(item.get("type")) or "考点"
            content = _norm_text(item.get("content"))
            if content:
                normalized.append({"type": point_type, "content": content})
        elif isinstance(item, str):
            content = _norm_text(item)
            if content:
                normalized.append({"type": "考点", "content": content})
    return normalized


def _teaching_unit_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _norm_text(row.get("id")),
        "title": _norm_text(row.get("title")),
        "subtitle": _norm_text(row.get("subtitle")),
        "category": _norm_text(row.get("category")),
        "gradeLevel": _safe_text_list(row.get("grade_level")),
        "poemIds": _safe_uuid_list(row.get("poem_ids")),
        "curriculumRef": _norm_text(row.get("curriculum_ref")),
        "masteryTarget": int(row.get("mastery_target") or 0),
        "displayOrder": int(row.get("display_order") or 0),
        "isActive": bool(row.get("is_active")),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _class_session_payload(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(row, dict):
        return None
    return {
        "id": _norm_text(row.get("id")),
        "teacherId": _norm_text(row.get("teacher_id")),
        "poemId": _norm_text(row.get("poem_id")),
        "poemTitle": _norm_text(row.get("poem_title")),
        "poemAuthor": _norm_text(row.get("poem_author")),
        "unitId": _norm_text(row.get("unit_id")),
        "currentStep": int(row.get("current_step") or 0),
        "status": _norm_text(row.get("status")) or "active",
        "notes": _norm_text(row.get("notes")),
        "durationMinutes": int(row.get("duration_minutes") or 0) if row.get("duration_minutes") is not None else None,
        "startedAt": row.get("started_at"),
        "endedAt": row.get("ended_at"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _poem_teaching_payload(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(row, dict):
        return None
    return {
        "poemId": _norm_text(row.get("id")),
        "poemTitle": _norm_text(row.get("title")),
        "curriculumUnit": _norm_text(row.get("curriculum_unit")),
        "teachingObjectives": _normalize_teaching_objectives(row.get("teaching_objectives")),
        "inquiryTasks": _normalize_inquiry_tasks(row.get("inquiry_tasks")),
        "examPoints": _normalize_exam_points(row.get("exam_points")),
        "difficultyLevel": _norm_text(row.get("difficulty_level")) or "medium",
        "periodEstimateMinutes": int(row.get("period_estimate_minutes") or 40),
        "updatedAt": row.get("updated_at"),
    }


def _get_poem_meta(poem_id: str | None) -> dict[str, str | None]:
    poem_key = _norm_text(poem_id)
    if not poem_key:
        return {"title": None, "author": None}
    client = get_supabase_admin()
    result = client.table("poems").select("title,author").eq("id", poem_key).limit(1).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        return {"title": None, "author": None}
    title = _norm_text(row.get("title")) or None
    author = _norm_text(row.get("author")) or None
    return {"title": title, "author": author}


def _get_poem_title(poem_id: str | None) -> str | None:
    return _get_poem_meta(poem_id).get("title")


def list_teaching_units(*, grade_level: str | None = None, active_only: bool = True, limit: int = 50) -> list[dict[str, Any]]:
    client = get_supabase_admin()
    query = client.table("teaching_units").select(TEACHING_UNIT_SELECT)
    if active_only:
        query = query.eq("is_active", True)

    normalized_grade = _norm_text(grade_level).lower()
    if normalized_grade:
        query = query.contains("grade_level", [normalized_grade])

    result = query.order("display_order").limit(max(1, min(100, int(limit)))).execute()
    rows = result.data or []
    return [_teaching_unit_payload(row) for row in rows if isinstance(row, dict)]


def get_teaching_unit(unit_id: str) -> dict[str, Any]:
    client = get_supabase_admin()
    result = client.table("teaching_units").select(TEACHING_UNIT_SELECT).eq("id", unit_id).limit(1).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Teaching unit not found")
    return _teaching_unit_payload(row)


def create_teaching_unit(payload: TeachingUnitCreateRequest) -> dict[str, Any]:
    client = get_supabase_admin()
    record = {
        "title": _norm_text(payload.title),
        "subtitle": _norm_text(payload.subtitle) or None,
        "category": _norm_text(payload.category) or "theme",
        "grade_level": [item for item in payload.gradeLevel if _norm_text(item)],
        "poem_ids": [_norm_text(item) for item in payload.poemIds if _norm_text(item)],
        "poem_count": len([item for item in payload.poemIds if _norm_text(item)]),
        "curriculum_ref": _norm_text(payload.curriculumRef) or None,
        "mastery_target": int(payload.masteryTarget),
        "display_order": int(payload.displayOrder),
        "is_active": bool(payload.isActive),
        "updated_at": _now_iso(),
    }
    result = client.table("teaching_units").insert(record).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        raise HTTPException(status_code=500, detail="Teaching unit create failed")
    return _teaching_unit_payload(row)


def update_teaching_unit(unit_id: str, payload: TeachingUnitUpdateRequest) -> dict[str, Any]:
    patch: dict[str, Any] = {"updated_at": _now_iso()}
    if payload.title is not None:
        patch["title"] = _norm_text(payload.title)
    if payload.subtitle is not None:
        patch["subtitle"] = _norm_text(payload.subtitle) or None
    if payload.category is not None:
        patch["category"] = _norm_text(payload.category) or "theme"
    if payload.gradeLevel is not None:
        patch["grade_level"] = [item for item in payload.gradeLevel if _norm_text(item)]
    if payload.poemIds is not None:
        normalized = [_norm_text(item) for item in payload.poemIds if _norm_text(item)]
        patch["poem_ids"] = normalized
        patch["poem_count"] = len(normalized)
    if payload.curriculumRef is not None:
        patch["curriculum_ref"] = _norm_text(payload.curriculumRef) or None
    if payload.masteryTarget is not None:
        patch["mastery_target"] = int(payload.masteryTarget)
    if payload.displayOrder is not None:
        patch["display_order"] = int(payload.displayOrder)
    if payload.isActive is not None:
        patch["is_active"] = bool(payload.isActive)

    client = get_supabase_admin()
    result = client.table("teaching_units").update(patch).eq("id", unit_id).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Teaching unit not found")
    return _teaching_unit_payload(row)


def delete_teaching_unit(unit_id: str) -> None:
    client = get_supabase_admin()
    client.table("teaching_units").delete().eq("id", unit_id).execute()


def replace_teaching_unit_poems(unit_id: str, poem_ids: list[str]) -> dict[str, Any]:
    normalized = [_norm_text(item) for item in poem_ids if _norm_text(item)]
    client = get_supabase_admin()
    result = (
        client.table("teaching_units")
        .update(
            {
                "poem_ids": normalized,
                "poem_count": len(normalized),
                "updated_at": _now_iso(),
            }
        )
        .eq("id", unit_id)
        .execute()
    )
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Teaching unit not found")
    return _teaching_unit_payload(row)


def get_poem_teaching_content(poem_id: str) -> dict[str, Any]:
    client = get_supabase_admin()
    result = client.table("poems").select(POEM_TEACHING_SELECT).eq("id", poem_id).limit(1).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Poem not found")
    return _poem_teaching_payload(row) or {}


def get_latest_class_session(*, teacher_id: str) -> dict[str, Any] | None:
    client = get_supabase_admin()
    active_result = (
        client.table("class_sessions")
        .select(CLASS_SESSION_SELECT)
        .eq("teacher_id", teacher_id)
        .eq("status", "active")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    row = (active_result.data or [None])[0]
    if isinstance(row, dict):
        return _class_session_payload(row)

    latest_result = (
        client.table("class_sessions")
        .select(CLASS_SESSION_SELECT)
        .eq("teacher_id", teacher_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    latest_row = (latest_result.data or [None])[0]
    return _class_session_payload(latest_row)


def create_class_session(*, teacher_id: str, payload: TeachingSessionCreateRequest) -> dict[str, Any]:
    client = get_supabase_admin()
    now_iso = _now_iso()
    poem_meta = _get_poem_meta(payload.poemId)
    poem_title = _norm_text(payload.poemTitle) or poem_meta.get("title")
    poem_author = _norm_text(payload.poemAuthor) or poem_meta.get("author")
    record = {
        "teacher_id": teacher_id,
        "poem_id": _norm_text(payload.poemId) or None,
        "poem_title": poem_title,
        "poem_author": poem_author,
        "unit_id": _norm_text(payload.unitId) or None,
        "current_step": int(payload.currentStep),
        "status": "active",
        "notes": _norm_text(payload.notes) or None,
        "started_at": now_iso,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    result = client.table("class_sessions").insert(record).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        return get_latest_class_session(teacher_id=teacher_id) or {"id": "", "teacherId": teacher_id, "currentStep": int(payload.currentStep)}
    return _class_session_payload(row) or {}


def update_class_session_step(*, teacher_id: str, session_id: str, payload: TeachingSessionStepUpdateRequest) -> dict[str, Any]:
    client = get_supabase_admin()
    existing_result = (
        client.table("class_sessions")
        .select(CLASS_SESSION_SELECT)
        .eq("id", session_id)
        .eq("teacher_id", teacher_id)
        .limit(1)
        .execute()
    )
    existing_row = (existing_result.data or [None])[0]
    if not isinstance(existing_row, dict):
        raise HTTPException(status_code=404, detail="Class session not found")

    poem_id = _norm_text(payload.poemId) or _norm_text(existing_row.get("poem_id")) or None
    poem_meta = _get_poem_meta(poem_id)
    poem_title = _norm_text(payload.poemTitle) or poem_meta.get("title") or _norm_text(existing_row.get("poem_title")) or None
    poem_author = _norm_text(payload.poemAuthor) or poem_meta.get("author") or _norm_text(existing_row.get("poem_author")) or None
    update_payload = {
        "current_step": int(payload.currentStep),
        "poem_id": poem_id,
        "poem_title": poem_title,
        "poem_author": poem_author,
        "unit_id": _norm_text(payload.unitId) or _norm_text(existing_row.get("unit_id")) or None,
        "notes": _norm_text(payload.notes) or _norm_text(existing_row.get("notes")) or None,
        "updated_at": _now_iso(),
    }
    result = client.table("class_sessions").update(update_payload).eq("id", session_id).eq("teacher_id", teacher_id).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        refreshed_result = (
            client.table("class_sessions")
            .select(CLASS_SESSION_SELECT)
            .eq("id", session_id)
            .eq("teacher_id", teacher_id)
            .limit(1)
            .execute()
        )
        row = (refreshed_result.data or [None])[0]
    return _class_session_payload(row) or {}


def end_class_session(*, teacher_id: str, session_id: str, payload: TeachingSessionEndRequest) -> dict[str, Any]:
    client = get_supabase_admin()
    existing_result = (
        client.table("class_sessions")
        .select(CLASS_SESSION_SELECT)
        .eq("id", session_id)
        .eq("teacher_id", teacher_id)
        .limit(1)
        .execute()
    )
    existing_row = (existing_result.data or [None])[0]
    if not isinstance(existing_row, dict):
        raise HTTPException(status_code=404, detail="Class session not found")

    now = datetime.now(timezone.utc)
    started_at_raw = _norm_text(existing_row.get("started_at"))
    duration_minutes: int | None = None
    if started_at_raw:
        try:
            started_at = datetime.fromisoformat(started_at_raw.replace("Z", "+00:00"))
            duration_minutes = max(0, int((now - started_at).total_seconds() // 60))
        except ValueError:
            duration_minutes = None

    update_payload = {
        "status": "completed",
        "ended_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "duration_minutes": duration_minutes,
        "notes": _norm_text(payload.notes) or _norm_text(existing_row.get("notes")) or None,
    }
    result = client.table("class_sessions").update(update_payload).eq("id", session_id).eq("teacher_id", teacher_id).execute()
    row = (result.data or [None])[0]
    if not isinstance(row, dict):
        refreshed_result = (
            client.table("class_sessions")
            .select(CLASS_SESSION_SELECT)
            .eq("id", session_id)
            .eq("teacher_id", teacher_id)
            .limit(1)
            .execute()
        )
        row = (refreshed_result.data or [None])[0]
    return _class_session_payload(row) or {}
