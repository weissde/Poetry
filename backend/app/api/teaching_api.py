from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from ..auth import CurrentUser, get_current_user
from ..response import fail, ok
from ..schemas import (
    LessonTaskCreateRequest,
    TeachingSessionCreateRequest,
    TeachingSessionEndRequest,
    TeachingSessionStepUpdateRequest,
    TeachingUnitCreateRequest,
    TeachingUnitPoemsUpdateRequest,
    TeachingUnitUpdateRequest,
)
from ..services.task_service import create_lesson_task, list_lesson_tasks
from ..services.summary_service import get_user_role
from ..services.teaching_service import (
    create_teaching_unit,
    create_class_session,
    delete_teaching_unit,
    end_class_session,
    get_latest_class_session,
    get_poem_teaching_content,
    get_teaching_unit,
    list_teaching_units,
    replace_teaching_unit_poems,
    update_teaching_unit,
    update_class_session_step,
)

router = APIRouter(prefix="/api/teaching", tags=["teaching"])
logger = logging.getLogger("poetry_ai.api.teaching")


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _teaching_units_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail(
            "teaching units are not ready. Please run migration 016_teaching_units.sql first.",
            _trace_id(request),
            code=5312,
        ),
    )


def _class_sessions_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail(
            "class sessions are not ready. Please run migration 017_class_sessions.sql first.",
            _trace_id(request),
            code=5313,
        ),
    )


def _poems_teaching_fields_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail(
            "poem teaching fields are not ready. Please run migration 018_poems_teaching_fields.sql first.",
            _trace_id(request),
            code=5314,
        ),
    )


def _lesson_tasks_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail(
            "lesson tasks are not ready. Please run migration 020_lesson_tasks.sql first.",
            _trace_id(request),
            code=5316,
        ),
    )


async def _ensure_teacher(user: CurrentUser) -> None:
    role_payload = await get_user_role(user.id)
    role = str(role_payload.get("role") or "student").lower()
    if role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher role required")


@router.get("/units")
async def teaching_units_list(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    gradeLevel: str | None = Query(default=None),
    activeOnly: bool = Query(default=True),
    limit: int = Query(default=20, ge=1, le=100),
):
    _ = user
    try:
        units = list_teaching_units(grade_level=gradeLevel, active_only=activeOnly, limit=limit)
    except Exception:
        logger.warning("teaching_units_list_failed", exc_info=True)
        return _teaching_units_table_error(request)
    return ok({"items": units}, _trace_id(request))


