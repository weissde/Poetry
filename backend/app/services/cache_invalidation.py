from __future__ import annotations

from ..cache import cache_delete_prefix


async def _invalidate_wrongbook_cache(user_id: str) -> None:
    await cache_delete_prefix(f'wrongbook-dashboard-items:{user_id}:')
    await cache_delete_prefix(f'wrongbook-dashboard-meta:{user_id}:')


async def _invalidate_nav_pending_cache(user_id: str) -> None:
    await cache_delete_prefix(f'nav-pending-summary:{user_id}:')


async def _invalidate_weakness_cache(user_id: str) -> None:
    await cache_delete_prefix(f'weakness-profile:{user_id}:')


async def _invalidate_poem_favorites_cache(user_id: str) -> None:
    await cache_delete_prefix(f'poem-favorites:{user_id}:')


async def _invalidate_memory_cache(user_id: str) -> None:
    await cache_delete_prefix(f'memory-today:{user_id}:')
    await cache_delete_prefix(f'memory-stats:{user_id}:')


async def _invalidate_exam_cache(user_id: str) -> None:
    await cache_delete_prefix(f'exam-history:{user_id}:')


async def _invalidate_creation_cache(user_id: str) -> None:
    await cache_delete_prefix(f'create-history:{user_id}:')


async def _invalidate_creation_public_cache() -> None:
    await cache_delete_prefix('create-public:')


async def _invalidate_chat_summary_cache(user_id: str) -> None:
    await cache_delete_prefix(f'chat-summaries:{user_id}:')


async def _invalidate_learning_cache(user_id: str) -> None:
    await cache_delete_prefix(f'user-summary:{user_id}:')
    await cache_delete_prefix(f'user-learning-summary:{user_id}:')
    await cache_delete_prefix(f'user-today-tasks:{user_id}:')
    await cache_delete_prefix(f'ai-learning-report:{user_id}:')
    await cache_delete_prefix(f'lesson-tasks:{user_id}:')
    await cache_delete_prefix(f'user-role:{user_id}:')
