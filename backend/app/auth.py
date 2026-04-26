from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import Depends, Header, HTTPException

from .config import get_settings


@dataclass
class CurrentUser:
    id: str
    email: str | None = None
    raw: dict[str, Any] | None = None


_AUTH_CLIENT: httpx.AsyncClient | None = None
_AUTH_CACHE: dict[str, tuple[float, CurrentUser]] = {}
_AUTH_CACHE_MAX = 1024


def _get_auth_client() -> httpx.AsyncClient:
    global _AUTH_CLIENT
    if _AUTH_CLIENT is None:
        settings = get_settings()
        timeout = max(3, int(settings.auth_request_timeout_seconds))
        _AUTH_CLIENT = httpx.AsyncClient(
            timeout=timeout,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )
    return _AUTH_CLIENT


def _auth_cache_ttl_seconds() -> int:
    settings = get_settings()
    return max(0, int(settings.auth_user_cache_ttl_seconds))


def _get_cached_user(token: str) -> CurrentUser | None:
    ttl = _auth_cache_ttl_seconds()
    if ttl <= 0:
        return None

    cached = _AUTH_CACHE.get(token)
    if not cached:
        return None

    expires_at, user = cached
    if expires_at <= time.time():
        _AUTH_CACHE.pop(token, None)
        return None

    return user


def _set_cached_user(token: str, user: CurrentUser) -> None:
    ttl = _auth_cache_ttl_seconds()
    if ttl <= 0:
        return

    now = time.time()
    _AUTH_CACHE[token] = (now + ttl, user)

    if len(_AUTH_CACHE) <= _AUTH_CACHE_MAX:
        return

    # 优先清理过期项，再控制上限，避免缓存无限增长。
    expired_keys = [key for key, (expires_at, _) in _AUTH_CACHE.items() if expires_at <= now]
    for key in expired_keys:
        _AUTH_CACHE.pop(key, None)

    if len(_AUTH_CACHE) > _AUTH_CACHE_MAX:
        sorted_items = sorted(_AUTH_CACHE.items(), key=lambda item: item[1][0], reverse=True)[:_AUTH_CACHE_MAX]
        _AUTH_CACHE.clear()
        _AUTH_CACHE.update(sorted_items)


async def _fetch_user_from_supabase(token: str) -> CurrentUser:
    cached_user = _get_cached_user(token)
    if cached_user:
        return cached_user

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=500, detail='Supabase auth config missing')

    url = f"{settings.supabase_url}/auth/v1/user"
    headers = {
        'Authorization': f'Bearer {token}',
        'apikey': settings.supabase_anon_key,
    }

    try:
        response = await _get_auth_client().get(url, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail='Auth service unavailable') from exc

    if response.status_code >= 400:
        _AUTH_CACHE.pop(token, None)
        raise HTTPException(status_code=401, detail='Invalid auth token')

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail='Invalid auth response') from exc

    user_id = payload.get('id')
    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid user payload')

    user = CurrentUser(id=user_id, email=payload.get('email'), raw=payload)
    _set_cached_user(token, user)
    return user


async def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Missing bearer token')

    token = authorization.split(' ', 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail='Missing bearer token')

    return await _fetch_user_from_supabase(token)


async def get_optional_user(authorization: str | None = Header(default=None)) -> CurrentUser | None:
    if not authorization or not authorization.lower().startswith('bearer '):
        return None
    token = authorization.split(' ', 1)[1].strip()
    if not token:
        return None
    return await _fetch_user_from_supabase(token)


UserDep = Depends(get_current_user)
