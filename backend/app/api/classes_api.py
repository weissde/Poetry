from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from ..auth import CurrentUser, get_current_user
from ..response import fail, ok
from ..schemas import ClassCreateRequest, ClassJoinRequest, ClassUpdateRequest
from ..schemas import LessonTaskCreateRequest
from ..services.cache_invalidation import _invalidate_learning_cache
from ..services.summary_service import get_user_role
from ..services.task_service import LESSON_TASK_SELECT, _lesson_task_payload, create_lesson_task
from ..supabase_client import get_supabase_admin

router = APIRouter(prefix="/api/classes", tags=["classes"])


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _norm_text(value: Any) -> str:
    return str(value or "").strip()


def _classes_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail(
            "classes tables are not ready. Please run migration 024_classes.sql and 025_class_members.sql first.",
            _trace_id(request),
            code=5317,
        ),
    )


async def _ensure_teacher(user: CurrentUser) -> None:
    payload = await get_user_role(user.id)
    role = str(payload.get("role") or "student").lower()
    if role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher role required")


def _class_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _norm_text(row.get("id")),
        "name": _norm_text(row.get("name")),
        "description": _norm_text(row.get("description")),
        "teacherId": _norm_text(row.get("teacher_id")),
        "inviteCode": _norm_text(row.get("invite_code")),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _count_text(rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for row in rows:
        value = _norm_text(row.get(key))
        if value:
            counts[value] = counts.get(value, 0) + 1
    return [{"label": key, "value": value, "count": count} for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))]


def _count_tags(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for row in rows:
        raw_tags = row.get("keyword_tags")
        if not isinstance(raw_tags, list):
            continue
        for raw_tag in raw_tags:
            value = _norm_text(raw_tag)
            if value:
                counts[value] = counts.get(value, 0) + 1
    return [{"label": "keyword_tags", "value": value, "count": count} for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))]


async def _class_student_ids(client: Any, class_id: str) -> list[str]:
    member_rows = client.table("class_members").select("user_id").eq("class_id", class_id).execute().data or []
    return [
        _norm_text(row.get("user_id"))
        for row in member_rows
        if isinstance(row, dict) and _norm_text(row.get("user_id"))
    ]


