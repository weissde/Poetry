from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..auth import CurrentUser, get_current_user
from ..cache import cache_get_json, cache_set_json
from ..response import ok
from ..supabase_client import get_supabase_admin
from ..weakness import create_profile

router = APIRouter()


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


@router.get("/api/weakness/profile")
async def weakness_profile(request: Request, user: CurrentUser = Depends(get_current_user)):
    cache_key = f"weakness-profile:{user.id}:v1"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok({"profile": cached}, _trace_id(request))

    client = get_supabase_admin()
    result = client.table("weakness_profiles").select("profile_json").eq("user_id", user.id).limit(1).execute()
    rows = result.data or []
    profile = rows[0]["profile_json"] if rows else create_profile()
    if not isinstance(profile, dict):
        profile = create_profile()
    await cache_set_json(cache_key, profile, ttl_seconds=60)
    return ok({"profile": profile}, _trace_id(request))
