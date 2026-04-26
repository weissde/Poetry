from __future__ import annotations

import asyncio
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..ai import AIServiceError, complete_json, stream_analysis, stream_chat
from ..auth import CurrentUser, get_current_user
from ..cache import cache_get_json, cache_set_json
from ..config import get_settings
from ..response import fail, ok
from ..schemas import AnalyzeRequest, ChatRequest, ChatSummarySaveRequest, LearningReportRequest
from ..services.cache_invalidation import _invalidate_chat_summary_cache
from ..services.summary_service import get_user_learning_summary
from ..supabase_client import get_supabase_admin

router = APIRouter()
settings = get_settings()


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _stable_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _json_sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _extract_first_json(raw_text: str) -> dict[str, Any] | None:
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        obj = json.loads(raw_text[start : end + 1])
    except Exception:
        return None
    return obj if isinstance(obj, dict) else None


def _chat_summary_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail(
            "chat_summaries table is not ready. Please run migration 010_chat_summaries.sql first.",
            _trace_id(request),
            code=5306,
        ),
    )


def _clip_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    if limit <= 3:
        return text[: max(1, limit)]
    return f"{text[: max(1, limit - 3)]}..."


def _normalize_chat_messages(raw_messages: list[Any]) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    for raw_item in raw_messages[:60]:
        if isinstance(raw_item, dict):
            role = str(raw_item.get("role") or "").strip()
            content = str(raw_item.get("content") or "").strip()
        else:
            role = str(getattr(raw_item, "role", "") or "").strip()
            content = str(getattr(raw_item, "content", "") or "").strip()
        if role not in {"user", "assistant"}:
            continue
        if not content:
            continue
        normalized.append({"role": role, "content": content})
    return normalized


def _extract_chat_key_points(text: str, limit: int = 3) -> list[str]:
    points: list[str] = []
    seen: set[str] = set()
    for raw_sentence in re.split(r"[\.\!\?。！？\n]+", text):
        sentence = raw_sentence.strip(" ;,，。")
        if len(sentence) < 6:
            continue
        key = sentence.lower()
        if key in seen:
            continue
        seen.add(key)
        points.append(sentence if sentence.endswith(".") else f"{sentence}.")
        if len(points) >= limit:
            break
    return points


def _poet_label(poet: str) -> str:
    labels = {
        "libai": "Li Bai",
        "dufu": "Du Fu",
        "wangwei": "Wang Wei",
        "baijuyi": "Bai Juyi",
        "wangchangling": "Wang Changling",
        "lishangyin": "Li Shangyin",
        "sushi": "Su Shi",
        "xinqiji": "Xin Qiji",
        "liqingzhao": "Li Qingzhao",
        "taoyuanming": "Tao Yuanming",
    }
    key = str(poet or "").strip().lower()
    return labels.get(key, key or "poet")


def _build_heuristic_chat_summary(
    *,
    mode: str,
    poet: str,
    poem_title: str | None,
    messages: list[dict[str, str]],
) -> dict[str, Any]:
    user_messages = [item["content"] for item in messages if item.get("role") == "user"]
    assistant_messages = [item["content"] for item in messages if item.get("role") == "assistant"]
    last_question = user_messages[-1] if user_messages else ""
    latest_answer = assistant_messages[-1] if assistant_messages else ""
    key_points = _extract_chat_key_points(latest_answer, limit=3)
    if not key_points:
        key_points = _extract_chat_key_points("\n".join(user_messages[-3:]), limit=3)
    if not key_points:
        key_points = ["Review key terms, imagery, and emotional progression from the dialogue."]

    mode_label = "poet-chat" if mode == "poet" else "qa-learning"
    topic_label = poem_title.strip() if isinstance(poem_title, str) and poem_title.strip() else "current poem topic"
    poet_text = f" ({_poet_label(poet)})" if mode == "poet" else ""

    summary_parts = [
        f"This {mode_label}{poet_text} session focused on {topic_label} with {len(messages)} messages.",
    ]
    if last_question:
        summary_parts.append(f"Last learner question: {_clip_text(last_question, 40)}.")
    if latest_answer:
        summary_parts.append(f"Latest tutor response: {_clip_text(latest_answer, 80)}.")

    summary = " ".join(summary_parts).strip() or f"{mode_label} summary completed."
    return {
        "summary": summary,
        "keyPoints": key_points[:5],
        "lastQuestion": _clip_text(last_question, 120) if last_question else None,
        "source": "heuristic",
    }


