from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from ..auth import CurrentUser, get_current_user
from ..cache import cache_get_json, cache_set_json
from ..response import fail, ok
from ..schemas import MemoryEnrollRequest, MemoryReviewSubmitRequest
from ..services.cache_invalidation import _invalidate_memory_cache
from ..supabase_client import get_supabase_admin

router = APIRouter()

MEMORY_PRACTICE_MODES = {"next_line", "blank", "full_text", "dictation"}


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _extract_poem_relation(raw: Any) -> dict[str, Any] | None:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        return raw[0]
    return None


def _stable_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _iso_today() -> date:
    return datetime.now(timezone.utc).date()


def _parse_iso_date(raw: Any) -> date | None:
    if not raw:
        return None
    if isinstance(raw, date):
        return raw
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw).date()
        except ValueError:
            return None
    return None


def _clamp_quality(quality: int) -> int:
    return max(0, min(5, int(quality)))


def _sm2_next_state(
    *,
    interval_days: int,
    ease_factor: float,
    quality: int,
    review_count: int,
    success_count: int,
    is_success: bool,
) -> tuple[int, float, str]:
    safe_interval = max(1, int(interval_days or 1))
    safe_ease = max(1.3, float(ease_factor or 2.5))
    q = _clamp_quality(quality)

    if not is_success:
        next_interval = 1
        next_ease = max(1.3, round(safe_ease - 0.2, 2))
        return next_interval, next_ease, "learning"

    if review_count <= 0:
        next_interval = 1
    elif review_count == 1:
        next_interval = 3
    elif review_count == 2:
        next_interval = 7
    else:
        next_interval = max(4, int(round(safe_interval * safe_ease)))

    delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
    next_ease = max(1.3, min(2.8, round(safe_ease + delta, 2)))
    next_interval = min(120, max(1, next_interval))

    next_review_count = review_count + 1
    next_success_count = success_count + 1
    next_success_rate = (next_success_count / next_review_count) if next_review_count else 0
    status = "mastered" if next_interval >= 14 and next_success_rate >= 0.8 else "learning"
    return next_interval, next_ease, status


def _memory_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail("记忆模块数据表未就绪，请先执行 005_memory_reviews.sql", _trace_id(request), code=5301),
    )


def _compute_streak(review_dates: set[date], today: date) -> int:
    streak = 0
    cursor = today
    while cursor in review_dates:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


def _safe_int(raw: Any, default: int = 0) -> int:
    try:
        if raw is None:
            return default
        return int(raw)
    except (TypeError, ValueError):
        return default


