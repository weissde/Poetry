from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import time
from datetime import date, datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..cache import cache_delete_prefix, cache_get_json, cache_set_json
from ..response import fail, ok
from ..schemas import PoemExamPointCreateRequest, PoemExamPointsUpsertRequest, PoemFavoriteUpdateRequest, PoemNoteUpsertRequest
from ..services.cache_invalidation import _invalidate_poem_favorites_cache
from ..services.summary_service import get_user_role
from ..supabase_client import get_supabase_admin

router = APIRouter()
logger = logging.getLogger("poetry_ai.api.poems")

POEM_BASE_FIELDS = ("id", "title", "author", "dynasty", "content", "tags", "grade_level")
POEM_BASE_SELECT = ",".join(POEM_BASE_FIELDS)
POEM_SNAPSHOT_SELECT = f"{POEM_BASE_SELECT},updated_at"
POEM_SNAPSHOT_LIMIT = 5000
POEM_SNAPSHOT_TTL_SECONDS = 300
_poem_snapshot_lock = asyncio.Lock()
_poem_snapshot_expires_at = 0.0
_poem_snapshot_rows: list[dict[str, Any]] = []
_poem_snapshot_by_id: dict[str, dict[str, Any]] = {}
_poem_snapshot_by_title: dict[str, list[dict[str, Any]]] = {}


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _norm_text(value: Any) -> str:
    return str(value or "").strip()


def _norm_lower(value: Any) -> str:
    return _norm_text(value).lower()


def _match_theme(tags_raw: Any, keyword: str) -> bool:
    if not isinstance(tags_raw, list):
        return False
    expected = _norm_lower(keyword)
    if not expected:
        return False
    for item in tags_raw:
        if _norm_lower(item) == expected:
            return True
    return False


def _poem_base_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {field: row.get(field) for field in POEM_BASE_FIELDS}


def _safe_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if isinstance(item, str) and str(item).strip()]


def _related_poem_score(source: dict[str, Any], candidate: dict[str, Any]) -> int:
    score = 0
    source_author = _norm_text(source.get("author"))
    source_dynasty = _norm_text(source.get("dynasty"))
    source_tags = set(_safe_list(source.get("tags")))
    source_grade = set(_safe_list(source.get("grade_level")))
    source_title = _norm_text(source.get("title"))
    source_content = _norm_text(source.get("content"))

    candidate_author = _norm_text(candidate.get("author"))
    candidate_dynasty = _norm_text(candidate.get("dynasty"))
    candidate_tags = set(_safe_list(candidate.get("tags")))
    candidate_grade = set(_safe_list(candidate.get("grade_level")))
    candidate_title = _norm_text(candidate.get("title"))
    candidate_content = _norm_text(candidate.get("content"))

    if source_author and candidate_author and source_author == candidate_author:
        score += 60
    if source_dynasty and candidate_dynasty and source_dynasty == candidate_dynasty:
        score += 20

    shared_tags = source_tags & candidate_tags
    score += min(3, len(shared_tags)) * 12

    shared_grade = source_grade & candidate_grade
    score += min(2, len(shared_grade)) * 8

    shared_title_chars = set(source_title) & set(candidate_title)
    score += min(5, len([c for c in shared_title_chars if c.strip()])) * 2

    if source_content and candidate_content and source_content[:6] == candidate_content[:6]:
        score += 6

    return max(0, score)