async def _build_ai_chat_summary(
    *,
    mode: str,
    poet: str,
    poem_title: str | None,
    poem_author: str | None,
    messages: list[dict[str, str]],
) -> dict[str, Any] | None:
    transcript_lines = []
    for item in messages[-20:]:
        role = "student" if item.get("role") == "user" else "tutor"
        transcript_lines.append(f"{role}: {item.get('content', '')}")

    prompt = "\n".join(
        [
            "You are a Chinese-literature teacher. Generate a concise review summary for this chat.",
            "Return JSON only, no extra text.",
            'JSON schema: {"summary": string, "keyPoints": string[], "lastQuestion": string}.',
            f'Conversation mode: {"poet-chat" if mode == "poet" else "qa-learning"}',
            f'Poet persona: {_poet_label(poet) if mode == "poet" else "none"}',
            f'Poem title: {poem_title or "unknown"}',
            f'Poem author: {poem_author or "unknown"}',
            "Conversation transcript:",
            "\n".join(transcript_lines),
        ]
    )
    timeout_seconds = max(6.0, min(12.0, float(settings.request_timeout_seconds)))
    try:
        data = await complete_json(
            prompt,
            temperature=0.2,
            max_attempts=1,
            timeout_seconds=timeout_seconds,
        )
    except Exception:
        return None

    if not isinstance(data, dict):
        return None

    summary = str(data.get("summary") or "").strip()
    raw_key_points = data.get("keyPoints")
    raw_last_question = data.get("lastQuestion")
    if not summary:
        return None

    key_points: list[str] = []
    if isinstance(raw_key_points, list):
        for item in raw_key_points:
            if not isinstance(item, str):
                continue
            text = item.strip()
            if not text:
                continue
            key_points.append(text)
            if len(key_points) >= 5:
                break
    if not key_points:
        key_points = _extract_chat_key_points(summary, limit=3)

    last_question = str(raw_last_question or "").strip() or None
    return {
        "summary": summary,
        "keyPoints": key_points[:5],
        "lastQuestion": _clip_text(last_question, 120) if last_question else None,
        "source": "ai",
    }


def _chunk_text_for_sse(text: str, chunk_size: int = 20) -> list[str]:
    chunks: list[str] = []
    for line in text.splitlines(keepends=True):
        if len(line) <= chunk_size:
            chunks.append(line)
            continue
        start = 0
        while start < len(line):
            chunks.append(line[start : start + chunk_size])
            start += chunk_size
    return chunks or [text]


async def _stream_client_disconnected(request: Request) -> bool:
    try:
        return await request.is_disconnected()
    except Exception:
        return False


def _build_learning_report_fallback(summary_payload: dict[str, Any]) -> dict[str, Any]:
    report_seed = summary_payload.get("reportSeed") if isinstance(summary_payload.get("reportSeed"), dict) else {}
    summary_title = str(report_seed.get("summaryTitle") or "AI 学情解读").strip()
    summary_text = str(report_seed.get("summaryText") or "").strip()
    teacher_title = str(report_seed.get("teacherAdviceTitle") or "教师 / 家长建议").strip()
    teacher_text = str(report_seed.get("teacherAdviceText") or "").strip()
    weakest = summary_payload.get("weakest") if isinstance(summary_payload.get("weakest"), dict) else None
    trend_items = summary_payload.get("trend", {}).get("items") if isinstance(summary_payload.get("trend"), dict) else []
    last_trend_value = None
    if isinstance(trend_items, list) and trend_items:
        maybe_value = trend_items[-1].get("value") if isinstance(trend_items[-1], dict) else None
        if isinstance(maybe_value, int):
            last_trend_value = maybe_value
    if not summary_text:
        overview = summary_payload.get("overview") if isinstance(summary_payload.get("overview"), dict) else {}
        summary_text = (
            f"近 30 天综合准确率约 {overview.get('accuracy30d', 0)}%，"
            f"已累计学习 {overview.get('poemCount', 0)} 首诗词，连续学习 {overview.get('streakDays', 0)} 天。"
        )
        if weakest:
            summary_text += f" 当前最需要补齐的是 {weakest.get('bucket')}·{weakest.get('label')}（正确率 {weakest.get('rate')}%）。"
        if last_trend_value is not None:
            summary_text += f" 最近一周趋势点约为 {last_trend_value}%。"
    if not teacher_text:
        teacher_text = "建议先做一组专项练测，再回错题与记忆训练收束。"

    sections = [
        f"{summary_title}\n{summary_text}",
        f"{teacher_title}\n{teacher_text}",
    ]
    text = "\n\n".join(section for section in sections if section.strip())
    return {
        "text": text.strip(),
        "summaryTitle": summary_title,
        "summaryText": summary_text,
        "teacherAdviceTitle": teacher_title,
        "teacherAdviceText": teacher_text,
        "source": "heuristic",
    }


