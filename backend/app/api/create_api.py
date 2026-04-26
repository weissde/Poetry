from __future__ import annotations

import asyncio
import hashlib
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from ..ai import AIServiceError, complete_json
from ..auth import CurrentUser, get_current_user
from ..cache import cache_get_json, cache_set_json
from ..config import get_settings
from ..response import fail, ok
from ..schemas import (
    CreationLikeUpdateRequest,
    CreationRefineRequest,
    CreationReviewRequest,
    CreationTransformRequest,
    CreationVisibilityUpdateRequest,
)
from ..services.cache_invalidation import _invalidate_creation_cache, _invalidate_creation_public_cache
from ..services.planning import _build_local_creation_feedback, insert_creation_record, normalize_creation_feedback
from ..supabase_client import get_supabase_admin

router = APIRouter()
settings = get_settings()

LIKE_TOGGLE_COOLDOWN_SECONDS = 2
CREATION_TREND_LOOKBACK_DAYS = 7
CREATION_TREND_CANDIDATE_MULTIPLIER = 6
CREATION_TREND_CANDIDATE_MAX = 1000


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _stable_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _practice_quick_timeout() -> float:
    timeout = max(6, int(settings.practice_ai_timeout_seconds))
    return float(min(timeout, settings.request_timeout_seconds))


def _practice_quick_attempts() -> int:
    return max(1, int(settings.practice_ai_max_attempts))


def _creation_visibility_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail("创作公开功能未就绪，请先执行 011_creations_public_visibility.sql", _trace_id(request), code=5307),
    )


def _creation_like_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail("创作点赞功能未就绪，请先执行 012_creation_likes.sql", _trace_id(request), code=5308),
    )


def _normalize_creation_public_sort(raw: str) -> str:
    sort_value = str(raw or "latest").strip().lower()
    if sort_value not in {"latest", "hot", "trend"}:
        raise HTTPException(status_code=400, detail="sort must be latest or hot or trend")
    return sort_value


def _hydrate_creation_like_meta(client: Any, *, user_id: str, items: list[dict[str, Any]]) -> None:
    if not items:
        return

    creation_ids: list[str] = []
    for row in items:
        row["like_count"] = max(0, int(row.get("like_count") or 0))
        row["liked_by_me"] = False
        creation_id = str(row.get("id") or "").strip()
        if creation_id:
            creation_ids.append(creation_id)

    if not creation_ids:
        return

    liked_rows = (
        client.table("creation_likes")
        .select("creation_id")
        .eq("user_id", user_id)
        .in_("creation_id", creation_ids)
        .execute()
        .data
        or []
    )
    liked_set = {str(row.get("creation_id") or "").strip() for row in liked_rows if isinstance(row, dict)}
    for row in items:
        row["liked_by_me"] = str(row.get("id") or "").strip() in liked_set


def _normalize_creation_public_item(row: dict[str, Any], *, viewer_user_id: str) -> dict[str, Any]:
    item = dict(row)
    if "mode" not in item:
        item["mode"] = "review"
    if "source_text" not in item:
        item["source_text"] = None
    if "is_public" not in item:
        item["is_public"] = True
    if "published_at" not in item:
        item["published_at"] = item.get("created_at")

    item["like_count"] = max(0, int(item.get("like_count") or 0))
    item["liked_by_me"] = bool(item.get("liked_by_me"))
    item["like_count_7d"] = max(0, int(item.get("like_count_7d") or 0))
    item["like_count_1d"] = max(0, int(item.get("like_count_1d") or 0))
    item["hot_score"] = max(0, int(item.get("hot_score") or item.get("like_count") or 0))

    owner_id = str(item.pop("user_id", "") or "").strip()
    item["owned_by_me"] = bool(owner_id and owner_id == viewer_user_id)
    return item


