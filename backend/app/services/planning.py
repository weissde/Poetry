from __future__ import annotations

import re
from typing import Any


def _normalize_keyword_focus(raw_focus: Any) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    if not isinstance(raw_focus, list):
        return items

    for raw_item in raw_focus:
        keyword = ''
        goal = '围绕该关键词进行专项复习并完成错因复盘。'
        attempts = 0
        pending = 0
        rate = 0

        if isinstance(raw_item, str):
            keyword = raw_item.strip()
        elif isinstance(raw_item, dict):
            keyword = str(raw_item.get('keyword') or raw_item.get('key') or raw_item.get('value') or '').strip()
            goal = str(raw_item.get('goal') or raw_item.get('reason') or goal).strip() or goal
            attempts = max(0, int(raw_item.get('attempts') or 0))
            pending = max(0, int(raw_item.get('pending') or raw_item.get('pendingCount') or 0))
            raw_rate = raw_item.get('rate')
            if isinstance(raw_rate, (int, float)):
                rate_value = float(raw_rate)
                if rate_value <= 1:
                    rate = max(0, min(100, int(round(rate_value * 100))))
                else:
                    rate = max(0, min(100, int(round(rate_value))))
        else:
            continue

        if not keyword:
            continue
        norm = keyword.lower()
        if norm in seen:
            continue
        seen.add(norm)
        items.append(
            {
                'keyword': keyword,
                'goal': goal,
                'attempts': attempts,
                'pending': pending,
                'rate': rate,
            }
        )
        if len(items) >= 10:
            break

    return items


def _normalize_task_priority(raw_priority: Any) -> str:
    value = str(raw_priority or '').strip().lower()
    if value in {'high', 'p0', 'urgent', '紧急', '高', '高优先级'}:
        return 'high'
    if value in {'low', 'p2', '低', '低优先级'}:
        return 'low'
    return 'medium'


def _normalize_phase_goals(raw_phase_goals: Any) -> list[str]:
    goals: list[str] = []
    if isinstance(raw_phase_goals, list):
        for item in raw_phase_goals:
            text = str(item).strip()
            if text:
                goals.append(text)
            if len(goals) >= 6:
                break

    if goals:
        return goals

    return [
        '阶段1：夯实基础，完成每日任务并记录错因。',
        '阶段2：聚焦薄弱关键词，完成专项训练与复盘。',
        '阶段3：考前冲刺，按考试节奏限时练习并回顾高频错题。',
    ]


def normalize_review_plan(raw_plan: Any) -> dict[str, Any]:
    data = raw_plan if isinstance(raw_plan, dict) else {}
    overview = str(data.get('overview') or '根据当前错题与薄弱点生成的复习计划。')
    phase_goals = _normalize_phase_goals(data.get('phaseGoals'))

    raw_days = data.get('dailyTasks')
    normalized_days: list[dict[str, Any]] = []
    if isinstance(raw_days, list):
        for index, day_item in enumerate(raw_days):
            if not isinstance(day_item, dict):
                continue

            day = str(day_item.get('day') or f'第{index + 1}天')
            focus = str(day_item.get('focus') or '诗词复习')
            stage_goal = str(day_item.get('stageGoal') or day_item.get('goal') or '聚焦当天薄弱点并完成复盘。').strip()
            raw_tasks = day_item.get('tasks')
            tasks: list[str] = []
            if isinstance(raw_tasks, list):
                for raw_task in raw_tasks:
                    task_text = str(raw_task).strip()
                    if task_text:
                        tasks.append(task_text)
            if not tasks:
                tasks = ['完成 20 分钟古诗词复习', '整理 5 道错题并复盘原因']

            raw_task_priorities = day_item.get('taskPriorities')
            task_priorities: list[str] = []
            if isinstance(raw_task_priorities, list):
                for raw_priority in raw_task_priorities:
                    task_priorities.append(_normalize_task_priority(raw_priority))
                    if len(task_priorities) >= len(tasks):
                        break

            while len(task_priorities) < len(tasks):
                if len(task_priorities) == 0:
                    task_priorities.append('high')
                else:
                    task_priorities.append('medium')

            normalized_days.append(
                {
                    'day': day,
                    'focus': focus,
                    'stageGoal': stage_goal or '聚焦当天薄弱点并完成复盘。',
                    'tasks': tasks,
                    'taskPriorities': task_priorities[: len(tasks)],
                }
            )

    if not normalized_days:
        normalized_days = [
            {
                'day': f'第{i + 1}天',
                'focus': '基础复盘',
                'stageGoal': '巩固核心篇目与高频考点。',
                'tasks': ['复习经典篇目', '完成针对性练习'],
                'taskPriorities': ['high', 'medium'],
            }
            for i in range(5)
        ]

    completed_raw = data.get('completedTaskKeys')
    completed_keys = sorted({str(item) for item in completed_raw if isinstance(item, str)}) if isinstance(completed_raw, list) else []
    keyword_focus = _normalize_keyword_focus(data.get('keywordFocus'))

    return {
        'overview': overview,
        'phaseGoals': phase_goals,
        'dailyTasks': normalized_days,
        'completedTaskKeys': completed_keys,
        'keywordFocus': keyword_focus,
    }


