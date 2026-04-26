from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..auth import CurrentUser, get_current_user
from ..cache import cache_get_json, cache_set_json
from ..response import ok
from ..schemas import WrongbookBatchUpdate, WrongbookItemIn, WrongbookStatusUpdate
from ..services.cache_invalidation import _invalidate_learning_cache, _invalidate_nav_pending_cache, _invalidate_wrongbook_cache
from ..supabase_client import get_supabase_admin

router = APIRouter()

_wrong_questions_extended_supported: bool | None = None
_wrong_questions_question_id_supported: bool | None = None


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _can_use_wrong_questions_extended() -> bool:
    # Unknown(None) defaults to True and will be downgraded after first schema mismatch.
    return _wrong_questions_extended_supported is not False


def _mark_wrong_questions_extended_supported(supported: bool) -> None:
    global _wrong_questions_extended_supported
    _wrong_questions_extended_supported = bool(supported)


def _can_use_wrong_questions_question_id() -> bool:
    # 021 is optional during rollout; keep 003/009 columns usable if it is not applied yet.
    return _wrong_questions_question_id_supported is not False


def _mark_wrong_questions_question_id_supported(supported: bool) -> None:
    global _wrong_questions_question_id_supported
    _wrong_questions_question_id_supported = bool(supported)


def _parse_exact_date_range(raw_date: str | None) -> tuple[str | None, str | None]:
    if not raw_date:
        return None, None
    try:
        parsed = datetime.fromisoformat(raw_date).date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid date format, expected YYYY-MM-DD") from exc
    start = datetime(parsed.year, parsed.month, parsed.day, tzinfo=timezone.utc)
    end = datetime.fromtimestamp(start.timestamp() + 86400, tz=timezone.utc)
    return start.isoformat(), end.isoformat()