def _hydrate_creation_trend_meta(client: Any, *, items: list[dict[str, Any]], lookback_days: int = CREATION_TREND_LOOKBACK_DAYS) -> None:
    for row in items:
        row["like_count_1d"] = 0
        row["like_count_7d"] = 0
        row["hot_score"] = max(0, int(row.get("like_count") or 0))

    if not items:
        return

    creation_ids = [str(row.get("id") or "").strip() for row in items if str(row.get("id") or "").strip()]
    if not creation_ids:
        return

    since_iso = (datetime.now(timezone.utc) - timedelta(days=max(1, int(lookback_days)))).isoformat()
    recent_rows = (
        client.table("creation_likes")
        .select("creation_id,created_at")
        .in_("creation_id", creation_ids)
        .gte("created_at", since_iso)
        .limit(20000)
        .execute()
        .data
        or []
    )
    today_start_iso = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    recent_map: dict[str, int] = {}
    today_map: dict[str, int] = {}
    for row in recent_rows:
        if not isinstance(row, dict):
            continue
        creation_id = str(row.get("creation_id") or "").strip()
        if not creation_id:
            continue
        recent_map[creation_id] = recent_map.get(creation_id, 0) + 1
        created_at = str(row.get("created_at") or "").strip()
        if created_at and created_at >= today_start_iso:
            today_map[creation_id] = today_map.get(creation_id, 0) + 1

    for row in items:
        creation_id = str(row.get("id") or "").strip()
        today_count = max(0, int(today_map.get(creation_id, 0)))
        recent_count = max(0, int(recent_map.get(creation_id, 0)))
        total_count = max(0, int(row.get("like_count") or 0))
        row["like_count_1d"] = today_count
        row["like_count_7d"] = recent_count
        # New likes get higher weight while keeping total likes as a secondary signal.
        row["hot_score"] = (recent_count * 5) + total_count


async def _ensure_creation_like_rate_limit(user_id: str, creation_id: str) -> None:
    key = f"create-like-cooldown:{user_id}:{creation_id}"
    now_ts = time.time()
    recent = await cache_get_json(key)
    if isinstance(recent, dict):
        raw_ts = recent.get("ts")
        if isinstance(raw_ts, (int, float)):
            elapsed = now_ts - float(raw_ts)
            if elapsed < LIKE_TOGGLE_COOLDOWN_SECONDS:
                wait_seconds = max(1, int(round(LIKE_TOGGLE_COOLDOWN_SECONDS - elapsed)))
                raise HTTPException(status_code=429, detail=f"操作过于频繁，请 {wait_seconds} 秒后重试")
    await cache_set_json(key, {"ts": now_ts}, ttl_seconds=LIKE_TOGGLE_COOLDOWN_SECONDS)