@router.get("")
async def classes_list(request: Request, user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()
    try:
        role_payload = await get_user_role(user.id)
        role = str(role_payload.get("role") or "student").lower()
        if role == "teacher":
            result = client.table("classes").select("*").eq("teacher_id", user.id).order("created_at", desc=True).execute()
            rows = result.data or []
        else:
            member_result = client.table("class_members").select("class_id").eq("user_id", user.id).execute()
            class_ids = [row.get("class_id") for row in (member_result.data or []) if isinstance(row, dict) and row.get("class_id")]
            if not class_ids:
                rows = []
            else:
                result = client.table("classes").select("*").in_("id", class_ids).order("created_at", desc=True).execute()
                rows = result.data or []
    except Exception:
        return _classes_table_error(request)
    return ok({"items": [_class_payload(row) for row in rows if isinstance(row, dict)]}, _trace_id(request))


@router.post("")
async def classes_create(
    payload: ClassCreateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    try:
        result = (
            client.table("classes")
            .insert(
                {
                    "name": _norm_text(payload.name),
                    "description": _norm_text(payload.description) or None,
                    "teacher_id": user.id,
                    "invite_code": secrets.token_hex(3).upper(),
                    "created_at": now,
                    "updated_at": now,
                }
            )
            .execute()
        )
        row = (result.data or [None])[0]
    except Exception:
        return _classes_table_error(request)
    return ok({"item": _class_payload(row if isinstance(row, dict) else {})}, _trace_id(request))


@router.post("/join")
async def classes_join_by_code(
    payload: ClassJoinRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    invite_code = _norm_text(payload.inviteCode).upper()
    try:
        row = (client.table("classes").select("*").eq("invite_code", invite_code).limit(1).execute().data or [None])[0]
    except Exception:
        return _classes_table_error(request)
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Class not found")
    class_id = _norm_text(row.get("id"))
    try:
        client.table("class_members").upsert(
            {
                "class_id": class_id,
                "user_id": user.id,
                "role": "student",
            },
            on_conflict="class_id,user_id",
        ).execute()
    except Exception:
        return _classes_table_error(request)
    return ok({"joined": True, "classId": class_id, "item": _class_payload(row)}, _trace_id(request))


@router.get("/{class_id}")
async def classes_detail(class_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()
    try:
        row = (client.table("classes").select("*").eq("id", class_id).limit(1).execute().data or [None])[0]
    except Exception:
        return _classes_table_error(request)
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Class not found")
    if _norm_text(row.get("teacher_id")) != user.id:
        member = (
            client.table("class_members")
            .select("id")
            .eq("class_id", class_id)
            .eq("user_id", user.id)
            .limit(1)
            .execute()
        )
        if not (member.data or []):
            raise HTTPException(status_code=403, detail="Forbidden")
    return ok({"item": _class_payload(row)}, _trace_id(request))


@router.put("/{class_id}")
async def classes_update(
    class_id: str,
    payload: ClassUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    patch: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.name is not None:
        patch["name"] = _norm_text(payload.name)
    if payload.description is not None:
        patch["description"] = _norm_text(payload.description) or None
    try:
        result = client.table("classes").update(patch).eq("id", class_id).eq("teacher_id", user.id).execute()
        row = (result.data or [None])[0]
    except Exception:
        return _classes_table_error(request)
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Class not found")
    return ok({"item": _class_payload(row)}, _trace_id(request))


@router.delete("/{class_id}")
async def classes_delete(class_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    try:
        client.table("classes").delete().eq("id", class_id).eq("teacher_id", user.id).execute()
    except Exception:
        return _classes_table_error(request)
    return ok({"deleted": True, "classId": class_id}, _trace_id(request))


@router.post("/{class_id}/join")
async def classes_join(
    class_id: str,
    payload: ClassJoinRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    try:
        row = (client.table("classes").select("id,invite_code").eq("id", class_id).limit(1).execute().data or [None])[0]
    except Exception:
        return _classes_table_error(request)
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Class not found")
    if _norm_text(row.get("invite_code")).upper() != _norm_text(payload.inviteCode).upper():
        raise HTTPException(status_code=400, detail="Invalid invite code")
    try:
        client.table("class_members").upsert(
            {
                "class_id": class_id,
                "user_id": user.id,
                "role": "student",
            },
            on_conflict="class_id,user_id",
        ).execute()
    except Exception:
        return _classes_table_error(request)
    return ok({"joined": True, "classId": class_id}, _trace_id(request))


@router.get("/{class_id}/students")
async def classes_students(class_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    try:
        owned = client.table("classes").select("id").eq("id", class_id).eq("teacher_id", user.id).limit(1).execute()
        if not (owned.data or []):
            raise HTTPException(status_code=403, detail="Forbidden")
        rows = client.table("class_members").select("id,user_id,role,joined_at").eq("class_id", class_id).order("joined_at").execute()
    except HTTPException:
        raise
    except Exception:
        return _classes_table_error(request)
    return ok({"items": rows.data or []}, _trace_id(request))


@router.get("/{class_id}/summary")
async def classes_summary(class_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    try:
        owned = client.table("classes").select("id,name").eq("id", class_id).eq("teacher_id", user.id).limit(1).execute()
        class_row = (owned.data or [None])[0]
        if not isinstance(class_row, dict):
            raise HTTPException(status_code=403, detail="Forbidden")

        members = client.table("class_members").select("id", count="planned").eq("class_id", class_id).execute()
        member_count = int(members.count or 0)
        student_ids = [
            row.get("user_id")
            for row in (
                client.table("class_members").select("user_id").eq("class_id", class_id).execute().data or []
            )
            if isinstance(row, dict) and row.get("user_id")
        ]
        task_count = 0
        completion_rate = 0
        if student_ids:
            task_rows = (
                client.table("lesson_tasks")
                .select("id,status")
                .in_("target_user_id", student_ids)
                .limit(5000)
                .execute()
                .data
                or []
            )
            task_count = len(task_rows)
            completed = sum(1 for row in task_rows if isinstance(row, dict) and _norm_text(row.get("status")) == "completed")
            completion_rate = int(round((completed / task_count) * 100)) if task_count else 0
    except HTTPException:
        raise
    except Exception:
        return _classes_table_error(request)

    return ok(
        {
            "classId": class_id,
            "className": _norm_text(class_row.get("name")),
            "studentCount": member_count,
            "taskCount": task_count,
            "taskCompletionRate": completion_rate,
        },
        _trace_id(request),
    )


@router.get("/{class_id}/tasks")
async def classes_tasks(class_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    try:
        owned = client.table("classes").select("id").eq("id", class_id).eq("teacher_id", user.id).limit(1).execute()
        if not (owned.data or []):
            raise HTTPException(status_code=403, detail="Forbidden")
        member_rows = client.table("class_members").select("user_id").eq("class_id", class_id).execute().data or []
        student_ids = [
            _norm_text(row.get("user_id"))
            for row in member_rows
            if isinstance(row, dict) and _norm_text(row.get("user_id"))
        ]
        if not student_ids:
            return ok({"items": []}, _trace_id(request))
        rows = (
            client.table("lesson_tasks")
            .select(LESSON_TASK_SELECT)
            .eq("teacher_id", user.id)
            .in_("target_user_id", student_ids)
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
            .data
            or []
        )
    except HTTPException:
        raise
    except Exception:
        return _classes_table_error(request)
    return ok({"items": [_lesson_task_payload(row) for row in rows if isinstance(row, dict)]}, _trace_id(request))


@router.get("/{class_id}/wrongbook/distribution")
async def classes_wrongbook_distribution(class_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    try:
        owned = client.table("classes").select("id").eq("id", class_id).eq("teacher_id", user.id).limit(1).execute()
        if not (owned.data or []):
            raise HTTPException(status_code=403, detail="Forbidden")
        student_ids = await _class_student_ids(client, class_id)
        if not student_ids:
            return ok({"classId": class_id, "totalWrong": 0, "byType": [], "byDynasty": [], "byTheme": [], "byKeywordTag": []}, _trace_id(request))
        rows = (
            client.table("wrong_questions")
            .select("id,error_type,dynasty,theme,keyword_tags,status,created_at,user_id")
            .in_("user_id", student_ids)
            .limit(5000)
            .execute()
            .data
            or []
        )
    except HTTPException:
        raise
    except Exception:
        return _classes_table_error(request)

    typed_rows = [row for row in rows if isinstance(row, dict)]
    return ok(
        {
            "classId": class_id,
            "totalWrong": len(typed_rows),
            "studentCount": len(student_ids),
            "byType": _count_text(typed_rows, "error_type")[:10],
            "byDynasty": _count_text(typed_rows, "dynasty")[:10],
            "byTheme": _count_text(typed_rows, "theme")[:10],
            "byKeywordTag": _count_tags(typed_rows)[:10],
        },
        _trace_id(request),
    )


@router.post("/{class_id}/tasks")
async def classes_create_task(
    class_id: str,
    payload: LessonTaskCreateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    try:
        owned = client.table("classes").select("id").eq("id", class_id).eq("teacher_id", user.id).limit(1).execute()
        if not (owned.data or []):
            raise HTTPException(status_code=403, detail="Forbidden")
        member_rows = (
            client.table("class_members")
            .select("user_id")
            .eq("class_id", class_id)
            .eq("role", "student")
            .execute()
            .data
            or []
        )
        student_ids = [
            _norm_text(row.get("user_id"))
            for row in member_rows
            if isinstance(row, dict) and _norm_text(row.get("user_id"))
        ]
        created = []
        payload_data = payload.model_dump()
        for student_id in student_ids:
            item = create_lesson_task(
                teacher_id=user.id,
                payload=LessonTaskCreateRequest(**{**payload_data, "targetUserId": student_id}),
            )
            created.append(item)
            await _invalidate_learning_cache(student_id)
        await _invalidate_learning_cache(user.id)
    except HTTPException:
        raise
    except Exception:
        return _classes_table_error(request)

    return ok({"items": created, "createdCount": len(created), "classId": class_id}, _trace_id(request))
