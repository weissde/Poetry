from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from ..cache import cache_get_json, cache_set_json
from ..supabase_client import get_supabase_admin
from ..weakness import create_profile

USER_SUMMARY_CACHE_TTL_SECONDS = 45
USER_ROLE_CACHE_TTL_SECONDS = 120


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _norm_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_user_role(value: Any) -> str:
    role = _norm_text(value).lower()
    return role if role in {"student", "teacher"} else "student"


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_iso_datetime(raw: Any) -> datetime | None:
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _compute_streak(review_dates: set[date], today: date) -> int:
    streak = 0
    cursor = today
    while cursor in review_dates:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


def _derive_weak_dimension(profile: dict[str, Any]) -> str:
    weak_dimensions = profile.get("weak_dimensions")
    if isinstance(weak_dimensions, list):
        for item in weak_dimensions:
            text = _norm_text(item)
            if text:
                return text

    by_question_type = profile.get("by_question_type")
    if isinstance(by_question_type, dict):
        best_label = ""
        best_attempts = -1
        best_rate = 2.0
        for key, row in by_question_type.items():
            if not isinstance(row, dict):
                continue
            attempts = _safe_int(row.get("attempts"))
            if attempts <= 0:
                continue
            rate = float(row.get("rate") or 0)
            if rate >= 0.7:
                continue
            label = _norm_text(key)
            if not label:
                continue
            if rate < best_rate or (rate == best_rate and attempts > best_attempts):
                best_rate = rate
                best_attempts = attempts
                best_label = f"题型·{label}"
        if best_label:
            return best_label

    return "暂未识别"