def _build_poems_snapshot(rows: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    by_id: dict[str, dict[str, Any]] = {}
    by_title: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        poem_id = _norm_text(row.get("id"))
        if poem_id:
            by_id[poem_id] = row

        title_key = _norm_lower(row.get("title"))
        if title_key:
            by_title.setdefault(title_key, []).append(row)

    return by_id, by_title


async def _get_poems_snapshot(client: Any, *, force_refresh: bool = False) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    global _poem_snapshot_expires_at, _poem_snapshot_rows, _poem_snapshot_by_id, _poem_snapshot_by_title

    now = time.time()
    if not force_refresh and _poem_snapshot_rows and now < _poem_snapshot_expires_at:
        return _poem_snapshot_rows, _poem_snapshot_by_id, _poem_snapshot_by_title

    async with _poem_snapshot_lock:
        now = time.time()
        if not force_refresh and _poem_snapshot_rows and now < _poem_snapshot_expires_at:
            return _poem_snapshot_rows, _poem_snapshot_by_id, _poem_snapshot_by_title

        result = client.table("poems").select(POEM_SNAPSHOT_SELECT).order("updated_at", desc=True).limit(POEM_SNAPSHOT_LIMIT).execute()
        rows = result.data or []
        by_id, by_title = _build_poems_snapshot(rows)
        _poem_snapshot_rows = rows
        _poem_snapshot_by_id = by_id
        _poem_snapshot_by_title = by_title
        _poem_snapshot_expires_at = time.time() + POEM_SNAPSHOT_TTL_SECONDS
        return rows, by_id, by_title


def _extract_poem_relation(raw: Any) -> dict[str, Any] | None:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        return raw[0]
    return None


def _study_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail(
            "study tables are not ready. Please run migration 006_poem_favorites_notes.sql first.",
            _trace_id(request),
            code=5302,
        ),
    )


def _safe_execute(query_result: Any) -> list[dict[str, Any]]:
    """Safely get data from a Supabase query result, returning empty list on error."""
    data: list[dict[str, Any]] = []
    try:
        # .execute() returns SyncQueryResult; data is a list
        raw = query_result.data if hasattr(query_result, "data") else query_result
        if isinstance(raw, list):
            data = [dict(item) for item in raw]
    except Exception:
        pass
    return data


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stable_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _poem_exists(client: Any, poem_id: str) -> bool:
    result = client.table("poems").select("id").eq("id", poem_id).limit(1).execute()
    return bool(result.data or [])


def _split_exam_points_text(raw: str) -> list[str]:
    items = [
        item.strip(" -•\t")
        for item in re.split(r"[\n。！？；]+", raw or "")
        if str(item or "").strip(" -•\t")
    ]
    deduped: list[str] = []
    seen: set[str] = set()
    for item in items:
        normalized = item.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(item)
        if len(deduped) >= 6:
            break
    return deduped


