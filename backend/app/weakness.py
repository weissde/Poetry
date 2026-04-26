from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

DEFAULT_PROFILE: dict[str, Any] = {
    'by_question_type': {
        'memorization': {'attempts': 0, 'correct': 0, 'rate': 0},
        'meaning': {'attempts': 0, 'correct': 0, 'rate': 0},
        'technique': {'attempts': 0, 'correct': 0, 'rate': 0},
        'emotion': {'attempts': 0, 'correct': 0, 'rate': 0},
        'appreciation': {'attempts': 0, 'correct': 0, 'rate': 0},
    },
    'by_dynasty': {},
    'by_theme': {},
    'by_keyword_tag': {},
    'by_question_source': {},
    'weak_dimensions': [],
}


def create_profile() -> dict[str, Any]:
    return deepcopy(DEFAULT_PROFILE)


def _touch_metric(bucket: dict[str, Any], key: str, is_correct: bool) -> None:
    row = bucket.get(key) or {'attempts': 0, 'correct': 0, 'rate': 0}
    row['attempts'] += 1
    if is_correct:
        row['correct'] += 1
    row['rate'] = round(row['correct'] / row['attempts'], 4) if row['attempts'] else 0
    bucket[key] = row


def _normalize_optional_text(value: Any) -> str | None:
    text = str(value or '').strip()
    return text or None


def _normalize_tag_list(value: list[str] | None) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    items: list[str] = []
    for raw in value:
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


def update_profile(
    profile: dict[str, Any],
    question_type: str,
    is_correct: bool,
    dynasty: str | None,
    theme: str | None,
    keyword_tags: list[str] | None = None,
    question_source: str | None = None,
) -> dict[str, Any]:
    current = deepcopy(profile)
    by_question_type = current.setdefault('by_question_type', {})
    by_dynasty = current.setdefault('by_dynasty', {})
    by_theme = current.setdefault('by_theme', {})
    by_question_source = current.setdefault('by_question_source', {})
    by_keyword_tag = current.setdefault('by_keyword_tag', {})

    normalized_question_type = _normalize_optional_text(question_type) or 'unknown'
    _touch_metric(by_question_type, normalized_question_type, is_correct)

    normalized_dynasty = _normalize_optional_text(dynasty)
    if normalized_dynasty:
        _touch_metric(by_dynasty, normalized_dynasty, is_correct)

    normalized_theme = _normalize_optional_text(theme)
    if normalized_theme:
        _touch_metric(by_theme, normalized_theme, is_correct)

    normalized_source = _normalize_optional_text(question_source)
    if normalized_source:
        _touch_metric(by_question_source, normalized_source, is_correct)

    for tag in _normalize_tag_list(keyword_tags):
        _touch_metric(by_keyword_tag, tag, is_correct)
    # keep optional buckets shape stable even if updated in other module paths
    current['by_question_source'] = by_question_source
    current['by_keyword_tag'] = by_keyword_tag

    weak_rows: list[tuple[float, int, str]] = []

    def collect(bucket: dict[str, Any], prefix: str, *, min_attempts: int = 3, max_items: int = 4) -> None:
        rows: list[tuple[float, int, str]] = []
        for key, row in bucket.items():
            attempts = int(row.get('attempts', 0))
            rate = float(row.get('rate', 0))
            if attempts < min_attempts:
                continue
            if rate >= 0.7:
                continue
            rows.append((rate, -attempts, f'{prefix}{key}'))
        rows.sort(key=lambda item: (item[0], item[1], item[2]))
        weak_rows.extend(rows[:max_items])

    collect(by_question_type, '题型·', min_attempts=3, max_items=5)
    collect(by_dynasty, '朝代·', min_attempts=3, max_items=3)
    collect(by_theme, '题材·', min_attempts=3, max_items=3)
    collect(by_keyword_tag, '意象·', min_attempts=2, max_items=3)
    collect(by_question_source, '来源·', min_attempts=2, max_items=4)

    weak_rows.sort(key=lambda item: (item[0], item[1], item[2]))
    weak_dimensions = [item[2] for item in weak_rows[:8]]
    current['weak_dimensions'] = weak_dimensions
    return current


async def compute_and_save_profile(
    user_id: str,
    *,
    question_type: str,
    is_correct: bool,
    dynasty: str | None = None,
    theme: str | None = None,
    keyword_tags: list[str] | None = None,
    question_source: str | None = None,
) -> dict[str, Any]:
    from .supabase_client import get_supabase_admin

    client = get_supabase_admin()
    result = client.table('weakness_profiles').select('profile_json').eq('user_id', user_id).limit(1).execute()
    row = (result.data or [None])[0]
    current_profile = row.get('profile_json') if isinstance(row, dict) and isinstance(row.get('profile_json'), dict) else create_profile()

    profile = update_profile(
        current_profile,
        question_type=question_type,
        is_correct=is_correct,
        dynasty=dynasty,
        theme=theme,
        keyword_tags=keyword_tags,
        question_source=question_source,
    )

    client.table('weakness_profiles').upsert(
        {
            'user_id': user_id,
            'profile_json': profile,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        },
        on_conflict='user_id',
    ).execute()
    return profile
