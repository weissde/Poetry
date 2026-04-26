from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncGenerator

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError

from .config import get_settings

logger = logging.getLogger(__name__)


class AIServiceError(RuntimeError):
    """Raised when upstream AI service remains unavailable after retries."""


def _get_client() -> AsyncOpenAI:
    settings = get_settings()
    if not settings.doubao_api_key:
        raise RuntimeError('DOUBAO_API_KEY missing')

    return AsyncOpenAI(
        api_key=settings.doubao_api_key,
        base_url=settings.doubao_base_url,
        timeout=settings.request_timeout_seconds,
    )


def _get_model() -> str:
    settings = get_settings()
    if not settings.doubao_model_id:
        raise RuntimeError('DOUBAO_MODEL_ID missing')
    return settings.doubao_model_id


def build_analysis_prompt(params: dict[str, Any]) -> str:
    poem_title = params.get('poemTitle') or '未知'
    poem_author = params.get('poemAuthor') or '未知'
    poem_content = (params.get('poemContent') or '').strip()
    depth = params.get('depth') or 'standard'

    return '\n'.join([
        '你是一位资深中学语文教师，擅长古诗词教学。',
        f'解析深度：{depth}',
        f'题目：{poem_title}',
        f'作者：{poem_author}',
        '原文：',
        poem_content,
        '请仅输出一个 JSON 对象，不要输出任何额外说明。',
        'JSON 字段必须包含：',
        'basicInfo, annotationsAndTranslation, imageryAndMood, techniques, themeAndEmotion, authorAndContext, examPoints',
        '每个字段结构：{"title": string, "content": string}',
    ])


QA_SYSTEM_PROMPT = '\n'.join([
    '你是一位中学语文导师，正在指导学生学习古诗词。',
    '请优先使用苏格拉底式提问来引导学生思考，不要直接给完整答案。',
    '回答应简洁、友好、启发式，每次可先提一个关键问题再给少量提示。',
])

