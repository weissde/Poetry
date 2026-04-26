from __future__ import annotations

import json
import time
from typing import Any

from .config import get_settings

try:
    from redis.asyncio import Redis
except Exception:  # pragma: no cover - optional dependency
    Redis = None  # type: ignore[assignment]


_REDIS_CLIENT: Redis | None = None
_REDIS_UNAVAILABLE_UNTIL = 0.0
_REDIS_BACKOFF_SECONDS = 60
_LOCAL_CACHE: dict[str, tuple[float, str]] = {}
_LOCAL_CACHE_MAX = 2048


def _local_get(key: str) -> Any | None:
    entry = _LOCAL_CACHE.get(key)
    if not entry:
        return None

    expires_at, payload = entry
    if expires_at <= time.time():
        _LOCAL_CACHE.pop(key, None)
        return None

    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        _LOCAL_CACHE.pop(key, None)
        return None


def _local_set(key: str, value: Any, ttl_seconds: int) -> None:
    ttl = max(1, int(ttl_seconds))
    _LOCAL_CACHE[key] = (time.time() + ttl, json.dumps(value, ensure_ascii=False))

    if len(_LOCAL_CACHE) <= _LOCAL_CACHE_MAX:
        return

    now = time.time()
    expired = [cache_key for cache_key, (expires_at, _payload) in _LOCAL_CACHE.items() if expires_at <= now]
    for cache_key in expired:
        _LOCAL_CACHE.pop(cache_key, None)

    if len(_LOCAL_CACHE) > _LOCAL_CACHE_MAX:
        freshest = sorted(_LOCAL_CACHE.items(), key=lambda item: item[1][0], reverse=True)[:_LOCAL_CACHE_MAX]
        _LOCAL_CACHE.clear()
        _LOCAL_CACHE.update(freshest)


async def _get_redis_client() -> Redis | None:
    global _REDIS_CLIENT

    settings = get_settings()
    redis_url = settings.redis_url.strip()
    if not redis_url or Redis is None:
        return None

    now = time.time()
    if now < _REDIS_UNAVAILABLE_UNTIL:
        return None

    if _REDIS_CLIENT is None:
        _REDIS_CLIENT = Redis.from_url(
            redis_url,
            encoding='utf-8',
            decode_responses=True,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
            retry_on_timeout=False,
        )
        try:
            await _REDIS_CLIENT.ping()
        except Exception:
            await _mark_redis_unavailable()
            return None

    return _REDIS_CLIENT


async def _mark_redis_unavailable() -> None:
    global _REDIS_CLIENT, _REDIS_UNAVAILABLE_UNTIL
    _REDIS_UNAVAILABLE_UNTIL = time.time() + _REDIS_BACKOFF_SECONDS
    if _REDIS_CLIENT is not None:
        try:
            await _REDIS_CLIENT.aclose()
        except Exception:
            pass
    _REDIS_CLIENT = None


async def cache_get_json(key: str) -> Any | None:
    client = await _get_redis_client()
    if client is None:
        return _local_get(key)

    try:
        raw = await client.get(key)
    except Exception:
        await _mark_redis_unavailable()
        return _local_get(key)

    if not raw:
        return None

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int | None = None) -> None:
    settings = get_settings()
    ttl = max(1, int(ttl_seconds or settings.redis_cache_ttl_seconds))
    payload = json.dumps(value, ensure_ascii=False)

    client = await _get_redis_client()
    if client is None:
        _local_set(key, value, ttl)
        return

    try:
        await client.setex(key, ttl, payload)
    except Exception:
        await _mark_redis_unavailable()
        _local_set(key, value, ttl)


async def cache_delete_prefix(prefix: str) -> None:
    client = await _get_redis_client()
    if client is None:
        keys = [key for key in _LOCAL_CACHE.keys() if key.startswith(prefix)]
        for key in keys:
            _LOCAL_CACHE.pop(key, None)
        return

    try:
        cursor = 0
        while True:
            cursor, keys = await client.scan(cursor=cursor, match=f'{prefix}*', count=200)
            if keys:
                await client.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        await _mark_redis_unavailable()
        keys = [key for key in _LOCAL_CACHE.keys() if key.startswith(prefix)]
        for key in keys:
            _LOCAL_CACHE.pop(key, None)
