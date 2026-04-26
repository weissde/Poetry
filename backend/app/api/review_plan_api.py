from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from ..ai import AIServiceError, complete_json
from ..auth import CurrentUser, get_current_user
from ..cache import cache_get_json, cache_set_json
from ..config import get_settings
from ..response import fail, ok
from ..schemas import ReviewPlanRequest, ReviewPlanTaskMove, ReviewPlanTaskReorder, ReviewPlanTaskUpdate
from ..services.cache_invalidation import _invalidate_nav_pending_cache
from ..services.planning import (
    _build_local_review_plan,
    _normalize_phase_goals,
    _normalize_task_priority,
    normalize_review_plan,
    review_plan_progress,
)
from ..supabase_client import get_supabase_admin
from ..weakness import create_profile

router = APIRouter()
settings = get_settings()


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _practice_quick_timeout() -> float:
    timeout = max(6, int(settings.practice_ai_timeout_seconds))
    return float(min(timeout, settings.request_timeout_seconds))


def _practice_quick_attempts() -> int:
    return max(1, int(settings.practice_ai_max_attempts))


def _clip_text(text: str, limit: int) -> str:
    value = str(text or "").strip()
    if len(value) <= max(0, limit):
        return value
    return value[: max(0, limit) - 1].rstrip() + "…"


