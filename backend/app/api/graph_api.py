from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..auth import CurrentUser, get_current_user, get_optional_user
from ..cache import cache_get_json, cache_set_json
from ..response import ok
from ..supabase_client import get_supabase_admin
from ..weakness import create_profile

router = APIRouter()
logger = logging.getLogger("poetry_ai.api.graph")

_wrong_questions_extended_supported: bool | None = None
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

QUESTION_TYPE_LABELS = {
    "memorization": "默写",
    "meaning": "词义",
    "technique": "手法",
    "emotion": "情感",
    "appreciation": "赏析",
    "comparison": "比较阅读",
    "context": "语境默写",
    "subjective": "主观题",
    "exam": "考试",
}


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _can_use_wrong_questions_extended() -> bool:
    return _wrong_questions_extended_supported is not False


def _mark_wrong_questions_extended_supported(supported: bool) -> None:
    global _wrong_questions_extended_supported
    _wrong_questions_extended_supported = bool(supported)


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


def _stable_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


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


def _query_poems_from_snapshot(
    rows: list[dict[str, Any]],
    *,
    kind: str,
    keyword: str,
    limit: int,
) -> list[dict[str, Any]]:
    needle = _norm_text(keyword)
    if not needle:
        return []

    result: list[dict[str, Any]] = []
    expected = _norm_lower(needle)

    for row in rows:
        if kind == "poet":
            matched = _norm_lower(row.get("author")) == expected
        elif kind == "imagery":
            matched = expected in _norm_lower(row.get("content"))
        elif kind == "dynasty":
            matched = _norm_lower(row.get("dynasty")) == expected
        elif kind == "title":
            matched = expected in _norm_lower(row.get("title"))
        elif kind == "theme":
            matched = _match_theme(row.get("tags"), needle)
        else:
            matched = False

        if matched:
            result.append(_poem_base_payload(row))
            if len(result) >= limit:
                break

    return result


def _dynasty_order(dynasty: str) -> int:
    order_map = {
        "先秦": 10,
        "秦": 20,
        "汉": 30,
        "东汉": 31,
        "魏晋": 40,
        "东晋": 41,
        "南北朝": 50,
        "隋": 60,
        "唐": 70,
        "五代": 80,
        "宋": 90,
        "元": 100,
        "明": 110,
        "清": 120,
        "近代": 130,
    }
    text = str(dynasty or "").strip()
    if text in order_map:
        return order_map[text]
    if "汉" in text:
        return 30
    if "晋" in text:
        return 40
    if "唐" in text:
        return 70
    if "宋" in text:
        return 90
    if "元" in text:
        return 100
    if "明" in text:
        return 110
    if "清" in text:
        return 120
    return 999


def _extract_metric_rate(bucket: Any, key: str) -> int | None:
    if not isinstance(bucket, dict):
        return None
    row = bucket.get(key)
    if not isinstance(row, dict):
        return None
    raw = row.get("rate")
    if isinstance(raw, (int, float)):
        return max(0, min(100, int(round(raw * 100))))
    return None


def _build_graph_node_recommendation(kind: str, keyword: str, item_count: int) -> dict[str, Any]:
    kind_value = str(kind or "").strip().lower()
    key = str(keyword or "").strip() or "当前节点"
    count = max(0, int(item_count or 0))
    if kind_value == "poet":
        return {
            "title": f"诗人专题：{key}",
            "reason": f"已匹配 {count} 首相关诗词，适合做“风格与情感表达”对比学习。",
            "actionPlan": [
                "先读代表作，标出高频意象与关键词。",
                "完成“手法+情感”专项练习 8 题。",
                "回到错题本定位该诗人相关薄弱项。",
            ],
        }
    if kind_value == "imagery":
        return {
            "title": f"意象专题：{key}",
            "reason": f"该意象关联 {count} 首诗词，适合训练“意象->情感->主旨”的分析链路。",
            "actionPlan": [
                "先对比 2-3 首同意象诗词的情感差异。",
                "完成“情感+赏析”专项练习 8 题。",
                "把高频错因写成 1 条答题模板。",
            ],
        }
    if kind_value == "dynasty":
        return {
            "title": f"朝代专题：{key}",
            "reason": f"已匹配 {count} 首{key}诗词，适合做时代背景与表达风格联动复盘。",
            "actionPlan": [
                "先梳理该朝代常见题材与表达倾向。",
                "完成“词义+手法+情感”综合练习 8 题。",
                "回看错题中同朝代高频失分点。",
            ],
        }
    if kind_value == "theme":
        return {
            "title": f"题材专题：{key}",
            "reason": f"已匹配 {count} 首同题材诗词，适合训练“同题材多文本比较”。",
            "actionPlan": [
                "选 2 首同题材诗词做异同点对比。",
                "完成“赏析+情感”专项练习 8 题。",
                "整理 3 个可复用的比较表达句式。",
            ],
        }
    if kind_value == "error_type":
        label = QUESTION_TYPE_LABELS.get(key, key)
        return {
            "title": f"弱项修复：{label}",
            "reason": f"该题型近期错误较集中（关联诗词 {count} 首），建议优先修复。",
            "actionPlan": [
                "先定位该题型最近错题，复盘错误原因。",
                "完成同题型专项练习 8 题。",
                "将错因归纳为 2 条“避坑提醒”。",
            ],
        }
    if kind_value == "title":
        return {
            "title": f"单诗突破：{key}",
            "reason": f"已匹配 {count} 首相关诗词，可围绕该诗做“学习-练习-纠错”闭环。",
            "actionPlan": [
                "先进入学习页完成解析与注释复盘。",
                "完成该诗主题练习 5 题。",
                "把错题回流到错题本并标记状态。",
            ],
        }
    return {
        "title": f"节点专题：{key}",
        "reason": f"已匹配 {count} 首诗词，可直接进入专项训练。",
        "actionPlan": ["先学后练，再回错题本复盘。"],
    }


