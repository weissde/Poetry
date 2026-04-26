from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Request

from ..config import get_settings
from ..response import ok

router = APIRouter()
settings = get_settings()


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


@router.get("/api/health")
async def health(request: Request):
    return ok({"service": settings.app_name, "time": datetime.now(timezone.utc).isoformat()}, _trace_id(request))