def _normalize_exam_points_list(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    normalized: list[dict[str, str]] = []
    for item in raw:
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


def _extract_exam_points_from_analysis(analysis_json: dict[str, Any]) -> list[dict[str, str]]:
    raw = analysis_json.get("exam_points") or analysis_json.get("考点")
    if not raw:
        exam_points_obj = analysis_json.get("examPoints")
        if isinstance(exam_points_obj, dict):
            content = _norm_text(exam_points_obj.get("content"))
            if content:
                return [{"type": "考点", "content": content}]
        return []
    return _normalize_exam_points_list(raw)


async def _ensure_teacher(user: CurrentUser) -> None:
    payload = await get_user_role(user.id)
    role = _norm_text(payload.get("role")).lower() or "student"
    if role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher role required")


def _exam_points_to_bullet_points(exam_points: list[dict[str, str]]) -> list[str]:
    bullet_points: list[str] = []
    seen: set[str] = set()
    for item in exam_points:
        point_type = _norm_text(item.get("type"))
        content = _norm_text(item.get("content"))
        if not content:
            continue
        text = f"{point_type}：{content}" if point_type else content
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        bullet_points.append(text)
        if len(bullet_points) >= 6:
            break
    return bullet_points


@router.on_event("startup")
async def warm_poems_snapshot_on_startup() -> None:
    async def _warm_snapshot() -> None:
        try:
            client = get_supabase_admin()
            await _get_poems_snapshot(client, force_refresh=True)
        except Exception:
            logger.warning("poem_snapshot_warmup_failed", exc_info=True)

    asyncio.create_task(_warm_snapshot())


@router.get("/api/poems/search")
async def poems_search(
    request: Request,
    q: str = Query(default=""),
    gradeLevel: str = Query(default=""),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1, le=2000),
    pageSize: int | None = Query(default=None, ge=1, le=100),
):
    client = get_supabase_admin()
    page_size = max(1, min(100, int(pageSize or limit)))
    page_number = max(1, int(page))
    page_start = (page_number - 1) * page_size
    page_end = page_start + page_size - 1
    keyword = q.strip()
    grade_level = gradeLevel.strip().lower()
    cache_key = f"poems-search:{_stable_hash({'q': keyword, 'gradeLevel': grade_level, 'page': page_number, 'pageSize': page_size})}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    try:
        rows, _by_id, _by_title = await _get_poems_snapshot(client)
        if keyword or grade_level:
            expected = _norm_lower(keyword)
            matched_rows = [
                row
                for row in rows
                if (
                    (
                        (not expected)
                        or expected in _norm_lower(row.get("title"))
                        or expected in _norm_lower(row.get("author"))
                        or expected in _norm_lower(row.get("content"))
                    )
                    and (
                        (not grade_level)
                        or grade_level in {_norm_lower(item) for item in _safe_list(row.get("grade_level"))}
                    )
                )
            ]
        else:
            matched_rows = rows

        total = len(matched_rows)
        total_pages = max(1, (total + page_size - 1) // page_size)
        page_items = matched_rows[page_start : page_end + 1]
        payload = {
            "items": [_poem_base_payload(item) for item in page_items],
            "pagination": {
                "page": page_number,
                "pageSize": page_size,
                "total": total,
                "totalPages": total_pages,
                "hasPrev": page_number > 1,
                "hasNext": page_number < total_pages,
            },
        }
        await cache_set_json(cache_key, payload, ttl_seconds=60)
        return ok(payload, _trace_id(request))
    except Exception:
        logger.warning("poems_search_snapshot_failed q=%s grade=%s", keyword, grade_level, exc_info=True)

    query = client.table("poems").select("id,title,author,dynasty,content,tags,grade_level", count="planned")

    if keyword:
        key = f"%{keyword}%"
        query = query.or_(f"title.ilike.{key},author.ilike.{key},content.ilike.{key}")
    if grade_level:
        query = query.contains("grade_level", [grade_level])

    result = query.order("updated_at", desc=True).range(page_start, page_end).execute()
    total = int(result.count or 0)
    total_pages = max(1, (total + page_size - 1) // page_size)
    payload = {
        "items": result.data or [],
        "pagination": {
            "page": page_number,
            "pageSize": page_size,
            "total": total,
            "totalPages": total_pages,
            "hasPrev": page_number > 1,
            "hasNext": page_number < total_pages,
        },
    }
    await cache_set_json(cache_key, payload, ttl_seconds=60)
    return ok(payload, _trace_id(request))


@router.get("/api/poems/favorites")
async def poem_favorites(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    limit: int = Query(default=60, ge=1, le=200),
    page: int = Query(default=1, ge=1, le=2000),
    pageSize: int | None = Query(default=None, ge=1, le=200),
    q: str = Query(default=""),
):
    client = get_supabase_admin()
    page_size = max(1, min(200, int(pageSize or limit)))
    page_number = max(1, int(page))
    page_start = (page_number - 1) * page_size
    page_end = page_start + page_size - 1
    keyword = q.strip()
    cache_key = f"poem-favorites:{user.id}:{_stable_hash({'page': page_number, 'pageSize': page_size, 'q': keyword})}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))
    try:
        favorites_query = (
            client.table("poem_favorites")
            .select("poem_id,created_at,poems(id,title,author,dynasty,content,tags,grade_level)", count="planned")
            .eq("user_id", user.id)
        )

        if keyword:
            key = f"%{keyword}%"
            matched_poem_ids: set[str] = set()

            poem_result = (
                client.table("poems")
                .select("id")
                .or_(f"title.ilike.{key},author.ilike.{key},dynasty.ilike.{key},content.ilike.{key}")
                .limit(1000)
                .execute()
            )
            for row in poem_result.data or []:
                poem_id = str(row.get("id") or "").strip()
                if poem_id:
                    matched_poem_ids.add(poem_id)

            note_result = (
                client.table("poem_notes")
                .select("poem_id")
                .eq("user_id", user.id)
                .ilike("note", key)
                .limit(1000)
                .execute()
            )
            for row in note_result.data or []:
                poem_id = str(row.get("poem_id") or "").strip()
                if poem_id:
                    matched_poem_ids.add(poem_id)

            if not matched_poem_ids:
                payload = {
                    "items": [],
                    "pagination": {
                        "page": page_number,
                        "pageSize": page_size,
                        "total": 0,
                        "totalPages": 1,
                        "hasPrev": page_number > 1,
                        "hasNext": False,
                    },
                }
                await cache_set_json(cache_key, payload, ttl_seconds=30)
                return ok(payload, _trace_id(request))

            favorites_query = favorites_query.in_("poem_id", list(matched_poem_ids))

        result = favorites_query.order("created_at", desc=True).range(page_start, page_end).execute()
        rows = result.data or []
        total = int(result.count or 0)
        poem_ids = [str(row.get("poem_id")) for row in rows if row.get("poem_id")]

        note_map: dict[str, dict[str, Any]] = {}
        if poem_ids:
            note_result = (
                client.table("poem_notes")
                .select("poem_id,note,updated_at")
                .eq("user_id", user.id)
                .in_("poem_id", poem_ids)
                .execute()
            )
            for row in note_result.data or []:
                poem_id = str(row.get("poem_id") or "").strip()
                if poem_id:
                    note_map[poem_id] = {
                        "note": str(row.get("note") or ""),
                        "noteUpdatedAt": row.get("updated_at"),
                    }

        items: list[dict[str, Any]] = []
        for row in rows:
            poem = _extract_poem_relation(row.get("poems"))
            if not poem:
                continue
            poem_id = str(row.get("poem_id") or "")
            note_info = note_map.get(poem_id, {})
            items.append(
                {
                    "poemId": poem_id,
                    "favoritedAt": row.get("created_at"),
                    "note": note_info.get("note", ""),
                    "noteUpdatedAt": note_info.get("noteUpdatedAt"),
                    "poem": poem,
                }
            )
        total_pages = max(1, (total + page_size - 1) // page_size)
        payload = {
            "items": items,
            "pagination": {
                "page": page_number,
                "pageSize": page_size,
                "total": total,
                "totalPages": total_pages,
                "hasPrev": page_number > 1,
                "hasNext": page_number < total_pages,
            },
        }
        await cache_set_json(cache_key, payload, ttl_seconds=30)
        return ok(payload, _trace_id(request))
    except Exception:
        return _study_table_error(request)


@router.get("/api/poems/{poem_id}")
async def poem_detail(poem_id: str, request: Request):
    cache_key = f"poem-detail:{poem_id}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    try:
        _rows, by_id, _by_title = await _get_poems_snapshot(client)
        snapshot_item = by_id.get(poem_id)
        if isinstance(snapshot_item, dict):
            payload = _poem_base_payload(snapshot_item)
            await cache_set_json(cache_key, payload, ttl_seconds=300)
            return ok(payload, _trace_id(request))
    except Exception:
        logger.warning("poem_snapshot_lookup_failed poem_id=%s", poem_id, exc_info=True)

    result = client.table("poems").select(POEM_BASE_SELECT).eq("id", poem_id).limit(1).execute()
    rows = result.data or []
    if not rows:
        return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))

    payload = rows[0]
    await cache_set_json(cache_key, payload, ttl_seconds=300)
    return ok(payload, _trace_id(request))


@router.get("/api/poems/{poem_id}/exam-points")
async def poem_exam_points(poem_id: str, request: Request):
    cache_key = f"poem-exam-points:{poem_id}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    poem_result = (
        client.table("poems")
        .select("id,title,author,exam_points,teaching_objectives")
        .eq("id", poem_id)
        .limit(1)
        .execute()
    )
    poem_row = (poem_result.data or [None])[0]
    if not isinstance(poem_row, dict):
        return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))

    source = "poems.exam_points"
    updated_at = None

    exam_points = _normalize_exam_points_list(poem_row.get("exam_points"))
    bullet_points = _exam_points_to_bullet_points(exam_points)

    if not exam_points:
        analysis_result = (
            client.table("analysis_cache")
            .select("analysis_json,updated_at")
            .eq("poem_id", poem_id)
            .eq("model", "exam")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        analysis_row = (analysis_result.data or [None])[0]
        if not isinstance(analysis_row, dict):
            analysis_result = (
                client.table("analysis_cache")
                .select("analysis_json,updated_at")
                .eq("poem_id", poem_id)
                .order("updated_at", desc=True)
                .limit(1)
                .execute()
            )
            analysis_row = (analysis_result.data or [None])[0]
        if isinstance(analysis_row, dict) and isinstance(analysis_row.get("analysis_json"), dict):
            exam_points = _extract_exam_points_from_analysis(analysis_row["analysis_json"])
            bullet_points = _exam_points_to_bullet_points(exam_points)
            if bullet_points:
                source = "analysis_cache"
                updated_at = analysis_row.get("updated_at")

    if not bullet_points:
        objectives = poem_row.get("teaching_objectives")
        objective_goals: list[str] = []
        if isinstance(objectives, list):
            for item in objectives:
                if not isinstance(item, dict):
                    continue
                raw_goals = item.get("goals")
                if isinstance(raw_goals, list):
                    for raw_goal in raw_goals:
                        text = _norm_text(raw_goal)
                        if text:
                            objective_goals.append(text)
                summary_text = _norm_text(item.get("summary"))
                if summary_text:
                    objective_goals.append(summary_text)
        if objective_goals:
            source = "teaching_objectives"
            bullet_points = []
            seen: set[str] = set()
            for goal in objective_goals:
                normalized = goal.lower()
                if normalized in seen:
                    continue
                seen.add(normalized)
                bullet_points.append(goal)
                if len(bullet_points) >= 4:
                    break

    if not bullet_points:
        source = "heuristic"
        bullet_points = [
            "先抓住核心意象，再判断情感走向。",
            "回答题目时尽量引用诗句中的关键词作依据。",
            "从表达手法与主旨作用两个层次组织答题语言。",
        ]

    summary = "；".join(bullet_points)

    payload = {
        "poemId": _norm_text(poem_row.get("id")),
        "poem_id": _norm_text(poem_row.get("id")),
        "poemTitle": _norm_text(poem_row.get("title")),
        "poem_title": _norm_text(poem_row.get("title")),
        "summary": summary,
        "bulletPoints": bullet_points,
        "source": source,
        "updatedAt": updated_at,
        "examPoints": exam_points,
        "exam_points": exam_points,
    }
    await cache_set_json(cache_key, payload, ttl_seconds=300)
    return ok(payload, _trace_id(request))


@router.post("/api/poems/{poem_id}/exam-points")
async def poem_exam_points_upsert(
    poem_id: str,
    payload: PoemExamPointsUpsertRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    if not _poem_exists(client, poem_id):
        return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))

    normalized = _normalize_exam_points_list(payload.examPoints)
    try:
        client.table("poems").update({"exam_points": normalized, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", poem_id).execute()
        await cache_delete_prefix(f"poem-exam-points:{poem_id}")
    except Exception:
        return _study_table_error(request)
    return ok({"poemId": poem_id, "examPoints": normalized}, _trace_id(request))


@router.post("/api/poems/{poem_id}/exam-points/add")
async def poem_exam_point_add(
    poem_id: str,
    payload: PoemExamPointCreateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    await _ensure_teacher(user)
    client = get_supabase_admin()
    poem_result = client.table("poems").select("id,exam_points").eq("id", poem_id).limit(1).execute()
    poem_row = (poem_result.data or [None])[0]
    if not isinstance(poem_row, dict):
        return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))

    exam_points = _normalize_exam_points_list(poem_row.get("exam_points"))
    exam_points.append({"type": _norm_text(payload.pointType) or "考点", "content": _norm_text(payload.content)})
    deduped = _normalize_exam_points_list(exam_points)
    try:
        client.table("poems").update({"exam_points": deduped, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", poem_id).execute()
        await cache_delete_prefix(f"poem-exam-points:{poem_id}")
    except Exception:
        return _study_table_error(request)
    return ok({"poemId": poem_id, "examPoints": deduped}, _trace_id(request))


@router.get("/api/poems/{poem_id}/related")
async def poem_related(
    poem_id: str,
    request: Request,
    limit: int = Query(default=6, ge=3, le=20),
):
    cache_key = f"poem-related:{poem_id}:{limit}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    source: dict[str, Any] | None = None
    rows: list[dict[str, Any]] = []

    try:
        rows, by_id, _by_title = await _get_poems_snapshot(client)
        source = by_id.get(poem_id)
    except Exception:
        logger.warning("poem_related_snapshot_failed poem_id=%s", poem_id, exc_info=True)

    if not isinstance(source, dict):
        source_result = client.table("poems").select(POEM_BASE_SELECT).eq("id", poem_id).limit(1).execute()
        source_rows = source_result.data or []
        if not source_rows:
            return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))
        source = source_rows[0]
        if not rows:
            fallback_rows_result = client.table("poems").select(POEM_BASE_SELECT).order("updated_at", desc=True).limit(2000).execute()
            rows = fallback_rows_result.data or []

    source_author = _norm_text(source.get("author"))
    source_dynasty = _norm_text(source.get("dynasty"))
    source_tags = _safe_list(source.get("tags"))

    scored: list[tuple[int, dict[str, Any]]] = []
    for row in rows:
        candidate_id = _norm_text(row.get("id"))
        if not candidate_id or candidate_id == poem_id:
            continue
        score = _related_poem_score(source, row)
        if score > 0:
            scored.append((score, row))

    if not scored:
        query = client.table("poems").select(POEM_BASE_SELECT).neq("id", poem_id).limit(80)
        if source_author:
            query = query.eq("author", source_author)
        elif source_dynasty:
            query = query.eq("dynasty", source_dynasty)
        elif source_tags:
            try:
                query = query.contains("tags", [source_tags[0]])
            except Exception:
                pass
        fallback_items = query.execute().data or []
        payload = {"items": [_poem_base_payload(item) for item in fallback_items[:limit]]}
        await cache_set_json(cache_key, payload, ttl_seconds=300)
        return ok(payload, _trace_id(request))

    scored.sort(key=lambda item: (-item[0], _norm_text(item[1].get("title"))))
    items = [_poem_base_payload(item[1]) for item in scored[:limit]]
    payload = {"items": items}
    await cache_set_json(cache_key, payload, ttl_seconds=300)
    return ok(payload, _trace_id(request))


@router.get("/api/poems/{poem_id}/study-state")
async def poem_study_state(poem_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()
    if not _poem_exists(client, poem_id):
        return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))

    try:
        favorite_result = (
            client.table("poem_favorites")
            .select("id")
            .eq("user_id", user.id)
            .eq("poem_id", poem_id)
            .limit(1)
            .execute()
        )
        note_result = (
            client.table("poem_notes")
            .select("note,updated_at")
            .eq("user_id", user.id)
            .eq("poem_id", poem_id)
            .limit(1)
            .execute()
        )

        # 查询学习进度
        study_state_result = _safe_execute(
            client.table("poem_study_states")
            .select("*")
            .eq("user_id", user.id)
            .eq("poem_id", poem_id)
            .limit(1)
        )

        favorited = bool(favorite_result.data or [])
        note_rows = note_result.data or []
        note_row = note_rows[0] if note_rows else {}
        study_row = study_state_result[0] if study_state_result else {}

        return ok(
            {
                "poemId": poem_id,
                "isFavorited": favorited,
                "note": str(note_row.get("note") or ""),
                "noteUpdatedAt": note_row.get("updated_at"),
                "currentStage": study_row.get("current_stage", "not_started"),
                "stage1CompletedAt": study_row.get("stage1_completed_at"),
                "stage2CompletedAt": study_row.get("stage2_completed_at"),
                "stage3CompletedAt": study_row.get("stage3_completed_at"),
                "stage4CompletedAt": study_row.get("stage4_completed_at"),
                "fullyCompletedAt": study_row.get("fully_completed_at"),
                "lastAccessedAt": study_row.get("last_accessed_at"),
            },
            _trace_id(request),
        )
    except Exception:
        return _study_table_error(request)