async def _build_ai_learning_report(summary_payload: dict[str, Any]) -> dict[str, Any] | None:
    prompt = "\n".join(
        [
            "你是一位中学语文老师，请根据以下学习数据生成简洁的学情解读。",
            "输出 JSON，不要额外说明。",
            'JSON schema: {"summaryTitle": string, "summaryText": string, "teacherAdviceTitle": string, "teacherAdviceText": string}.',
            "要求：summaryText 聚焦学生当前状态，teacherAdviceText 聚焦下一步教学/陪伴建议，语言自然、具体、克制。",
            json.dumps(summary_payload, ensure_ascii=False),
        ]
    )
    try:
        data = await complete_json(prompt, temperature=0.2, max_attempts=1, timeout_seconds=12)
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    summary_title = str(data.get("summaryTitle") or "AI 学情解读").strip()
    summary_text = str(data.get("summaryText") or "").strip()
    teacher_title = str(data.get("teacherAdviceTitle") or "教师 / 家长建议").strip()
    teacher_text = str(data.get("teacherAdviceText") or "").strip()
    if not summary_text or not teacher_text:
        return None
    text = f"{summary_title}\n{summary_text}\n\n{teacher_title}\n{teacher_text}".strip()
    return {
        "text": text,
        "summaryTitle": summary_title,
        "summaryText": summary_text,
        "teacherAdviceTitle": teacher_title,
        "teacherAdviceText": teacher_text,
        "source": "ai",
    }