async def get_user_role(user_id: str) -> dict[str, Any]:
    cache_key = f"user-role:{user_id}:v1"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return {
            "role": _normalize_user_role(cached.get("role")),
            "schoolName": _norm_text(cached.get("schoolName")) or None,
            "className": _norm_text(cached.get("className")) or None,
        }

    client = get_supabase_admin()
    profile_result = (
        client.table("user_profiles")
        .select("id,role,school_name,class_name")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile_row = (profile_result.data or [None])[0]
    role = "student"
    school_name = None
    class_name = None

    if isinstance(profile_row, dict):
        role = _normalize_user_role(profile_row.get("role"))
        school_name = _norm_text(profile_row.get("school_name")) or None
        class_name = _norm_text(profile_row.get("class_name")) or None
    else:
        now_iso = _now_utc().isoformat()
        try:
            client.table("user_profiles").insert({"id": user_id, "role": role, "updated_at": now_iso}).execute()
        except Exception:
            client.table("user_profiles").insert({"id": user_id, "updated_at": now_iso}).execute()

    payload = {"role": role, "schoolName": school_name, "className": class_name}
    await cache_set_json(cache_key, payload, ttl_seconds=USER_ROLE_CACHE_TTL_SECONDS)
    return payload


async def set_user_role(user_id: str, role: str) -> dict[str, Any]:
    normalized_role = _normalize_user_role(role)
    client = get_supabase_admin()
    now_iso = _now_utc().isoformat()

    profile_result = client.table("user_profiles").select("id").eq("id", user_id).limit(1).execute()
    profile_row = (profile_result.data or [None])[0]

    if isinstance(profile_row, dict):
        client.table("user_profiles").update({"role": normalized_role, "updated_at": now_iso}).eq("id", user_id).execute()
    else:
        client.table("user_profiles").insert({"id": user_id, "role": normalized_role, "updated_at": now_iso}).execute()

    payload = {"role": normalized_role}
    await cache_set_json(f"user-role:{user_id}:v1", payload, ttl_seconds=USER_ROLE_CACHE_TTL_SECONDS)
    return payload


async def get_user_summary(user_id: str) -> dict[str, Any]:
    cache_key = f"user-summary:{user_id}:v2"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    client = get_supabase_admin()
    now = _now_utc()
    today = now.date()
    since_30d = (now - timedelta(days=30)).isoformat()
    since_7d = (now - timedelta(days=7)).isoformat()
    role = "student"

    try:
        role_payload = await get_user_role(user_id)
        role = _normalize_user_role(role_payload.get("role"))
    except Exception:
        role = "student"

    streak_days = 0
    try:
        profile_result = client.table("user_profiles").select("streak_days").eq("id", user_id).limit(1).execute()
        profile_row = (profile_result.data or [None])[0]
        if isinstance(profile_row, dict):
            streak_days = _safe_int(profile_row.get("streak_days"))
    except Exception:
        streak_days = 0

    if streak_days <= 0:
        try:
            logs_result = (
                client.table("memory_review_logs")
                .select("created_at")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(365)
                .execute()
            )
            review_dates = {
                parsed.date()
                for row in (logs_result.data or [])
                if isinstance(row, dict) and (parsed := _parse_iso_datetime(row.get("created_at"))) is not None
            }
            streak_days = _compute_streak(review_dates, today)
        except Exception:
            streak_days = 0

    learned_poem_ids: set[str] = set()
    due_memory_count = 0
    try:
        memory_result = client.table("memory_reviews").select("poem_id,due_date").eq("user_id", user_id).limit(5000).execute()
        for row in memory_result.data or []:
            if not isinstance(row, dict):
                continue
            poem_id = _norm_text(row.get("poem_id"))
            if poem_id:
                learned_poem_ids.add(poem_id)
            due_date_raw = row.get("due_date")
            due_date = None
            if isinstance(due_date_raw, str):
                try:
                    due_date = date.fromisoformat(due_date_raw[:10])
                except ValueError:
                    due_date = None
            elif isinstance(due_date_raw, date):
                due_date = due_date_raw
            if due_date is not None and due_date <= today:
                due_memory_count += 1
    except Exception:
        due_memory_count = 0

    weekly_practice_count = 0
    accuracy_30d = 0
    try:
        answers_30d_result = (
            client.table("user_answers")
            .select("poem_id,is_correct,created_at")
            .eq("user_id", user_id)
            .gte("created_at", since_30d)
            .limit(5000)
            .execute()
        )
        answers_30d_rows = answers_30d_result.data or []
        attempts_30d = 0
        correct_30d = 0
        for row in answers_30d_rows:
            if not isinstance(row, dict):
                continue
            poem_id = _norm_text(row.get("poem_id"))
            if poem_id:
                learned_poem_ids.add(poem_id)
            attempts_30d += 1
            if row.get("is_correct") is True:
                correct_30d += 1
            created_at = _parse_iso_datetime(row.get("created_at"))
            if created_at is not None and created_at >= now - timedelta(days=7):
                weekly_practice_count += 1
        accuracy_30d = int(round((correct_30d / attempts_30d) * 100)) if attempts_30d else 0
    except Exception:
        accuracy_30d = 0
        weekly_practice_count = 0

    try:
        answers_all_result = client.table("user_answers").select("poem_id").eq("user_id", user_id).limit(5000).execute()
        for row in answers_all_result.data or []:
            if not isinstance(row, dict):
                continue
            poem_id = _norm_text(row.get("poem_id"))
            if poem_id:
                learned_poem_ids.add(poem_id)
    except Exception:
        pass

    weekly_wrong_count = 0
    try:
        wrong_result = (
            client.table("wrong_questions")
            .select("id", count="planned")
            .eq("user_id", user_id)
            .gte("created_at", since_7d)
            .execute()
        )
        weekly_wrong_count = max(0, int(wrong_result.count or 0))
    except Exception:
        weekly_wrong_count = 0

    profile_json: dict[str, Any] = create_profile()
    try:
        weakness_result = client.table("weakness_profiles").select("profile_json").eq("user_id", user_id).limit(1).execute()
        weakness_row = (weakness_result.data or [None])[0]
        if isinstance(weakness_row, dict) and isinstance(weakness_row.get("profile_json"), dict):
            profile_json = weakness_row["profile_json"]
    except Exception:
        profile_json = create_profile()

    payload = {
        "role": role,
        "streakDays": streak_days,
        "poemCount": len(learned_poem_ids),
        "accuracy30d": accuracy_30d,
        "weeklyWrongCount": weekly_wrong_count,
        "weeklyPracticeCount": weekly_practice_count,
        "dueMemoryCount": due_memory_count,
        "weakDimension": _derive_weak_dimension(profile_json),
    }

    await cache_set_json(cache_key, payload, ttl_seconds=USER_SUMMARY_CACHE_TTL_SECONDS)
    return payload


async def get_memory_coverage(user_id: str) -> dict[str, Any]:
    cache_key = f"user-memory-coverage:{user_id}:v1"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    client = get_supabase_admin()
    result = client.table("memory_reviews").select("status").eq("user_id", user_id).limit(5000).execute()
    rows = result.data or []

    counts = {"learning": 0, "reviewing": 0, "mastered": 0}
    for row in rows:
        if not isinstance(row, dict):
            continue
        status = _norm_text(row.get("status")).lower()
        if status in counts:
            counts[status] += 1

    payload = {
        "items": [
            {"status": "learning", "count": counts["learning"], "label": "学习中"},
            {"status": "reviewing", "count": counts["reviewing"], "label": "复习中"},
            {"status": "mastered", "count": counts["mastered"], "label": "已掌握"},
        ],
        "total": counts["learning"] + counts["reviewing"] + counts["mastered"],
    }
    await cache_set_json(cache_key, payload, ttl_seconds=USER_SUMMARY_CACHE_TTL_SECONDS)
    return payload


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _bucket_average_rate(bucket: Any) -> int:
    if not isinstance(bucket, dict):
        return 0
    weighted_total = 0.0
    attempts_total = 0
    for row in bucket.values():
        if not isinstance(row, dict):
            continue
        attempts = _safe_int(row.get("attempts"))
        if attempts <= 0:
            continue
        weighted_total += _safe_float(row.get("rate")) * attempts
        attempts_total += attempts
    if attempts_total <= 0:
        return 0
    return int(round((weighted_total / attempts_total) * 100))


def _collect_rate_rows(profile: dict[str, Any]) -> list[dict[str, Any]]:
    label_maps = {
        "by_question_type": {
            "memorization": "默写",
            "meaning": "词义",
            "technique": "手法",
            "emotion": "情感",
            "appreciation": "赏析",
            "comparison": "比较阅读",
            "context": "语境默写",
            "subjective": "主观题",
        },
        "by_dynasty": {},
        "by_theme": {},
    }
    bucket_labels = {
        "by_question_type": "题型",
        "by_dynasty": "朝代",
        "by_theme": "题材",
    }
    rows: list[dict[str, Any]] = []
    for bucket_name, bucket in profile.items():
        if bucket_name not in bucket_labels or not isinstance(bucket, dict):
            continue
        for key, row in bucket.items():
            if not isinstance(row, dict):
                continue
            attempts = _safe_int(row.get("attempts"))
            if attempts <= 0:
                continue
            label = label_maps[bucket_name].get(str(key), _norm_text(key))
            if not label:
                continue
            rows.append(
                {
                    "bucket": bucket_labels[bucket_name],
                    "label": label,
                    "attempts": attempts,
                    "rate": int(round(_safe_float(row.get("rate")) * 100)),
                }
            )
    return rows


def _build_weekly_trend_points(answer_rows: list[dict[str, Any]], now: datetime) -> list[dict[str, Any]]:
    buckets = [
        {"label": "第1周", "attempts": 0, "correct": 0},
        {"label": "第2周", "attempts": 0, "correct": 0},
        {"label": "第3周", "attempts": 0, "correct": 0},
        {"label": "第4周", "attempts": 0, "correct": 0},
    ]
    start = (now - timedelta(days=27)).date()

    for row in answer_rows:
        if not isinstance(row, dict):
            continue
        created_at = _parse_iso_datetime(row.get("created_at"))
        if created_at is None:
            continue
        delta_days = (created_at.date() - start).days
        if delta_days < 0 or delta_days > 27:
            continue
        bucket_index = min(3, max(0, delta_days // 7))
        buckets[bucket_index]["attempts"] += 1
        if row.get("is_correct") is True:
            buckets[bucket_index]["correct"] += 1

    points: list[dict[str, Any]] = []
    rolling_value = 0
    for bucket in buckets:
        attempts = int(bucket["attempts"])
        if attempts > 0:
            rolling_value = int(round((int(bucket["correct"]) / attempts) * 100))
        points.append({"label": bucket["label"], "value": rolling_value})
    return points


def _build_learning_report_seed(
    *,
    overview: dict[str, Any],
    weakest: dict[str, Any] | None,
    strongest: dict[str, Any] | None,
    coverage: list[dict[str, Any]],
) -> dict[str, str]:
    weakest_text = (
        f"{weakest['bucket']}·{weakest['label']}（正确率 {weakest['rate']}%）"
        if weakest
        else "暂无明显薄弱点"
    )
    strongest_text = (
        f"{strongest['bucket']}·{strongest['label']}（正确率 {strongest['rate']}%）"
        if strongest
        else "暂无明显强项"
    )
    coverage_focus = "、".join(item["label"] for item in coverage[:3]) or "题型、朝代、题材"
    summary_text = (
        f"近 30 天综合准确率约 {overview['accuracy30d']}%，已累计学习 {overview['poemCount']} 首诗词，"
        f"当前连续学习 {overview['streakDays']} 天。最需要优先补齐的是 {weakest_text}；"
        f"相对稳定的部分是 {strongest_text}。"
    )
    teacher_advice_text = (
        f"建议下一轮复习先围绕 {weakest_text} 安排 1 组专项练测，再回到错题本与记忆训练做收束；"
        f"课堂讲评可优先覆盖 {coverage_focus} 这些维度，避免只看总分不看错因。"
    )
    return {
        "summaryTitle": "AI 学情解读",
        "summaryText": summary_text,
        "teacherAdviceTitle": "教师 / 家长建议",
        "teacherAdviceText": teacher_advice_text,
    }


async def get_user_learning_summary(user_id: str) -> dict[str, Any]:
    cache_key = f"user-learning-summary:{user_id}:v1"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    overview = await get_user_summary(user_id)
    client = get_supabase_admin()
    now = _now_utc()
    since_28d = (now - timedelta(days=28)).isoformat()

    answer_rows: list[dict[str, Any]] = []
    try:
        answers_result = (
            client.table("user_answers")
            .select("is_correct,created_at")
            .eq("user_id", user_id)
            .gte("created_at", since_28d)
            .limit(5000)
            .execute()
        )
        answer_rows = [row for row in (answers_result.data or []) if isinstance(row, dict)]
    except Exception:
        answer_rows = []

    profile_json: dict[str, Any] = create_profile()
    try:
        weakness_result = client.table("weakness_profiles").select("profile_json").eq("user_id", user_id).limit(1).execute()
        weakness_row = (weakness_result.data or [None])[0]
        if isinstance(weakness_row, dict) and isinstance(weakness_row.get("profile_json"), dict):
            profile_json = weakness_row["profile_json"]
    except Exception:
        profile_json = create_profile()

    rate_rows = _collect_rate_rows(profile_json)
    weakest = min(rate_rows, key=lambda item: (item["rate"], -item["attempts"], item["label"]), default=None)
    strongest = max(rate_rows, key=lambda item: (item["rate"], item["attempts"], item["label"]), default=None)

    coverage = [
        {
            "label": "题型表现",
            "mastery": _bucket_average_rate(profile_json.get("by_question_type")),
            "description": "来自练测题型表现，反映默写、赏析、情感等题型稳定度。",
        },
        {
            "label": "朝代理解",
            "mastery": _bucket_average_rate(profile_json.get("by_dynasty")),
            "description": "反映不同朝代作品理解情况，适合做比较阅读前的基线判断。",
        },
        {
            "label": "题材理解",
            "mastery": _bucket_average_rate(profile_json.get("by_theme")),
            "description": "聚焦送别、思乡、山水等主题掌握程度，便于安排专题复习。",
        },
        {
            "label": "记忆巩固",
            "mastery": max(0, min(100, 100 - min(80, overview["dueMemoryCount"] * 8))),
            "description": "结合到期复习压力估算记忆稳定度，到期越多说明越需要回到记忆训练。",
        },
    ]

    metrics = [
        {
            "label": "掌握率趋势",
            "value": f"{overview['accuracy30d']}%",
            "detail": (
                f"当前强项是 {strongest['bucket']}·{strongest['label']}。"
                if strongest
                else "近 30 天总体掌握率正在形成稳定基线。"
            ),
        },
        {
            "label": "知识点覆盖",
            "value": f"{len(coverage)} 类",
            "detail": "从题型、朝代、题材和记忆巩固四个维度汇总当前学习覆盖面。",
        },
        {
            "label": "薄弱环节",
            "value": weakest["label"] if weakest else "暂无",
            "detail": f"待复习错题 {overview['weeklyWrongCount']} 道 · 待记忆复习 {overview['dueMemoryCount']} 首。",
        },
    ]

    narrative = (
        f"当前整体掌握率约 {overview['accuracy30d']}%，已连续学习 {overview['streakDays']} 天，"
        f"累计学习 {overview['poemCount']} 首。"
        + (
            f"当前最需要补齐的是 {weakest['bucket']}·{weakest['label']}（{weakest['rate']}%）。"
            if weakest
            else "当前还没有形成明显薄弱维度。"
        )
    )

    payload = {
        "overview": overview,
        "metrics": metrics,
        "trend": {
            "days": 28,
            "items": _build_weekly_trend_points(answer_rows, now),
        },
        "coverage": coverage,
        "weakest": weakest,
        "strongest": strongest,
        "narrative": narrative,
        "reportSeed": _build_learning_report_seed(
            overview=overview,
            weakest=weakest,
            strongest=strongest,
            coverage=coverage,
        ),
    }

    await cache_set_json(cache_key, payload, ttl_seconds=USER_SUMMARY_CACHE_TTL_SECONDS)
    return payload