@router.get("/api/graph/timeline")
async def graph_timeline(request: Request, _user: CurrentUser | None = Depends(get_optional_user)):
    cache_key = "graph-timeline:v1"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    result = client.table("poems").select("author,dynasty").limit(3000).execute()
    items = result.data or []

    dynasty_counts: dict[str, int] = {}
    dynasty_author_counts: dict[str, dict[str, int]] = {}
    for item in items:
        dynasty = str(item.get("dynasty") or "未知").strip() or "未知"
        author = str(item.get("author") or "未知").strip() or "未知"
        dynasty_counts[dynasty] = dynasty_counts.get(dynasty, 0) + 1
        by_author = dynasty_author_counts.setdefault(dynasty, {})
        by_author[author] = by_author.get(author, 0) + 1

    timeline_items: list[dict[str, Any]] = []
    for dynasty, count in sorted(dynasty_counts.items(), key=lambda item: (_dynasty_order(item[0]), -item[1], item[0])):
        top_poets = sorted(
            dynasty_author_counts.get(dynasty, {}).items(),
            key=lambda item: (-item[1], item[0]),
        )[:5]
        timeline_items.append(
            {
                "dynasty": dynasty,
                "count": count,
                "topPoets": [{"author": author, "count": poet_count} for author, poet_count in top_poets],
            }
        )

    payload = {
        "items": timeline_items,
        "totalPoems": sum(dynasty_counts.values()),
        "dynastyCount": len(dynasty_counts),
    }
    await cache_set_json(cache_key, payload, ttl_seconds=300)
    return ok(payload, _trace_id(request))


@router.get("/api/graph/imagery")
async def graph_imagery(request: Request, _user: CurrentUser | None = Depends(get_optional_user)):
    cache_key = "graph-imagery:v1"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    keywords = ["明月", "故乡", "春风", "秋雨", "杨柳", "鸿雁", "菊花", "江水", "落日"]
    client = get_supabase_admin()
    result = client.table("poems").select("id,title,content").limit(1000).execute()
    items = result.data or []

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    for key in keywords:
        nodes.append({"id": key, "label": key, "type": "imagery"})

    for poem in items:
        poem_id = poem.get("id")
        title = poem.get("title") or "未命名"
        content = poem.get("content") or ""
        poem_node_id = f"poem:{poem_id}"
        hit = False
        for key in keywords:
            if key in content:
                edges.append({"source": key, "target": poem_node_id})
                hit = True
        if hit:
            nodes.append({"id": poem_node_id, "label": title, "type": "poem"})

    payload = {"nodes": nodes, "edges": edges}
    await cache_set_json(cache_key, payload, ttl_seconds=300)
    return ok(payload, _trace_id(request))