def review_plan_progress(plan: dict[str, Any]) -> dict[str, Any]:
    daily_tasks = plan.get('dailyTasks') if isinstance(plan.get('dailyTasks'), list) else []
    completed = set(plan.get('completedTaskKeys') or [])
    total = 0
    done = 0
    for day_index, day_item in enumerate(daily_tasks):
        if not isinstance(day_item, dict):
            continue
        tasks = day_item.get('tasks') if isinstance(day_item.get('tasks'), list) else []
        for task_index, _task in enumerate(tasks):
            key = f'{day_index}-{task_index}'
            total += 1
            if key in completed:
                done += 1

    rate = round(done / total, 4) if total else 0
    return {'completed': done, 'total': total, 'rate': rate}


def normalize_creation_feedback(raw_feedback: Any) -> dict[str, Any]:
    data = raw_feedback if isinstance(raw_feedback, dict) else {}
    scores = data.get('scores') if isinstance(data.get('scores'), dict) else {}

    def _score(key: str) -> int:
        value = scores.get(key)
        if isinstance(value, (int, float)):
            return max(1, min(10, int(value)))
        return 7

    suggestions_raw = data.get('suggestions')
    highlights_raw = data.get('highlights')
    revised_content = data.get('revisedContent')

    suggestions = [str(item) for item in suggestions_raw if isinstance(item, str)] if isinstance(suggestions_raw, list) else []
    highlights = [str(item) for item in highlights_raw if isinstance(item, str)] if isinstance(highlights_raw, list) else []

    return {
        'scores': {
            'imagery': _score('imagery'),
            'rhythm': _score('rhythm'),
            'wording': _score('wording'),
        },
        'summary': str(data.get('summary') or '作品完成度良好，建议继续打磨意象与节奏。'),
        'suggestions': suggestions[:6] or ['加强关键词凝练，避免表达重复。'],
        'highlights': highlights[:6] or ['主题表达清晰，具备进一步打磨空间。'],
        'revisedContent': str(revised_content) if isinstance(revised_content, str) else None,
    }


def _build_local_review_plan(
    *,
    exam_date: str | None,
    wrong_summary_lines: list[str],
    keyword_focus_seed: list[dict[str, Any]],
    exam_summary_lines: list[str] | None = None,
) -> dict[str, Any]:
    phase_goals = [
        '阶段1：夯实基础，优先清理高频错题与核心篇目。',
        '阶段2：专项突破，围绕关键词薄弱点完成针对训练。',
        '阶段3：冲刺提分，按考试节奏完成限时复盘。',
    ]
    keyword_focus = keyword_focus_seed[:5]
    if not keyword_focus:
        keyword_focus = [
            {'keyword': '意象分析', 'goal': '补齐意象识别与情感映射。', 'attempts': 0, 'pending': 0, 'rate': 0},
            {'keyword': '手法判断', 'goal': '补齐常见手法与作用表达。', 'attempts': 0, 'pending': 0, 'rate': 0},
        ]

    overview_parts = ['根据当前错题与薄弱关键词，已生成5日复习安排。']
    if exam_date:
        overview_parts.append(f'目标考试日期：{exam_date}。')
    if wrong_summary_lines:
        overview_parts.append(f'错题概况：{wrong_summary_lines[0]}。')
    if exam_summary_lines:
        overview_parts.append(f'最近考试表现：{exam_summary_lines[0]}。')
    overview = ''.join(overview_parts)

    daily_tasks: list[dict[str, Any]] = []
    for day_index in range(5):
        keyword_item = keyword_focus[day_index % len(keyword_focus)]
        keyword = str(keyword_item.get('keyword') or '综合复盘').strip() or '综合复盘'
        focus = f'{keyword}专项'
        stage_goal = f'围绕“{keyword}”完成识别-分析-复盘闭环。'
        tasks = [
            f'复盘“{keyword}”相关错题 3 题并记录错因。',
            f'完成“{keyword}”专项练习 6 题（至少含1题主观题）。',
            '整理1条可复用答题模板并口头复述。',
        ]
        task_priorities = ['high', 'high', 'medium']
        daily_tasks.append(
            {
                'day': f'第{day_index + 1}天',
                'focus': focus,
                'stageGoal': stage_goal,
                'tasks': tasks,
                'taskPriorities': task_priorities,
            }
        )

    return normalize_review_plan(
        {
            'overview': overview,
            'phaseGoals': phase_goals,
            'keywordFocus': keyword_focus,
            'dailyTasks': daily_tasks,
            'completedTaskKeys': [],
        }
    )


