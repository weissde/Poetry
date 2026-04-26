from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from ..auth import CurrentUser, get_current_user
from ..response import fail, ok
from ..schemas import UserRoleUpdateRequest
from ..services.cache_invalidation import _invalidate_learning_cache
from ..services.summary_service import (
    get_memory_coverage,
    get_user_learning_summary,
    get_user_role,
    get_user_summary,
    set_user_role,
)
from ..services.task_service import get_today_tasks

router = APIRouter()
logger = logging.getLogger("poetry_ai.api.user")


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _user_role_column_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail(
            "user role is not ready. Please run migration 019_user_role.sql first.",
            _trace_id(request),
            code=5315,
        ),
    )


@router.get("/api/user/summary")
async def user_summary(request: Request, user: CurrentUser = Depends(get_current_user)):
    payload = await get_user_summary(user.id)
    return ok(payload, _trace_id(request))


@router.get("/api/user/role")
async def user_role(request: Request, user: CurrentUser = Depends(get_current_user)):
    try:
        payload = await get_user_role(user.id)
    except Exception:
        logger.warning("user_role_read_failed user_id=%s", user.id, exc_info=True)
        return _user_role_column_error(request)
    return ok(payload, _trace_id(request))


@router.patch("/api/user/role")
async def user_role_update(
    payload: UserRoleUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        data = await set_user_role(user.id, payload.role)
        await _invalidate_learning_cache(user.id)
    except Exception:
        logger.warning("user_role_update_failed user_id=%s role=%s", user.id, payload.role, exc_info=True)
        return _user_role_column_error(request)
    return ok(data, _trace_id(request))


@router.get("/api/user/learning-summary")
async def user_learning_summary(request: Request, user: CurrentUser = Depends(get_current_user)):
    payload = await get_user_learning_summary(user.id)
    return ok(payload, _trace_id(request))


@router.get("/api/user/today-tasks")
async def user_today_tasks(request: Request, user: CurrentUser = Depends(get_current_user)):
    payload = await get_today_tasks(user.id)
    return ok(payload, _trace_id(request))


@router.get("/api/user/coverage")
async def user_memory_coverage(request: Request, user: CurrentUser = Depends(get_current_user)):
    payload = await get_memory_coverage(user.id)
    return ok(payload, _trace_id(request))