@router.get("/api/graph/personal")
async def graph_personal(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    limit: int = Query(default=6, ge=3, le=20),
):
    cache_key = f"graph-personal:{user.id}:{limit}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    try:
        profile_result = client.table("weakness_profiles").select("profile_json").eq("user_id", user.id).limit(1).execute()
        profile_rows = profile_result.data or []
        profile = profile_rows[0].get("profile_json") if profile_rows else create_profile()
        if not isinstance(profile, dict):
            profile = create_profile()
    except Exception:
        profile = create_profile()

    wrong_rows: list[dict[str, Any]] = []
    if _can_use_wrong_questions_extended():
        try:
            wrong_result = (
                client.table("wrong_questions")
                .select("poem_title,error_type,dynasty,theme")
                .eq("user_id", user.id)
                .order("created_at", desc=True)
                .limit(3000)
                .execute()
            )
            wrong_rows = wrong_result.data or []
        except Exception:
            _mark_wrong_questions_extended_supported(False)

    if not wrong_rows:
        try:
            wrong_result = (
                client.table("wrong_questions")
                .select("poem_title,error_type")
                .eq("user_id", user.id)
                .order("created_at", desc=True)
                .limit(3000)
                .execute()
            )
            wrong_rows = wrong_result.data or []
            for row in wrong_rows:
                if "dynasty" not in row:
                    row["dynasty"] = ""
                if "theme" not in row:
                    row["theme"] = ""
        except Exception:
            wrong_rows = []

    by_type: dict[str, int] = {}
    by_dynasty: dict[str, int] = {}
    by_theme: dict[str, int] = {}
    by_poem: dict[str, int] = {}

    for row in wrong_rows:
        error_type = str(row.get("error_type") or "").strip()
        dynasty = str(row.get("dynasty") or "").strip()
        theme = str(row.get("theme") or "").strip()
        poem_title = str(row.get("poem_title") or "").strip()

        if error_type:
            by_type[error_type] = by_type.get(error_type, 0) + 1
        if dynasty:
            by_dynasty[dynasty] = by_dynasty.get(dynasty, 0) + 1
        if theme:
            by_theme[theme] = by_theme.get(theme, 0) + 1
        if poem_title:
            by_poem[poem_title] = by_poem.get(poem_title, 0) + 1

    nodes: list[dict[str, Any]] = [
        {"id": "me", "label": "我的知识图谱", "type": "root", "count": len(wrong_rows)},
    ]
    edges: list[dict[str, Any]] = []

    def append_group(
        group: str,
        kind: str,
        counts: dict[str, int],
        metric_bucket: Any,
        label_mapper: dict[str, str] | None = None,
    ):
        ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)[:limit]
        for value, count in ranked:
            metric_rate = _extract_metric_rate(metric_bucket, value)
            node_id = f"{group}:{value}"
            label = label_mapper.get(value, value) if label_mapper else value
            node = {
                "id": node_id,
                "label": label,
                "type": "weakness",
                "group": group,
                "kind": kind,
                "value": value,
                "count": count,
            }
            if metric_rate is not None:
                node["rate"] = metric_rate
            nodes.append(node)
            edges.append({"source": "me", "target": node_id})

    append_group("question_type", "error_type", by_type, profile.get("by_question_type"), QUESTION_TYPE_LABELS)
    append_group("dynasty", "dynasty", by_dynasty, profile.get("by_dynasty"))
    append_group("theme", "theme", by_theme, profile.get("by_theme"))
    append_group("poem", "title", by_poem, {}, None)

    summary = {
        "wrongCount": len(wrong_rows),
        "typeCount": len(by_type),
        "dynastyCount": len(by_dynasty),
        "themeCount": len(by_theme),
        "poemCount": len(by_poem),
    }

    payload = {"nodes": nodes, "edges": edges, "summary": summary}
    await cache_set_json(cache_key, payload, ttl_seconds=60)
    return ok(payload, _trace_id(request))