@router.post("/api/review-plan/generate")
async def review_plan_generate(
    payload: ReviewPlanRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    wrong_result = (
        client.table("wrong_questions")
        .select("poem_title,question_kind,error_type,keyword_tags")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(100)
        .execute()
    )
    wrong_items = wrong_result.data or []

    counts: dict[str, int] = {}
    for item in wrong_items:
        key = item.get("poem_title") or "未分类"
        counts[key] = counts.get(key, 0) + 1

    wrong_summary_lines = [f"{k}: {v}题" for k, v in counts.items()] or ["暂无错题，生成通用计划"]

    exam_summary_result = (
        client.table("practice_session_summaries")
        .select("topic,summary,attempts,correct,accuracy,weak_type,created_at")
        .eq("user_id", user.id)
        .eq("source", "exam_submit")
        .order("created_at", desc=True)
        .limit(8)
        .execute()
    )
    exam_summary_rows = exam_summary_result.data or []
    exam_summary_lines: list[str] = []
    exam_weak_type_counts: dict[str, int] = {}
    for row in exam_summary_rows:
        if not isinstance(row, dict):
            continue
        topic = str(row.get("topic") or "考试").strip() or "考试"
        accuracy = int(row.get("accuracy") or 0)
        attempts = int(row.get("attempts") or 0)
        correct = int(row.get("correct") or 0)
        summary = _clip_text(str(row.get("summary") or ""), 120)
        exam_summary_lines.append(f"{topic}: 正确率{accuracy}% / {correct}/{attempts}，摘要：{summary or '无'}")
        weak_type = str(row.get("weak_type") or "").strip()
        if weak_type:
            exam_weak_type_counts[weak_type] = exam_weak_type_counts.get(weak_type, 0) + 1
    exam_summary_lines = exam_summary_lines[:5]

    profile_result = (
        client.table("weakness_profiles")
        .select("profile_json")
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    profile_rows = profile_result.data or []
    profile_json = profile_rows[0].get("profile_json") if profile_rows else create_profile()
    keyword_bucket = profile_json.get("by_keyword_tag") if isinstance(profile_json, dict) else {}
    if not isinstance(keyword_bucket, dict):
        keyword_bucket = {}

    pending_keyword_counts: dict[str, int] = {}
    for item in wrong_items:
        question_kind = str(item.get("question_kind") or "").strip().lower()
        error_type = str(item.get("error_type") or "").strip().lower()
        if question_kind != "subjective" and error_type != "subjective":
            continue
        raw_tags = item.get("keyword_tags")
        if not isinstance(raw_tags, list):
            continue
        for raw_tag in raw_tags:
            if not isinstance(raw_tag, str):
                continue
            tag = raw_tag.strip()
            if not tag:
                continue
            pending_keyword_counts[tag] = pending_keyword_counts.get(tag, 0) + 1

    keyword_focus_seed: list[dict[str, Any]] = []
    for key, row in keyword_bucket.items():
        if not isinstance(key, str) or not isinstance(row, dict):
            continue
        attempts = int(row.get("attempts", 0))
        if attempts <= 0:
            continue
        rate_raw = row.get("rate")
        rate_percent = int(round(float(rate_raw) * 100)) if isinstance(rate_raw, (int, float)) else 0
        keyword_focus_seed.append(
            {
                "keyword": key,
                "goal": f"围绕关键词“{key}”完成主观题表达训练并复盘错因。",
                "attempts": attempts,
                "pending": pending_keyword_counts.get(key, 0),
                "rate": max(0, min(100, rate_percent)),
            }
        )

    keyword_focus_seed.sort(
        key=lambda item: (
            int(item.get("rate", 0)),
            -int(item.get("pending", 0)),
            -int(item.get("attempts", 0)),
            str(item.get("keyword", "")),
        )
    )

    if len(keyword_focus_seed) < 6:
        existing = {str(item.get("keyword", "")).lower() for item in keyword_focus_seed}
        extra_keywords = sorted(pending_keyword_counts.items(), key=lambda pair: (-pair[1], pair[0]))
        for keyword, pending_count in extra_keywords:
            norm = keyword.lower()
            if norm in existing:
                continue
            keyword_focus_seed.append(
                {
                    "keyword": keyword,
                    "goal": f"围绕关键词“{keyword}”完成主观题专项纠错。",
                    "attempts": 0,
                    "pending": pending_count,
                    "rate": 0,
                }
            )
            existing.add(norm)
            if len(keyword_focus_seed) >= 8:
                break

    if len(keyword_focus_seed) < 8 and exam_weak_type_counts:
        existing = {str(item.get("keyword", "")).lower() for item in keyword_focus_seed}
        extra_exam_keywords = sorted(exam_weak_type_counts.items(), key=lambda pair: (-pair[1], pair[0]))
        for weak_type, seen_count in extra_exam_keywords:
            norm = weak_type.lower()
            if norm in existing:
                continue
            keyword_focus_seed.append(
                {
                    "keyword": weak_type,
                    "goal": f"围绕题型“{weak_type}”完成考试错因纠偏与表达训练。",
                    "attempts": seen_count,
                    "pending": 0,
                    "rate": 0,
                }
            )
            existing.add(norm)
            if len(keyword_focus_seed) >= 8:
                break

    keyword_focus_seed = keyword_focus_seed[:8]
    keyword_focus_lines = [
        f'{item["keyword"]}: 正确率{item["rate"]}% / 练习{item["attempts"]}次 / 待复习{item["pending"]}题'
        for item in keyword_focus_seed
    ] or ["暂无关键词掌握度数据"]

    prompt = "\n".join(
        [
            "你是一位中学语文学习规划老师。",
            "请根据用户错题情况与关键词薄弱点输出个性化复习计划。",
            "你必须只返回 JSON 对象，不要输出任何额外说明。",
            (
                "JSON 结构必须为："
                '{"overview": string, '
                '"phaseGoals": [string], '
                '"keywordFocus": [{"keyword": string, "goal": string, "attempts": number, "rate": number, "pending": number}], '
                '"dailyTasks": [{"day": string, "focus": string, "stageGoal": string, "tasks": string[], "taskPriorities": ["high"|"medium"|"low"]}]}'
            ),
            "phaseGoals 给出 3 条阶段目标（基础巩固/专项突破/冲刺提分）。",
            "dailyTasks 给出 5 天计划，每天 2-4 条任务，taskPriorities 与 tasks 一一对应。",
            "每天至少 1 条任务需要明确对应一个关键词薄弱点。",
            f'考试日期：{payload.examDate or "未设置"}',
            "错题摘要：",
            *wrong_summary_lines,
            "最近考试小结：",
            *(exam_summary_lines or ["暂无考试小结数据"]),
            "关键词薄弱点摘要：",
            *keyword_focus_lines,
        ]
    )

    plan_source = "ai"
    try:
        plan_json = await complete_json(
            prompt,
            temperature=0.2,
            max_attempts=_practice_quick_attempts(),
            timeout_seconds=_practice_quick_timeout(),
        )
        normalized_plan = normalize_review_plan(plan_json)
    except (AIServiceError, asyncio.TimeoutError):
        plan_source = "fallback_local"
        normalized_plan = _build_local_review_plan(
            exam_date=payload.examDate,
            wrong_summary_lines=wrong_summary_lines,
            keyword_focus_seed=keyword_focus_seed,
            exam_summary_lines=exam_summary_lines,
        )
    if keyword_focus_seed and not normalized_plan.get("keywordFocus"):
        normalized_plan["keywordFocus"] = keyword_focus_seed
    if not normalized_plan.get("phaseGoals"):
        normalized_plan["phaseGoals"] = _normalize_phase_goals(None)

    daily_tasks = normalized_plan.get("dailyTasks") if isinstance(normalized_plan.get("dailyTasks"), list) else []
    normalized_keywords = normalized_plan.get("keywordFocus") if isinstance(normalized_plan.get("keywordFocus"), list) else []
    for day_index, day_item in enumerate(daily_tasks):
        if day_index >= len(normalized_keywords):
            break
        if not isinstance(day_item, dict):
            continue
        keyword_item = normalized_keywords[day_index]
        if not isinstance(keyword_item, dict):
            continue
        keyword = str(keyword_item.get("keyword") or "").strip()
        if not keyword:
            continue
        tasks = day_item.get("tasks") if isinstance(day_item.get("tasks"), list) else []
        task_priorities = day_item.get("taskPriorities") if isinstance(day_item.get("taskPriorities"), list) else []
        contains_keyword = any(keyword in str(task) for task in tasks)
        if not contains_keyword:
            tasks.append(f"围绕关键词“{keyword}”完成 2 道专项练习并记录错因。")
            task_priorities.append("high")

        while len(task_priorities) < len(tasks):
            task_priorities.append("medium")

        day_item["stageGoal"] = str(day_item.get("stageGoal") or f"围绕关键词“{keyword}”完成薄弱点突破。").strip()
        day_item["tasks"] = tasks
        day_item["taskPriorities"] = [_normalize_task_priority(priority) for priority in task_priorities[: len(tasks)]]

    now = datetime.now(timezone.utc).isoformat()
    insert_result = (
        client.table("review_plans")
        .insert(
            {
                "user_id": user.id,
                "exam_date": payload.examDate,
                "plan_json": normalized_plan,
                "created_at": now,
            }
        )
        .execute()
    )
    await _invalidate_nav_pending_cache(user.id)
    inserted = (insert_result.data or [None])[0] or {}

    return ok(
        {
            "planId": inserted.get("id"),
            "examDate": payload.examDate,
            "createdAt": now,
            "plan": normalized_plan,
            "progress": review_plan_progress(normalized_plan),
            "source": plan_source,
            "planEvidence": {
                "examSummaryCount": len(exam_summary_rows),
                "examSummarySamples": exam_summary_lines[:3],
                "keywordFocusTop": [
                    str(item.get("keyword") or "")
                    for item in keyword_focus_seed[:5]
                    if str(item.get("keyword") or "").strip()
                ],
                "wrongSummaryTop": wrong_summary_lines[:3],
            },
        },
        _trace_id(request),
    )


@router.get("/api/review-plan/latest")
async def review_plan_latest(request: Request, user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()
    result = (
        client.table("review_plans")
        .select("id,exam_date,plan_json,created_at")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return ok(
            {
                "planId": None,
                "examDate": None,
                "createdAt": None,
                "plan": None,
                "progress": None,
                "planEvidence": None,
            },
            _trace_id(request),
        )

    row = rows[0]
    normalized_plan = normalize_review_plan(row.get("plan_json"))
    if normalized_plan != row.get("plan_json"):
        client.table("review_plans").update({"plan_json": normalized_plan}).eq("id", row.get("id")).eq("user_id", user.id).execute()

    return ok(
        {
            "planId": row.get("id"),
            "examDate": row.get("exam_date"),
            "createdAt": row.get("created_at"),
            "plan": normalized_plan,
            "progress": review_plan_progress(normalized_plan),
            "planEvidence": None,
        },
        _trace_id(request),
    )


@router.get("/api/nav/pending-summary")
async def nav_pending_summary(request: Request, user: CurrentUser = Depends(get_current_user)):
    cache_key = f"nav-pending-summary:{user.id}:v1"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()

    plan_pending = 0
    plan_result = (
        client.table("review_plans")
        .select("plan_json")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    plan_rows = plan_result.data or []
    if plan_rows:
        normalized_plan = normalize_review_plan(plan_rows[0].get("plan_json"))
        progress = review_plan_progress(normalized_plan)
        total = int(progress.get("total") or 0)
        completed = int(progress.get("completed") or 0)
        plan_pending = max(0, total - completed)

    wrong_pending_result = (
        client.table("wrong_questions")
        .select("id", count="planned")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    wrongbook_pending = max(0, int(wrong_pending_result.count or 0))

    payload = {
        "planPending": plan_pending,
        "wrongbookPending": wrongbook_pending,
        "pendingTaskCount": max(plan_pending, wrongbook_pending),
    }
    await cache_set_json(cache_key, payload, ttl_seconds=20)
    return ok(payload, _trace_id(request))


@router.patch("/api/review-plan/{plan_id}/task")
async def review_plan_update_task(
    plan_id: str,
    payload: ReviewPlanTaskUpdate,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    key = payload.key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="key is required")

    client = get_supabase_admin()
    result = (
        client.table("review_plans")
        .select("id,plan_json")
        .eq("id", plan_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return JSONResponse(status_code=404, content=fail("Review plan not found", _trace_id(request), code=4041))

    row = rows[0]
    plan = normalize_review_plan(row.get("plan_json"))
    completed_keys = set(plan.get("completedTaskKeys") or [])
    if payload.done:
        completed_keys.add(key)
    else:
        completed_keys.discard(key)
    plan["completedTaskKeys"] = sorted(completed_keys)

    client.table("review_plans").update({"plan_json": plan}).eq("id", plan_id).eq("user_id", user.id).execute()
    await _invalidate_nav_pending_cache(user.id)

    return ok({"planId": plan_id, "plan": plan, "progress": review_plan_progress(plan)}, _trace_id(request))


def _remap_task_index_after_move(index: int, from_index: int, to_index: int) -> int:
    if from_index == to_index:
        return index
    if index == from_index:
        return to_index
    if from_index < to_index:
        if from_index < index <= to_index:
            return index - 1
        return index
    if to_index <= index < from_index:
        return index + 1
    return index


@router.patch("/api/review-plan/{plan_id}/task/reorder")
async def review_plan_reorder_task(
    plan_id: str,
    payload: ReviewPlanTaskReorder,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    result = (
        client.table("review_plans")
        .select("id,plan_json")
        .eq("id", plan_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return JSONResponse(status_code=404, content=fail("Review plan not found", _trace_id(request), code=4041))

    row = rows[0]
    plan = normalize_review_plan(row.get("plan_json"))
    daily_tasks = plan.get("dailyTasks") if isinstance(plan.get("dailyTasks"), list) else []
    if payload.dayIndex < 0 or payload.dayIndex >= len(daily_tasks):
        raise HTTPException(status_code=400, detail="dayIndex out of range")

    day_item = daily_tasks[payload.dayIndex] if isinstance(daily_tasks[payload.dayIndex], dict) else {}
    tasks = [str(task).strip() for task in (day_item.get("tasks") if isinstance(day_item.get("tasks"), list) else []) if str(task).strip()]
    if payload.fromIndex < 0 or payload.fromIndex >= len(tasks) or payload.toIndex < 0 or payload.toIndex >= len(tasks):
        raise HTTPException(status_code=400, detail="task index out of range")

    if payload.fromIndex == payload.toIndex:
        return ok({"planId": plan_id, "plan": plan, "progress": review_plan_progress(plan)}, _trace_id(request))

    task_priorities = day_item.get("taskPriorities") if isinstance(day_item.get("taskPriorities"), list) else []
    normalized_priorities = [_normalize_task_priority(priority) for priority in task_priorities[: len(tasks)]]
    while len(normalized_priorities) < len(tasks):
        normalized_priorities.append("medium")

    moved_task = tasks.pop(payload.fromIndex)
    tasks.insert(payload.toIndex, moved_task)

    moved_priority = normalized_priorities.pop(payload.fromIndex)
    normalized_priorities.insert(payload.toIndex, moved_priority)

    day_item["tasks"] = tasks
    day_item["taskPriorities"] = normalized_priorities
    daily_tasks[payload.dayIndex] = day_item
    plan["dailyTasks"] = daily_tasks

    remapped_completed: list[str] = []
    completed_keys = plan.get("completedTaskKeys") if isinstance(plan.get("completedTaskKeys"), list) else []
    for key in completed_keys:
        text = str(key or "").strip()
        parts = text.split("-")
        if len(parts) != 2:
            remapped_completed.append(text)
            continue
        try:
            day_index = int(parts[0])
            task_index = int(parts[1])
        except ValueError:
            remapped_completed.append(text)
            continue
        if day_index != payload.dayIndex:
            remapped_completed.append(text)
            continue
        next_index = _remap_task_index_after_move(task_index, payload.fromIndex, payload.toIndex)
        remapped_completed.append(f"{day_index}-{next_index}")

    def _key_order(text: str) -> tuple[int, int, str]:
        parts = text.split("-")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            return (int(parts[0]), int(parts[1]), "")
        return (10**9, 10**9, text)

    deduped = sorted(set(remapped_completed), key=_key_order)
    plan["completedTaskKeys"] = deduped

    client.table("review_plans").update({"plan_json": plan}).eq("id", plan_id).eq("user_id", user.id).execute()
    await _invalidate_nav_pending_cache(user.id)

    return ok({"planId": plan_id, "plan": plan, "progress": review_plan_progress(plan)}, _trace_id(request))


def _parse_plan_task_key(text: str) -> tuple[int, int] | None:
    parts = str(text or "").strip().split("-")
    if len(parts) != 2:
        return None
    if not parts[0].isdigit() or not parts[1].isdigit():
        return None
    return int(parts[0]), int(parts[1])


@router.patch("/api/review-plan/{plan_id}/task/move")
async def review_plan_move_task(
    plan_id: str,
    payload: ReviewPlanTaskMove,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    result = (
        client.table("review_plans")
        .select("id,plan_json")
        .eq("id", plan_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return JSONResponse(status_code=404, content=fail("Review plan not found", _trace_id(request), code=4041))

    row = rows[0]
    plan = normalize_review_plan(row.get("plan_json"))
    daily_tasks = plan.get("dailyTasks") if isinstance(plan.get("dailyTasks"), list) else []
    from_day = payload.fromDayIndex
    to_day = payload.toDayIndex
    if from_day < 0 or from_day >= len(daily_tasks) or to_day < 0 or to_day >= len(daily_tasks):
        raise HTTPException(status_code=400, detail="day index out of range")

    from_item = daily_tasks[from_day] if isinstance(daily_tasks[from_day], dict) else {}
    to_item = daily_tasks[to_day] if isinstance(daily_tasks[to_day], dict) else {}
    from_tasks = [str(task).strip() for task in (from_item.get("tasks") if isinstance(from_item.get("tasks"), list) else []) if str(task).strip()]
    to_tasks = [str(task).strip() for task in (to_item.get("tasks") if isinstance(to_item.get("tasks"), list) else []) if str(task).strip()]

    if payload.fromIndex < 0 or payload.fromIndex >= len(from_tasks):
        raise HTTPException(status_code=400, detail="fromIndex out of range")
    if payload.toIndex < 0 or payload.toIndex > len(to_tasks):
        raise HTTPException(status_code=400, detail="toIndex out of range")

    if from_day == to_day:
        same_day_target = min(max(0, payload.toIndex), max(0, len(from_tasks) - 1))
        reorder_payload = ReviewPlanTaskReorder(dayIndex=from_day, fromIndex=payload.fromIndex, toIndex=same_day_target)
        return await review_plan_reorder_task(plan_id, reorder_payload, request, user)

    from_priorities = from_item.get("taskPriorities") if isinstance(from_item.get("taskPriorities"), list) else []
    to_priorities = to_item.get("taskPriorities") if isinstance(to_item.get("taskPriorities"), list) else []
    normalized_from_priorities = [_normalize_task_priority(priority) for priority in from_priorities[: len(from_tasks)]]
    normalized_to_priorities = [_normalize_task_priority(priority) for priority in to_priorities[: len(to_tasks)]]
    while len(normalized_from_priorities) < len(from_tasks):
        normalized_from_priorities.append("medium")
    while len(normalized_to_priorities) < len(to_tasks):
        normalized_to_priorities.append("medium")

    moved_task = from_tasks.pop(payload.fromIndex)
    moved_priority = normalized_from_priorities.pop(payload.fromIndex)
    to_tasks.insert(payload.toIndex, moved_task)
    normalized_to_priorities.insert(payload.toIndex, moved_priority)

    from_item["tasks"] = from_tasks
    from_item["taskPriorities"] = normalized_from_priorities
    to_item["tasks"] = to_tasks
    to_item["taskPriorities"] = normalized_to_priorities
    daily_tasks[from_day] = from_item
    daily_tasks[to_day] = to_item
    plan["dailyTasks"] = daily_tasks

    moved_done = False
    remapped_completed: list[str] = []
    completed_keys = plan.get("completedTaskKeys") if isinstance(plan.get("completedTaskKeys"), list) else []
    for key in completed_keys:
        parsed = _parse_plan_task_key(str(key or ""))
        if not parsed:
            remapped_completed.append(str(key or "").strip())
            continue
        day_index, task_index = parsed
        if day_index == from_day and task_index == payload.fromIndex:
            moved_done = True
            continue
        if day_index == from_day and task_index > payload.fromIndex:
            remapped_completed.append(f"{day_index}-{task_index - 1}")
            continue
        if day_index == to_day and task_index >= payload.toIndex:
            remapped_completed.append(f"{day_index}-{task_index + 1}")
            continue
        remapped_completed.append(f"{day_index}-{task_index}")

    if moved_done:
        remapped_completed.append(f"{to_day}-{payload.toIndex}")

    def _key_order(text: str) -> tuple[int, int, str]:
        parsed = _parse_plan_task_key(text)
        if parsed:
            return (parsed[0], parsed[1], "")
        return (10**9, 10**9, text)

    plan["completedTaskKeys"] = sorted(set(remapped_completed), key=_key_order)
    client.table("review_plans").update({"plan_json": plan}).eq("id", plan_id).eq("user_id", user.id).execute()
    await _invalidate_nav_pending_cache(user.id)
    return ok({"planId": plan_id, "plan": plan, "progress": review_plan_progress(plan)}, _trace_id(request))