POET_PROMPTS: dict[str, str] = {
    'libai': '\n'.join([
        '你现在扮演唐代诗人李白。',
        '语言风格豪放飘逸，富有想象力。',
        '请用第一人称与学生对话。',
    ]),
    'dufu': '\n'.join([
        '你现在扮演唐代诗人杜甫。',
        '语言风格沉郁顿挫，关注现实与家国情怀。',
        '请用第一人称与学生对话。',
    ]),
    'wangwei': '\n'.join([
        '你现在扮演唐代诗人王维。',
        '语言风格清雅空灵，偏山水田园与禅意表达。',
        '请用第一人称与学生对话。',
    ]),
    'baijuyi': '\n'.join([
        '你现在扮演唐代诗人白居易。',
        '语言风格平易晓畅，善于用通俗表达揭示情感。',
        '请用第一人称与学生对话。',
    ]),
    'wangchangling': '\n'.join([
        '你现在扮演唐代诗人王昌龄。',
        '语言风格凝练雄健，擅长边塞题材与壮阔气象。',
        '请用第一人称与学生对话。',
    ]),
    'lishangyin': '\n'.join([
        '你现在扮演唐代诗人李商隐。',
        '语言风格含蓄婉曲，意象精巧，常见象征与寄托。',
        '请用第一人称与学生对话。',
    ]),
    'sushi': '\n'.join([
        '你现在扮演宋代词人苏轼。',
        '语言风格旷达豪放，兼具哲思与生活趣味。',
        '请用第一人称与学生对话。',
    ]),
    'xinqiji': '\n'.join([
        '你现在扮演宋代词人辛弃疾。',
        '语言风格慷慨激昂，重家国情怀与壮志难酬。',
        '请用第一人称与学生对话。',
    ]),
    'liqingzhao': '\n'.join([
        '你现在扮演宋代词人李清照。',
        '语言风格婉约细腻，善于刻画愁绪与生活感受。',
        '请用第一人称与学生对话。',
    ]),
    'taoyuanming': '\n'.join([
        '你现在扮演东晋诗人陶渊明。',
        '语言风格质朴自然，重田园意趣与内心澄明。',
        '请用第一人称与学生对话。',
    ]),
    'luyou': '\n'.join([
        '你现在扮演南宋诗人陆游。',
        '语言风格沉郁激越，兼具家国情怀与个人志节。',
        '请用第一人称与学生对话。',
    ]),
    'dumu': '\n'.join([
        '你现在扮演晚唐诗人杜牧。',
        '语言风格清俊含讽，善于借古抒怀与咏史寄慨。',
        '请用第一人称与学生对话。',
    ]),
    'menghaoran': '\n'.join([
        '你现在扮演唐代诗人孟浩然。',
        '语言风格清新自然，偏山水田园与闲适情怀。',
        '请用第一人称与学生对话。',
    ]),
    'censhen': '\n'.join([
        '你现在扮演唐代诗人岑参。',
        '语言风格雄奇瑰丽，边塞画面感强。',
        '请用第一人称与学生对话。',
    ]),
    'gaoshi': '\n'.join([
        '你现在扮演唐代诗人高适。',
        '语言风格刚健沉雄，常见边塞与建功主题。',
        '请用第一人称与学生对话。',
    ]),
    'wangbo': '\n'.join([
        '你现在扮演唐代诗人王勃。',
        '语言风格俊逸开阔，擅长抒写志气与少年豪情。',
        '请用第一人称与学生对话。',
    ]),
    'luobinwang': '\n'.join([
        '你现在扮演唐代诗人骆宾王。',
        '语言风格明快俊朗，善用咏物寄意。',
        '请用第一人称与学生对话。',
    ]),
    'hezhizhang': '\n'.join([
        '你现在扮演唐代诗人贺知章。',
        '语言风格自然流畅，善写乡情与童趣。',
        '请用第一人称与学生对话。',
    ]),
    'lihe': '\n'.join([
        '你现在扮演唐代诗人李贺。',
        '语言风格奇崛瑰丽，意象跳跃、想象奇特。',
        '请用第一人称与学生对话。',
    ]),
    'liuyuxi': '\n'.join([
        '你现在扮演唐代诗人刘禹锡。',
        '语言风格爽朗刚健，善以简练语言表达哲理。',
        '请用第一人称与学生对话。',
    ]),
    'hanyu': '\n'.join([
        '你现在扮演唐代文学家韩愈。',
        '语言风格雄健峭拔，重视文道与现实关怀。',
        '请用第一人称与学生对话。',
    ]),
    'liuzongyuan': '\n'.join([
        '你现在扮演唐代文学家柳宗元。',
        '语言风格简洁冷峻，常见山水与身世之感。',
        '请用第一人称与学生对话。',
    ]),
    'yuanzhen': '\n'.join([
        '你现在扮演唐代诗人元稹。',
        '语言风格真挚细腻，重情感与现实观察。',
        '请用第一人称与学生对话。',
    ]),
    'wentingyun': '\n'.join([
        '你现在扮演晚唐词人温庭筠。',
        '语言风格绮丽婉约，善于细部描写与意象营造。',
        '请用第一人称与学生对话。',
    ]),
    'liyu': '\n'.join([
        '你现在扮演南唐后主李煜。',
        '语言风格哀婉深沉，长于亡国之痛与人生感慨。',
        '请用第一人称与学生对话。',
    ]),
    'ouyangxiu': '\n'.join([
        '你现在扮演宋代文学家欧阳修。',
        '语言风格平易中见深情，善写景抒怀。',
        '请用第一人称与学生对话。',
    ]),
    'yanshu': '\n'.join([
        '你现在扮演宋代词人晏殊。',
        '语言风格雅致含蓄，常写宴游与时序感伤。',
        '请用第一人称与学生对话。',
    ]),
    'wanganshi': '\n'.join([
        '你现在扮演宋代文学家王安石。',
        '语言风格峭劲明快，常寓政治理想与思辨。',
        '请用第一人称与学生对话。',
    ]),
    'fanzhongyan': '\n'.join([
        '你现在扮演宋代文学家范仲淹。',
        '语言风格刚健深沉，家国责任感强。',
        '请用第一人称与学生对话。',
    ]),
    'qinuan': '\n'.join([
        '你现在扮演宋代词人秦观。',
        '语言风格婉约柔美，善于写离愁与情思。',
        '请用第一人称与学生对话。',
    ]),
    'hezhu': '\n'.join([
        '你现在扮演宋代词人贺铸。',
        '语言风格清俊兼豪宕，善于用典与情景交织。',
        '请用第一人称与学生对话。',
    ]),
    'jiangkui': '\n'.join([
        '你现在扮演宋代词人姜夔。',
        '语言风格清空雅致，注重声律与意境。',
        '请用第一人称与学生对话。',
    ]),
    'zhoubangyan': '\n'.join([
        '你现在扮演宋代词人周邦彦。',
        '语言风格工丽严整，擅长结构铺叙与音律经营。',
        '请用第一人称与学生对话。',
    ]),
}


def build_chat_system_prompt(mode: str, poet: str, poem_context: str | None) -> str:
    base = QA_SYSTEM_PROMPT if mode == 'qa' else POET_PROMPTS.get(poet, POET_PROMPTS['libai'])
    if poem_context and poem_context.strip():
        return f'{base}\n\n当前学习诗词上下文如下：\n{poem_context}\n\n请优先围绕该诗词进行问答。'
    return base


def _max_attempts() -> int:
    settings = get_settings()
    # 重试2次表示总尝试次数为3（首调 + 2次重试）。
    return max(1, int(settings.ai_retry_attempts) + 1)


async def _sleep_before_retry(attempt: int) -> None:
    settings = get_settings()
    base = max(0.0, float(settings.ai_retry_backoff_seconds))
    delay = min(4.0, base * (2**attempt))
    if delay > 0:
        await asyncio.sleep(delay)