@router.get("/api/graph/personal/insights")
async def graph_personal_insights(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    days: int = Query(default=7, ge=3, le=30),
):
    cache_key = f"graph-personal-insights:{user.id}:{days}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    now_utc = datetime.now(timezone.utc)
    since_iso = datetime.fromtimestamp(now_utc.timestamp() - (days * 86400), tz=timezone.utc).isoformat()
    bucket_dates: list[str] = []
    for offset in range(days - 1, -1, -1):
        bucket_dates.append(datetime.fromtimestamp(now_utc.timestamp() - (offset * 86400), tz=timezone.utc).date().isoformat())

    def init_bucket() -> dict[str, int]:
        return {key: 0 for key in bucket_dates}

    practice_map = init_bucket()
    wrong_map = init_bucket()
    memory_map = init_bucket()
    creation_map = init_bucket()

    def aggregate_created_at(table_name: str, target_map: dict[str, int]) -> None:
        result = (
            client.table(table_name)
            .select("created_at")
            .eq("user_id", user.id)
            .gte("created_at", since_iso)
            .limit(5000)
            .execute()
        )
        rows = result.data or []
        for row in rows:
            if not isinstance(row, dict):
                continue
            created_at = row.get("created_at")
            if isinstance(created_at, str) and len(created_at) >= 10:
                day_key = created_at[:10]
                if day_key in target_map:
                    target_map[day_key] += 1

    try:
        aggregate_created_at("user_answers", practice_map)
    except Exception:
        pass
    try:
        aggregate_created_at("wrong_questions", wrong_map)
    except Exception:
        pass
    try:
        aggregate_created_at("memory_review_logs", memory_map)
    except Exception:
        pass
    try:
        aggregate_created_at("creations", creation_map)
    except Exception:
        pass

    favorites_count = 0
    mastered_count = 0
    public_creations = 0
    received_likes = 0
    try:
        result = client.table("poem_favorites").select("id", count="planned").eq("user_id", user.id).limit(1).execute()
        favorites_count = max(0, int(result.count or 0))
    except Exception:
        favorites_count = 0

    try:
        result = (
            client.table("memory_reviews")
            .select("id", count="planned")
            .eq("user_id", user.id)
            .eq("status", "mastered")
            .limit(1)
            .execute()
        )
        mastered_count = max(0, int(result.count or 0))
    except Exception:
        mastered_count = 0

    try:
        creation_result = (
            client.table("creations")
            .select("id,is_public,like_count")
            .eq("user_id", user.id)
            .limit(5000)
            .execute()
        )
        creation_rows = creation_result.data or []
        public_creations = sum(1 for row in creation_rows if bool((row or {}).get("is_public")))
        received_likes = sum(max(0, int((row or {}).get("like_count") or 0)) for row in creation_rows if isinstance(row, dict))
    except Exception:
        public_creations = 0
        received_likes = 0

    profile = create_profile()
    try:
        profile_result = client.table("weakness_profiles").select("profile_json").eq("user_id", user.id).limit(1).execute()
        profile_rows = profile_result.data or []
        if profile_rows and isinstance(profile_rows[0], dict) and isinstance(profile_rows[0].get("profile_json"), dict):
            profile = profile_rows[0]["profile_json"]
    except Exception:
        pass

    def weakest_key(bucket: Any, minimum_attempts: int = 3) -> dict[str, Any]:
        if not isinstance(bucket, dict):
            return {"key": None, "attempts": 0, "rate": None}
        candidates: list[tuple[str, int, float]] = []
        for key, value in bucket.items():
            if not isinstance(value, dict):
                continue
            attempts = int(value.get("attempts") or 0)
            rate = value.get("rate")
            if attempts < minimum_attempts or not isinstance(rate, (int, float)):
                continue
            candidates.append((str(key), attempts, float(rate)))
        if not candidates:
            return {"key": None, "attempts": 0, "rate": None}
        candidates.sort(key=lambda item: (item[2], -item[1], item[0]))
        winner = candidates[0]
        return {"key": winner[0], "attempts": winner[1], "rate": max(0, min(100, int(round(winner[2] * 100))))}

    focus = {
        "questionType": weakest_key(profile.get("by_question_type")),
        "dynasty": weakest_key(profile.get("by_dynasty")),
        "theme": weakest_key(profile.get("by_theme")),
    }

    weekly_practice = sum(practice_map.values())
    weekly_wrong_added = sum(wrong_map.values())
    weekly_memory = sum(memory_map.values())
    weekly_creations = sum(creation_map.values())

    recommendations: list[str] = []
    q_key = focus["questionType"].get("key")
    if isinstance(q_key, str) and q_key:
        label = QUESTION_TYPE_LABELS.get(q_key, q_key)
        recommendations.append(f"优先完成“{label}”专项练习，连续 3 天每天 8 题。")
    if weekly_practice < 20:
        recommendations.append("近一周练习量偏少，建议每天保持至少 15 分钟专项训练。")
    if weekly_memory < 7:
        recommendations.append("背诵复习频次不足，建议开启每日默写打卡（至少 1 首）。")
    if public_creations > 0 and received_likes < public_creations:
        recommendations.append("公开作品互动偏少，建议先润色标题与意象，再发布到广场。")
    if not recommendations:
        recommendations.append("学习节奏稳定，建议继续保持并挑战更高难度综合题。")

    activity_items = [
        {
            "date": key,
            "practice": practice_map.get(key, 0),
            "wrongAdded": wrong_map.get(key, 0),
            "memoryReview": memory_map.get(key, 0),
            "creation": creation_map.get(key, 0),
        }
        for key in bucket_dates
    ]

    payload = {
        "summary": {
            "favoritesCount": favorites_count,
            "masteredCount": mastered_count,
            "publicCreations": public_creations,
            "receivedLikes": received_likes,
            "weeklyPractice": weekly_practice,
            "weeklyWrongAdded": weekly_wrong_added,
            "weeklyMemoryReview": weekly_memory,
            "weeklyCreations": weekly_creations,
        },
        "focus": focus,
        "activity": {
            "days": days,
            "items": activity_items,
        },
        "recommendations": recommendations[:4],
    }
    await cache_set_json(cache_key, payload, ttl_seconds=60)
    return ok(payload, _trace_id(request))


