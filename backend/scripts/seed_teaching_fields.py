"""
Seed teaching-related poem fields in `poems`:
- teaching_objectives
- inquiry_tasks
- exam_points
- difficulty_level
- period_estimate_minutes

Run from project root:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python -m backend.scripts.seed_teaching_fields
Run from `backend/`:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python -m scripts.seed_teaching_fields
"""

from __future__ import annotations

import os
from typing import Any

from supabase import create_client


TEACHING_DATA: dict[tuple[str, str], dict[str, Any]] = {
    ("静夜思", "李白"): {
        "teaching_objectives": [
            {
                "title": "理解诗歌内容",
                "goals": ["理解月夜思乡的情境", "掌握关键字词含义", "梳理情感推进路径"],
                "teacher_hint": "先让学生描述画面，再进入句意解析。",
            },
            {
                "title": "分析表达手法",
                "goals": ["识别借景抒情", "比较“举头/低头”的情感转折"],
                "teacher_hint": "引导学生从动作变化中感受情绪。",
            },
        ],
        "inquiry_tasks": [
            {
                "title": "核心字词探究",
                "prompt": "找出最关键的一个字词，并说明为什么它最能体现全诗情感。",
                "preset_questions": [
                    "“疑”字为什么重要？",
                    "“举头/低头”对应怎样的心理变化？",
                    "月亮意象在古诗中常见含义是什么？",
                ],
                "completion_cta": "完成探究后进入练习",
            }
        ],
        "exam_points": [
            {"type": "字词", "content": "疑：好像、仿佛，表达不确定感。"},
            {"type": "手法", "content": "借景抒情：由月色引发思乡情。"},
            {"type": "主旨", "content": "借夜景表达游子思乡。"},
        ],
        "difficulty_level": "easy",
        "period_estimate_minutes": 40,
    },
    ("春望", "杜甫"): {
        "teaching_objectives": [
            {
                "title": "理解时代背景",
                "goals": ["了解安史之乱背景", "理解家国忧思主题"],
                "teacher_hint": "先补充时代背景，再读诗句情感。",
            },
            {
                "title": "分析情感与手法",
                "goals": ["识别反衬", "把握忧国思家双重情绪"],
                "teacher_hint": "聚焦“感时花溅泪，恨别鸟惊心”。",
            },
        ],
        "inquiry_tasks": [
            {
                "title": "情感深读任务",
                "prompt": "诗人为何在春景中写出沉重情感？",
                "preset_questions": [
                    "花鸟意象在本诗中的作用是什么？",
                    "“家书抵万金”说明了什么？",
                    "你如何理解诗末的形象变化？",
                ],
                "completion_cta": "进入题组巩固",
            }
        ],
        "exam_points": [
            {"type": "手法", "content": "反衬：以乐景衬哀情。"},
            {"type": "字词", "content": "感时、恨别体现时局与离散之痛。"},
            {"type": "主旨", "content": "忧国伤时与思家情怀并重。"},
        ],
        "difficulty_level": "medium",
        "period_estimate_minutes": 45,
    },
}


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env: {name}")
    return value


def _service_key() -> str:
    for key in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"):
        value = os.getenv(key, "").strip()
        if value:
            return value
    raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)")


def seed() -> None:
    supabase = create_client(_require_env("SUPABASE_URL"), _service_key())

    print("Seeding poem teaching fields...")
    success = 0
    skipped = 0

    for (title, author), payload in TEACHING_DATA.items():
        poem_result = (
            supabase.table("poems")
            .select("id,title,author")
            .eq("title", title)
            .eq("author", author)
            .maybe_single()
            .execute()
        )
        poem_row = poem_result.data or None
        if not isinstance(poem_row, dict):
            skipped += 1
            print(f"  - SKIP {title} / {author}: poem not found")
            continue

        poem_id = poem_row["id"]
        update_result = supabase.table("poems").update(payload).eq("id", poem_id).execute()
        if update_result.data:
            success += 1
            print(f"  + OK   {title} / {author}")
        else:
            skipped += 1
            print(f"  - FAIL {title} / {author}")

    print(f"Done. success={success}, skipped={skipped}")


if __name__ == "__main__":
    seed()