@router.post('/api/create/review')
async def creation_review(
    payload: CreationReviewRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    prompt = '\n'.join([
        '你是古诗词创作老师，请对学生作品进行点评。',
        '只输出 JSON 对象。',
        '结构：{"scores":{"imagery":1-10,"rhythm":1-10,"wording":1-10},"summary":string,"suggestions":string[],"highlights":string[]}',
        f'风格：{payload.style}',
        f'参考诗词：{payload.referencePoem or "无"}',
        '作品：',
        payload.content,
    ])

    feedback_source = 'ai'
    try:
        feedback_raw = await complete_json(
            prompt,
            temperature=0.4,
            max_attempts=_practice_quick_attempts(),
            timeout_seconds=_practice_quick_timeout(),
        )
        feedback = normalize_creation_feedback(feedback_raw)
    except (AIServiceError, asyncio.TimeoutError):
        feedback_source = 'fallback_local'
        feedback = _build_local_creation_feedback(
            content=payload.content,
            style=payload.style,
            reference_poem=payload.referencePoem,
            mode='review',
        )
    now = datetime.now(timezone.utc).isoformat()

    client = get_supabase_admin()
    creation = insert_creation_record(
        client,
        user_id=user.id,
        style=payload.style,
        reference_poem=payload.referencePoem,
        content=payload.content,
        feedback=feedback,
        created_at=now,
        mode='review',
        source_text=None,
    )

    await _invalidate_creation_cache(user.id)
    return ok({'feedback': feedback, 'creation': creation, 'source': feedback_source}, _trace_id(request))


@router.get('/api/create/history')
async def creation_history(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    limit: int = Query(default=30, ge=1, le=200),
    page: int = Query(default=1, ge=1, le=2000),
    pageSize: int | None = Query(default=None, ge=1, le=200),
    style: str | None = Query(default=None),
    q: str = Query(default=''),
):
    client = get_supabase_admin()
    page_size = max(1, min(200, int(pageSize or limit)))
    page_number = max(1, int(page))
    page_start = (page_number - 1) * page_size
    page_end = page_start + page_size - 1
    cache_key = f"create-history:{user.id}:{_stable_hash({'style': style or '', 'q': q.strip(), 'page': page_number, 'pageSize': page_size})}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    def build_query(select_columns: str):
        query = client.table('creations').select(select_columns, count='planned').eq('user_id', user.id)
        if style and style.strip():
            query = query.eq('style', style.strip())
        if q.strip():
            keyword = f"%{q.strip()}%"
            query = query.or_(f"content.ilike.{keyword},reference_poem.ilike.{keyword}")
        return query

    try:
        result = (
            build_query('id,style,reference_poem,content,feedback_json,mode,source_text,is_public,published_at,like_count,created_at')
            .order('created_at', desc=True)
            .range(page_start, page_end)
            .execute()
        )
        total = int(result.count or 0)
        items = result.data or []
    except Exception:
        result = (
            build_query('id,style,reference_poem,content,feedback_json,created_at')
            .order('created_at', desc=True)
            .range(page_start, page_end)
            .execute()
        )
        total = int(result.count or 0)
        items = result.data or []
        for row in items:
            if 'mode' not in row:
                row['mode'] = 'review'
            if 'source_text' not in row:
                row['source_text'] = None
            if 'is_public' not in row:
                row['is_public'] = False
            if 'published_at' not in row:
                row['published_at'] = None
            if 'like_count' not in row:
                row['like_count'] = 0

    for row in items:
        if 'mode' not in row:
            row['mode'] = 'review'
        if 'source_text' not in row:
            row['source_text'] = None
        if 'is_public' not in row:
            row['is_public'] = False
        if 'published_at' not in row:
            row['published_at'] = None
        row['like_count'] = max(0, int(row.get('like_count') or 0))

    total_pages = max(1, (total + page_size - 1) // page_size)
    payload = {
        'items': items,
        'pagination': {
            'page': page_number,
            'pageSize': page_size,
            'total': total,
            'totalPages': total_pages,
            'hasPrev': page_number > 1,
            'hasNext': page_number < total_pages,
        },
    }
    await cache_set_json(cache_key, payload, ttl_seconds=20)
    return ok(payload, _trace_id(request))


@router.get('/api/create/public')
async def creation_public_list(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    limit: int = Query(default=24, ge=1, le=200),
    page: int = Query(default=1, ge=1, le=2000),
    pageSize: int | None = Query(default=None, ge=1, le=200),
    style: str | None = Query(default=None),
    sort: str = Query(default='latest'),
    q: str = Query(default=''),
):
    client = get_supabase_admin()
    page_size = max(1, min(200, int(pageSize or limit)))
    page_number = max(1, int(page))
    sort_value = _normalize_creation_public_sort(sort)
    page_start = (page_number - 1) * page_size
    page_end = page_start + page_size - 1
    cache_key = f"create-public:{user.id}:{_stable_hash({'style': style or '', 'sort': sort_value, 'q': q.strip(), 'page': page_number, 'pageSize': page_size})}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    def build_query(select_columns: str):
        query = client.table('creations').select(select_columns, count='planned').eq('is_public', True)
        if style and style.strip():
            query = query.eq('style', style.strip())
        if q.strip():
            keyword = f"%{q.strip()}%"
            query = query.or_(f"content.ilike.{keyword},reference_poem.ilike.{keyword}")
        return query

    items: list[dict[str, Any]]
    total: int
    try:
        query = build_query('id,user_id,style,reference_poem,content,feedback_json,mode,source_text,is_public,published_at,like_count,created_at')
        if sort_value == 'hot':
            result = (
                query.order('like_count', desc=True)
                .order('published_at', desc=True)
                .order('created_at', desc=True)
                .range(page_start, page_end)
                .execute()
            )
        elif sort_value == 'trend':
            candidate_size = min(
                CREATION_TREND_CANDIDATE_MAX,
                max(page_end + 1, page_size * CREATION_TREND_CANDIDATE_MULTIPLIER),
            )
            result = (
                query.order('published_at', desc=True)
                .order('created_at', desc=True)
                .range(0, candidate_size - 1)
                .execute()
            )
        else:
            result = query.order('published_at', desc=True).order('created_at', desc=True).range(page_start, page_end).execute()
        total = int(result.count or 0)
        items = result.data or []
    except Exception as exc:
        message = str(exc).lower()
        if 'is_public' in message or 'published_at' in message:
            # When migration 011 is not applied yet, keep endpoint available and return empty list.
            total = 0
            items = []
        elif 'like_count' in message:
            result = (
                build_query('id,user_id,style,reference_poem,content,feedback_json,mode,source_text,is_public,published_at,created_at')
                .order('published_at', desc=True)
                .order('created_at', desc=True)
                .range(page_start, page_end)
                .execute()
            )
            total = int(result.count or 0)
            items = result.data or []
            for row in items:
                row['like_count'] = 0
        else:
            raise

    try:
        _hydrate_creation_like_meta(client, user_id=user.id, items=items)
        if sort_value == 'trend':
            _hydrate_creation_trend_meta(client, items=items)
    except Exception as exc:
        if 'creation_likes' in str(exc).lower():
            for row in items:
                row['like_count'] = max(0, int(row.get('like_count') or 0))
                row['liked_by_me'] = False
                row['like_count_7d'] = 0
                row['hot_score'] = max(0, int(row.get('like_count') or 0))
        else:
            raise

    if sort_value == 'trend':
        items.sort(
            key=lambda row: (
                max(0, int(row.get('like_count_7d') or 0)),
                max(0, int(row.get('like_count') or 0)),
                str(row.get('published_at') or ''),
                str(row.get('created_at') or ''),
            ),
            reverse=True,
        )
        items = items[page_start : page_end + 1]

    items = [_normalize_creation_public_item(row, viewer_user_id=user.id) for row in items]

    total_pages = max(1, (total + page_size - 1) // page_size)
    payload = {
        'items': items,
        'pagination': {
            'page': page_number,
            'pageSize': page_size,
            'total': total,
            'totalPages': total_pages,
            'hasPrev': page_number > 1,
            'hasNext': page_number < total_pages,
        },
    }
    await cache_set_json(cache_key, payload, ttl_seconds=20)
    return ok(payload, _trace_id(request))


@router.get('/api/create/public/rankings')
async def creation_public_rankings(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    limit: int = Query(default=5, ge=3, le=20),
):
    client = get_supabase_admin()
    top_n = max(3, min(20, int(limit)))
    cache_key = f'create-public:rankings:{user.id}:{top_n}'
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    candidate_size = min(
        CREATION_TREND_CANDIDATE_MAX,
        max(top_n * CREATION_TREND_CANDIDATE_MULTIPLIER, top_n * 12),
    )

    rows: list[dict[str, Any]]
    try:
        result = (
            client.table('creations')
            .select('id,user_id,style,reference_poem,content,feedback_json,mode,source_text,is_public,published_at,like_count,created_at')
            .eq('is_public', True)
            .order('like_count', desc=True)
            .order('published_at', desc=True)
            .order('created_at', desc=True)
            .limit(candidate_size)
            .execute()
        )
        rows = result.data or []
    except Exception as exc:
        message = str(exc).lower()
        if 'is_public' in message or 'published_at' in message:
            rows = []
        elif 'like_count' in message:
            result = (
                client.table('creations')
                .select('id,user_id,style,reference_poem,content,feedback_json,mode,source_text,is_public,published_at,created_at')
                .eq('is_public', True)
                .order('published_at', desc=True)
                .order('created_at', desc=True)
                .limit(candidate_size)
                .execute()
            )
            rows = result.data or []
            for row in rows:
                row['like_count'] = 0
        else:
            raise

    if not rows:
        payload = {'today': [], 'week': [], 'generatedAt': datetime.now(timezone.utc).isoformat()}
        await cache_set_json(cache_key, payload, ttl_seconds=20)
        return ok(payload, _trace_id(request))

    try:
        _hydrate_creation_like_meta(client, user_id=user.id, items=rows)
        _hydrate_creation_trend_meta(client, items=rows)
    except Exception as exc:
        if 'creation_likes' in str(exc).lower():
            for row in rows:
                row['liked_by_me'] = False
                row['like_count_7d'] = 0
                row['like_count_1d'] = 0
                row['hot_score'] = max(0, int(row.get('like_count') or 0))
        else:
            raise

    normalized_rows = [_normalize_creation_public_item(row, viewer_user_id=user.id) for row in rows]
    week_ranked = sorted(
        normalized_rows,
        key=lambda row: (
            max(0, int(row.get('like_count_7d') or 0)),
            max(0, int(row.get('like_count') or 0)),
            str(row.get('published_at') or ''),
            str(row.get('created_at') or ''),
        ),
        reverse=True,
    )
    today_ranked = sorted(
        normalized_rows,
        key=lambda row: (
            max(0, int(row.get('like_count_1d') or 0)),
            max(0, int(row.get('like_count_7d') or 0)),
            max(0, int(row.get('like_count') or 0)),
            str(row.get('published_at') or ''),
            str(row.get('created_at') or ''),
        ),
        reverse=True,
    )

    today_items = [row for row in today_ranked if max(0, int(row.get('like_count_1d') or 0)) > 0][:top_n]
    if len(today_items) < top_n:
        seen_ids = {str(row.get('id') or '').strip() for row in today_items}
        for row in today_ranked:
            row_id = str(row.get('id') or '').strip()
            if row_id in seen_ids:
                continue
            today_items.append(row)
            seen_ids.add(row_id)
            if len(today_items) >= top_n:
                break

    payload = {
        'today': today_items[:top_n],
        'week': week_ranked[:top_n],
        'generatedAt': datetime.now(timezone.utc).isoformat(),
    }
    await cache_set_json(cache_key, payload, ttl_seconds=20)
    return ok(payload, _trace_id(request))


@router.post('/api/create/{creation_id}/refine')
async def creation_refine(
    creation_id: str,
    payload: CreationRefineRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    source_result = (
        client.table('creations')
        .select('id,style,reference_poem,content')
        .eq('id', creation_id)
        .eq('user_id', user.id)
        .limit(1)
        .execute()
    )
    source_rows = source_result.data or []
    if not source_rows:
        return JSONResponse(status_code=404, content=fail('Creation not found', _trace_id(request), code=4042))

    source = source_rows[0]
    target_style = payload.style or source.get('style') or '豪放'
    target_reference = payload.referencePoem or source.get('reference_poem')
    source_content = str(source.get('content') or '')
    instruction = (payload.instruction or '在保留原意的前提下，让语言更凝练、节奏更稳定。').strip()

    prompt = '\n'.join([
        '你是古诗词创作老师，请对学生作品进行“润色并点评”。',
        '只输出 JSON 对象，不要输出任何额外说明。',
        (
            '结构：'
            '{"revisedContent":string,'
            '"scores":{"imagery":1-10,"rhythm":1-10,"wording":1-10},'
            '"summary":string,"suggestions":string[],"highlights":string[]}'
        ),
        f'风格：{target_style}',
        f'参考诗词：{target_reference or "无"}',
        f'润色要求：{instruction}',
        '原作品：',
        source_content,
    ])

    feedback_source = 'ai'
    try:
        refined_raw = await complete_json(
            prompt,
            temperature=0.5,
            max_attempts=_practice_quick_attempts(),
            timeout_seconds=_practice_quick_timeout(),
        )
        feedback = normalize_creation_feedback(refined_raw)
    except (AIServiceError, asyncio.TimeoutError):
        feedback_source = 'fallback_local'
        feedback = _build_local_creation_feedback(
            content=source_content,
            style=target_style,
            reference_poem=target_reference,
            mode='refine',
            instruction=instruction,
            source_text=source_content,
        )
    revised_content = feedback.get('revisedContent') or source_content
    feedback['revisedContent'] = revised_content
    now = datetime.now(timezone.utc).isoformat()

    creation = insert_creation_record(
        client,
        user_id=user.id,
        style=target_style,
        reference_poem=target_reference,
        content=revised_content,
        feedback=feedback,
        created_at=now,
        mode='refine',
        source_text=source_content,
    )

    await _invalidate_creation_cache(user.id)
    return ok({'feedback': feedback, 'creation': creation, 'source': feedback_source}, _trace_id(request))


@router.post('/api/create/transform')
async def creation_transform(
    payload: CreationTransformRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    modern_text = payload.modernText.strip()
    if not modern_text:
        raise HTTPException(status_code=400, detail='modernText is required')

    prompt = '\n'.join([
        '你是一位古诗词创作老师，请把学生的现代文本转写成古风诗句，并给出点评。',
        '只输出 JSON 对象，不要输出任何额外说明。',
        (
            '结构：'
            '{"transformedContent":string,'
            '"scores":{"imagery":1-10,"rhythm":1-10,"wording":1-10},'
            '"summary":string,"suggestions":string[],"highlights":string[]}'
        ),
        f'风格：{payload.style}',
        f'参考诗词：{payload.referencePoem or "无"}',
        '现代文本：',
        modern_text,
    ])

    feedback_source = 'ai'
    try:
        transformed_raw = await complete_json(
            prompt,
            temperature=0.55,
            max_attempts=_practice_quick_attempts(),
            timeout_seconds=_practice_quick_timeout(),
        )
        feedback = normalize_creation_feedback(transformed_raw)
        transformed_content = ''
        if isinstance(transformed_raw, dict):
            raw_content = transformed_raw.get('transformedContent')
            if isinstance(raw_content, str):
                transformed_content = raw_content.strip()
        if not transformed_content:
            transformed_content = str(feedback.get('revisedContent') or '').strip()
        if not transformed_content:
            transformed_content = modern_text
    except (AIServiceError, asyncio.TimeoutError):
        feedback_source = 'fallback_local'
        transformed_content = modern_text
        feedback = _build_local_creation_feedback(
            content=transformed_content,
            style=payload.style,
            reference_poem=payload.referencePoem,
            mode='transform',
            source_text=modern_text,
        )
        transformed_content = str(feedback.get('revisedContent') or modern_text).strip() or modern_text

    feedback['revisedContent'] = transformed_content
    feedback['sourceText'] = modern_text
    now = datetime.now(timezone.utc).isoformat()

    client = get_supabase_admin()
    creation = insert_creation_record(
        client,
        user_id=user.id,
        style=payload.style,
        reference_poem=payload.referencePoem,
        content=transformed_content,
        feedback=feedback,
        created_at=now,
        mode='transform',
        source_text=modern_text,
    )

    await _invalidate_creation_cache(user.id)
    return ok({'feedback': feedback, 'creation': creation, 'source': feedback_source}, _trace_id(request))


@router.patch('/api/create/{creation_id}/visibility')
async def creation_visibility_update(
    creation_id: str,
    payload: CreationVisibilityUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    row_result = (
        client.table('creations')
        .select('id')
        .eq('id', creation_id)
        .eq('user_id', user.id)
        .limit(1)
        .execute()
    )
    rows = row_result.data or []
    if not rows:
        return JSONResponse(status_code=404, content=fail('Creation not found', _trace_id(request), code=4042))

    next_is_public = bool(payload.isPublic)
    next_published_at = datetime.now(timezone.utc).isoformat() if next_is_public else None

    try:
        update_result = (
            client.table('creations')
            .update({'is_public': next_is_public, 'published_at': next_published_at})
            .eq('id', creation_id)
            .eq('user_id', user.id)
            .execute()
        )
        updated = (update_result.data or [None])[0]
    except Exception:
        return _creation_visibility_table_error(request)

    if not isinstance(updated, dict):
        updated = {'id': creation_id, 'is_public': next_is_public, 'published_at': next_published_at}
    else:
        updated.setdefault('is_public', next_is_public)
        updated.setdefault('published_at', next_published_at)

    await _invalidate_creation_cache(user.id)
    await _invalidate_creation_public_cache()
    return ok({'creation': updated}, _trace_id(request))


@router.patch('/api/create/{creation_id}/like')
async def creation_like_update(
    creation_id: str,
    payload: CreationLikeUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    row_result = (
        client.table('creations')
        .select('id,user_id,is_public,like_count')
        .eq('id', creation_id)
        .limit(1)
        .execute()
    )
    rows = row_result.data or []
    if not rows:
        return JSONResponse(status_code=404, content=fail('Creation not found', _trace_id(request), code=4042))

    creation = rows[0]
    if not bool(creation.get('is_public')):
        return JSONResponse(status_code=400, content=fail('Only public creations can be liked', _trace_id(request), code=4006))
    owner_id = str(creation.get('user_id') or '').strip()
    if owner_id and owner_id == user.id:
        return JSONResponse(status_code=400, content=fail('Cannot like your own creation', _trace_id(request), code=4007))

    liked = bool(payload.liked)
    await _ensure_creation_like_rate_limit(user.id, creation_id)
    try:
        if liked:
            client.table('creation_likes').upsert(
                {
                    'creation_id': creation_id,
                    'user_id': user.id,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                },
                on_conflict='creation_id,user_id',
            ).execute()
        else:
            client.table('creation_likes').delete().eq('creation_id', creation_id).eq('user_id', user.id).execute()

        likes_result = client.table('creation_likes').select('id', count='planned').eq('creation_id', creation_id).execute()
        like_count = max(0, int(likes_result.count or 0))
        client.table('creations').update({'like_count': like_count}).eq('id', creation_id).execute()
    except Exception:
        return _creation_like_table_error(request)

    await _invalidate_creation_public_cache()
    if owner_id:
        await _invalidate_creation_cache(owner_id)

    return ok({'creationId': creation_id, 'liked': liked, 'likeCount': like_count}, _trace_id(request))


@router.delete('/api/create/{creation_id}')
async def creation_delete(
    creation_id: str,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    row_result = (
        client.table('creations')
        .select('id')
        .eq('id', creation_id)
        .eq('user_id', user.id)
        .limit(1)
        .execute()
    )
    rows = row_result.data or []
    if not rows:
        return JSONResponse(status_code=404, content=fail('Creation not found', _trace_id(request), code=4042))

    client.table('creations').delete().eq('id', creation_id).eq('user_id', user.id).execute()
    await _invalidate_creation_cache(user.id)
    await _invalidate_creation_public_cache()
    return ok({'deletedId': creation_id}, _trace_id(request))