@router.get("/api/graph/poets")
async def graph_poets(request: Request, _user: CurrentUser | None = Depends(get_optional_user)):
    cache_key = "graph-poets:v2"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    result = client.table("poems").select("author,dynasty,tags").limit(3000).execute()
    items = result.data or []

    counts: dict[str, int] = {}
    dynasties: dict[str, str] = {}
    author_tag_counts: dict[str, dict[str, int]] = {}
    for item in items:
        author = item.get("author") or "未知"
        counts[author] = counts.get(author, 0) + 1
        dynasties[author] = item.get("dynasty") or "未知"
        raw_tags = item.get("tags")
        if isinstance(raw_tags, list):
            for raw_tag in raw_tags[:8]:
                tag = str(raw_tag or "").strip()
                if not tag:
                    continue
                bucket = author_tag_counts.setdefault(author, {})
                bucket[tag] = bucket.get(tag, 0) + 1

    ranked_authors = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:80]
    nodes = [{"id": author, "label": author, "count": count, "dynasty": dynasties.get(author, "未知")} for author, count in ranked_authors]

    dynasty_groups: dict[str, list[str]] = {}
    for author, _count in ranked_authors:
        dynasty = dynasties.get(author, "未知")
        dynasty_groups.setdefault(dynasty, []).append(author)

    edges: list[dict[str, Any]] = []
    edge_pairs: set[tuple[str, str, str]] = set()
    for dynasty, authors in dynasty_groups.items():
        if len(authors) < 2:
            continue
        for left in range(len(authors)):
            for right in range(left + 1, min(len(authors), left + 4)):
                source = authors[left]
                target = authors[right]
                pair_key = (min(source, target), max(source, target), "same_dynasty")
                if pair_key in edge_pairs:
                    continue
                edges.append(
                    {
                        "source": source,
                        "target": target,
                        "type": "same_dynasty",
                        "dynasty": dynasty,
                    }
                )
                edge_pairs.add(pair_key)
                if len(edges) >= 160:
                    break
            if len(edges) >= 160:
                break
        if len(edges) >= 160:
            break

    author_list = [author for author, _count in ranked_authors]
    shared_theme_candidates: list[dict[str, Any]] = []
    for left in range(len(author_list)):
        author_a = author_list[left]
        tags_a = author_tag_counts.get(author_a, {})
        if not tags_a:
            continue
        for right in range(left + 1, len(author_list)):
            author_b = author_list[right]
            tags_b = author_tag_counts.get(author_b, {})
            if not tags_b:
                continue

            shared_score = 0
            strongest_tag = ""
            strongest_strength = 0
            for tag, count_a in tags_a.items():
                count_b = tags_b.get(tag)
                if not count_b:
                    continue
                strength = min(count_a, count_b)
                shared_score += strength
                if strength > strongest_strength:
                    strongest_strength = strength
                    strongest_tag = tag

            if shared_score < 2 or not strongest_tag:
                continue

            shared_theme_candidates.append(
                {
                    "source": author_a,
                    "target": author_b,
                    "type": "shared_theme",
                    "tag": strongest_tag,
                    "weight": shared_score,
                    "sameDynasty": dynasties.get(author_a, "未知") == dynasties.get(author_b, "未知"),
                }
            )

    shared_theme_candidates.sort(
        key=lambda item: (
            -int(item.get("weight") or 0),
            0 if item.get("sameDynasty") else 1,
            str(item.get("source") or ""),
            str(item.get("target") or ""),
        )
    )

    shared_theme_added = 0
    for candidate in shared_theme_candidates:
        source = str(candidate.get("source") or "")
        target = str(candidate.get("target") or "")
        if not source or not target:
            continue
        pair_key = (min(source, target), max(source, target), "shared_theme")
        if pair_key in edge_pairs:
            continue
        edges.append(
            {
                "source": source,
                "target": target,
                "type": "shared_theme",
                "tag": str(candidate.get("tag") or ""),
                "weight": int(candidate.get("weight") or 0),
                "dynasty": dynasties.get(source, "未知") if dynasties.get(source, "未知") == dynasties.get(target, "未知") else "",
            }
        )
        edge_pairs.add(pair_key)
        shared_theme_added += 1
        if shared_theme_added >= 120:
            break

    payload = {"nodes": nodes, "edges": edges}
    await cache_set_json(cache_key, payload, ttl_seconds=300)
    return ok(payload, _trace_id(request))


