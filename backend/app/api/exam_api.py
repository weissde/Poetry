from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from ..ai import AIServiceError, complete_json
from ..auth import CurrentUser, get_current_user
from ..cache import cache_get_json, cache_set_json
from ..config import get_settings
from ..response import ok
from ..schemas import ExamCreateRequest, ExamSubmitRequest
from ..services.cache_invalidation import _invalidate_exam_cache, _invalidate_nav_pending_cache, _invalidate_wrongbook_cache
from ..supabase_client import get_supabase_admin

router = APIRouter()
settings = get_settings()
logger = logging.getLogger("poetry_ai.api.exam")

QUESTION_TYPE_LABELS = {
    'memorization': '默写',
    'meaning': '词义',
    'technique': '手法',
    'emotion': '情感',
    'appreciation': '赏析',
    'comparison': '比较阅读',
    'context': '语境默写',
    'subjective': '主观题',
    'exam': '考试',
}


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, 'trace_id', None)


def _stable_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def _clip_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return f"{text[: max(1, limit - 1)]}…"


def _safe_uuid_text(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return str(UUID(text))
    except (TypeError, ValueError):
        return None


def _clean_exam_question_type(raw_type: Any) -> str:
    value = str(raw_type or "").strip().lower()
    allowed = {"exam", "meaning", "technique", "emotion", "appreciation", "subjective", "memorization", "comparison", "context"}
    return value if value in allowed else "exam"


def _parse_score(raw_score: Any, *, fallback: float) -> float:
    try:
        parsed = float(raw_score)
    except (TypeError, ValueError):
        parsed = fallback
    return round(max(0.5, parsed), 2)


def _normalize_exam_options(raw_options: Any) -> list[str]:
    options = [str(item).strip() for item in raw_options if isinstance(item, str) and str(item).strip()] if isinstance(raw_options, list) else []
    if len(options) >= 4:
        return options[:4]
    default_options = ["A项", "B项", "C项", "D项"]
    while len(options) < 4:
        options.append(default_options[len(options)])
    return options


def _normalize_exam_keywords(raw_keywords: Any, fallback_answer: str) -> list[str]:
    keywords: list[str] = []
    seen: set[str] = set()
    if isinstance(raw_keywords, list):
        for raw_item in raw_keywords:
            if not isinstance(raw_item, str):
                continue
            key = raw_item.strip()
            if not key:
                continue
            lowered = key.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            keywords.append(key)
            if len(keywords) >= 6:
                break
    if keywords:
        return keywords

    extracted: list[str] = []
    for token in re.findall(r"[\u4e00-\u9fff]{2,6}", fallback_answer):
        cleaned = token.strip()
        if not cleaned:
            continue
        lowered = cleaned.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        extracted.append(cleaned)
        if len(extracted) >= 4:
            break
    if extracted:
        return extracted
    return ["意象", "情感", "手法"]


def _practice_quick_timeout() -> float:
    timeout = max(6, int(settings.practice_ai_timeout_seconds))
    return float(min(timeout, settings.request_timeout_seconds))


def _practice_quick_attempts() -> int:
    return max(1, int(settings.practice_ai_max_attempts))

def _is_subjective_question(question: dict[str, Any]) -> bool:
    kind = str(question.get('questionKind') or '').strip().lower()
    if kind == 'subjective':
        return True
    options = question.get('options')
    answer = question.get('answer')
    if not isinstance(options, list) or len(options) < 2:
        return True
    return not isinstance(answer, int)


def _is_subjective_like(item: dict[str, Any]) -> bool:
    kind = str(item.get('questionKind') or item.get('question_kind') or '').strip().lower()
    if kind == 'subjective':
        return True
    if kind == 'objective':
        return False
    q_type = str(item.get('type') or item.get('questionType') or item.get('question_type') or '').strip().lower()
    if q_type == 'subjective':
        return True
    if q_type in {'exam', 'meaning', 'technique', 'emotion', 'appreciation', 'memorization', 'comparison', 'context'}:
        return False
    return _is_subjective_question(item)


def _normalize_exam_question(raw_question: Any, index: int, topic: str) -> dict[str, Any]:
    question = raw_question if isinstance(raw_question, dict) else {}
    question_id = _safe_uuid_text(question.get("id") or question.get("questionId"))
    content = str(question.get("content") or "").strip() or f"第 {index + 1} 题：请围绕“{topic}”作答。"
    question_type = _clean_exam_question_type(question.get("type"))
    dynasty = str(question.get("dynasty") or "").strip() or None
    theme = str(question.get("theme") or "").strip() or topic or None
    explanation = str(question.get("explanation") or "").strip() or "请结合诗句关键词与修辞手法进行分析。"

    raw_options = question.get("options")
    raw_answer = question.get("answer")

    treat_subjective = question_type == "subjective"
    if not treat_subjective:
        if not isinstance(raw_options, list) or len(raw_options) < 2 or not isinstance(raw_answer, int):
            treat_subjective = True

    if treat_subjective:
        reference_answer = str(raw_answer or question.get("referenceAnswer") or "").strip()
        if not reference_answer:
            reference_answer = f"可从意象、情感、手法三方面分析“{topic}”相关诗词。"
        keywords = _normalize_exam_keywords(question.get("keywords"), reference_answer)
        return {
            "id": question_id,
            "type": question_type if question_type != "exam" else "subjective",
            "questionKind": "subjective",
            "content": content,
            "options": [],
            "answer": reference_answer,
            "keywords": keywords,
            "explanation": explanation,
            "score": _parse_score(question.get("score"), fallback=6.0),
            "dynasty": dynasty,
            "theme": theme,
        }

    options = _normalize_exam_options(raw_options)
    answer_index = raw_answer if isinstance(raw_answer, int) and 0 <= raw_answer < len(options) else 0
    return {
        "id": question_id,
        "type": question_type or "exam",
        "questionKind": "objective",
        "content": content,
        "options": options,
        "answer": answer_index,
        "explanation": explanation,
        "score": _parse_score(question.get("score"), fallback=2.0),
        "dynasty": dynasty,
        "theme": theme,
    }


def _normalize_exam_questions(
    raw_questions: list[Any],
    count: int,
    topic: str,
    subjective_required: int | None = None,
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, raw_question in enumerate(raw_questions[: max(count, 1)]):
        normalized.append(_normalize_exam_question(raw_question, index, topic))

    while len(normalized) < count:
        idx = len(normalized)
        normalized.append(
            {
                "id": None,
                "type": "subjective",
                "questionKind": "subjective",
                "content": f"第 {idx + 1} 题：请结合一首你熟悉的古诗词，分析“{topic}”相关表达。",
                "options": [],
                "answer": "可从诗句引用、意象分析、情感主旨三个层面作答。",
                "keywords": ["诗句引用", "意象", "情感", "主旨"],
                "explanation": "回答需覆盖诗句依据与分析结论。",
                "score": 6.0,
                "dynasty": None,
                "theme": topic or None,
            }
        )

    required = subjective_required if subjective_required is not None else (2 if count >= 8 else 1)
    required = max(0, min(int(required), int(max(1, count))))
    current_subjective = sum(1 for item in normalized if _is_subjective_question(item))
    if current_subjective < required:
        deficit = required - current_subjective
        for i in range(deficit):
            replace_idx = len(normalized) - 1 - i
            if replace_idx < 0:
                break
            normalized[replace_idx] = _normalize_exam_question(
                {
                    "type": "subjective",
                    "content": f"主观题：请从意象、情感、手法角度赏析“{topic}”相关诗词表达。",
                    "answer": "可围绕意象选择、情感倾向、艺术手法展开，并给出诗句依据。",
                    "keywords": ["意象", "情感", "手法", "诗句依据"],
                    "score": 6,
                    "theme": topic,
                },
                replace_idx,
                topic,
            )

    return normalized[:count]


def _resolve_exam_subjective_required(payload: ExamCreateRequest, safe_count: int) -> int:
    safe_count = max(3, int(safe_count or 0))
    default_required = 2 if safe_count >= 8 else 1

    template_ratio_map: dict[str, float] = {
        "zhongkao_foundation": 0.25,
        "zhongkao_sprint": 0.3,
        "gaokao_appreciation": 0.4,
        "gaokao_comprehensive": 0.35,
        "subjective_repair": 0.75,
    }
    mode_ratio_map: dict[str, float] = {
        "zhongkao": 0.25,
        "gaokao": 0.35,
        "custom": 0.4,
    }

    explicit_count = payload.subjectiveCount is not None
    explicit_ratio = payload.subjectiveRatio is not None
    explicitly_specified = explicit_count or explicit_ratio

    if explicit_count:
        required = int(payload.subjectiveCount or 0)
    else:
        ratio = payload.subjectiveRatio
        if ratio is None:
            ratio = template_ratio_map.get(str(payload.templateId or "").strip())
        if ratio is None:
            ratio = mode_ratio_map.get(str(payload.mode or "").strip(), 0.3)
        required = int(round(float(ratio) * safe_count))
        if float(ratio) > 0 and required <= 0:
            required = 1

    if not explicitly_specified:
        required = max(default_required, required)

    max_subjective = safe_count - 1 if safe_count > 1 else 1
    required = max(0, min(int(required), max_subjective))
    return required


def _build_local_exam_questions(count: int, topic: str, subjective_required: int | None = None) -> list[dict[str, Any]]:
    safe_count = max(3, int(count or 0))
    topic_text = topic.strip() or "古诗词综合"
    objective_pool: list[dict[str, Any]] = [
        {
            "type": "meaning",
            "content": f"下列对“{topic_text}”相关诗句词义理解最恰当的一项是？",
            "options": [
                "只按现代汉语常用义解释即可。",
                "应结合上下句语境判断词义。",
                "古诗词词义固定，不需结合文本。",
                "词义与情感无关，可忽略。",
            ],
            "answer": 1,
            "explanation": "词义判断应基于上下文语境和情感线索。",
            "score": 2,
            "theme": topic_text,
        },
        {
            "type": "technique",
            "content": f"关于“{topic_text}”相关诗词手法，下列判断最合理的是？",
            "options": [
                "景物描写只负责写实，与情感无关。",
                "借景抒情常通过意象组织情感。",
                "诗词手法无需与主旨关联。",
                "修辞出现越多越好，不必看作用。",
            ],
            "answer": 1,
            "explanation": "手法分析要落在“如何服务情感与主旨”。",
            "score": 2,
            "theme": topic_text,
        },
        {
            "type": "emotion",
            "content": f"“{topic_text}”类诗词的情感线索通常如何呈现？",
            "options": [
                "只看最后一句即可判断全部情感。",
                "常由意象铺垫，逐步走向情感核心。",
                "古诗词主要叙事，基本不抒情。",
                "情感与语境无关，完全主观。",
            ],
            "answer": 1,
            "explanation": "情感通常通过意象与语境层层推进。",
            "score": 2,
            "theme": topic_text,
        },
    ]
    subjective_template = {
        "type": "subjective",
        "content": f"请结合诗句，从意象、手法、情感三个角度赏析“{topic_text}”相关表达。",
        "answer": "可按“观点-诗句依据-分析结论”三步作答。",
        "keywords": ["意象", "手法", "情感", "诗句依据"],
        "explanation": "回答需包含观点、依据与分析。",
        "score": 6,
        "theme": topic_text,
    }

    raw_questions: list[dict[str, Any]] = []
    required = subjective_required if subjective_required is not None else (2 if safe_count >= 8 else 1)
    required = max(0, min(int(required), safe_count - 1 if safe_count > 1 else 1))
    objective_target = max(0, safe_count - required)
    for idx in range(objective_target):
        raw_questions.append(dict(objective_pool[idx % len(objective_pool)]))
    for _ in range(required):
        raw_questions.append(dict(subjective_template))
    return _normalize_exam_questions(raw_questions, safe_count, topic_text, subjective_required=required)


def _build_exam_composition(questions: list[dict[str, Any]]) -> dict[str, Any]:
    total = max(0, len(questions))
    subjective_count = sum(1 for item in questions if _is_subjective_like(item))
    objective_count = max(0, total - subjective_count)
    subjective_ratio = round((subjective_count / total), 4) if total else 0.0
    return {
        'total': total,
        'subjectiveCount': subjective_count,
        'objectiveCount': objective_count,
        'subjectiveRatio': subjective_ratio,
    }


def _normalize_text_for_match(raw: Any) -> str:
    text = str(raw or "").lower()
    return re.sub(r"[\s，。！？；：、“”‘’（）()《》【】,.!?;:'\"-]+", "", text).strip()


def _lcs_ratio(text_a: str, text_b: str) -> float:
    a = _normalize_text_for_match(text_a)[:400]
    b = _normalize_text_for_match(text_b)[:400]
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0

    n = len(b)
    prev = [0] * (n + 1)
    curr = [0] * (n + 1)
    for i in range(1, len(a) + 1):
        ai = a[i - 1]
        for j in range(1, n + 1):
            if ai == b[j - 1]:
                curr[j] = prev[j - 1] + 1
            else:
                curr[j] = prev[j] if prev[j] >= curr[j - 1] else curr[j - 1]
        prev, curr = curr, prev
    lcs = prev[n]
    return lcs / max(len(a), len(b))


def _score_subjective_answer(question: dict[str, Any], user_answer: str, max_score: float) -> dict[str, Any]:
    normalized_user = _normalize_text_for_match(user_answer)
    if not normalized_user:
        return {
            "earnedScore": 0.0,
            "isCorrect": False,
            "rate": 0.0,
            "feedback": "答案为空，建议先给出观点并引用诗句依据。",
            "matchedKeywords": [],
            "missingKeywords": [item for item in (question.get("keywords") or []) if isinstance(item, str)],
            "rubric": [
                {"key": "viewpoint", "label": "观点立意", "score": 0.0, "maxScore": round(max_score * 0.3, 2), "note": "未形成明确观点"},
                {"key": "evidence", "label": "诗句依据", "score": 0.0, "maxScore": round(max_score * 0.3, 2), "note": "缺少诗句或关键词依据"},
                {"key": "analysis", "label": "分析深度", "score": 0.0, "maxScore": round(max_score * 0.25, 2), "note": "缺少因果与手法分析"},
                {"key": "expression", "label": "表达组织", "score": 0.0, "maxScore": round(max_score * 0.15, 2), "note": "答案结构不足"},
            ],
            "suggestions": ["先写结论句，再补诗句依据，最后补“为何如此”的分析句。"],
        }

    reference_answer = str(question.get("answer") or "").strip()
    keywords = [str(item).strip() for item in (question.get("keywords") or []) if isinstance(item, str) and str(item).strip()]

    matched_keywords: list[str] = []
    missing_keywords: list[str] = []
    for keyword in keywords:
        normalized_keyword = _normalize_text_for_match(keyword)
        if normalized_keyword and normalized_keyword in normalized_user:
            matched_keywords.append(keyword)
        else:
            missing_keywords.append(keyword)

    coverage_rate = (len(matched_keywords) / len(keywords)) if keywords else 0.0
    similarity_rate = _lcs_ratio(user_answer, reference_answer) if reference_answer else 0.0

    if keywords and reference_answer:
        rate = (coverage_rate * 0.6) + (similarity_rate * 0.4)
    elif keywords:
        rate = coverage_rate
    elif reference_answer:
        rate = similarity_rate
    else:
        rate = 0.7 if len(normalized_user) >= 12 else 0.4

    raw_text = str(user_answer or "")
    normalized_len = len(normalized_user)
    has_quote_evidence = bool(re.search(r'[“”"《》「」]', raw_text))
    analysis_markers = ["因为", "所以", "表达", "表现", "体现", "突出", "映衬", "衬托", "营造", "借景", "托物", "手法", "情感", "主旨"]
    marker_hits = 0
    lowered_text = str(raw_text or "")
    for marker in analysis_markers:
        if marker in lowered_text:
            marker_hits += 1
    punctuation_hits = sum(1 for ch in raw_text if ch in {"，", "。", "；", "："})

    viewpoint_rate = 1.0 if normalized_len >= 20 else (0.65 if normalized_len >= 12 else 0.35)
    evidence_rate = min(1.0, (coverage_rate * 0.85) + (0.15 if has_quote_evidence else 0.0))
    analysis_rate = min(1.0, (marker_hits / 4.0))
    expression_rate = 1.0 if (normalized_len >= 24 and punctuation_hits >= 2) else (0.6 if normalized_len >= 14 else 0.35)
    rubric_avg_rate = (viewpoint_rate + evidence_rate + analysis_rate + expression_rate) / 4.0
    rate = (rate * 0.5) + (rubric_avg_rate * 0.5)

    rate = max(0.0, min(1.0, rate))
    earned_score = round(max_score * rate, 2)
    is_correct = rate >= 0.6

    viewpoint_max = round(max_score * 0.3, 2)
    evidence_max = round(max_score * 0.3, 2)
    analysis_max = round(max_score * 0.25, 2)
    expression_max = round(max_score * 0.15, 2)
    rubric = [
        {
            "key": "viewpoint",
            "label": "观点立意",
            "score": round(viewpoint_max * viewpoint_rate, 2),
            "maxScore": viewpoint_max,
            "note": "观点完整" if viewpoint_rate >= 0.9 else ("观点基本明确" if viewpoint_rate >= 0.6 else "观点较弱"),
        },
        {
            "key": "evidence",
            "label": "诗句依据",
            "score": round(evidence_max * evidence_rate, 2),
            "maxScore": evidence_max,
            "note": "依据充分" if evidence_rate >= 0.9 else ("依据一般" if evidence_rate >= 0.6 else "依据不足"),
        },
        {
            "key": "analysis",
            "label": "分析深度",
            "score": round(analysis_max * analysis_rate, 2),
            "maxScore": analysis_max,
            "note": "分析深入" if analysis_rate >= 0.9 else ("分析基本到位" if analysis_rate >= 0.6 else "分析偏浅"),
        },
        {
            "key": "expression",
            "label": "表达组织",
            "score": round(expression_max * expression_rate, 2),
            "maxScore": expression_max,
            "note": "结构清晰" if expression_rate >= 0.9 else ("结构基本清晰" if expression_rate >= 0.6 else "结构松散"),
        },
    ]

    feedback_parts = [f"关键词覆盖 {round(coverage_rate * 100)}%"]
    if reference_answer:
        feedback_parts.append(f"参考答案相似度 {round(similarity_rate * 100)}%")
    if missing_keywords:
        feedback_parts.append(f"建议补充：{'、'.join(missing_keywords[:4])}")
    feedback_parts.append(f"分项完成度 {round(rubric_avg_rate * 100)}%")
    feedback = "；".join(feedback_parts)

    suggestions: list[str] = []
    if viewpoint_rate < 0.6:
        suggestions.append("先用一句话直接回答“这首诗表达了什么”。")
    if evidence_rate < 0.6:
        suggestions.append("至少引用 1 处诗句或关键词作为依据。")
    if analysis_rate < 0.6:
        suggestions.append("补一句“通过……表现/表达……”解释因果关系。")
    if expression_rate < 0.6:
        suggestions.append("按“观点-依据-分析”三句结构组织答案。")
    if not suggestions:
        suggestions.append("整体作答较完整，可继续提升表达精炼度。")

    return {
        "earnedScore": earned_score,
        "isCorrect": is_correct,
        "rate": round(rate, 4),
        "feedback": feedback,
        "matchedKeywords": matched_keywords,
        "missingKeywords": missing_keywords,
        "rubric": rubric,
        "suggestions": suggestions[:4],
    }


def _build_exam_metric_rows(bucket: dict[str, dict[str, int]], label_mapper: dict[str, str] | None = None):
    items: list[dict[str, Any]] = []
    for key, value in bucket.items():
        attempts = int(value.get('attempts', 0))
        correct = int(value.get('correct', 0))
        wrong = max(0, attempts - correct)
        rate = round(correct / attempts, 4) if attempts else 0
        label = label_mapper.get(key, key) if label_mapper else key
        items.append(
            {
                'key': key,
                'label': label,
                'attempts': attempts,
                'correct': correct,
                'wrong': wrong,
                'rate': rate,
            }
        )
    items.sort(key=lambda item: (-int(item['wrong']), -int(item['attempts']), str(item['label'])))
    return items


def _derive_exam_diagnostics_from_detail(detail_items: list[dict[str, Any]]) -> dict[str, Any]:
    by_type: dict[str, dict[str, int]] = {}
    by_dynasty: dict[str, dict[str, int]] = {}
    by_theme: dict[str, dict[str, int]] = {}

    def update_metric(bucket: dict[str, dict[str, int]], key: str, is_correct: bool):
        if not key:
            return
        metric = bucket.setdefault(key, {'attempts': 0, 'correct': 0})
        metric['attempts'] += 1
        if is_correct:
            metric['correct'] += 1

    for item in detail_items:
        if not isinstance(item, dict):
            continue
        is_correct = bool(item.get('isCorrect'))
        question_type = str(item.get('questionType', '') or item.get('question_type', '') or '').strip()
        dynasty = str(item.get('dynasty', '') or '').strip()
        theme = str(item.get('theme', '') or '').strip()

        update_metric(by_type, question_type, is_correct)
        update_metric(by_dynasty, dynasty, is_correct)
        update_metric(by_theme, theme, is_correct)

    type_rows = _build_exam_metric_rows(by_type, QUESTION_TYPE_LABELS)
    dynasty_rows = _build_exam_metric_rows(by_dynasty)
    theme_rows = _build_exam_metric_rows(by_theme)

    weakest: list[dict[str, Any]] = []
    for row_item in type_rows:
        if int(row_item.get('wrong', 0)) > 0:
            weakest.append({**row_item, 'dimension': 'questionType'})
    for row_item in dynasty_rows:
        if int(row_item.get('wrong', 0)) > 0:
            weakest.append({**row_item, 'dimension': 'dynasty'})
    for row_item in theme_rows:
        if int(row_item.get('wrong', 0)) > 0:
            weakest.append({**row_item, 'dimension': 'theme'})

    weakest.sort(
        key=lambda item: (
            float(item.get('rate', 0)),
            -int(item.get('wrong', 0)),
            -int(item.get('attempts', 0)),
            str(item.get('label', '')),
        )
    )

    return {
        'byQuestionType': type_rows,
        'byDynasty': dynasty_rows,
        'byTheme': theme_rows,
        'weakest': weakest[:6],
    }


def _extract_exam_detail_and_diagnostics(answer_detail: Any) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    diagnostics: dict[str, Any] | None = None
    detail_items: list[dict[str, Any]] = []

    if isinstance(answer_detail, dict):
        raw_diagnostics = answer_detail.get('diagnostics')
        if isinstance(raw_diagnostics, dict):
            diagnostics = raw_diagnostics
        raw_detail = answer_detail.get('detail')
        if isinstance(raw_detail, list):
            detail_items = [item for item in raw_detail if isinstance(item, dict)]
    elif isinstance(answer_detail, list):
        detail_items = [item for item in answer_detail if isinstance(item, dict)]

    if diagnostics is None:
        diagnostics = _derive_exam_diagnostics_from_detail(detail_items)

    return detail_items, diagnostics


@router.post('/api/exam/create')
async def exam_create(payload: ExamCreateRequest, request: Request, user: CurrentUser = Depends(get_current_user)):
    mode_default_duration = {
        'zhongkao': 60,
        'gaokao': 90,
        'custom': 60,
    }
    safe_count = max(3, int(payload.count or 0))
    duration_minutes = payload.durationMinutes or mode_default_duration.get(payload.mode, 60)
    subjective_required = _resolve_exam_subjective_required(payload, safe_count)

    prompt = '\n'.join(
        [
            '你是一位中学语文命题老师，请生成模拟考试题。',
            '只输出 JSON 数组，不要其他文字。',
            '请混合客观题与主观题，必须满足指定主观题数量。',
            '客观题结构：{"type":"exam|meaning|technique|emotion|appreciation","questionKind":"objective","content":string,"options":string[4],"answer":number,"explanation":string,"score":number,"dynasty":string|null,"theme":string|null}',
            '主观题结构：{"type":"subjective","questionKind":"subjective","content":string,"answer":string,"keywords":string[],"explanation":string,"score":number,"dynasty":string|null,"theme":string|null}',
            f'模式：{payload.mode}',
            f'主题：{payload.topic}',
            f'题量：{safe_count}',
            f'主观题目标数量：{subjective_required}',
            f'模板ID：{payload.templateId or "none"}',
        ]
    )

    source = 'ai'
    try:
        questions = await complete_json(
            prompt,
            temperature=0.2,
            max_attempts=_practice_quick_attempts(),
            timeout_seconds=_practice_quick_timeout(),
        )
        if not isinstance(questions, list):
            raise HTTPException(status_code=500, detail='AI did not return exam question list')
        normalized_questions = _normalize_exam_questions(
            questions,
            safe_count,
            payload.topic,
            subjective_required=subjective_required,
        )
    except (AIServiceError, asyncio.TimeoutError):
        source = 'fallback_local'
        normalized_questions = _build_local_exam_questions(
            safe_count,
            payload.topic,
            subjective_required=subjective_required,
        )
    composition = _build_exam_composition(normalized_questions)

    session = {
        'mode': payload.mode,
        'topic': payload.topic,
        'durationMinutes': duration_minutes,
        'questions': normalized_questions,
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'owner': user.id,
        'source': source,
        'composition': composition,
        'subjectiveRequired': subjective_required,
        'templateId': payload.templateId,
    }
    return ok({'session': session}, _trace_id(request))


@router.post('/api/exam/submit')
async def exam_submit(payload: ExamSubmitRequest, request: Request, user: CurrentUser = Depends(get_current_user)):
    total = 0.0
    score = 0.0
    detail: list[dict[str, Any]] = []
    wrong_rows: list[dict[str, Any]] = []
    by_type: dict[str, dict[str, int]] = {}
    by_dynasty: dict[str, dict[str, int]] = {}
    by_theme: dict[str, dict[str, int]] = {}
    now = datetime.now(timezone.utc).isoformat()

    def update_metric(bucket: dict[str, dict[str, int]], key: str, correct: bool):
        if not key:
            return
        row = bucket.setdefault(key, {'attempts': 0, 'correct': 0})
        row['attempts'] += 1
        if correct:
            row['correct'] += 1

    def build_metric_rows(
        bucket: dict[str, dict[str, int]],
        label_mapper: dict[str, str] | None = None,
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for key, row in bucket.items():
            attempts = int(row.get('attempts', 0))
            correct_count = int(row.get('correct', 0))
            wrong_count = max(0, attempts - correct_count)
            rate = round(correct_count / attempts, 4) if attempts else 0
            label = label_mapper.get(key, key) if label_mapper else key
            rows.append(
                {
                    'key': key,
                    'label': label,
                    'attempts': attempts,
                    'correct': correct_count,
                    'wrong': wrong_count,
                    'rate': rate,
                }
            )

        rows.sort(key=lambda item: (-int(item['wrong']), -int(item['attempts']), str(item['label'])))
        return rows

    for index, question in enumerate(payload.questions):
        is_subjective = _is_subjective_question(question)
        q_score = _parse_score(question.get('score'), fallback=6.0 if is_subjective else 2.0)
        total += q_score

        answer = question.get('answer')
        user_answer = payload.answers[index] if index < len(payload.answers) else None

        question_type = _clean_exam_question_type(question.get('type'))
        question_kind = 'subjective' if is_subjective else 'objective'
        if is_subjective and question_type == 'exam':
            question_type = 'subjective'
        if not is_subjective and question_type == 'subjective':
            question_type = 'exam'
        question_dynasty = str(question.get('dynasty', '') or '').strip()
        question_theme = str(question.get('theme', '') or '').strip() or str(payload.topic or '').strip()
        question_id = _safe_uuid_text(question.get('id') or question.get('questionId'))

        correct = False
        earned_score = 0.0
        detail_item: dict[str, Any]

        if is_subjective:
            user_text = str(user_answer or '').strip()
            subjective_result = _score_subjective_answer(question, user_text, q_score)
            correct = bool(subjective_result.get('isCorrect'))
            earned_score = float(subjective_result.get('earnedScore', 0) or 0)
            score += earned_score
            detail_item = {
                'index': index,
                'isCorrect': correct,
                'score': earned_score,
                'maxScore': q_score,
                'userAnswer': user_text,
                'correctAnswer': str(answer or ''),
                'questionType': question_type,
                'questionKind': question_kind,
                'questionId': question_id,
                'dynasty': question_dynasty or None,
                'theme': question_theme or None,
                'content': question.get('content', ''),
                'explanation': question.get('explanation', ''),
                'rate': subjective_result.get('rate'),
                'feedback': subjective_result.get('feedback'),
                'matchedKeywords': subjective_result.get('matchedKeywords', []),
                'missingKeywords': subjective_result.get('missingKeywords', []),
                'rubric': subjective_result.get('rubric', []),
                'suggestions': subjective_result.get('suggestions', []),
            }
            if not correct:
                wrong_rows.append(
                    {
                        'user_id': user.id,
                        'poem_title': payload.topic or payload.mode,
                        'question_id': question_id,
                        'question_content': str(question.get('content', '')),
                        'user_answer': user_text,
                        'correct_answer': str(answer or ''),
                        'explanation': str(question.get('explanation', '')),
                        'error_type': question_type,
                        'question_kind': 'subjective',
                        'keyword_tags': subjective_result.get('missingKeywords', []),
                        'dynasty': question_dynasty or None,
                        'theme': question_theme or None,
                        'status': 'pending',
                        'created_at': now,
                        'updated_at': now,
                    }
                )
        else:
            options = _normalize_exam_options(question.get('options'))
            answer_index = answer if isinstance(answer, int) and 0 <= answer < len(options) else 0

            user_index: int | None = None
            if isinstance(user_answer, int):
                user_index = user_answer if 0 <= user_answer < len(options) else None
            elif isinstance(user_answer, str):
                text = user_answer.strip()
                if text.isdigit():
                    parsed = int(text)
                    user_index = parsed if 0 <= parsed < len(options) else None

            correct = user_index is not None and user_index == answer_index
            earned_score = q_score if correct else 0.0
            score += earned_score
            detail_item = {
                'index': index,
                'isCorrect': correct,
                'score': earned_score,
                'maxScore': q_score,
                'userAnswer': user_index,
                'correctAnswer': answer_index,
                'questionType': question_type,
                'questionKind': question_kind,
                'questionId': question_id,
                'dynasty': question_dynasty or None,
                'theme': question_theme or None,
                'content': question.get('content', ''),
                'explanation': question.get('explanation', ''),
            }
            if not correct:
                correct_option = options[answer_index] if 0 <= answer_index < len(options) else ''
                user_option = options[user_index] if isinstance(user_index, int) and 0 <= user_index < len(options) else ''
                wrong_rows.append(
                    {
                        'user_id': user.id,
                        'poem_title': payload.topic or payload.mode,
                        'question_id': question_id,
                        'question_content': str(question.get('content', '')),
                        'user_answer': user_option,
                        'correct_answer': correct_option,
                        'explanation': str(question.get('explanation', '')),
                        'error_type': question_type,
                        'question_kind': 'objective',
                        'keyword_tags': [],
                        'dynasty': question_dynasty or None,
                        'theme': question_theme or None,
                        'status': 'pending',
                        'created_at': now,
                        'updated_at': now,
                    }
                )

        update_metric(by_type, question_type, correct)
        update_metric(by_dynasty, question_dynasty, correct)
        update_metric(by_theme, question_theme, correct)

        detail.append(detail_item)

    percent = round((score / total) * 100, 2) if total else 0

    type_rows = build_metric_rows(by_type, QUESTION_TYPE_LABELS)
    dynasty_rows = build_metric_rows(by_dynasty)
    theme_rows = build_metric_rows(by_theme)

    weakest_candidates: list[dict[str, Any]] = []
    for row in type_rows:
        if int(row.get('attempts', 0)) > 0:
            weakest_candidates.append({**row, 'dimension': 'questionType'})
    for row in dynasty_rows:
        if int(row.get('attempts', 0)) > 0:
            weakest_candidates.append({**row, 'dimension': 'dynasty'})
    for row in theme_rows:
        if int(row.get('attempts', 0)) > 0:
            weakest_candidates.append({**row, 'dimension': 'theme'})

    weakest_candidates.sort(
        key=lambda item: (
            float(item.get('rate', 0)),
            -int(item.get('wrong', 0)),
            -int(item.get('attempts', 0)),
            str(item.get('label', '')),
        )
    )
    weakest = [item for item in weakest_candidates if int(item.get('wrong', 0)) > 0][:6]

    diagnostics_payload = {
        'byQuestionType': type_rows,
        'byDynasty': dynasty_rows,
        'byTheme': theme_rows,
        'weakest': weakest,
    }

    client = get_supabase_admin()
    client.table('exam_records').insert(
        {
            'user_id': user.id,
            'exam_type': payload.mode,
            'total_score': score,
            'max_score': total,
            'answer_detail': {'detail': detail, 'diagnostics': diagnostics_payload},
            'created_at': now,
        }
    ).execute()
    await _invalidate_exam_cache(user.id)

    if wrong_rows:
        try:
            client.table('wrong_questions').insert(wrong_rows).execute()
        except Exception:
            fallback_rows = []
            for row in wrong_rows:
                fallback_rows.append(
                    {
                        'user_id': row.get('user_id'),
                        'poem_title': row.get('poem_title'),
                        'question_content': row.get('question_content'),
                        'user_answer': row.get('user_answer'),
                        'correct_answer': row.get('correct_answer'),
                        'explanation': row.get('explanation'),
                        'error_type': row.get('error_type'),
                        'status': row.get('status'),
                        'created_at': row.get('created_at'),
                        'updated_at': row.get('updated_at'),
                    }
                )
            client.table('wrong_questions').insert(fallback_rows).execute()
        await _invalidate_wrongbook_cache(user.id)
        await _invalidate_nav_pending_cache(user.id)

    practice_summary_item: dict[str, Any] | None = None
    practice_summary_saved = False
    try:
        attempts_total = max(0, len(payload.questions))
        correct_total = max(0, sum(1 for row in detail if bool(row.get('isCorrect'))))
        weak_item = weakest[0] if weakest else None
        weak_text = ''
        if isinstance(weak_item, dict):
            weak_label = str(weak_item.get('label') or '').strip()
            weak_dimension = str(weak_item.get('dimension') or '').strip()
            if weak_label:
                dim_label = {'questionType': '题型', 'dynasty': '朝代', 'theme': '题材'}.get(weak_dimension, weak_dimension or '维度')
                weak_text = f'薄弱点：{dim_label}·{weak_label}。'
        summary_text = (
            f'模考《{payload.topic or payload.mode}》共 {attempts_total} 题，正确 {correct_total} 题，'
            f'正确率 {percent}%。{weak_text or "建议优先复盘错题并做同类题巩固。"}'
        )
        type_stats_payload = [
            {
                'type': str(row.get('key') or ''),
                'attempts': int(row.get('attempts') or 0),
                'correct': int(row.get('correct') or 0),
                'rate': max(0, min(100, int(round(float(row.get('rate') or 0) * 100)))),
            }
            for row in type_rows
            if str(row.get('key') or '').strip()
        ][:12]
        summary_record = {
            'user_id': user.id,
            'source': 'exam_submit',
            'topic': _clip_text(payload.topic, 120) if payload.topic else _clip_text(payload.mode, 120),
            'summary': _clip_text(summary_text, 600),
            'attempts': attempts_total,
            'correct': correct_total,
            'accuracy': max(0, min(100, int(round(percent)))),
            'weak_type': _clip_text(str(weakest[0].get('key')) if weakest else '', 40) if weakest else None,
            'type_stats': type_stats_payload,
            'created_at': now,
        }
        summary_result = client.table('practice_session_summaries').insert(summary_record).execute()
        practice_summary_item = (summary_result.data or [None])[0]
        practice_summary_saved = bool(practice_summary_item)
    except Exception:
        practice_summary_item = None
        practice_summary_saved = False

    return ok(
        {
            'result': {
                'score': score,
                'maxScore': total,
                'percent': percent,
                'detail': detail,
                'feedback': f'本次模考得分 {score}/{total}，正确率 {percent}%。',
                'diagnostics': diagnostics_payload,
            },
            'practiceSummary': {
                'saved': practice_summary_saved,
                'item': practice_summary_item,
            },
        },
        _trace_id(request),
    )


@router.get('/api/exam/latest-diagnostics')
async def exam_latest_diagnostics(request: Request, user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()
    result = (
        client.table('exam_records')
        .select('id,exam_type,total_score,max_score,answer_detail,created_at')
        .eq('user_id', user.id)
        .order('created_at', desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return ok({'exists': False}, _trace_id(request))

    row = rows[0]
    _detail_items, diagnostics = _extract_exam_detail_and_diagnostics(row.get('answer_detail'))

    total_score = float(row.get('total_score') or 0)
    max_score = float(row.get('max_score') or 0)
    percent = round((total_score / max_score) * 100, 2) if max_score else 0

    return ok(
        {
            'exists': True,
            'createdAt': row.get('created_at'),
            'examType': row.get('exam_type'),
            'score': total_score,
            'maxScore': max_score,
            'percent': percent,
            'diagnostics': diagnostics,
        },
        _trace_id(request),
    )


@router.get('/api/exam/history')
async def exam_history(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    includeDetail: bool = Query(default=False),
    page: int = Query(default=1, ge=1, le=2000),
    pageSize: int | None = Query(default=None, ge=1, le=100),
):
    client = get_supabase_admin()
    page_size = max(1, min(100, int(pageSize or limit)))
    page_number = max(1, int(page))
    page_start = (page_number - 1) * page_size
    page_end = page_start + page_size - 1
    cache_key = f"exam-history:{user.id}:{_stable_hash({'includeDetail': includeDetail, 'page': page_number, 'pageSize': page_size})}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict):
        return ok(cached, _trace_id(request))

    result = (
        client.table('exam_records')
        .select('id,exam_type,total_score,max_score,answer_detail,created_at', count='planned')
        .eq('user_id', user.id)
        .order('created_at', desc=True)
        .range(page_start, page_end)
        .execute()
    )
    rows = result.data or []
    total = int(result.count or 0)

    items: list[dict[str, Any]] = []
    for row in rows:
        total_score = float(row.get('total_score') or 0)
        max_score = float(row.get('max_score') or 0)
        percent = round((total_score / max_score) * 100, 2) if max_score else 0
        detail_items, diagnostics = _extract_exam_detail_and_diagnostics(row.get('answer_detail'))
        composition = _build_exam_composition(detail_items)

        items.append(
            {
                'id': row.get('id'),
                'createdAt': row.get('created_at'),
                'examType': row.get('exam_type'),
                'score': total_score,
                'maxScore': max_score,
                'percent': percent,
                'questionCount': len(detail_items),
                'composition': composition,
                'diagnostics': diagnostics,
                'detail': detail_items if includeDetail else None,
            }
        )

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