def _aggregate_string_counts(rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for row in rows:
        raw = row.get(key)
        if not isinstance(raw, str):
            continue
        value = raw.strip()
        if not value:
            continue
        counts[value] = counts.get(value, 0) + 1

    items = [{"value": k, "count": v} for k, v in counts.items()]
    items.sort(key=lambda item: (-int(item["count"]), str(item["value"])))
    return items


def _aggregate_keyword_tags(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for row in rows:
        raw_tags = row.get("keyword_tags")
        if not isinstance(raw_tags, list):
            continue
        for raw_item in raw_tags:
            if not isinstance(raw_item, str):
                continue
            value = raw_item.strip()
            if not value:
                continue
            counts[value] = counts.get(value, 0) + 1

    items = [{"value": k, "count": v} for k, v in counts.items()]
    items.sort(key=lambda item: (-int(item["count"]), str(item["value"])))
    return items


def _build_trend_items(rows: list[dict[str, Any]], days: int) -> list[dict[str, Any]]:
    bucket_dates: list[str] = []
    created_map: dict[str, int] = {}
    mastered_map: dict[str, int] = {}
    now_utc = datetime.now(timezone.utc)
    for offset in range(days - 1, -1, -1):
        key = datetime.fromtimestamp(now_utc.timestamp() - (offset * 86400), tz=timezone.utc).date().isoformat()
        bucket_dates.append(key)
        created_map[key] = 0
        mastered_map[key] = 0

    for row in rows:
        created_at = row.get("created_at")
        if isinstance(created_at, str) and len(created_at) >= 10:
            created_key = created_at[:10]
            if created_key in created_map:
                created_map[created_key] += 1

        if row.get("status") == "mastered":
            updated_at = row.get("updated_at") or row.get("created_at")
            if isinstance(updated_at, str) and len(updated_at) >= 10:
                updated_key = updated_at[:10]
                if updated_key in mastered_map:
                    mastered_map[updated_key] += 1

    return [{"date": key, "created": created_map.get(key, 0), "mastered": mastered_map.get(key, 0)} for key in bucket_dates]


def _build_weekly_trend_items(rows: list[dict[str, Any]], days: int) -> list[dict[str, Any]]:
    normalized_days = max(7, days)
    bucket_count = max(1, (normalized_days + 6) // 7)
    now_utc = datetime.now(timezone.utc)
    buckets: list[dict[str, Any]] = []
    for index in range(bucket_count):
        bucket_end = (now_utc - timedelta(days=(bucket_count - 1 - index) * 7)).date()
        bucket_start = bucket_end - timedelta(days=6)
        buckets.append(
            {
                "label": f"第{index + 1}周",
                "startDate": bucket_start.isoformat(),
                "endDate": bucket_end.isoformat(),
                "created": 0,
                "mastered": 0,
            }
        )

    for row in rows:
        created_at = row.get("created_at")
        created_date = None
        if isinstance(created_at, str) and len(created_at) >= 10:
            try:
                created_date = datetime.fromisoformat(created_at.replace("Z", "+00:00")).date()
            except ValueError:
                created_date = None

        updated_at = row.get("updated_at") or row.get("created_at")
        updated_date = None
        if isinstance(updated_at, str) and len(updated_at) >= 10:
            try:
                updated_date = datetime.fromisoformat(updated_at.replace("Z", "+00:00")).date()
            except ValueError:
                updated_date = None

        for bucket in buckets:
            start_date = date.fromisoformat(bucket["startDate"])
            end_date = date.fromisoformat(bucket["endDate"])
            if created_date is not None and start_date <= created_date <= end_date:
                bucket["created"] += 1
            if row.get("status") == "mastered" and updated_date is not None and start_date <= updated_date <= end_date:
                bucket["mastered"] += 1

    return buckets


@router.get("/api/wrongbook")
async def wrongbook_list(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    status: str | None = Query(default=None),
    errorType: str | None = Query(default=None),
    questionKind: str | None = Query(default=None),
    keywordTag: str | None = Query(default=None),
    dynasty: str | None = Query(default=None),
    theme: str | None = Query(default=None),
    date: str | None = Query(default=None),
    days: int | None = Query(default=None, ge=1, le=3650),
    q: str = Query(default=""),
    limit: int = Query(default=300, ge=1, le=1000),
):
    client = get_supabase_admin()
    exact_day_start_iso, exact_day_end_iso = _parse_exact_date_range(date)

    def build_query(
        select_columns: str,
        allow_dimension_filters: bool = True,
        allow_extended_filters: bool = True,
    ):
        query = client.table("wrong_questions").select(select_columns).eq("user_id", user.id)

        if status in {"pending", "mastered", "retry"}:
            query = query.eq("status", status)

        if errorType and errorType.strip() and errorType.strip().lower() != "all":
            query = query.eq("error_type", errorType.strip())

        if allow_extended_filters and questionKind and questionKind.strip() and questionKind.strip().lower() != "all":
            query = query.eq("question_kind", questionKind.strip())

        if allow_extended_filters and keywordTag and keywordTag.strip():
            query = query.contains("keyword_tags", [keywordTag.strip()])

        if allow_dimension_filters and dynasty and dynasty.strip() and dynasty.strip().lower() != "all":
            query = query.eq("dynasty", dynasty.strip())

        if allow_dimension_filters and theme and theme.strip() and theme.strip().lower() != "all":
            query = query.eq("theme", theme.strip())

        if exact_day_start_iso and exact_day_end_iso:
            query = query.gte("created_at", exact_day_start_iso)
            query = query.lt("created_at", exact_day_end_iso)

        if days and not exact_day_start_iso:
            since = datetime.now(timezone.utc).timestamp() - (days * 86400)
            since_iso = datetime.fromtimestamp(since, tz=timezone.utc).isoformat()
            query = query.gte("created_at", since_iso)

        if q.strip():
            keyword = f"%{q.strip()}%"
            query = query.or_(f"poem_title.ilike.{keyword},question_content.ilike.{keyword},explanation.ilike.{keyword}")

        return query

    extended_select = (
        "id,poem_title,question_content,user_answer,correct_answer,explanation,error_type,"
        "question_kind,keyword_tags,dynasty,theme,status,created_at"
    )
    try:
        select_columns = f"id,question_id,{extended_select.removeprefix('id,')}" if _can_use_wrong_questions_question_id() else extended_select
        try:
            result = build_query(select_columns).order("created_at", desc=True).limit(limit).execute()
        except Exception:
            if not _can_use_wrong_questions_question_id():
                raise
            _mark_wrong_questions_question_id_supported(False)
            result = build_query(extended_select).order("created_at", desc=True).limit(limit).execute()
        return ok({"items": result.data or []}, _trace_id(request))
    except Exception:
        # Fallback for environments where new columns are not migrated yet.
        result = build_query(
            "id,poem_title,question_content,user_answer,correct_answer,explanation,error_type,status,created_at",
            allow_dimension_filters=False,
            allow_extended_filters=False,
        ).order("created_at", desc=True).limit(limit).execute()
        items = result.data or []
        for item in items:
            item.setdefault("question_id", None)
            item.setdefault("dynasty", None)
            item.setdefault("theme", None)
            item.setdefault("question_kind", None)
            item.setdefault("keyword_tags", [])
        return ok({"items": items}, _trace_id(request))


@router.get("/api/wrongbook/meta")
async def wrongbook_meta(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    status: str | None = Query(default=None),
    errorType: str | None = Query(default=None),
    questionKind: str | None = Query(default=None),
    keywordTag: str | None = Query(default=None),
    date: str | None = Query(default=None),
    days: int | None = Query(default=None, ge=1, le=3650),
):
    client = get_supabase_admin()

    exact_day_start_iso, exact_day_end_iso = _parse_exact_date_range(date)
    since_iso: str | None = None
    if days:
        since = datetime.now(timezone.utc).timestamp() - (days * 86400)
        since_iso = datetime.fromtimestamp(since, tz=timezone.utc).isoformat()

    try:
        query = client.table("wrong_questions").select("error_type,question_kind,keyword_tags,dynasty,theme").eq("user_id", user.id)
        if status in {"pending", "mastered", "retry"}:
            query = query.eq("status", status)
        if errorType and errorType.strip() and errorType.strip().lower() != "all":
            query = query.eq("error_type", errorType.strip())
        if questionKind and questionKind.strip() and questionKind.strip().lower() != "all":
            query = query.eq("question_kind", questionKind.strip())
        if keywordTag and keywordTag.strip():
            query = query.contains("keyword_tags", [keywordTag.strip()])
        if exact_day_start_iso and exact_day_end_iso:
            query = query.gte("created_at", exact_day_start_iso).lt("created_at", exact_day_end_iso)
        if since_iso:
            query = query.gte("created_at", since_iso)
        result = query.limit(3000).execute()
        rows = result.data or []
    except Exception:
        # Fallback for environments where new columns are not migrated yet.
        query = client.table("wrong_questions").select("error_type").eq("user_id", user.id)
        if status in {"pending", "mastered", "retry"}:
            query = query.eq("status", status)
        if errorType and errorType.strip() and errorType.strip().lower() != "all":
            query = query.eq("error_type", errorType.strip())
        if exact_day_start_iso and exact_day_end_iso:
            query = query.gte("created_at", exact_day_start_iso).lt("created_at", exact_day_end_iso)
        if since_iso:
            query = query.gte("created_at", since_iso)
        result = query.limit(3000).execute()
        rows = result.data or []
        for row in rows:
            row["dynasty"] = None
            row["theme"] = None
            row["question_kind"] = None
            row["keyword_tags"] = []

    return ok(
        {
            "errorTypes": _aggregate_string_counts(rows, "error_type"),
            "questionKinds": _aggregate_string_counts(rows, "question_kind"),
            "keywordTags": _aggregate_keyword_tags(rows),
            "dynasties": _aggregate_string_counts(rows, "dynasty"),
            "themes": _aggregate_string_counts(rows, "theme"),
        },
        _trace_id(request),
    )


@router.get("/api/wrongbook/trend")
async def wrongbook_trend(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    days: int = Query(default=7, ge=1, le=90),
    interval: str = Query(default="daily"),
):
    client = get_supabase_admin()
    since_ts = datetime.now(timezone.utc).timestamp() - (days * 86400)
    since_iso = datetime.fromtimestamp(since_ts, tz=timezone.utc).isoformat()

    result = (
        client.table("wrong_questions")
        .select("created_at,updated_at,status")
        .eq("user_id", user.id)
        .or_(f"created_at.gte.{since_iso},updated_at.gte.{since_iso}")
        .limit(5000)
        .execute()
    )
    rows = result.data or []

    normalized_interval = interval.strip().lower()
    if normalized_interval == "weekly":
        items = _build_weekly_trend_items(rows, days)
    else:
        items = _build_trend_items(rows, days)
    return ok({"days": days, "interval": normalized_interval or "daily", "items": items}, _trace_id(request))


@router.get("/api/wrongbook/dashboard")
async def wrongbook_dashboard(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    status: str | None = Query(default=None),
    errorType: str | None = Query(default=None),
    questionKind: str | None = Query(default=None),
    keywordTag: str | None = Query(default=None),
    dynasty: str | None = Query(default=None),
    theme: str | None = Query(default=None),
    date: str | None = Query(default=None),
    days: int | None = Query(default=None, ge=1, le=3650),
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1, le=2000),
    pageSize: int = Query(default=24, ge=6, le=200),
    trendDays: int | None = Query(default=None, ge=1, le=90),
):
    client = get_supabase_admin()
    page_number = max(1, int(page))
    page_size = max(6, min(200, int(pageSize)))
    page_start = (page_number - 1) * page_size
    page_end = page_start + page_size - 1

    exact_day_start_iso, exact_day_end_iso = _parse_exact_date_range(date)
    since_iso: str | None = None
    if (not date) and days:
        since_ts = datetime.now(timezone.utc).timestamp() - (days * 86400)
        since_iso = datetime.fromtimestamp(since_ts, tz=timezone.utc).isoformat()

    trend_window_days = trendDays or (days if days else 30)
    trend_since_ts = datetime.now(timezone.utc).timestamp() - (trend_window_days * 86400)
    trend_since_iso = datetime.fromtimestamp(trend_since_ts, tz=timezone.utc).isoformat()

    base_filter_payload = {
        "status": status or "",
        "errorType": errorType or "",
        "questionKind": questionKind or "",
        "keywordTag": keywordTag or "",
        "dynasty": dynasty or "",
        "theme": theme or "",
        "date": date or "",
        "days": days or 0,
        "q": q.strip(),
        "trendDays": trend_window_days,
    }
    base_fingerprint = hashlib.sha256(
        json.dumps(base_filter_payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    item_fingerprint = hashlib.sha256(
        json.dumps(
            {
                **base_filter_payload,
                "page": page_number,
                "pageSize": page_size,
            },
            sort_keys=True,
            ensure_ascii=False,
        ).encode("utf-8")
    ).hexdigest()

    items_cache_key = f"wrongbook-dashboard-items:{user.id}:{item_fingerprint}"
    meta_cache_key = f"wrongbook-dashboard-meta:{user.id}:{base_fingerprint}"
    cached_items = await cache_get_json(items_cache_key)
    cached_meta = await cache_get_json(meta_cache_key)
    if isinstance(cached_items, dict) and isinstance(cached_meta, dict):
        return ok(
            {
                **cached_items,
                "meta": cached_meta.get("meta")
                or {"errorTypes": [], "questionKinds": [], "keywordTags": [], "dynasties": [], "themes": []},
                "trend": cached_meta.get("trend") or {"days": trend_window_days, "items": []},
            },
            _trace_id(request),
        )

    def build_item_query(
        select_columns: str,
        allow_dimension_filters: bool = True,
        allow_extended_filters: bool = True,
    ):
        query = client.table("wrong_questions").select(select_columns, count="planned").eq("user_id", user.id)

        if status in {"pending", "mastered", "retry"}:
            query = query.eq("status", status)

        if errorType and errorType.strip() and errorType.strip().lower() != "all":
            query = query.eq("error_type", errorType.strip())

        if allow_extended_filters and questionKind and questionKind.strip() and questionKind.strip().lower() != "all":
            query = query.eq("question_kind", questionKind.strip())

        if allow_extended_filters and keywordTag and keywordTag.strip():
            query = query.contains("keyword_tags", [keywordTag.strip()])

        if allow_dimension_filters and dynasty and dynasty.strip() and dynasty.strip().lower() != "all":
            query = query.eq("dynasty", dynasty.strip())

        if allow_dimension_filters and theme and theme.strip() and theme.strip().lower() != "all":
            query = query.eq("theme", theme.strip())

        if exact_day_start_iso and exact_day_end_iso:
            query = query.gte("created_at", exact_day_start_iso).lt("created_at", exact_day_end_iso)
        elif since_iso:
            query = query.gte("created_at", since_iso)

        if q.strip():
            keyword = f"%{q.strip()}%"
            query = query.or_(f"poem_title.ilike.{keyword},question_content.ilike.{keyword},explanation.ilike.{keyword}")

        return query

    if isinstance(cached_items, dict):
        items_payload = cached_items
    else:
        can_use_extended = _can_use_wrong_questions_extended()
        extended_item_select = (
            "id,poem_title,question_content,user_answer,correct_answer,explanation,error_type,"
            "question_kind,keyword_tags,dynasty,theme,status,created_at"
        )
        try:
            if not can_use_extended:
                raise RuntimeError("wrong_questions extended columns disabled")
            select_columns = (
                f"id,question_id,{extended_item_select.removeprefix('id,')}"
                if _can_use_wrong_questions_question_id()
                else extended_item_select
            )
            try:
                item_result = build_item_query(select_columns).order("created_at", desc=True).range(page_start, page_end).execute()
            except Exception:
                if not _can_use_wrong_questions_question_id():
                    raise
                _mark_wrong_questions_question_id_supported(False)
                item_result = build_item_query(extended_item_select).order("created_at", desc=True).range(page_start, page_end).execute()
            total_items = int(item_result.count or 0)
            items = item_result.data or []
        except Exception:
            _mark_wrong_questions_extended_supported(False)
            item_result = (
                build_item_query(
                    "id,poem_title,question_content,user_answer,correct_answer,explanation,error_type,status,created_at",
                    allow_dimension_filters=False,
                    allow_extended_filters=False,
                )
                .order("created_at", desc=True)
                .range(page_start, page_end)
                .execute()
            )
            total_items = int(item_result.count or 0)
            items = item_result.data or []
            for item in items:
                item.setdefault("question_id", None)
                item.setdefault("dynasty", None)
                item.setdefault("theme", None)
                item.setdefault("question_kind", None)
                item.setdefault("keyword_tags", [])

        total_pages = max(1, (total_items + page_size - 1) // page_size)
        items_payload = {
            "items": items,
            "pagination": {
                "page": page_number,
                "pageSize": page_size,
                "total": total_items,
                "totalPages": total_pages,
                "hasPrev": page_number > 1,
                "hasNext": page_number < total_pages,
            },
        }
        await cache_set_json(items_cache_key, items_payload, ttl_seconds=45)

    if isinstance(cached_meta, dict):
        meta_payload = cached_meta
    else:
        can_use_extended = _can_use_wrong_questions_extended()
        try:
            if not can_use_extended:
                raise RuntimeError("wrong_questions extended columns disabled")
            meta_query = client.table("wrong_questions").select("error_type,question_kind,keyword_tags,dynasty,theme").eq("user_id", user.id)
            if status in {"pending", "mastered", "retry"}:
                meta_query = meta_query.eq("status", status)
            if errorType and errorType.strip() and errorType.strip().lower() != "all":
                meta_query = meta_query.eq("error_type", errorType.strip())
            if questionKind and questionKind.strip() and questionKind.strip().lower() != "all":
                meta_query = meta_query.eq("question_kind", questionKind.strip())
            if keywordTag and keywordTag.strip():
                meta_query = meta_query.contains("keyword_tags", [keywordTag.strip()])
            if exact_day_start_iso and exact_day_end_iso:
                meta_query = meta_query.gte("created_at", exact_day_start_iso).lt("created_at", exact_day_end_iso)
            elif since_iso:
                meta_query = meta_query.gte("created_at", since_iso)
            meta_result = meta_query.limit(3000).execute()
            meta_rows = meta_result.data or []
        except Exception:
            _mark_wrong_questions_extended_supported(False)
            meta_query = client.table("wrong_questions").select("error_type").eq("user_id", user.id)
            if status in {"pending", "mastered", "retry"}:
                meta_query = meta_query.eq("status", status)
            if errorType and errorType.strip() and errorType.strip().lower() != "all":
                meta_query = meta_query.eq("error_type", errorType.strip())
            if exact_day_start_iso and exact_day_end_iso:
                meta_query = meta_query.gte("created_at", exact_day_start_iso).lt("created_at", exact_day_end_iso)
            elif since_iso:
                meta_query = meta_query.gte("created_at", since_iso)
            meta_result = meta_query.limit(3000).execute()
            meta_rows = meta_result.data or []
            for row in meta_rows:
                row["dynasty"] = None
                row["theme"] = None
                row["question_kind"] = None
                row["keyword_tags"] = []

        trend_result = (
            client.table("wrong_questions")
            .select("created_at,updated_at,status")
            .eq("user_id", user.id)
            .or_(f"created_at.gte.{trend_since_iso},updated_at.gte.{trend_since_iso}")
            .limit(3000)
            .execute()
        )
        trend_rows = trend_result.data or []
        meta_payload = {
            "meta": {
                "errorTypes": _aggregate_string_counts(meta_rows, "error_type"),
                "questionKinds": _aggregate_string_counts(meta_rows, "question_kind"),
                "keywordTags": _aggregate_keyword_tags(meta_rows),
                "dynasties": _aggregate_string_counts(meta_rows, "dynasty"),
                "themes": _aggregate_string_counts(meta_rows, "theme"),
            },
            "trend": {"days": trend_window_days, "items": _build_trend_items(trend_rows, trend_window_days)},
        }
        await cache_set_json(meta_cache_key, meta_payload, ttl_seconds=45)

    payload = {
        "items": items_payload.get("items") or [],
        "meta": meta_payload.get("meta")
        or {"errorTypes": [], "questionKinds": [], "keywordTags": [], "dynasties": [], "themes": []},
        "trend": meta_payload.get("trend") or {"days": trend_window_days, "items": []},
        "pagination": items_payload.get("pagination")
        or {
            "page": page_number,
            "pageSize": page_size,
            "total": 0,
            "totalPages": 1,
            "hasPrev": False,
            "hasNext": False,
        },
    }
    return ok(payload, _trace_id(request))


@router.post("/api/wrongbook")
async def wrongbook_add(payload: WrongbookItemIn, request: Request, user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    question_id = str(payload.questionId or "").strip() or None
    legacy_base_record = {
        "user_id": user.id,
        "poem_title": payload.poemTitle,
        "question_content": payload.questionContent,
        "user_answer": payload.userAnswer,
        "correct_answer": payload.correctAnswer,
        "explanation": payload.explanation,
        "error_type": payload.errorType,
        "status": payload.status,
        "created_at": now,
        "updated_at": now,
    }
    base_record = {
        **legacy_base_record,
        "question_kind": payload.questionKind,
        "keyword_tags": payload.keywordTags,
    }
    with_dimension = {**base_record, "dynasty": payload.dynasty, "theme": payload.theme}
    with_question_id = {**with_dimension, "question_id": question_id} if question_id else with_dimension

    try:
        result = client.table("wrong_questions").insert(with_question_id).execute()
    except Exception:
        # Fallback for environments where new columns are not migrated yet.
        try:
            result = client.table("wrong_questions").insert(with_dimension).execute()
        except Exception:
            try:
                result = client.table("wrong_questions").insert(base_record).execute()
            except Exception:
                result = client.table("wrong_questions").insert(legacy_base_record).execute()

    await _invalidate_wrongbook_cache(user.id)
    await _invalidate_nav_pending_cache(user.id)
    await _invalidate_learning_cache(user.id)
    return ok({"item": (result.data or [None])[0]}, _trace_id(request))


@router.patch("/api/wrongbook/{item_id}")
async def wrongbook_update_status(
    item_id: str,
    payload: WrongbookStatusUpdate,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    result = (
        client.table("wrong_questions")
        .update({"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", item_id)
        .eq("user_id", user.id)
        .execute()
    )
    await _invalidate_wrongbook_cache(user.id)
    await _invalidate_nav_pending_cache(user.id)
    await _invalidate_learning_cache(user.id)
    return ok({"item": (result.data or [None])[0]}, _trace_id(request))


@router.delete("/api/wrongbook/{item_id}")
async def wrongbook_delete(item_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()
    client.table("wrong_questions").delete().eq("id", item_id).eq("user_id", user.id).execute()
    await _invalidate_wrongbook_cache(user.id)
    await _invalidate_nav_pending_cache(user.id)
    await _invalidate_learning_cache(user.id)
    return ok({"deleted": item_id}, _trace_id(request))


@router.post("/api/wrongbook/batch")
async def wrongbook_batch_update(
    payload: WrongbookBatchUpdate,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    ids = [item for item in payload.ids if item]
    if not ids:
        raise HTTPException(status_code=400, detail="ids is required")

    client = get_supabase_admin()

    if payload.action == "delete":
        result = client.table("wrong_questions").delete().eq("user_id", user.id).in_("id", ids).execute()
        await _invalidate_wrongbook_cache(user.id)
        await _invalidate_nav_pending_cache(user.id)
        await _invalidate_learning_cache(user.id)
        return ok({"action": "delete", "affected": len(result.data or [])}, _trace_id(request))

    if payload.status not in {"pending", "mastered", "retry"}:
        raise HTTPException(status_code=400, detail="status is required when action=set_status")

    result = (
        client.table("wrong_questions")
        .update({"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("user_id", user.id)
        .in_("id", ids)
        .execute()
    )
    await _invalidate_wrongbook_cache(user.id)
    await _invalidate_nav_pending_cache(user.id)
    await _invalidate_learning_cache(user.id)
    return ok({"action": "set_status", "status": payload.status, "affected": len(result.data or [])}, _trace_id(request))