@router.get("/api/graph/node-poems")
async def graph_node_poems(
    request: Request,
    kind: str = Query(..., description="poet or imagery or dynasty or theme or title or error_type"),
    value: str = Query(..., min_length=1),
    limit: int = Query(default=30, ge=1, le=100),
    optional_user: CurrentUser | None = Depends(get_optional_user),
):
    kind_value = kind.strip().lower()
    keyword = value.strip()
    if kind_value not in {"poet", "imagery", "dynasty", "theme", "title", "error_type"}:
        raise HTTPException(status_code=400, detail="kind must be poet or imagery or dynasty or theme or title or error_type")
    if not keyword:
        raise HTTPException(status_code=400, detail="value is required")

    cache_user = optional_user.id if optional_user else "anon"
    cache_key = f"graph-node-poems:v2:{kind_value}:{cache_user}:{_stable_hash({'value': keyword, 'limit': limit})}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    if kind_value != "error_type":
        try:
            rows, _by_id, _by_title = await _get_poems_snapshot(client)
            items = _query_poems_from_snapshot(rows, kind=kind_value, keyword=keyword, limit=limit)
            payload = {
                "items": items,
                "kind": kind_value,
                "value": keyword,
                "recommendation": _build_graph_node_recommendation(kind_value, keyword, len(items)),
            }
            await cache_set_json(cache_key, payload, ttl_seconds=300)
            return ok(payload, _trace_id(request))
        except Exception:
            logger.warning("graph_node_poems_snapshot_failed kind=%s value=%s", kind_value, keyword, exc_info=True)

        query = client.table("poems").select(POEM_BASE_SELECT).limit(limit)
        if kind_value == "poet":
            query = query.eq("author", keyword)
        elif kind_value == "imagery":
            query = query.ilike("content", f"%{keyword}%")
        elif kind_value == "dynasty":
            query = query.eq("dynasty", keyword)
        elif kind_value == "title":
            query = query.ilike("title", f"%{keyword}%")
        elif kind_value == "theme":
            try:
                query = query.contains("tags", [keyword])
            except Exception:
                query = query.ilike("content", f"%{keyword}%")

        result = query.execute()
        items = result.data or []
        payload = {
            "items": items,
            "kind": kind_value,
            "value": keyword,
            "recommendation": _build_graph_node_recommendation(kind_value, keyword, len(items)),
        }
        await cache_set_json(cache_key, payload, ttl_seconds=300)
        return ok(payload, _trace_id(request))

    if kind_value == "error_type":
        if not optional_user:
            raise HTTPException(status_code=401, detail="auth required for error_type")
        wrong_result = (
            client.table("wrong_questions")
            .select("poem_title")
            .eq("user_id", optional_user.id)
            .eq("error_type", keyword)
            .limit(500)
            .execute()
        )
        wrong_rows = wrong_result.data or []
        title_counts: dict[str, int] = {}
        for row in wrong_rows:
            title = _norm_text(row.get("poem_title"))
            if not title:
                continue
            title_counts[title] = title_counts.get(title, 0) + 1
        ranked_titles = [item[0] for item in sorted(title_counts.items(), key=lambda item: item[1], reverse=True)]
        if not ranked_titles:
            payload = {
                "items": [],
                "kind": kind_value,
                "value": keyword,
                "recommendation": _build_graph_node_recommendation(kind_value, keyword, 0),
            }
            await cache_set_json(cache_key, payload, ttl_seconds=60)
            return ok(payload, _trace_id(request))

        try:
            _rows, _by_id, by_title = await _get_poems_snapshot(client)
            ranked_items: list[dict[str, Any]] = []
            seen_ids: set[str] = set()
            for title in ranked_titles:
                title_key = _norm_lower(title)
                if not title_key:
                    continue
                for row in by_title.get(title_key, []):
                    poem_id = _norm_text(row.get("id"))
                    if not poem_id or poem_id in seen_ids:
                        continue
                    seen_ids.add(poem_id)
                    ranked_items.append(_poem_base_payload(row))
                    if len(ranked_items) >= limit:
                        break
                if len(ranked_items) >= limit:
                    break

            if ranked_items:
                payload = {
                    "items": ranked_items,
                    "kind": kind_value,
                    "value": keyword,
                    "recommendation": _build_graph_node_recommendation(kind_value, keyword, len(ranked_items)),
                }
                await cache_set_json(cache_key, payload, ttl_seconds=120)
                return ok(payload, _trace_id(request))
        except Exception:
            logger.warning("graph_node_poems_error_type_snapshot_failed value=%s", keyword, exc_info=True)

        poems_result = (
            client.table("poems")
            .select(POEM_BASE_SELECT)
            .in_("title", ranked_titles[:100])
            .limit(limit)
            .execute()
        )
        poems = poems_result.data or []
        rank_map = {_norm_lower(title): idx for idx, title in enumerate(ranked_titles)}
        poems.sort(key=lambda item: rank_map.get(_norm_lower(item.get("title")), 99999))
        ranked = poems[:limit]
        payload = {
            "items": ranked,
            "kind": kind_value,
            "value": keyword,
            "recommendation": _build_graph_node_recommendation(kind_value, keyword, len(ranked)),
        }
        await cache_set_json(cache_key, payload, ttl_seconds=120)
        return ok(payload, _trace_id(request))