def _is_retryable(exc: Exception) -> bool:
    if isinstance(exc, (APITimeoutError, APIConnectionError, RateLimitError)):
        return True
    if isinstance(exc, APIStatusError):
        status = getattr(exc, 'status_code', None)
        return isinstance(status, int) and (status == 429 or status >= 500)
    if isinstance(exc, json.JSONDecodeError):
        return True
    if isinstance(exc, RuntimeError):
        lowered = str(exc).lower()
        return 'empty content' in lowered
    return False


async def stream_analysis(params: dict[str, Any]) -> AsyncGenerator[str, None]:
    client = _get_client()
    model = _get_model()
    attempts = _max_attempts()

    for attempt in range(attempts):
        emitted = False
        try:
            stream = await client.chat.completions.create(
                model=model,
                temperature=0.3,
                stream=True,
                messages=[{'role': 'user', 'content': build_analysis_prompt(params)}],
            )

            async for chunk in stream:
                token = chunk.choices[0].delta.content if chunk.choices else None
                if token:
                    emitted = True
                    yield token
            return
        except Exception as exc:
            can_retry = _is_retryable(exc) and (attempt < attempts - 1) and not emitted
            if can_retry:
                logger.warning('stream_analysis failed, retrying attempt=%s error=%s', attempt + 1, type(exc).__name__)
                await _sleep_before_retry(attempt)
                continue
            if _is_retryable(exc):
                raise AIServiceError('AI 解析服务暂时不可用，请稍后重试。') from exc
            raise


async def stream_chat(payload: dict[str, Any]) -> AsyncGenerator[str, None]:
    client = _get_client()
    model = _get_model()
    attempts = _max_attempts()

    mode = payload.get('mode', 'qa')
    poet = payload.get('poet', 'libai')
    poem_context = payload.get('poemContext', '')
    history = payload.get('history', [])
    user_message = payload.get('userMessage', '')

    messages: list[dict[str, str]] = [
        {'role': 'system', 'content': build_chat_system_prompt(mode, poet, poem_context)}
    ]

    for item in history:
        role = item.get('role')
        content = item.get('content')
        if role in {'user', 'assistant'} and isinstance(content, str):
            messages.append({'role': role, 'content': content})

    messages.append({'role': 'user', 'content': user_message})

    for attempt in range(attempts):
        emitted = False
        try:
            stream = await client.chat.completions.create(
                model=model,
                temperature=0.5,
                stream=True,
                messages=messages,
            )

            async for chunk in stream:
                token = chunk.choices[0].delta.content if chunk.choices else None
                if token:
                    emitted = True
                    yield token
            return
        except Exception as exc:
            can_retry = _is_retryable(exc) and (attempt < attempts - 1) and not emitted
            if can_retry:
                logger.warning('stream_chat failed, retrying attempt=%s error=%s', attempt + 1, type(exc).__name__)
                await _sleep_before_retry(attempt)
                continue
            if _is_retryable(exc):
                raise AIServiceError('AI 对话服务暂时不可用，请稍后重试。') from exc
            raise


def _extract_json_text(raw_text: str) -> str:
    trimmed = raw_text.strip()
    if trimmed.startswith('```'):
        parts = trimmed.split('```')
        if len(parts) >= 2:
            return parts[1].replace('json', '', 1).strip()
    return trimmed


async def complete_json(
    prompt: str,
    temperature: float = 0.3,
    *,
    max_attempts: int | None = None,
    timeout_seconds: float | None = None,
) -> Any:
    client = _get_client()
    model = _get_model()
    attempts = max(1, int(max_attempts)) if isinstance(max_attempts, int) else _max_attempts()
    timeout = float(timeout_seconds) if isinstance(timeout_seconds, (int, float)) and timeout_seconds > 0 else None

    for attempt in range(attempts):
        try:
            request_kwargs: dict[str, Any] = {
                'model': model,
                'temperature': temperature,
                'stream': False,
                'messages': [{'role': 'user', 'content': prompt}],
            }
            if timeout is not None:
                request_kwargs['timeout'] = timeout

            completion = await client.chat.completions.create(
                **request_kwargs,
            )

            content = completion.choices[0].message.content if completion.choices else ''
            if not content:
                raise RuntimeError('AI returned empty content')

            json_text = _extract_json_text(content)
            return json.loads(json_text)
        except Exception as exc:
            can_retry = _is_retryable(exc) and (attempt < attempts - 1)
            if can_retry:
                logger.warning('complete_json failed, retrying attempt=%s error=%s', attempt + 1, type(exc).__name__)
                await _sleep_before_retry(attempt)
                continue
            if _is_retryable(exc):
                raise AIServiceError('AI 服务暂时不可用，请稍后重试。') from exc
            raise

    raise AIServiceError('AI 服务暂时不可用，请稍后重试。')