@router.post("/api/ai/analyze/stream")
async def ai_analyze_stream(payload: AnalyzeRequest, request: Request, _user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()

    normalized = payload.poemContent.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="poemContent is required")

    poem_hash = hashlib.sha256(f"{payload.depth}|{normalized}".encode("utf-8")).hexdigest()
    cached = client.table("analysis_cache").select("analysis_json").eq("poem_hash", poem_hash).limit(1).execute()
    cached_rows = cached.data or []

    if cached_rows:

        async def cache_stream() -> AsyncGenerator[str, None]:
            full_text = json.dumps(cached_rows[0]["analysis_json"], ensure_ascii=False)
            if await _stream_client_disconnected(request):
                return
            yield _json_sse("token", {"token": full_text, "text": full_text, "source": "cache"})
            if await _stream_client_disconnected(request):
                return
            yield _json_sse("done", {"text": full_text, "source": "cache"})

        return StreamingResponse(cache_stream(), media_type="text/event-stream")

    async def event_stream() -> AsyncGenerator[str, None]:
        cumulative = ""
        try:
            async for token in stream_analysis(payload.model_dump()):
                if await _stream_client_disconnected(request):
                    break
                cumulative += token
                yield _json_sse("token", {"token": token, "text": cumulative, "source": "ai"})
            if await _stream_client_disconnected(request):
                return

            parsed = _extract_first_json(cumulative)
            if parsed:
                client.table("analysis_cache").upsert(
                    {
                        "poem_hash": poem_hash,
                        "poem_id": payload.poemId,
                        "model": settings.doubao_model_id,
                        "analysis_json": parsed,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                    on_conflict="poem_hash",
                ).execute()
            yield _json_sse("done", {"text": cumulative, "source": "ai"})
        except AIServiceError as exc:
            message = str(exc)
            if not cumulative:
                cumulative = message
                yield _json_sse("token", {"token": message, "text": cumulative, "source": "fallback"})
            if not await _stream_client_disconnected(request):
                yield _json_sse("done", {"text": cumulative, "source": "fallback", "message": message})
        except asyncio.CancelledError:
            return

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/api/ai/chat/stream")
async def ai_chat_stream(payload: ChatRequest, request: Request, _user: CurrentUser = Depends(get_current_user)):
    async def event_stream() -> AsyncGenerator[str, None]:
        cumulative = ""
        try:
            async for token in stream_chat(payload.model_dump()):
                if await _stream_client_disconnected(request):
                    break
                cumulative += token
                yield _json_sse("token", {"token": token, "text": cumulative})
            if not await _stream_client_disconnected(request):
                yield _json_sse("done", {"text": cumulative})
        except AIServiceError as exc:
            message = str(exc)
            if not cumulative:
                cumulative = message
                yield _json_sse("token", {"token": message, "text": cumulative, "source": "fallback"})
            if not await _stream_client_disconnected(request):
                yield _json_sse("done", {"text": cumulative, "source": "fallback", "message": message})
        except asyncio.CancelledError:
            return

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/api/ai/chat/summary")
async def ai_chat_summary_save(
    payload: ChatSummarySaveRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    normalized_messages = _normalize_chat_messages(payload.messages)
    if len(normalized_messages) < 2:
        raise HTTPException(status_code=400, detail="messages must contain at least 2 valid items")

    generated = _build_heuristic_chat_summary(
        mode=payload.mode,
        poet=payload.poet,
        poem_title=payload.poemTitle,
        messages=normalized_messages,
    )
    if payload.forceAi:
        ai_generated = await _build_ai_chat_summary(
            mode=payload.mode,
            poet=payload.poet,
            poem_title=payload.poemTitle,
            poem_author=payload.poemAuthor,
            messages=normalized_messages,
        )
        if ai_generated:
            generated = ai_generated

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user.id,
        "mode": payload.mode,
        "poet": payload.poet,
        "poem_title": _clip_text(payload.poemTitle, 80) if payload.poemTitle else None,
        "poem_author": _clip_text(payload.poemAuthor, 40) if payload.poemAuthor else None,
        "poem_context": _clip_text(payload.poemContext, 1200) if payload.poemContext else None,
        "summary": generated.get("summary"),
        "key_points": generated.get("keyPoints") or [],
        "last_question": generated.get("lastQuestion"),
        "message_count": len(normalized_messages),
        "source": generated.get("source") or "heuristic",
        "created_at": now,
        "updated_at": now,
    }

    client = get_supabase_admin()
    try:
        result = client.table("chat_summaries").insert(record).execute()
    except Exception:
        return _chat_summary_table_error(request)

    await _invalidate_chat_summary_cache(user.id)
    item = (result.data or [None])[0]
    return ok({"item": item}, _trace_id(request))


@router.get("/api/ai/chat/summaries")
async def ai_chat_summary_list(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    page: int = Query(default=1, ge=1, le=1000),
    pageSize: int = Query(default=8, ge=1, le=50),
    poemTitle: str = Query(default=""),
    mode: str = Query(default=""),
    poet: str = Query(default=""),
):
    page_size = max(1, min(50, int(pageSize)))
    page_number = max(1, int(page))
    page_start = (page_number - 1) * page_size
    page_end = page_start + page_size - 1
    poem_title = poemTitle.strip()
    mode_filter = mode.strip().lower()
    poet_filter = poet.strip().lower()
    if mode_filter not in {"qa", "poet"}:
        mode_filter = ""
    cache_key = f"chat-summaries:{user.id}:{_stable_hash({'page': page_number, 'pageSize': page_size, 'poemTitle': poem_title, 'mode': mode_filter, 'poet': poet_filter})}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    client = get_supabase_admin()
    query = client.table("chat_summaries").select(
        "id,mode,poet,poem_title,poem_author,summary,key_points,last_question,message_count,source,created_at",
        count="planned",
    )
    query = query.eq("user_id", user.id)
    if poem_title:
        query = query.ilike("poem_title", f"%{poem_title}%")
    if mode_filter:
        query = query.eq("mode", mode_filter)
    if poet_filter:
        query = query.ilike("poet", poet_filter)

    try:
        result = query.order("created_at", desc=True).range(page_start, page_end).execute()
    except Exception:
        return _chat_summary_table_error(request)

    total = int(result.count or 0)
    total_pages = max(1, (total + page_size - 1) // page_size)
    payload_data = {
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
    await cache_set_json(cache_key, payload_data, ttl_seconds=30)
    return ok(payload_data, _trace_id(request))


@router.post("/api/ai/learning-report")
async def ai_learning_report_stream(
    payload: LearningReportRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    target_user_id = payload.targetUserId or user.id
    summary_payload = await get_user_learning_summary(target_user_id)
    cache_key = f"ai-learning-report:{target_user_id}:v1"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict) and isinstance(cached.get("text"), str):

        async def cached_stream() -> AsyncGenerator[str, None]:
            text = str(cached.get("text") or "")
            if await _stream_client_disconnected(request):
                return
            yield _json_sse("token", {"token": text, "text": text, "source": cached.get("source") or "cache"})
            if await _stream_client_disconnected(request):
                return
            yield _json_sse("done", {"text": text, "source": cached.get("source") or "cache"})

        return StreamingResponse(cached_stream(), media_type="text/event-stream")

    ai_report = await _build_ai_learning_report(summary_payload)
    report = ai_report or _build_learning_report_fallback(summary_payload)
    await cache_set_json(cache_key, report, ttl_seconds=60)

    async def event_stream() -> AsyncGenerator[str, None]:
        cumulative = ""
        try:
            for chunk in _chunk_text_for_sse(str(report.get("text") or "")):
                if await _stream_client_disconnected(request):
                    return
                cumulative += chunk
                yield _json_sse("token", {"token": chunk, "text": cumulative, "source": report.get("source") or "heuristic"})
                await asyncio.sleep(0.01)
            if not await _stream_client_disconnected(request):
                yield _json_sse("done", {"text": cumulative, "source": report.get("source") or "heuristic"})
        except asyncio.CancelledError:
            return

    return StreamingResponse(event_stream(), media_type="text/event-stream")