# ==============================
# Phase 3: Enriched Graph Endpoint
# ==============================

@router.get("/api/graph/enriched")
async def graph_enriched(
    request: Request,
    poem_id: str | None = Query(None, description="Optional poem ID to center the graph on"),
    _user: CurrentUser | None = Depends(get_optional_user),
):
    """Returns enriched graph data using persistent poem_graph_nodes/edges tables,
    falling back to computed data for poems not yet semantically tagged."""
    cache_key = f"graph-enriched:v1:{poem_id or 'all'}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    # Try persistent graph nodes first
    try:
        nodes_query = client.table("poem_graph_nodes").select("*").limit(2000)
        if poem_id:
            nodes_query = nodes_query.eq("poem_id", poem_id)
        nodes_result = nodes_query.execute()
        persistent_nodes = nodes_result.data or []

        if persistent_nodes:
            node_ids = [n["id"] for n in persistent_nodes]
            edges_result = (
                client.table("poem_graph_edges")
                .select("*")
                .in_("source_node_id", node_ids)
                .limit(2000)
                .execute()
            )
            persistent_edges = edges_result.data or []

            # Map to graph format
            nodes = [
                {
                    "id": n["id"],
                    "label": n["label"],
                    "type": n["node_type"],
                    "count": int(n.get("weight", 1.0) * 10),
                    "poem_id": n.get("poem_id"),
                }
                for n in persistent_nodes
            ]
            edges = [
                {
                    "source": e["source_node_id"],
                    "target": e["target_node_id"],
                    "type": e.get("edge_type", "shared_tag"),
                    "weight": e.get("weight", 1.0),
                }
                for e in persistent_edges
            ]
    except Exception:
        logger.warning("graph_enriched_failed_to_read_persistent", exc_info=True)

    # Fall back to computed data if no persistent nodes found
    if not nodes:
        logger.info("graph_enriched_no_persistent_nodes, using computed fallback")
        try:
            poems_result = client.table("poems").select(POEM_BASE_SELECT).limit(500).execute()
            poems = poems_result.data or []

            seen_authors: dict[str, str] = {}
            seen_tags: dict[str, str] = {}
            for poem in poems:
                author = str(poem.get("author") or "").strip()
                dynasty = str(poem.get("dynasty") or "").strip()
                if author and author not in seen_authors:
                    node_id = f"author:{author}"
                    seen_authors[author] = node_id
                    nodes.append({"id": node_id, "label": author, "type": "poet", "count": 1, "dynasty": dynasty})
                tags = poem.get("tags") or []
                for tag in (tags if isinstance(tags, list) else []):
                    tag_str = str(tag).strip()
                    if tag_str and tag_str not in seen_tags:
                        node_id = f"tag:{tag_str}"
                        seen_tags[tag_str] = node_id
                        nodes.append({"id": node_id, "label": tag_str, "type": "theme", "count": 1})
        except Exception:
            logger.warning("graph_enriched_computed_fallback_failed", exc_info=True)

    payload = {"nodes": nodes, "edges": edges, "source": "enriched"}
    await cache_set_json(cache_key, payload, ttl_seconds=300)
    return ok(payload, _trace_id(request))


# ==============================
# Phase 3: AI Semantic Tagging
# ==============================

