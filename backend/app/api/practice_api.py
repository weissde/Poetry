from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from ..ai import AIServiceError, complete_json
from ..auth import CurrentUser, get_current_user
from ..cache import cache_get_json, cache_set_json
from ..config import get_settings
from ..response import fail, ok
from ..schemas import (
    PracticeAnswerSubmitRequest,
    PracticeQuestionFeedbackRequest,
    PracticeSessionSummarySaveRequest,
    QuestionGenerateRequest,
    WrongbookSubjectivePracticeGenerateRequest,
)
from ..services.cache_invalidation import _invalidate_learning_cache, _invalidate_weakness_cache
from ..supabase_client import get_supabase_admin
from ..weakness import compute_and_save_profile

router = APIRouter()
settings = get_settings()
logger = logging.getLogger("poetry_ai.api.practice")

PRACTICE_TYPES = ["memorization", "meaning", "technique", "emotion", "appreciation", "comparison", "context"]


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _practice_session_summary_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail("练习小结数据表未就绪，请先执行 014_practice_session_summaries.sql", _trace_id(request), code=5310),
    )


def _practice_question_feedback_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail("题目反馈数据表未就绪，请先执行 015_practice_question_feedback.sql", _trace_id(request), code=5311),
    )


def _clip_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return f"{text[: max(1, limit - 1)]}…"


def _clean_practice_type(raw_type: Any, fallback: str = "appreciation") -> str:
    value = str(raw_type or "").strip().lower()
    if value in PRACTICE_TYPES:
        return value
    return fallback if fallback in PRACTICE_TYPES else "appreciation"


def _normalize_practice_options(raw_options: Any) -> list[str]:
    options = [str(item).strip() for item in raw_options if isinstance(item, str) and str(item).strip()] if isinstance(raw_options, list) else []
    if len(options) >= 4:
        return options[:4]
    default_options = ["A项", "B项", "C项", "D项"]
    while len(options) < 4:
        options.append(default_options[len(options)])
    return options


def _normalize_practice_question(
    raw_question: Any,
    index: int,
    topic: str,
    fallback_type: str = "appreciation",
    dynasty: str | None = None,
    theme: str | None = None,
) -> dict[str, Any]:
    row = raw_question if isinstance(raw_question, dict) else {}
    question_type = _clean_practice_type(row.get("type"), fallback=fallback_type)
    content = str(row.get("content") or "").strip() or f"第 {index + 1} 题：以下关于“{topic}”的分析，最恰当的一项是？"
    options = _normalize_practice_options(row.get("options"))
    answer = row.get("answer")
    answer_index = answer if isinstance(answer, int) and 0 <= answer < len(options) else 0
    explanation = str(row.get("explanation") or "").strip() or "请关注诗句意象、情感倾向和表达手法。"
    row_dynasty = str(row.get("dynasty") or "").strip() or dynasty or None
    row_theme = str(row.get("theme") or "").strip() or theme or topic or None
    raw_tags = row.get("keywordTags") or row.get("keyword_tags")
    keyword_tags: list[str] = []
    seen: set[str] = set()
    if isinstance(raw_tags, list):
        for raw_item in raw_tags:
            if not isinstance(raw_item, str):
                continue
            tag = raw_item.strip()
            if not tag:
                continue
            normalized = tag.lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            keyword_tags.append(tag)
            if len(keyword_tags) >= 8:
                break
    question_source = str(row.get("questionSource") or row.get("source") or "").strip() or None
    return {
        "type": question_type,
        "content": content,
        "options": options,
        "answer": answer_index,
        "explanation": explanation,
        "dynasty": row_dynasty,
        "theme": row_theme,
        "keywordTags": keyword_tags,
        "questionSource": question_source,
    }