def _estimate_creation_scores(text: str) -> dict[str, int]:
    content = str(text or '').strip()
    length = len(content)
    line_count = max(1, len([line for line in re.split(r'[\n。！？；]', content) if line.strip()]))
    imagery = min(10, max(5, 5 + min(4, length // 18)))
    rhythm = min(10, max(5, 5 + min(4, line_count // 2)))
    wording = min(10, max(5, 5 + min(4, length // 22)))
    return {'imagery': imagery, 'rhythm': rhythm, 'wording': wording}


def _build_local_creation_feedback(
    *,
    content: str,
    style: str | None,
    reference_poem: str | None,
    mode: str,
    instruction: str | None = None,
    source_text: str | None = None,
) -> dict[str, Any]:
    scores = _estimate_creation_scores(content)
    style_text = str(style or '古风').strip() or '古风'
    reference_text = str(reference_poem or '').strip()
    summary_parts = [f'已完成{style_text}风格的本地点评。']
    if reference_text:
        summary_parts.append(f'可继续参考《{reference_text}》强化语感。')
    if mode == 'refine':
        summary_parts.append('润色方向已聚焦“表达更凝练、节奏更稳定”。')
    if mode == 'transform':
        summary_parts.append('现代文本已转写为古风表达，可进一步压缩句式。')
    summary = ''.join(summary_parts)

    suggestions = [
        '优先保留最关键的两个意象，减少重复修饰词。',
        '每句尽量控制在相近字数，提升节奏稳定性。',
        '补1句“情感落点”作为收束，增强主旨完整度。',
    ]
    if instruction and instruction.strip():
        suggestions.insert(0, f'按你的润色要求继续打磨：{instruction.strip()}')

    highlights = [
        '主题表达清晰，读者可以快速把握主线。',
        '意象选择有方向，具备继续精修空间。',
    ]

    revised_content = content.strip()
    if mode == 'transform' and source_text and revised_content == source_text.strip():
        revised_content = f'清风入夜，心事成诗。\n{source_text.strip()}'

    return normalize_creation_feedback(
        {
            'scores': scores,
            'summary': summary,
            'suggestions': suggestions[:6],
            'highlights': highlights[:6],
            'revisedContent': revised_content or None,
        }
    )


def insert_creation_record(
    client: Any,
    *,
    user_id: str,
    style: str | None,
    reference_poem: str | None,
    content: str,
    feedback: dict[str, Any],
    created_at: str,
    mode: str,
    source_text: str | None = None,
) -> dict[str, Any] | None:
    primary_payload = {
        'user_id': user_id,
        'style': style,
        'reference_poem': reference_poem,
        'content': content,
        'feedback_json': feedback,
        'mode': mode,
        'source_text': source_text,
        'created_at': created_at,
    }

    try:
        result = client.table('creations').insert(primary_payload).execute()
        return (result.data or [None])[0]
    except Exception:
        fallback_payload = {
            'user_id': user_id,
            'style': style,
            'reference_poem': reference_poem,
            'content': content,
            'feedback_json': feedback,
            'created_at': created_at,
        }
        result = client.table('creations').insert(fallback_payload).execute()
        creation = (result.data or [None])[0]
        if isinstance(creation, dict):
            creation.setdefault('mode', mode)
            creation.setdefault('source_text', source_text)
        return creation