def _build_memory_achievements(summary: dict[str, Any], logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    logs_desc = [row for row in logs if isinstance(row, dict)]
    logs_asc = list(reversed(logs_desc))
    first_log_at = logs_asc[0].get("created_at") if logs_asc else None

    total_reviews = _safe_int(summary.get("reviewCount"))
    mastered = _safe_int(summary.get("mastered"))
    streak_days = _safe_int(summary.get("streakDays"))
    success_rate = float(summary.get("successRate") or 0)

    def progress_with_threshold(target: int, predicate: Any) -> tuple[int, bool, str | None]:
        count = 0
        unlocked_at: str | None = None
        for row in logs_asc:
            if predicate(row):
                count += 1
                if count >= target and unlocked_at is None:
                    raw_created_at = row.get("created_at")
                    unlocked_at = str(raw_created_at) if isinstance(raw_created_at, str) else None
        return min(count, target), count >= target, unlocked_at

    speed_progress, speed_unlocked, speed_unlocked_at = progress_with_threshold(
        10,
        lambda row: (
            str(row.get("mode") or "") in MEMORY_PRACTICE_MODES
            and bool(row.get("is_correct"))
            and _safe_int(row.get("time_spent"), default=999999) > 0
            and _safe_int(row.get("time_spent"), default=999999) <= 90
        ),
    )

    full_text_progress, full_text_unlocked, full_text_unlocked_at = progress_with_threshold(
        5,
        lambda row: str(row.get("mode") or "") == "full_text" and bool(row.get("is_correct")),
    )

    seen_modes: set[str] = set()
    mode_unlocked_at: str | None = None
    for row in logs_asc:
        mode = str(row.get("mode") or "")
        if mode in MEMORY_PRACTICE_MODES:
            seen_modes.add(mode)
            if len(seen_modes) >= 3 and mode_unlocked_at is None:
                raw_created_at = row.get("created_at")
                mode_unlocked_at = str(raw_created_at) if isinstance(raw_created_at, str) else None

    mode_progress = min(len(seen_modes), 3)
    mode_unlocked = mode_progress >= 3
    first_unlocked = total_reviews >= 1
    streak_3_unlocked = streak_days >= 3
    streak_7_unlocked = streak_days >= 7
    mastery_unlocked = mastered >= 10
    accuracy_percent = round(success_rate * 100)
    accuracy_unlocked = total_reviews >= 20 and success_rate >= 0.8

    return [
        {
            "id": "first_checkin",
            "title": "初次打卡",
            "description": "完成 1 次记忆打卡",
            "icon": "seedling",
            "tier": "bronze",
            "target": 1,
            "progress": min(total_reviews, 1),
            "unlocked": first_unlocked,
            "unlockedAt": first_log_at if first_unlocked else None,
        },
        {
            "id": "streak_3",
            "title": "三日不辍",
            "description": "连续打卡达到 3 天",
            "icon": "flame",
            "tier": "bronze",
            "target": 3,
            "progress": min(streak_days, 3),
            "unlocked": streak_3_unlocked,
            "unlockedAt": first_log_at if streak_3_unlocked else None,
        },
        {
            "id": "streak_7",
            "title": "七日精进",
            "description": "连续打卡达到 7 天",
            "icon": "calendar",
            "tier": "silver",
            "target": 7,
            "progress": min(streak_days, 7),
            "unlocked": streak_7_unlocked,
            "unlockedAt": first_log_at if streak_7_unlocked else None,
        },
        {
            "id": "mode_explorer",
            "title": "多模训练",
            "description": "完成上句接下句、逐句填空、全文默写三种训练",
            "icon": "layers",
            "tier": "silver",
            "target": 3,
            "progress": mode_progress,
            "unlocked": mode_unlocked,
            "unlockedAt": mode_unlocked_at if mode_unlocked else None,
        },
        {
            "id": "speed_reviewer",
            "title": "快思快背",
            "description": "在 90 秒内完成 10 次正确练习",
            "icon": "timer",
            "tier": "gold",
            "target": 10,
            "progress": speed_progress,
            "unlocked": speed_unlocked,
            "unlockedAt": speed_unlocked_at if speed_unlocked else None,
        },
        {
            "id": "full_text_adept",
            "title": "默写行家",
            "description": "完成 5 次全文默写并判定正确",
            "icon": "scroll",
            "tier": "gold",
            "target": 5,
            "progress": full_text_progress,
            "unlocked": full_text_unlocked,
            "unlockedAt": full_text_unlocked_at if full_text_unlocked else None,
        },
        {
            "id": "accuracy_guard",
            "title": "精准稳固",
            "description": "累计 20 次复习且总成功率达到 80%",
            "icon": "target",
            "tier": "gold",
            "target": 80,
            "progress": min(accuracy_percent, 80),
            "unlocked": accuracy_unlocked,
            "unlockedAt": first_log_at if accuracy_unlocked else None,
        },
        {
            "id": "mastery_collector",
            "title": "掌握收集者",
            "description": "已掌握诗词达到 10 首",
            "icon": "crown",
            "tier": "platinum",
            "target": 10,
            "progress": min(mastered, 10),
            "unlocked": mastery_unlocked,
            "unlockedAt": first_log_at if mastery_unlocked else None,
        },
    ]


@router.post("/api/memory/enroll")
async def memory_enroll(
    payload: MemoryEnrollRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    today = _iso_today().isoformat()

    try:
        poem_result = client.table("poems").select("id,title,author,dynasty,content,tags").eq("id", payload.poemId).limit(1).execute()
        poem_rows = poem_result.data or []
        if not poem_rows:
            return JSONResponse(status_code=404, content=fail("Poem not found", _trace_id(request), code=4040))
        poem = poem_rows[0]

        existing = (
            client.table("memory_reviews")
            .select("id")
            .eq("user_id", user.id)
            .eq("poem_id", payload.poemId)
            .limit(1)
            .execute()
        )
        existing_rows = existing.data or []
        created = False
        if existing_rows:
            memory_id = existing_rows[0].get("id")
        else:
            created = True
            insert_result = (
                client.table("memory_reviews")
                .insert(
                    {
                        "user_id": user.id,
                        "poem_id": payload.poemId,
                        "status": "learning",
                        "review_count": 0,
                        "success_count": 0,
                        "interval_days": 1,
                        "ease_factor": 2.5,
                        "due_date": today,
                        "updated_at": now,
                    }
                )
                .execute()
            )
            memory_row = (insert_result.data or [None])[0] or {}
            memory_id = memory_row.get("id")

        if not memory_id:
            raise RuntimeError("failed to get memory id")

        row_result = (
            client.table("memory_reviews")
            .select("id,poem_id,status,review_count,success_count,interval_days,ease_factor,due_date,last_reviewed_at,created_at,updated_at")
            .eq("id", memory_id)
            .eq("user_id", user.id)
            .limit(1)
            .execute()
        )
        row = (row_result.data or [None])[0] or {}
        item = {
            **row,
            "poem": poem,
            "successRate": round((int(row.get("success_count") or 0) / int(row.get("review_count") or 1)), 4)
            if int(row.get("review_count") or 0) > 0
            else 0,
        }
        await _invalidate_memory_cache(user.id)
        return ok({"created": created, "item": item}, _trace_id(request))
    except Exception:
        return _memory_table_error(request)


@router.get("/api/memory/today")
async def memory_today(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    onlyDue: bool = Query(default=True),
    page: int = Query(default=1, ge=1, le=2000),
    pageSize: int | None = Query(default=None, ge=1, le=100),
):
    client = get_supabase_admin()
    today = _iso_today().isoformat()
    page_size = max(1, min(100, int(pageSize or limit)))
    page_number = max(1, int(page))
    page_start = (page_number - 1) * page_size
    page_end = page_start + page_size - 1
    cache_key = f"memory-today:{user.id}:{_stable_hash({'onlyDue': onlyDue, 'page': page_number, 'pageSize': page_size, 'today': today})}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    try:
        query = (
            client.table("memory_reviews")
            .select(
                (
                    "id,poem_id,status,review_count,success_count,interval_days,ease_factor,"
                    "due_date,last_reviewed_at,last_quality,created_at,updated_at,"
                    "poems(id,title,author,dynasty,content,tags,grade_level)"
                ),
                count="planned",
            )
            .eq("user_id", user.id)
            .order("due_date")
            .order("updated_at", desc=True)
            .range(page_start, page_end)
        )
        if onlyDue:
            query = query.lte("due_date", today)

        result = query.execute()
        rows = result.data or []
        total = int(result.count or 0)

        if onlyDue:
            total_due = total
        else:
            due_result = (
                client.table("memory_reviews")
                .select("id", count="planned", head=True)
                .eq("user_id", user.id)
                .lte("due_date", today)
                .execute()
            )
            total_due = int(due_result.count or 0)

        items: list[dict[str, Any]] = []
        for row in rows:
            poem = _extract_poem_relation(row.get("poems"))
            review_count = int(row.get("review_count") or 0)
            success_count = int(row.get("success_count") or 0)
            success_rate = round((success_count / review_count), 4) if review_count > 0 else 0
            items.append(
                {
                    "id": row.get("id"),
                    "poemId": row.get("poem_id"),
                    "status": row.get("status") or "learning",
                    "reviewCount": review_count,
                    "successCount": success_count,
                    "successRate": success_rate,
                    "intervalDays": int(row.get("interval_days") or 1),
                    "easeFactor": float(row.get("ease_factor") or 2.5),
                    "dueDate": row.get("due_date"),
                    "lastReviewedAt": row.get("last_reviewed_at"),
                    "lastQuality": row.get("last_quality"),
                    "createdAt": row.get("created_at"),
                    "updatedAt": row.get("updated_at"),
                    "poem": poem,
                }
            )

        total_pages = max(1, (total + page_size - 1) // page_size)
        payload = {
            "today": today,
            "totalDue": total_due,
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
        return _memory_table_error(request)


@router.post("/api/memory/review")
async def memory_review_submit(
    payload: MemoryReviewSubmitRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    if not payload.memoryId and not payload.poemId:
        raise HTTPException(status_code=400, detail="memoryId or poemId is required")

    client = get_supabase_admin()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    today = now.date()
    today_iso = today.isoformat()

    try:
        lookup = client.table("memory_reviews").select("*").eq("user_id", user.id)
        if payload.memoryId:
            lookup = lookup.eq("id", payload.memoryId)
        else:
            lookup = lookup.eq("poem_id", payload.poemId)
        lookup_result = lookup.limit(1).execute()
        rows = lookup_result.data or []
        if not rows:
            return JSONResponse(
                status_code=404,
                content=fail("Memory item not found, please enroll poem first", _trace_id(request), code=4043),
            )

        row = rows[0]
        memory_id = row.get("id")
        poem_id = row.get("poem_id")
        if not memory_id or not poem_id:
            raise RuntimeError("invalid memory row")

        review_count = int(row.get("review_count") or 0)
        success_count = int(row.get("success_count") or 0)
        interval_days = int(row.get("interval_days") or 1)
        ease_factor = float(row.get("ease_factor") or 2.5)
        quality = _clamp_quality(payload.quality)
        is_success = payload.isCorrect if payload.isCorrect is not None else quality >= 3

        next_interval, next_ease, next_status = _sm2_next_state(
            interval_days=interval_days,
            ease_factor=ease_factor,
            quality=quality,
            review_count=review_count,
            success_count=success_count,
            is_success=is_success,
        )
        next_due_date = (today + timedelta(days=next_interval)).isoformat()

        update_payload = {
            "status": next_status,
            "review_count": review_count + 1,
            "success_count": success_count + (1 if is_success else 0),
            "interval_days": next_interval,
            "ease_factor": next_ease,
            "due_date": next_due_date,
            "last_reviewed_at": now_iso,
            "last_quality": quality,
            "updated_at": now_iso,
        }

        client.table("memory_reviews").update(update_payload).eq("id", memory_id).eq("user_id", user.id).execute()

        try:
            client.table("memory_review_logs").insert(
                {
                    "user_id": user.id,
                    "memory_review_id": memory_id,
                    "poem_id": poem_id,
                    "quality": quality,
                    "is_correct": bool(is_success),
                    "mode": payload.mode,
                    "time_spent": payload.timeSpent,
                    "created_at": now_iso,
                }
            ).execute()
        except Exception:
            pass

        refreshed_result = (
            client.table("memory_reviews")
            .select(
                (
                    "id,poem_id,status,review_count,success_count,interval_days,ease_factor,"
                    "due_date,last_reviewed_at,last_quality,created_at,updated_at,"
                    "poems(id,title,author,dynasty,content,tags,grade_level)"
                )
            )
            .eq("id", memory_id)
            .eq("user_id", user.id)
            .limit(1)
            .execute()
        )
        refreshed_row = (refreshed_result.data or [None])[0] or {}
        poem = _extract_poem_relation(refreshed_row.get("poems"))
        refreshed_review_count = int(refreshed_row.get("review_count") or 0)
        refreshed_success_count = int(refreshed_row.get("success_count") or 0)
        success_rate = round((refreshed_success_count / refreshed_review_count), 4) if refreshed_review_count else 0

        await _invalidate_memory_cache(user.id)
        return ok(
            {
                "reviewedAt": now_iso,
                "today": today_iso,
                "item": {
                    "id": refreshed_row.get("id"),
                    "poemId": refreshed_row.get("poem_id"),
                    "status": refreshed_row.get("status") or "learning",
                    "reviewCount": refreshed_review_count,
                    "successCount": refreshed_success_count,
                    "successRate": success_rate,
                    "intervalDays": int(refreshed_row.get("interval_days") or 1),
                    "easeFactor": float(refreshed_row.get("ease_factor") or 2.5),
                    "dueDate": refreshed_row.get("due_date"),
                    "lastReviewedAt": refreshed_row.get("last_reviewed_at"),
                    "lastQuality": refreshed_row.get("last_quality"),
                    "createdAt": refreshed_row.get("created_at"),
                    "updatedAt": refreshed_row.get("updated_at"),
                    "poem": poem,
                },
            },
            _trace_id(request),
        )
    except Exception:
        return _memory_table_error(request)


@router.get("/api/memory/stats")
async def memory_stats(request: Request, user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()
    today = _iso_today()
    today_iso = today.isoformat()
    cache_key = f"memory-stats:{user.id}:{today_iso}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    try:
        reviews_result = (
            client.table("memory_reviews")
            .select("id,status,due_date,review_count,success_count,last_reviewed_at")
            .eq("user_id", user.id)
            .limit(5000)
            .execute()
        )
        reviews = reviews_result.data or []

        total = len(reviews)
        due = 0
        mastered = 0
        learning = 0
        total_review_count = 0
        total_success_count = 0
        reviewed_today = 0

        for row in reviews:
            due_date = _parse_iso_date(row.get("due_date"))
            if due_date and due_date <= today:
                due += 1

            status = str(row.get("status") or "learning")
            if status == "mastered":
                mastered += 1
            else:
                learning += 1

            review_count = int(row.get("review_count") or 0)
            success_count = int(row.get("success_count") or 0)
            total_review_count += review_count
            total_success_count += success_count

            reviewed_at = row.get("last_reviewed_at")
            if isinstance(reviewed_at, str):
                try:
                    reviewed_date = datetime.fromisoformat(reviewed_at).date()
                    if reviewed_date == today:
                        reviewed_today += 1
                except ValueError:
                    pass

        logs_result = (
            client.table("memory_review_logs")
            .select("created_at,quality,is_correct,mode,time_spent,poem_id,poems(id,title,author,dynasty)")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .limit(120)
            .execute()
        )
        logs = logs_result.data or []

        review_dates: set[date] = set()
        recent: list[dict[str, Any]] = []
        for row in logs:
            created_at_raw = row.get("created_at")
            if isinstance(created_at_raw, str):
                try:
                    review_dates.add(datetime.fromisoformat(created_at_raw).date())
                except ValueError:
                    pass

            if len(recent) < 12:
                poem = _extract_poem_relation(row.get("poems"))
                recent.append(
                    {
                        "createdAt": created_at_raw,
                        "quality": row.get("quality"),
                        "isCorrect": row.get("is_correct"),
                        "mode": row.get("mode"),
                        "timeSpent": row.get("time_spent"),
                        "poemId": row.get("poem_id"),
                        "poem": poem,
                    }
                )

        streak_days = _compute_streak(review_dates, today)
        success_rate = round((total_success_count / total_review_count), 4) if total_review_count else 0
        summary_payload = {
            "total": total,
            "due": due,
            "learning": learning,
            "mastered": mastered,
            "reviewCount": total_review_count,
            "successCount": total_success_count,
            "successRate": success_rate,
            "reviewedToday": reviewed_today,
            "streakDays": streak_days,
        }
        achievements = _build_memory_achievements(summary_payload, logs)

        payload = {
            "today": today_iso,
            "summary": summary_payload,
            "recent": recent,
            "achievements": achievements,
        }
        await cache_set_json(cache_key, payload, ttl_seconds=30)
        return ok(payload, _trace_id(request))
    except Exception:
        return _memory_table_error(request)
