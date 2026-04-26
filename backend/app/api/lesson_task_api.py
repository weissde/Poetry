from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from ..auth import CurrentUser, get_current_user
from ..response import fail, ok
from ..schemas import LessonTaskCreateRequest, LessonTaskStatusUpdateRequest
from ..services.cache_invalidation import _invalidate_learning_cache
from ..services.summary_service import get_user_role
from ..services.task_service import create_lesson_task, list_lesson_tasks, update_lesson_task_status

router = APIRouter(prefix="/api/lesson-tasks", tags=["lesson-tasks"])
logger = logging.getLogger("poetry_ai.api.lesson_tasks")


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


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


@router.get("")
async def lesson_tasks_list(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    targetUserId: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
):
    if targetUserId:
        await _ensure_teacher(user)
    try:
        payload = await list_lesson_tasks(user_id=user.id, target_user_id=targetUserId, limit=limit)
    except Exception:
        logger.warning("lesson_tasks_list_failed user_id=%s target_user_id=%s", user.id, targetUserId, exc_info=True)
        return _lesson_tasks_table_error(request)
    return ok(payload, _trace_id(request))


@router.post("")
async def lesson_task_create(
    payload: LessonTaskCreateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    try:
        item = create_lesson_task(teacher_id=user.id, payload=payload)
        if item.get("targetUserId"):
            await _invalidate_learning_cache(item["targetUserId"])
        await _invalidate_learning_cache(user.id)
    except Exception:
        logger.warning("lesson_task_create_failed teacher_id=%s", user.id, exc_info=True)
        return _lesson_tasks_table_error(request)
    return ok({"item": item}, _trace_id(request))


@router.patch("/{task_id}/status")
async def lesson_task_update_status(
    task_id: str,
    payload: LessonTaskStatusUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        item = update_lesson_task_status(actor_id=user.id, task_id=task_id, payload=payload)
        if item.get("targetUserId"):
            await _invalidate_learning_cache(item["targetUserId"])
        await _invalidate_learning_cache(item.get("teacherId") or user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception:
        logger.warning("lesson_task_update_status_failed actor_id=%s task_id=%s", user.id, task_id, exc_info=True)
        return _lesson_tasks_table_error(request)
    return ok({"item": item}, _trace_id(request))