@router.post("/api/admin/extract-graph-tags")
async def admin_extract_graph_tags(
    request: Request,
    _user: CurrentUser = Depends(get_current_user),
):
    """Triggers AI extraction of semantic tags (poet, imagery, theme, dynasty, emotion)
    for poems and populates poem_graph_nodes + poem_graph_edges tables."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    poem_ids: list[str] | None = body.get("poem_ids")
    batch_size: int = min(int(body.get("batch_size", 20)), 50)

    client = get_supabase_admin()

    # Fetch poems to tag
    query = client.table("poems").select(f"{POEM_BASE_SELECT},updated_at").limit(batch_size)
    if poem_ids:
        query = query.in_("id", poem_ids)
    poems_result = query.execute()
    poems = poems_result.data or []

    if not poems:
        return ok({"nodes_created": 0, "edges_created": 0, "poems_processed": 0}, _trace_id(request))

    nodes_created = 0
    edges_created = 0

    for poem in poems:
        poem_id = poem["id"]
        author = str(poem.get("author") or "").strip()
        dynasty = str(poem.get("dynasty") or "").strip()
        content = str(poem.get("content") or "")
        tags = poem.get("tags") or []
        tag_list = list(tags) if isinstance(tags, list) else []

        # Upsert poet node
        if author:
            try:
                poet_result = (
                    client.table("poem_graph_nodes")
                    .upsert(
                        {
                            "poem_id": poem_id,
                            "node_type": "poet",
                            "label": author,
                            "weight": 1.0,
                            "metadata": {"dynasty": dynasty},
                        },
                        on_conflict="poem_id,node_type,label",
                    )
                    .execute()
                )
                if poet_result.data:
                    nodes_created += 1
            except Exception:
                pass

        # Upsert dynasty node
        if dynasty:
            try:
                dyn_result = (
                    client.table("poem_graph_nodes")
                    .upsert(
                        {
                            "poem_id": poem_id,
                            "node_type": "dynasty",
                            "label": dynasty,
                            "weight": 1.0,
                        },
                        on_conflict="poem_id,node_type,label",
                    )
                    .execute()
                )
                if dyn_result.data:
                    nodes_created += 1
            except Exception:
                pass

        # Upsert tag/theme nodes
        for tag in tag_list:
            tag_str = str(tag).strip()
            if not tag_str:
                continue
            try:
                tag_result = (
                    client.table("poem_graph_nodes")
                    .upsert(
                        {
                            "poem_id": poem_id,
                            "node_type": "theme",
                            "label": tag_str,
                            "weight": 1.0,
                        },
                        on_conflict="poem_id,node_type,label",
                    )
                    .execute()
                )
                if tag_result.data:
                    nodes_created += 1
            except Exception:
                pass

    # Create edges between poems sharing the same tag/author/dynasty
    try:
        all_nodes_result = client.table("poem_graph_nodes").select("id,node_type,label,poem_id").limit(5000).execute()
        all_nodes = all_nodes_result.data or []

        # Group by label
        by_label: dict[str, list[dict[str, Any]]] = {}
        for n in all_nodes:
            key = f"{n['node_type']}:{n['label']}"
            by_label.setdefault(key, []).append(n)

        existing_edges_result = (
            client.table("poem_graph_edges")
            .select("source_node_id,target_node_id,edge_type")
            .limit(10000)
            .execute()
        )
        existing_edges = {
            (
                min(str(edge.get("source_node_id")), str(edge.get("target_node_id"))),
                max(str(edge.get("source_node_id")), str(edge.get("target_node_id"))),
                str(edge.get("edge_type") or "shared_tag"),
            )
            for edge in (existing_edges_result.data or [])
            if edge.get("source_node_id") and edge.get("target_node_id")
        }

        for label_nodes in by_label.values():
            if len(label_nodes) < 2:
                continue
            for i in range(len(label_nodes)):
                for j in range(i + 1, len(label_nodes)):
                    if label_nodes[i]["poem_id"] == label_nodes[j]["poem_id"]:
                        continue
                    try:
                        source_id = str(label_nodes[i]["id"])
                        target_id = str(label_nodes[j]["id"])
                        edge_key = (
                            min(source_id, target_id),
                            max(source_id, target_id),
                            "shared_tag",
                        )
                        if edge_key not in existing_edges:
                            client.table("poem_graph_edges").insert(
                                {
                                    "source_node_id": source_id,
                                    "target_node_id": target_id,
                                    "edge_type": "shared_tag",
                                    "weight": 1.0,
                                }
                            ).execute()
                            existing_edges.add(edge_key)
                            edges_created += 1
                    except Exception:
                        pass
    except Exception:
        logger.warning("extract_graph_tags_edge_creation_failed", exc_info=True)

    payload = {
        "nodes_created": nodes_created,
        "edges_created": edges_created,
        "poems_processed": len(poems),
    }
    return ok(payload, _trace_id(request))

    raise HTTPException(status_code=400, detail="unsupported graph node kind")