class PoemStudyStateUpdateRequest(BaseModel):
    current_stage: Optional[str] = None
    stage_completed: Optional[str] = None  # "stage1", "stage2", "stage3", "stage4"


@router.post("/api/poems/{poem_id}/study-state")
async def poem_study_state_update(
    poem_id: str,
    payload: PoemStudyStateUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    if not _poem_exists(client, poem_id):
        return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))

    now = _now_iso()
    update_data: dict[str, Any] = {
        "user_id": user.id,
        "poem_id": poem_id,
        "last_accessed_at": now,
        "updated_at": now,
    }

    if payload.current_stage:
        update_data["current_stage"] = payload.current_stage

    if payload.stage_completed:
        stage_field = f"{payload.stage_completed}_completed_at"
        update_data[stage_field] = now
        if payload.stage_completed == "stage4":
            update_data["fully_completed_at"] = now

    result = (
        client.table("poem_study_states")
        .upsert(update_data, on_conflict="user_id,poem_id")
        .execute()
    )
    rows = _safe_execute(result)
    return ok(rows[0] if rows else update_data, _trace_id(request))


@router.get("/api/user/poem-progress")
async def user_poem_progress(request: Request, user: CurrentUser = Depends(get_current_user)):
    """Return poem_id -> current_stage mapping for all poems the user has interacted with."""
    client = get_supabase_admin()
    result = (
        client.table("poem_study_states")
        .select("poem_id,current_stage,last_accessed_at")
        .eq("user_id", user.id)
        .order("last_accessed_at", desc=True)
        .limit(500)
        .execute()
    )
    rows = _safe_execute(result)
    progress_map: dict[str, dict[str, Any]] = {}
    for row in rows:
        pid = row.get("poem_id")
        if pid:
            progress_map[pid] = {
                "currentStage": row.get("current_stage", "not_started"),
                "lastAccessedAt": row.get("last_accessed_at"),
            }
    return ok({"progress": progress_map}, _trace_id(request))