@router.get("/units/{unit_id}")
async def teaching_unit_detail(unit_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    _ = user
    try:
        unit = get_teaching_unit(unit_id)
    except HTTPException:
        raise
    except Exception:
        logger.warning("teaching_unit_detail_failed unit_id=%s", unit_id, exc_info=True)
        return _teaching_units_table_error(request)
    return ok({"unit": unit}, _trace_id(request))


@router.post("/units")
async def teaching_unit_create(
    payload: TeachingUnitCreateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    try:
        unit = create_teaching_unit(payload)
    except Exception:
        logger.warning("teaching_unit_create_failed user_id=%s", user.id, exc_info=True)
        return _teaching_units_table_error(request)
    return ok({"unit": unit}, _trace_id(request))


@router.put("/units/{unit_id}")
async def teaching_unit_update(
    unit_id: str,
    payload: TeachingUnitUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    try:
        unit = update_teaching_unit(unit_id, payload)
    except HTTPException:
        raise
    except Exception:
        logger.warning("teaching_unit_update_failed unit_id=%s user_id=%s", unit_id, user.id, exc_info=True)
        return _teaching_units_table_error(request)
    return ok({"unit": unit}, _trace_id(request))


@router.delete("/units/{unit_id}")
async def teaching_unit_delete(unit_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    await _ensure_teacher(user)
    try:
        delete_teaching_unit(unit_id)
    except Exception:
        logger.warning("teaching_unit_delete_failed unit_id=%s user_id=%s", unit_id, user.id, exc_info=True)
        return _teaching_units_table_error(request)
    return ok({"deleted": True, "unitId": unit_id}, _trace_id(request))


@router.get("/units/{unit_id}/poems")
async def teaching_unit_poems(unit_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    _ = user
    try:
        unit = get_teaching_unit(unit_id)
    except HTTPException:
        raise
    except Exception:
        logger.warning("teaching_unit_poems_failed unit_id=%s", unit_id, exc_info=True)
        return _teaching_units_table_error(request)
    return ok({"items": unit.get("poemIds", []), "unitId": unit.get("id")}, _trace_id(request))


@router.put("/units/{unit_id}/poems")
async def teaching_unit_poems_update(
    unit_id: str,
    payload: TeachingUnitPoemsUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    try:
        unit = replace_teaching_unit_poems(unit_id, payload.poemIds)
    except HTTPException:
        raise
    except Exception:
        logger.warning("teaching_unit_poems_update_failed unit_id=%s user_id=%s", unit_id, user.id, exc_info=True)
        return _teaching_units_table_error(request)
    return ok({"unit": unit}, _trace_id(request))


@router.get("/objectives")
async def teaching_objectives_detail(
    request: Request,
    poemId: str | None = Query(default=None),
    poem_id: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    _ = user
    resolved_poem_id = (poemId or poem_id or "").strip()
    if not resolved_poem_id:
        raise HTTPException(status_code=422, detail="poemId or poem_id is required")
    try:
        payload = get_poem_teaching_content(resolved_poem_id)
    except HTTPException:
        raise
    except Exception:
        logger.warning("teaching_objectives_detail_failed poem_id=%s", resolved_poem_id, exc_info=True)
        return _poems_teaching_fields_error(request)
    return ok(payload, _trace_id(request))


@router.get("/sessions/latest")
async def latest_teaching_session(request: Request, user: CurrentUser = Depends(get_current_user)):
    try:
        session = get_latest_class_session(teacher_id=user.id)
    except Exception:
        logger.warning("latest_teaching_session_failed user_id=%s", user.id, exc_info=True)
        return _class_sessions_table_error(request)
    return ok({"session": session}, _trace_id(request))


@router.post("/sessions")
async def create_teaching_session(
    payload: TeachingSessionCreateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        session = create_class_session(teacher_id=user.id, payload=payload)
    except Exception:
        logger.warning("create_teaching_session_failed user_id=%s", user.id, exc_info=True)
        return _class_sessions_table_error(request)
    return ok({"session": session}, _trace_id(request))


@router.patch("/sessions/{session_id}/advance-step")
async def advance_teaching_session(
    session_id: str,
    payload: TeachingSessionStepUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        session = update_class_session_step(teacher_id=user.id, session_id=session_id, payload=payload)
    except HTTPException:
        raise
    except Exception:
        logger.warning("advance_teaching_session_failed user_id=%s session_id=%s", user.id, session_id, exc_info=True)
        return _class_sessions_table_error(request)
    return ok({"session": session}, _trace_id(request))


@router.patch("/sessions/{session_id}/end")
async def end_teaching_session(
    session_id: str,
    payload: TeachingSessionEndRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        session = end_class_session(teacher_id=user.id, session_id=session_id, payload=payload)
    except HTTPException:
        raise
    except Exception:
        logger.warning("end_teaching_session_failed user_id=%s session_id=%s", user.id, session_id, exc_info=True)
        return _class_sessions_table_error(request)
    return ok({"session": session}, _trace_id(request))


@router.post("/lesson-tasks")
async def teaching_lesson_task_create(
    payload: LessonTaskCreateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    try:
        item = create_lesson_task(teacher_id=user.id, payload=payload)
    except Exception:
        logger.warning("teaching_lesson_task_create_failed user_id=%s", user.id, exc_info=True)
        return _lesson_tasks_table_error(request)
    return ok({"item": item}, _trace_id(request))


@router.get("/lesson-tasks")
async def teaching_lesson_task_list(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    targetUserId: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
):
    try:
        payload = await list_lesson_tasks(user_id=user.id, target_user_id=targetUserId, limit=limit)
    except Exception:
        logger.warning(
            "teaching_lesson_task_list_failed user_id=%s target_user_id=%s",
            user.id,
            targetUserId,
            exc_info=True,
        )
        return _lesson_tasks_table_error(request)
    return ok({**payload, "deprecated": True, "canonicalPath": "/api/lesson-tasks"}, _trace_id(request))