def _normalize_practice_questions(
    raw_questions: list[Any],
    count: int,
    topic: str,
    fallback_type: str = "appreciation",
    dynasty: str | None = None,
    theme: str | None = None,
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, raw_question in enumerate(raw_questions[: max(1, count)]):
        normalized.append(
            _normalize_practice_question(
                raw_question,
                index,
                topic,
                fallback_type=fallback_type,
                dynasty=dynasty,
                theme=theme,
            )
        )

    while len(normalized) < count:
        idx = len(normalized)
        normalized.append(
            {
                "type": fallback_type,
                "content": f"第 {idx + 1} 题：以下对“{topic}”相关诗句的理解，最符合文本的一项是？",
                "options": [
                    "只需背诵字面意思，无需结合语境。",
                    "应结合意象和语境判断作者情感。",
                    "古诗词没有情感表达，仅有叙事功能。",
                    "诗句意思完全固定，不受上下句影响。",
                ],
                "answer": 1,
                "explanation": "古诗词理解要结合意象、上下文与情感线索。",
                "dynasty": dynasty,
                "theme": theme or topic,
                "keywordTags": [],
                "questionSource": None,
            }
        )

    return normalized[:count]


def _build_practice_cache_key(namespace: str, payload: dict[str, Any]) -> str:
    fingerprint = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
    return f"practice:{namespace}:{fingerprint}"


def _practice_quick_timeout() -> float:
    timeout = max(6, int(settings.practice_ai_timeout_seconds))
    return float(min(timeout, settings.request_timeout_seconds))


def _practice_quick_attempts() -> int:
    return max(1, int(settings.practice_ai_max_attempts))


def _build_local_practice_questions(
    topic: str,
    count: int,
    types: list[str],
    difficulty: str,
    *,
    dynasty: str | None = None,
    theme: str | None = None,
    keyword_tags: list[str] | None = None,
    source: str = "fallback_local",
) -> list[dict[str, Any]]:
    resolved_types = [item for item in types if item in PRACTICE_TYPES] or PRACTICE_TYPES
    tags = [tag for tag in (keyword_tags or []) if isinstance(tag, str) and tag.strip()]
    level_hint = {"easy": "基础识记", "medium": "理解分析", "hard": "综合鉴赏"}.get(difficulty, "理解分析")

    templates: dict[str, dict[str, Any]] = {
        "memorization": {
            "content": "以下哪项最适合作为“{topic}”相关诗词的背诵抓手？",
            "correct": "先抓关键词并按意象链复述，再回到原句核对。",
            "wrong": ["逐字机械重复，不需要理解诗句含义。", "只记作者生平，背诵内容可以忽略。", "先看解析结论，不必回到原诗语句。"],
            "explanation": "背诵效率最高的方法是“关键词-意象-原句”三步法。",
        },
        "meaning": {
            "content": "关于“{topic}”相关诗句词义理解，哪一项最恰当？",
            "correct": "应结合上下句语境判断词义，不可孤立释词。",
            "wrong": ["词语只按现代汉语常用义解释即可。", "遇到生僻词直接按字面拆解，不看语境。", "词义不会影响情感判断，可以忽略。"],
            "explanation": "古诗词词义必须结合语境和情感线索。",
        },
        "technique": {
            "content": "下列对“{topic}”相关表达手法的判断，最合理的是？",
            "correct": "常见是借景抒情与动静结合，共同服务情感表达。",
            "wrong": ["只要有景物描写，就一定是说明文写法。", "诗词手法和情感无关，只看字面即可。", "所有修辞都等价，不需区分作用。"],
            "explanation": "手法判断要落在“如何服务主旨”上。",
        },
        "emotion": {
            "content": "对于“{topic}”相关诗词的情感走向，最可能的是哪一项？",
            "correct": "先写景后入情，通过意象层层递进到情感核心。",
            "wrong": ["情感完全突兀出现，与前文意象无关。", "诗词只叙事不抒情，无法判断情感。", "情感只看最后一句，前文都不重要。"],
            "explanation": "情感通常由意象与语境共同铺垫。",
        },
        "appreciation": {
            "content": "从综合赏析角度看，“{topic}”相关诗词解读应优先关注哪项？",
            "correct": "同时关注意象、手法、情感三要素并举诗句证据。",
            "wrong": ["只评价是否押韵，不讨论内容和情感。", "只背结论，不引用诗句支撑观点。", "只看作者名气，不分析文本。"],
            "explanation": "综合赏析必须“观点+证据+分析”完整呈现。",
        },
        "comparison": {
            "content": "若将“{topic}”与同类诗词比较阅读，下列比较思路最合理的是？",
            "correct": "先比较意象与情感基调，再比较表达手法和语言风格差异。",
            "wrong": ["只比较字数长短，不看内容与主旨。", "只要作者朝代相同，就无需比较文本细节。", "比较阅读只看题目，不需要引用诗句。"],
            "explanation": "比较阅读要围绕“意象-情感-手法-语言”建立对应关系。",
        },
        "context": {
            "content": "在“{topic}”语境默写题中，最稳妥的作答策略是？",
            "correct": "先抓题干情境关键词，再定位对应名句并核对易错字。",
            "wrong": ["只凭感觉写一句相近诗句即可。", "不必核对字词，意思差不多就算正确。", "只写上半句，默写题通常不给下半句。"],
            "explanation": "语境默写要做到“情境匹配 + 句子准确 + 字词正确”。",
        },
    }

    questions: list[dict[str, Any]] = []
    for index in range(count):
        q_type = resolved_types[index % len(resolved_types)]
        template = templates.get(q_type, templates["appreciation"])
        tag_hint = tags[index % len(tags)] if tags else ""

        content = str(template["content"]).format(topic=topic)
        if tag_hint:
            content = f"{content}（关键词提示：{tag_hint}）"

        options = [template["correct"], *template["wrong"]]
        rotate = index % 4
        rotated_options = options[rotate:] + options[:rotate]
        answer_index = (0 - rotate) % 4

        explanation = str(template["explanation"])
        if tag_hint:
            explanation = f"{explanation} 建议重点复盘关键词“{tag_hint}”对应的表达依据。"

        questions.append(
            {
                "type": q_type,
                "content": f"[{level_hint}] 第 {index + 1} 题：{content}",
                "options": rotated_options,
                "answer": answer_index,
                "explanation": explanation,
                "dynasty": dynasty,
                "theme": theme or topic,
                "keywordTags": [tag_hint] if tag_hint else [],
                "questionSource": source,
            }
        )

    return questions


def _clean_metric_text(value: str | None) -> str | None:
    text = str(value or "").strip()
    return text or None


def _clean_metric_tags(value: list[str] | None) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    items: list[str] = []
    for raw in value[:20]:
        if not isinstance(raw, str):
            continue
        text = raw.strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        items.append(text)
    return items


async def _async_update_weakness(
    user_id: str,
    *,
    question_type: str,
    is_correct: bool,
    dynasty: str | None = None,
    theme: str | None = None,
    keyword_tags: list[str] | None = None,
    question_source: str | None = None,
) -> None:
    try:
        await compute_and_save_profile(
            user_id,
            question_type=question_type,
            is_correct=is_correct,
            dynasty=dynasty,
            theme=theme,
            keyword_tags=keyword_tags,
            question_source=question_source,
        )
        await _invalidate_weakness_cache(user_id)
        await _invalidate_learning_cache(user_id)
    except Exception:
        logger.warning("async_weakness_update_failed user_id=%s", user_id, exc_info=True)


@router.post("/api/practice/questions/generate")
async def practice_questions_generate(
    payload: QuestionGenerateRequest,
    request: Request,
    _user: CurrentUser = Depends(get_current_user),
):
    requested_types = [item for item in payload.types if item in PRACTICE_TYPES] or PRACTICE_TYPES
    cache_payload = {
        "topic": payload.topic.strip(),
        "count": int(payload.count),
        "difficulty": payload.difficulty,
        "types": requested_types,
        "model": settings.doubao_model_id,
        "version": 2,
    }
    cache_key = _build_practice_cache_key("generate", cache_payload)
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict) and isinstance(cached.get("questions"), list):
        return ok({"questions": cached.get("questions"), "meta": {"source": "cache"}}, _trace_id(request))

    difficulty_map = {
        "easy": "基础难度（偏识记与理解）",
        "medium": "中等难度（理解与鉴赏并重）",
        "hard": "进阶难度（重分析与综合）",
    }

    prompt = "\n".join(
        [
            "你是一位中学语文出题老师，请根据给定诗词或主题生成练习题。",
            "只返回 JSON 数组，不要任何额外说明。",
            (
                "数组项字段："
                f"type(content type must be one of {'/'.join(PRACTICE_TYPES)}), "
                "content, options(4), answer(0-3), explanation, dynasty(optional), theme(optional)。"
            ),
            f"题型只允许使用：{', '.join(requested_types)}",
            f"目标难度：{difficulty_map.get(payload.difficulty, difficulty_map['medium'])}",
            "题干与选项必须为中文，答案必须可由题干与选项唯一确定。",
            f"请围绕以下主题生成 {payload.count} 道题：",
            payload.topic,
        ]
    )

    try:
        data = await complete_json(
            prompt,
            temperature=0.2,
            max_attempts=_practice_quick_attempts(),
            timeout_seconds=_practice_quick_timeout(),
        )
        if not isinstance(data, list):
            raise HTTPException(status_code=500, detail="AI did not return question list")

        normalized_questions = _normalize_practice_questions(
            data,
            payload.count,
            payload.topic,
            fallback_type=requested_types[0] if requested_types else "appreciation",
        )
        for question in normalized_questions:
            if not question.get("questionSource"):
                question["questionSource"] = "ai"

        await cache_set_json(
            cache_key,
            {"questions": normalized_questions},
            ttl_seconds=settings.practice_ai_cache_ttl_seconds,
        )
        return ok({"questions": normalized_questions, "meta": {"source": "ai"}}, _trace_id(request))
    except (AIServiceError, asyncio.TimeoutError) as exc:
        logger.warning("practice_generate_fallback reason=%s", type(exc).__name__)
        fallback_questions = _build_local_practice_questions(
            payload.topic,
            payload.count,
            requested_types,
            payload.difficulty,
            source="fallback_local",
        )
        await cache_set_json(
            cache_key,
            {"questions": fallback_questions},
            ttl_seconds=max(60, settings.practice_ai_cache_ttl_seconds // 2),
        )
        return ok({"questions": fallback_questions, "meta": {"source": "fallback_local"}}, _trace_id(request))


@router.post("/api/practice/wrongbook-subjective/generate")
async def practice_wrongbook_subjective_generate(
    payload: WrongbookSubjectivePracticeGenerateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    cache_payload = {
        "user": user.id,
        "count": int(payload.count),
        "difficulty": payload.difficulty,
        "status": payload.status,
        "dynasty": (payload.dynasty or "").strip(),
        "theme": (payload.theme or "").strip(),
        "keywordTag": (payload.keywordTag or "").strip(),
        "model": settings.doubao_model_id,
        "version": 2,
    }
    cache_key = _build_practice_cache_key("wrongbook-subjective", cache_payload)
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict) and isinstance(cached.get("questions"), list):
        return ok(
            {
                "questions": cached.get("questions"),
                "focus": cached.get("focus"),
                "meta": {"source": "cache"},
            },
            _trace_id(request),
        )

    def build_query(select_columns: str, allow_extended_fields: bool = True):
        query = client.table("wrong_questions").select(select_columns).eq("user_id", user.id)
        if payload.status in {"pending", "retry"}:
            query = query.eq("status", payload.status)
        if payload.dynasty and payload.dynasty.strip():
            query = query.eq("dynasty", payload.dynasty.strip())
        if payload.theme and payload.theme.strip():
            query = query.eq("theme", payload.theme.strip())
        if allow_extended_fields and payload.keywordTag and payload.keywordTag.strip():
            query = query.contains("keyword_tags", [payload.keywordTag.strip()])
        return query

    try:
        result = (
            build_query(
                "question_content,explanation,error_type,question_kind,keyword_tags,dynasty,theme,status,created_at"
            )
            .order("created_at", desc=True)
            .limit(160)
            .execute()
        )
        rows = result.data or []
    except Exception:
        result = (
            build_query("question_content,explanation,error_type,dynasty,theme,status,created_at", allow_extended_fields=False)
            .order("created_at", desc=True)
            .limit(160)
            .execute()
        )
        rows = result.data or []
        for row in rows:
            row["question_kind"] = None
            row["keyword_tags"] = []

    subjective_rows: list[dict[str, Any]] = []
    for row in rows:
        question_kind = str(row.get("question_kind") or "").strip().lower()
        error_type = str(row.get("error_type") or "").strip().lower()
        if question_kind == "subjective" or error_type == "subjective":
            subjective_rows.append(row)

    if not subjective_rows:
        return JSONResponse(
            status_code=400,
            content=fail("暂无可用主观题错题，请先在模考中完成主观题作答。", _trace_id(request), code=4002),
        )

    keyword_counts: dict[str, int] = {}
    theme_counts: dict[str, int] = {}
    dynasty_counts: dict[str, int] = {}

    for row in subjective_rows:
        raw_theme = str(row.get("theme") or "").strip()
        raw_dynasty = str(row.get("dynasty") or "").strip()
        if raw_theme:
            theme_counts[raw_theme] = theme_counts.get(raw_theme, 0) + 1
        if raw_dynasty:
            dynasty_counts[raw_dynasty] = dynasty_counts.get(raw_dynasty, 0) + 1

        raw_tags = row.get("keyword_tags")
        if isinstance(raw_tags, list):
            for raw_tag in raw_tags:
                if not isinstance(raw_tag, str):
                    continue
                tag = raw_tag.strip()
                if not tag:
                    continue
                keyword_counts[tag] = keyword_counts.get(tag, 0) + 1

    if not keyword_counts:
        for row in subjective_rows[:30]:
            content = str(row.get("question_content") or "")
            for token in re.findall(r"[\u4e00-\u9fff]{2,6}", content):
                keyword_counts[token] = keyword_counts.get(token, 0) + 1

    top_keywords = [item[0] for item in sorted(keyword_counts.items(), key=lambda pair: (-pair[1], pair[0]))[:8]]
    focus_theme = (
        payload.theme.strip()
        if payload.theme and payload.theme.strip()
        else (sorted(theme_counts.items(), key=lambda pair: (-pair[1], pair[0]))[0][0] if theme_counts else "古诗词赏析")
    )
    focus_dynasty = (
        payload.dynasty.strip()
        if payload.dynasty and payload.dynasty.strip()
        else (sorted(dynasty_counts.items(), key=lambda pair: (-pair[1], pair[0]))[0][0] if dynasty_counts else "")
    )

    sample_items = []
    for row in subjective_rows[:6]:
        content = str(row.get("question_content") or "").strip()
        explanation = str(row.get("explanation") or "").strip()
        if content:
            sample_items.append(f"题干：{content}")
        if explanation:
            sample_items.append(f"解析：{explanation}")

    topic_text = f"{focus_theme}主观题专项"
    if payload.keywordTag and payload.keywordTag.strip():
        topic_text = f"{focus_theme}·{payload.keywordTag.strip()}专项"

    difficulty_map = {
        "easy": "基础难度（偏概念识别与基础理解）",
        "medium": "中等难度（结合诗句证据进行分析）",
        "hard": "进阶难度（重综合比较与表达手法判断）",
    }

    prompt_lines = [
        "你是一位中学语文老师，正在做“主观题错因回补”。",
        "请将主观题薄弱点转化为客观选择题练习，帮助学生先补基础再回到主观题。",
        "只输出 JSON 数组，不要任何解释。",
        "每题字段：type(仅可meaning/technique/emotion/appreciation)、content、options(4)、answer(0-3)、explanation、dynasty(optional)、theme(optional)。",
        f"题量：{payload.count}",
        f"难度：{difficulty_map.get(payload.difficulty, difficulty_map['medium'])}",
        f"聚焦主题：{focus_theme}",
        f"聚焦朝代：{focus_dynasty or '不限'}",
        f"高频缺失关键词：{'、'.join(top_keywords) if top_keywords else '意象、情感、手法'}",
        "请确保每题都能对应到上述关键词中的至少一个，避免重复题干。",
    ]
    if sample_items:
        prompt_lines.append("以下是学生近期主观题错题片段，请据此命题：")
        prompt_lines.extend(sample_items)

    try:
        data = await complete_json(
            "\n".join(prompt_lines),
            temperature=0.2,
            max_attempts=_practice_quick_attempts(),
            timeout_seconds=_practice_quick_timeout(),
        )
        if not isinstance(data, list):
            raise HTTPException(status_code=500, detail="AI did not return question list")

        normalized_questions = _normalize_practice_questions(
            data,
            payload.count,
            topic_text,
            fallback_type="appreciation",
            dynasty=focus_dynasty or None,
            theme=focus_theme or None,
        )
        fallback_tags = top_keywords[:4]
        for question in normalized_questions:
            existing_tags = question.get("keywordTags")
            if not isinstance(existing_tags, list) or not existing_tags:
                question["keywordTags"] = fallback_tags
            question["questionSource"] = "wrongbook_subjective"

        focus_payload = {
            "topic": topic_text,
            "theme": focus_theme,
            "dynasty": focus_dynasty or None,
            "keywords": top_keywords,
            "sourceWrongCount": len(subjective_rows),
        }
        await cache_set_json(
            cache_key,
            {"questions": normalized_questions, "focus": focus_payload},
            ttl_seconds=settings.practice_ai_cache_ttl_seconds,
        )
        return ok(
            {
                "questions": normalized_questions,
                "focus": focus_payload,
                "meta": {"source": "ai"},
            },
            _trace_id(request),
        )
    except (AIServiceError, asyncio.TimeoutError) as exc:
        logger.warning("practice_wrongbook_subjective_fallback reason=%s user=%s", type(exc).__name__, user.id)
        fallback_tags = top_keywords[:4]
        fallback_questions = _build_local_practice_questions(
            topic_text,
            payload.count,
            ["appreciation", "emotion", "technique", "meaning"],
            payload.difficulty,
            dynasty=focus_dynasty or None,
            theme=focus_theme or None,
            keyword_tags=fallback_tags,
            source="wrongbook_subjective_fallback",
        )
        focus_payload = {
            "topic": topic_text,
            "theme": focus_theme,
            "dynasty": focus_dynasty or None,
            "keywords": top_keywords,
            "sourceWrongCount": len(subjective_rows),
        }
        await cache_set_json(
            cache_key,
            {"questions": fallback_questions, "focus": focus_payload},
            ttl_seconds=max(60, settings.practice_ai_cache_ttl_seconds // 2),
        )
        return ok(
            {
                "questions": fallback_questions,
                "focus": focus_payload,
                "meta": {"source": "fallback_local"},
            },
            _trace_id(request),
        )


@router.post("/api/practice/questions/feedback")
async def practice_question_feedback_submit(
    payload: PracticeQuestionFeedbackRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    comment_text = str(payload.comment or "").strip()
    question_text = str(payload.questionContent or "").strip()
    if not question_text:
        raise HTTPException(status_code=400, detail="questionContent is required")
    if not comment_text:
        raise HTTPException(status_code=400, detail="comment is required")

    now = datetime.now(timezone.utc).isoformat()
    client = get_supabase_admin()
    record = {
        "user_id": user.id,
        "topic": (payload.topic or "").strip() or None,
        "question_type": (payload.questionType or "").strip() or None,
        "question_content": question_text,
        "options_json": payload.options[:8] if isinstance(payload.options, list) else [],
        "selected_index": payload.selectedIndex,
        "correct_index": payload.correctIndex,
        "comment": comment_text,
        "source": (payload.source or "").strip() or None,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = client.table("practice_question_feedback").insert(record).execute()
    except Exception:
        return _practice_question_feedback_table_error(request)

    item = (result.data or [None])[0]
    return ok({"saved": True, "item": item}, _trace_id(request))


@router.post("/api/practice/answers")
async def practice_answer_submit(
    payload: PracticeAnswerSubmitRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    now_iso = datetime.now(timezone.utc).isoformat()
    question_type = _clean_metric_text(payload.questionType) or "unknown"
    dynasty = _clean_metric_text(payload.dynasty)
    theme = _clean_metric_text(payload.theme)
    keyword_tags = _clean_metric_tags(payload.keywordTags)
    question_source = _clean_metric_text(payload.questionSource)

    answer_saved = False
    try:
        client.table("user_answers").insert(
            {
                "user_id": user.id,
                "question_type": question_type,
                "is_correct": payload.isCorrect,
                "context": "practice",
                "created_at": now_iso,
            }
        ).execute()
        answer_saved = True
    except Exception:
        logger.warning("practice_answer_insert_failed user_id=%s", user.id, exc_info=True)

    background_tasks.add_task(
        _async_update_weakness,
        user.id,
        question_type=question_type,
        is_correct=payload.isCorrect,
        dynasty=dynasty,
        theme=theme,
        keyword_tags=keyword_tags,
        question_source=question_source,
    )

    return ok({"queued": True, "answerSaved": answer_saved}, _trace_id(request))


@router.post("/api/practice/session-summary")
async def practice_session_summary_save(
    payload: PracticeSessionSummarySaveRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    source = str(payload.source or "practice").strip().lower() or "practice"
    topic = _clip_text(payload.topic, 120) if payload.topic else None
    summary = _clip_text(payload.summary, 600)
    weak_type = _clip_text(payload.weakType, 40) if payload.weakType else None
    attempts = max(0, int(payload.attempts or 0))
    correct = max(0, min(attempts, int(payload.correct or 0)))
    accuracy = max(0, min(100, int(payload.accuracy or 0)))
    type_stats = [
        {
            "type": _clip_text(item.type, 40),
            "attempts": max(0, int(item.attempts or 0)),
            "correct": max(0, int(item.correct or 0)),
            "rate": max(0, min(100, int(item.rate or 0))),
        }
        for item in (payload.typeStats or [])
        if str(item.type or "").strip()
    ][:12]

    record = {
        "user_id": user.id,
        "source": source,
        "topic": topic,
        "summary": summary,
        "attempts": attempts,
        "correct": correct,
        "accuracy": accuracy,
        "weak_type": weak_type,
        "type_stats": type_stats,
        "created_at": now,
    }
    try:
        result = client.table("practice_session_summaries").insert(record).execute()
    except Exception:
        return _practice_session_summary_table_error(request)
    item = (result.data or [None])[0]
    return ok({"item": item}, _trace_id(request))


@router.get("/api/practice/session-summaries")
async def practice_session_summary_list(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    source: str = Query(default=""),
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, alias="pageSize", ge=1, le=50),
    days: int = Query(default=0, ge=0, le=365),
):
    client = get_supabase_admin()
    source_filter = str(source or "").strip().lower()
    keyword = str(q or "").strip()
    since_iso = None
    if days > 0:
        since_iso = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    query = (
        client.table("practice_session_summaries")
        .select("id,source,topic,summary,attempts,correct,accuracy,weak_type,type_stats,created_at", count="exact")
        .eq("user_id", user.id)
    )
    if source_filter:
        query = query.eq("source", source_filter)
    if since_iso:
        query = query.gte("created_at", since_iso)
    if keyword:
        safe = keyword.replace("%", "").replace(",", " ").strip()
        if safe:
            query = query.or_(f"topic.ilike.%{safe}%,summary.ilike.%{safe}%")
    try:
        first = query.order("created_at", desc=True).limit(1).execute()
        total = int(first.count or 0)
        total_pages = max(1, (total + page_size - 1) // page_size)
        target_page = min(max(1, page), total_pages)
        start = (target_page - 1) * page_size
        end = start + page_size - 1
        result = query.order("created_at", desc=True).range(start, end).execute()
    except Exception:
        return _practice_session_summary_table_error(request)
    return ok(
        {
            "items": result.data or [],
            "pagination": {
                "page": target_page,
                "pageSize": page_size,
                "total": total,
                "totalPages": total_pages,
                "hasPrev": target_page > 1,
                "hasNext": target_page < total_pages,
            },
        },
        _trace_id(request),
    )


@router.delete("/api/practice/session-summaries/{summary_id}")
async def practice_session_summary_delete(
    summary_id: str,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    try:
        result = (
            client.table("practice_session_summaries")
            .delete()
            .eq("id", summary_id)
            .eq("user_id", user.id)
            .execute()
        )
    except Exception:
        return _practice_session_summary_table_error(request)
    rows = result.data or []
    if not rows:
        return JSONResponse(status_code=404, content=fail("Practice summary not found", _trace_id(request), code=4042))
    return ok({"id": summary_id, "deleted": True}, _trace_id(request))