@router.post("/api/poems/{poem_id}/favorite")
async def poem_favorite_update(
    poem_id: str,
    payload: PoemFavoriteUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    if not _poem_exists(client, poem_id):
        return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))

    try:
        if payload.favorited:
            client.table("poem_favorites").upsert(
                {
                    "user_id": user.id,
                    "poem_id": poem_id,
                },
                on_conflict="user_id,poem_id",
            ).execute()
        else:
            client.table("poem_favorites").delete().eq("user_id", user.id).eq("poem_id", poem_id).execute()

        await _invalidate_poem_favorites_cache(user.id)
        return ok({"poemId": poem_id, "isFavorited": payload.favorited}, _trace_id(request))
    except Exception:
        return _study_table_error(request)


@router.patch("/api/poems/{poem_id}/note")
async def poem_note_upsert(
    poem_id: str,
    payload: PoemNoteUpsertRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    if not _poem_exists(client, poem_id):
        return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))

    note_text = (payload.note or "").strip()
    now = datetime.now(timezone.utc).isoformat()

    try:
        if note_text:
            client.table("poem_notes").upsert(
                {
                    "user_id": user.id,
                    "poem_id": poem_id,
                    "note": note_text,
                    "updated_at": now,
                },
                on_conflict="user_id,poem_id",
            ).execute()
            updated_at = now
        else:
            client.table("poem_notes").delete().eq("user_id", user.id).eq("poem_id", poem_id).execute()
            updated_at = None

        await _invalidate_poem_favorites_cache(user.id)
        return ok(
            {
                "poemId": poem_id,
                "note": note_text,
                "noteUpdatedAt": updated_at,
            },
            _trace_id(request),
        )
    except Exception:
        return _study_table_error(request)
