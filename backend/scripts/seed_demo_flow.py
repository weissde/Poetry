"""Seed a complete demo workflow into Supabase.

Run from ``backend/``:
  .\.venv\Scripts\python.exe scripts\seed_demo_flow.py

Optional:
  .\.venv\Scripts\python.exe scripts\seed_demo_flow.py --teacher-email teacher@example.com --student-email student@example.com
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND / ".env")

NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "poetry-ai-demo-flow")


def demo_id(key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, key))


def now(offset_days: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=offset_days)).isoformat()


def day(offset_days: int = 0) -> str:
    return (date.today() + timedelta(days=offset_days)).isoformat()


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"缺少环境变量：{name}，请检查 backend/.env")
    return value


def service_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or require_env("SUPABASE_SERVICE_KEY")


def response_rows(response: Any) -> list[dict[str, Any]]:
    data = getattr(response, "data", response)
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def auth_users(client: Any) -> list[dict[str, Any]]:
    result = client.auth.admin.list_users()
    users = getattr(result, "users", result)
    if isinstance(users, dict):
        users = users.get("users", [])

    normalized: list[dict[str, Any]] = []
    for user in users or []:
        if isinstance(user, dict):
            user_id = user.get("id")
            email = user.get("email")
            created_at = user.get("created_at") or ""
        else:
            user_id = getattr(user, "id", None)
            email = getattr(user, "email", None)
            created_at = getattr(user, "created_at", "") or ""
        if user_id:
            normalized.append({"id": str(user_id), "email": email or "", "created_at": str(created_at)})
    return sorted(normalized, key=lambda item: item.get("created_at", ""))


def pick_user(users: list[dict[str, Any]], email: str | None, role_rows: list[dict[str, Any]], role: str) -> dict[str, Any] | None:
    if email:
        for user in users:
            if user.get("email", "").lower() == email.lower():
                return user
        raise RuntimeError(f"找不到指定 {role} 邮箱：{email}")

    role_ids = {row.get("id") for row in role_rows if row.get("role") == role}
    for user in users:
        if user["id"] in role_ids:
            return user
    return None


def upsert(client: Any, table: str, rows: list[dict[str, Any]] | dict[str, Any], conflict: str = "id") -> int:
    payload = rows if isinstance(rows, list) else [rows]
    if not payload:
        return 0
    client.table(table).upsert(payload, on_conflict=conflict).execute()
    return len(payload)


def scan_tables(client: Any) -> dict[str, int | str]:
    tables = [
        "poems",
        "questions",
        "teaching_units",
        "poem_graph_nodes",
        "poem_graph_edges",
        "user_profiles",
        "classes",
        "class_members",
        "class_sessions",
        "lesson_tasks",
        "poem_study_states",
        "user_answers",
        "wrong_questions",
        "weakness_profiles",
        "exam_records",
        "practice_session_summaries",
        "practice_question_feedback",
        "memory_reviews",
        "memory_review_logs",
        "poem_favorites",
        "poem_notes",
        "review_plans",
        "creations",
        "creation_likes",
    ]
    counts: dict[str, int | str] = {}
    for table in tables:
        try:
            result = client.table(table).select("id", count="exact").limit(1).execute()
            counts[table] = getattr(result, "count", 0) or 0
        except Exception as exc:  # noqa: BLE001 - keep scan useful even when one optional table is absent.
            counts[table] = f"不可用：{exc.__class__.__name__}"
    return counts


POEMS: list[dict[str, Any]] = [
    {
        "key": "jingyesi",
        "title": "静夜思",
        "author": "李白",
        "dynasty": "唐",
        "content": "床前明月光，疑是地上霜。\n举头望明月，低头思故乡。",
        "tags": ["思乡", "月夜", "五言绝句"],
        "grade_level": ["七年级", "小升初"],
        "curriculum_unit": "月与乡愁",
        "difficulty_level": "easy",
        "period_estimate_minutes": 40,
    },
    {
        "key": "chunxiao",
        "title": "春晓",
        "author": "孟浩然",
        "dynasty": "唐",
        "content": "春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。",
        "tags": ["春天", "惜春", "五言绝句"],
        "grade_level": ["七年级"],
        "curriculum_unit": "四季与物候",
        "difficulty_level": "easy",
        "period_estimate_minutes": 35,
    },
    {
        "key": "dengguanquelou",
        "title": "登鹳雀楼",
        "author": "王之涣",
        "dynasty": "唐",
        "content": "白日依山尽，黄河入海流。\n欲穷千里目，更上一层楼。",
        "tags": ["登高", "哲理", "边塞气象"],
        "grade_level": ["七年级"],
        "curriculum_unit": "登高与视野",
        "difficulty_level": "easy",
        "period_estimate_minutes": 35,
    },
    {
        "key": "wanglushanpubu",
        "title": "望庐山瀑布",
        "author": "李白",
        "dynasty": "唐",
        "content": "日照香炉生紫烟，遥看瀑布挂前川。\n飞流直下三千尺，疑是银河落九天。",
        "tags": ["山水", "夸张", "想象"],
        "grade_level": ["八年级"],
        "curriculum_unit": "山水与想象",
        "difficulty_level": "medium",
        "period_estimate_minutes": 45,
    },
    {
        "key": "yinhu",
        "title": "饮湖上初晴后雨",
        "author": "苏轼",
        "dynasty": "宋",
        "content": "水光潋滟晴方好，山色空蒙雨亦奇。\n欲把西湖比西子，淡妆浓抹总相宜。",
        "tags": ["西湖", "比喻", "山水"],
        "grade_level": ["八年级"],
        "curriculum_unit": "山水与审美",
        "difficulty_level": "medium",
        "period_estimate_minutes": 45,
    },
    {
        "key": "tilinbi",
        "title": "题西林壁",
        "author": "苏轼",
        "dynasty": "宋",
        "content": "横看成岭侧成峰，远近高低各不同。\n不识庐山真面目，只缘身在此山中。",
        "tags": ["哲理", "庐山", "视角"],
        "grade_level": ["八年级"],
        "curriculum_unit": "观察与哲思",
        "difficulty_level": "medium",
        "period_estimate_minutes": 45,
    },
]


def poem_payload(poem: dict[str, Any]) -> dict[str, Any]:
    title = poem["title"]
    return {
        "id": demo_id(f"poem:{poem['key']}"),
        "title": title,
        "author": poem["author"],
        "dynasty": poem["dynasty"],
        "content": poem["content"],
        "tags": poem["tags"],
        "grade_level": poem["grade_level"],
        "curriculum_unit": poem["curriculum_unit"],
        "difficulty_level": poem["difficulty_level"],
        "period_estimate_minutes": poem["period_estimate_minutes"],
        "teaching_objectives": [
            {"title": "读懂内容", "goals": [f"概括《{title}》画面", "解释关键词句", "完成背诵与默写"], "teacher_hint": "先让学生说画面，再回到诗句证据。"},
            {"title": "分析表达", "goals": ["识别意象与手法", "说清情感推进", "迁移到同主题诗歌"], "teacher_hint": "把意象、动词、情感三个维度串起来。"},
        ],
        "inquiry_tasks": [
            {
                "title": "核心意象探究",
                "prompt": f"选择《{title}》中最能体现主题的一个意象，并说明理由。",
                "preset_questions": ["这个意象带来了怎样的画面？", "它和诗人的情感有什么关系？", "换成别的词效果会怎样？"],
                "completion_cta": "进入练习巩固",
            }
        ],
        "exam_points": [
            {"type": "字词", "content": "解释关键词含义，并能结合诗句翻译。"},
            {"type": "手法", "content": "从意象、修辞、动静结合等角度分析表达效果。"},
            {"type": "主题", "content": "概括诗歌情感，并用原句作为依据。"},
        ],
        "updated_at": now(),
    }


def build_questions() -> list[dict[str, Any]]:
    specs = [
        ("jingyesi", "memorization", 1, "《静夜思》中“举头望明月”的下一句是？", ["低头思故乡", "花落知多少", "更上一层楼", "疑是地上霜"], "低头思故乡", "原诗末句承接望月动作，落到思乡情感。"),
        ("jingyesi", "emotion", 2, "《静夜思》主要表达了诗人怎样的情感？", ["思乡之情", "报国之志", "惜春之感", "离别之痛"], "思乡之情", "月光触发乡愁，是全诗情感核心。"),
        ("chunxiao", "meaning", 1, "“处处闻啼鸟”描写的是怎样的场景？", ["春晨鸟鸣", "秋夜虫声", "江边潮声", "边塞风声"], "春晨鸟鸣", "春眠醒来，耳边到处是鸟鸣。"),
        ("dengguanquelou", "appreciation", 2, "“更上一层楼”常用来比喻什么？", ["不断进取，拓展眼界", "及时行乐", "归隐田园", "惜别友人"], "不断进取，拓展眼界", "诗句由登楼望远引出进取哲理。"),
        ("wanglushanpubu", "technique", 3, "“飞流直下三千尺”主要运用了哪种手法？", ["夸张", "反衬", "借代", "双关"], "夸张", "三千尺突出瀑布高峻壮观。"),
        ("yinhu", "technique", 3, "“欲把西湖比西子”运用了什么修辞？", ["比喻", "拟人", "排比", "设问"], "比喻", "以西施比西湖，突出天然美与妆饰美皆宜。"),
        ("tilinbi", "comparison", 3, "《题西林壁》给人的启示更接近哪一项？", ["跳出局部看整体", "珍惜春光", "思念故乡", "建功边塞"], "跳出局部看整体", "身在山中难见全貌，提示要变换视角。"),
    ]
    rows = []
    for poem_key, question_type, difficulty, content, options, answer, explanation in specs:
        rows.append(
            {
                "id": demo_id(f"question:{poem_key}:{question_type}"),
                "poem_id": demo_id(f"poem:{poem_key}"),
                "type": question_type,
                "difficulty": difficulty,
                "content": content,
                "options": options,
                "answer": answer,
                "explanation": explanation,
                "source": "demo_seed",
            }
        )
    return rows


def build_graph() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    node_map: dict[tuple[str, str, str], str] = {}
    shared = {
        "jingyesi": [("poet", "李白"), ("dynasty", "唐"), ("imagery", "明月"), ("theme", "思乡"), ("emotion", "乡愁"), ("technique", "借景抒情")],
        "chunxiao": [("poet", "孟浩然"), ("dynasty", "唐"), ("imagery", "啼鸟"), ("theme", "惜春"), ("emotion", "闲适"), ("technique", "以声写景")],
        "dengguanquelou": [("poet", "王之涣"), ("dynasty", "唐"), ("imagery", "黄河"), ("theme", "登高"), ("emotion", "昂扬"), ("technique", "景理结合")],
        "wanglushanpubu": [("poet", "李白"), ("dynasty", "唐"), ("imagery", "瀑布"), ("theme", "山水"), ("emotion", "赞叹"), ("technique", "夸张")],
        "yinhu": [("poet", "苏轼"), ("dynasty", "宋"), ("imagery", "西湖"), ("theme", "山水"), ("emotion", "喜爱"), ("technique", "比喻")],
        "tilinbi": [("poet", "苏轼"), ("dynasty", "宋"), ("imagery", "庐山"), ("theme", "哲理"), ("emotion", "理趣"), ("technique", "景理结合")],
    }
    for poem_key, items in shared.items():
        for node_type, label in items:
            node_id = demo_id(f"graph-node:{poem_key}:{node_type}:{label}")
            node_map[(poem_key, node_type, label)] = node_id
            nodes.append(
                {
                    "id": node_id,
                    "poem_id": demo_id(f"poem:{poem_key}"),
                    "node_type": node_type,
                    "label": label,
                    "weight": 1.0,
                    "metadata": {"source": "demo_seed"},
                    "updated_at": now(),
                }
            )
        base = node_map[(poem_key, "poet", items[0][1])]
        for node_type, label in items[1:]:
            target = node_map[(poem_key, node_type, label)]
            edges.append(
                {
                    "id": demo_id(f"graph-edge:{poem_key}:{base}:{target}"),
                    "source_node_id": base,
                    "target_node_id": target,
                    "edge_type": "demo_semantic",
                    "weight": 1.0,
                    "metadata": {"source": "demo_seed"},
                }
            )
    return nodes, edges


def seed(client: Any, teacher: dict[str, Any], student: dict[str, Any]) -> dict[str, int | str]:
    teacher_id = teacher["id"]
    student_id = student["id"]
    counts: dict[str, int | str] = {}

    if teacher_id == student_id:
        profile_rows = [
            {
                "id": teacher_id,
                "nickname": "演示账号",
                "grade_level": "七年级",
                "role": "teacher",
                "school_name": "诗词实验中学",
                "class_name": "七年级一班",
                "streak_days": 12,
                "updated_at": now(),
            }
        ]
    else:
        profile_rows = [
            {"id": teacher_id, "nickname": "演示教师", "grade_level": "七年级", "role": "teacher", "school_name": "诗词实验中学", "class_name": "七年级一班", "streak_days": 12, "updated_at": now()},
            {"id": student_id, "nickname": "演示学生", "grade_level": "七年级", "role": "student", "school_name": "诗词实验中学", "class_name": "七年级一班", "streak_days": 7, "updated_at": now()},
        ]
    counts["user_profiles"] = upsert(client, "user_profiles", profile_rows)

    poem_rows = [poem_payload(poem) for poem in POEMS]
    counts["poems"] = upsert(client, "poems", poem_rows)
    counts["questions"] = upsert(client, "questions", build_questions())

    unit_rows = [
        {"id": demo_id("unit:moon-home"), "title": "月与乡愁", "subtitle": "从明月意象进入古诗情感", "category": "theme", "grade_level": ["七年级"], "poem_ids": [demo_id("poem:jingyesi")], "poem_count": 1, "curriculum_ref": "演示单元 A", "mastery_target": 85, "display_order": 1, "is_active": True, "updated_at": now()},
        {"id": demo_id("unit:landscape"), "title": "山水与哲思", "subtitle": "比较李白与苏轼的山水表达", "category": "theme", "grade_level": ["八年级"], "poem_ids": [demo_id("poem:wanglushanpubu"), demo_id("poem:yinhu"), demo_id("poem:tilinbi")], "poem_count": 3, "curriculum_ref": "演示单元 B", "mastery_target": 80, "display_order": 2, "is_active": True, "updated_at": now()},
    ]
    counts["teaching_units"] = upsert(client, "teaching_units", unit_rows)

    nodes, edges = build_graph()
    try:
        counts["poem_graph_nodes"] = upsert(client, "poem_graph_nodes", nodes)
        counts["poem_graph_edges"] = upsert(client, "poem_graph_edges", edges)
    except Exception as exc:  # noqa: BLE001 - deployments without graph migrations should still seed the demo flow.
        counts["poem_graph_nodes"] = f"skipped ({exc.__class__.__name__})"
        counts["poem_graph_edges"] = "skipped"

    class_id = demo_id("class:demo")
    existing_class = response_rows(client.table("classes").select("id").eq("invite_code", "DEMO29").execute())
    if existing_class:
        class_id = existing_class[0]["id"]
    session_id = demo_id("session:jingyesi")
    counts["classes"] = upsert(
        client,
        "classes",
        {"id": class_id, "name": "MastClass 演示班", "description": "完整流程演示班级：教师布置任务，学生练习、背诵、错题复盘。", "teacher_id": teacher_id, "invite_code": "DEMO29", "updated_at": now()},
    )
    if teacher_id == student_id:
        member_rows = [{"class_id": class_id, "user_id": teacher_id, "role": "teacher"}]
    else:
        member_rows = [
            {"class_id": class_id, "user_id": teacher_id, "role": "teacher"},
            {"class_id": class_id, "user_id": student_id, "role": "student"},
        ]
    counts["class_members"] = upsert(client, "class_members", member_rows, "class_id,user_id")
    counts["class_sessions"] = upsert(
        client,
        "class_sessions",
        {
            "id": session_id,
            "teacher_id": teacher_id,
            "poem_id": demo_id("poem:jingyesi"),
            "poem_title": "静夜思",
            "unit_id": demo_id("unit:moon-home"),
            "current_step": 4,
            "status": "active",
            "notes": "演示课：导入意象、逐句赏析、课堂练习、课后复盘。",
            "duration_minutes": 28,
            "updated_at": now(),
        },
    )

    counts["lesson_tasks"] = upsert(
        client,
        "lesson_tasks",
        [
            {"id": demo_id("task:practice"), "teacher_id": teacher_id, "created_by": teacher_id, "target_user_id": student_id, "session_id": session_id, "poem_id": demo_id("poem:jingyesi"), "poem_title": "静夜思", "title": "完成《静夜思》基础练习", "detail": "重点关注意象和情感题。", "task_config": {"question_count": 5, "types": ["memorization", "emotion"]}, "task_type": "practice", "status": "completed", "to": "演示学生", "due_date": day(1), "completed_at": now(-1), "updated_at": now()},
            {"id": demo_id("task:memory"), "teacher_id": teacher_id, "created_by": teacher_id, "target_user_id": student_id, "session_id": session_id, "poem_id": demo_id("poem:jingyesi"), "poem_title": "静夜思", "title": "背诵并默写《静夜思》", "detail": "明天课前完成一次自测。", "task_config": {"mode": "recite"}, "task_type": "memory", "status": "assigned", "to": "演示学生", "due_date": day(1), "updated_at": now()},
            {"id": demo_id("task:review"), "teacher_id": teacher_id, "created_by": teacher_id, "target_user_id": student_id, "session_id": session_id, "poem_id": demo_id("poem:dengguanquelou"), "poem_title": "登鹳雀楼", "title": "错题复盘：哲理题", "detail": "把错题解释改写成自己的话。", "task_config": {"focus": "appreciation"}, "task_type": "review", "status": "assigned", "to": "演示学生", "due_date": day(2), "updated_at": now()},
        ],
    )

    counts["poem_study_states"] = upsert(
        client,
        "poem_study_states",
        [
            {"id": demo_id("state:jingyesi"), "user_id": student_id, "poem_id": demo_id("poem:jingyesi"), "current_stage": "stage4", "stage1_completed_at": now(-5), "stage2_completed_at": now(-4), "stage3_completed_at": now(-2), "stage4_completed_at": now(-1), "fully_completed_at": now(-1), "last_accessed_at": now(), "session_count": 6, "updated_at": now()},
            {"id": demo_id("state:chunxiao"), "user_id": student_id, "poem_id": demo_id("poem:chunxiao"), "current_stage": "stage2", "stage1_completed_at": now(-3), "stage2_completed_at": now(-2), "last_accessed_at": now(-1), "session_count": 3, "updated_at": now()},
            {"id": demo_id("state:dengguanquelou"), "user_id": student_id, "poem_id": demo_id("poem:dengguanquelou"), "current_stage": "stage3", "stage1_completed_at": now(-4), "stage2_completed_at": now(-3), "stage3_completed_at": now(-1), "last_accessed_at": now(), "session_count": 4, "updated_at": now()},
        ],
        "user_id,poem_id",
    )

    q_jing_emotion = demo_id("question:jingyesi:emotion")
    q_deng_app = demo_id("question:dengguanquelou:appreciation")
    q_lushan = demo_id("question:wanglushanpubu:technique")
    counts["user_answers"] = upsert(
        client,
        "user_answers",
        [
            {"id": demo_id("answer:1"), "user_id": student_id, "question_id": demo_id("question:jingyesi:memorization"), "poem_id": demo_id("poem:jingyesi"), "question_type": "memorization", "user_answer": "低头思故乡", "is_correct": True, "time_spent": 18, "context": "practice", "created_at": now(-2)},
            {"id": demo_id("answer:2"), "user_id": student_id, "question_id": q_jing_emotion, "poem_id": demo_id("poem:jingyesi"), "question_type": "emotion", "user_answer": "思乡之情", "is_correct": True, "time_spent": 25, "context": "practice", "created_at": now(-2)},
            {"id": demo_id("answer:3"), "user_id": student_id, "question_id": q_deng_app, "poem_id": demo_id("poem:dengguanquelou"), "question_type": "appreciation", "user_answer": "及时行乐", "is_correct": False, "time_spent": 42, "context": "exam", "created_at": now(-1)},
            {"id": demo_id("answer:4"), "user_id": student_id, "question_id": q_lushan, "poem_id": demo_id("poem:wanglushanpubu"), "question_type": "technique", "user_answer": "比喻", "is_correct": False, "time_spent": 39, "context": "practice", "created_at": now(-1)},
        ],
    )
    counts["wrong_questions"] = upsert(
        client,
        "wrong_questions",
        [
            {"id": demo_id("wrong:dengguanquelou"), "user_id": student_id, "question_id": q_deng_app, "poem_title": "登鹳雀楼", "question_content": "“更上一层楼”常用来比喻什么？", "user_answer": "及时行乐", "correct_answer": "不断进取，拓展眼界", "explanation": "诗句由登楼望远引出进取哲理。", "error_type": "理解偏差", "status": "pending", "dynasty": "唐", "theme": "哲理", "question_kind": "objective", "keyword_tags": ["哲理", "登高"], "updated_at": now()},
            {"id": demo_id("wrong:lushan"), "user_id": student_id, "question_id": q_lushan, "poem_title": "望庐山瀑布", "question_content": "“飞流直下三千尺”主要运用了哪种手法？", "user_answer": "比喻", "correct_answer": "夸张", "explanation": "三千尺突出瀑布落差，属于夸张。", "error_type": "手法混淆", "status": "reviewed", "dynasty": "唐", "theme": "山水", "question_kind": "objective", "keyword_tags": ["夸张", "山水"], "updated_at": now()},
        ],
    )
    counts["weakness_profiles"] = upsert(
        client,
        "weakness_profiles",
        {"id": demo_id("weakness:student"), "user_id": student_id, "profile_json": {"weak_types": [{"type": "technique", "label": "表达手法", "accuracy": 58}, {"type": "appreciation", "label": "诗句赏析", "accuracy": 64}], "recommendations": ["复习夸张、比喻、借景抒情的区分", "赏析题按“画面-手法-情感”作答"]}, "updated_at": now()},
        "user_id",
    )
    counts["exam_records"] = upsert(
        client,
        "exam_records",
        {"id": demo_id("exam:student:1"), "user_id": student_id, "exam_type": "unit_demo", "total_score": 82, "max_score": 100, "answer_detail": [{"poem": "静夜思", "score": 24}, {"poem": "登鹳雀楼", "score": 18}, {"poem": "望庐山瀑布", "score": 16}], "created_at": now(-1)},
    )
    counts["practice_session_summaries"] = upsert(
        client,
        "practice_session_summaries",
        {"id": demo_id("summary:practice:1"), "user_id": student_id, "source": "practice", "topic": "静夜思", "summary": "完成 5 题，意象和情感题掌握较好，表达手法仍需巩固。", "attempts": 5, "correct": 4, "accuracy": 80, "weak_type": "technique", "type_stats": [{"type": "memorization", "correct": 2, "total": 2}, {"type": "emotion", "correct": 2, "total": 2}, {"type": "technique", "correct": 0, "total": 1}], "created_at": now(-1)},
    )
    counts["practice_question_feedback"] = upsert(
        client,
        "practice_question_feedback",
        {"id": demo_id("feedback:1"), "user_id": student_id, "topic": "望庐山瀑布", "question_type": "technique", "question_content": "“飞流直下三千尺”主要运用了哪种手法？", "options_json": ["夸张", "反衬", "借代", "双关"], "selected_index": 1, "correct_index": 0, "comment": "选项无误，学生反馈用于演示题目反馈流。", "source": "demo_seed", "updated_at": now()},
    )

    memory_id = demo_id("memory:jingyesi")
    counts["memory_reviews"] = upsert(
        client,
        "memory_reviews",
        {"id": memory_id, "user_id": student_id, "poem_id": demo_id("poem:jingyesi"), "status": "reviewing", "review_count": 4, "success_count": 3, "interval_days": 3, "ease_factor": 2.35, "due_date": day(), "last_reviewed_at": now(-1), "last_quality": 4, "updated_at": now()},
        "user_id,poem_id",
    )
    counts["memory_review_logs"] = upsert(
        client,
        "memory_review_logs",
        [
            {"id": demo_id("memory-log:1"), "user_id": student_id, "memory_review_id": memory_id, "poem_id": demo_id("poem:jingyesi"), "quality": 5, "is_correct": True, "mode": "self_check", "time_spent": 35, "created_at": now(-4)},
            {"id": demo_id("memory-log:2"), "user_id": student_id, "memory_review_id": memory_id, "poem_id": demo_id("poem:jingyesi"), "quality": 4, "is_correct": True, "mode": "dictation", "time_spent": 48, "created_at": now(-1)},
        ],
    )
    counts["poem_favorites"] = upsert(client, "poem_favorites", {"id": demo_id("favorite:jingyesi"), "user_id": student_id, "poem_id": demo_id("poem:jingyesi")}, "user_id,poem_id")
    counts["poem_notes"] = upsert(
        client,
        "poem_notes",
        {"id": demo_id("note:jingyesi"), "user_id": student_id, "poem_id": demo_id("poem:jingyesi"), "note": "月光像霜，动作从举头到低头，情感从看景转到思乡。", "updated_at": now()},
        "user_id,poem_id",
    )
    counts["review_plans"] = upsert(
        client,
        "review_plans",
        {"id": demo_id("review-plan:student"), "user_id": student_id, "exam_date": day(14), "plan_json": {"days": 14, "focus": ["静夜思默写", "山水诗手法", "错题二刷"], "daily_minutes": 20}, "created_at": now()},
    )
    counts["creations"] = upsert(
        client,
        "creations",
        {"id": demo_id("creation:student:1"), "user_id": student_id, "style": "仿写", "reference_poem": "静夜思", "mode": "imitate", "source_text": "以月夜思乡为主题仿写四句", "content": "窗外清辉满，阶前落叶凉。\n遥知千里客，此夜共思乡。", "feedback_json": {"score": 86, "comment": "意象清晰，尾句情感落点明确。"}, "is_public": True, "published_at": now(-1), "like_count": 1, "created_at": now(-1)},
    )
    if teacher_id != student_id:
        counts["creation_likes"] = upsert(
            client,
            "creation_likes",
            {"id": demo_id("creation-like:teacher"), "creation_id": demo_id("creation:student:1"), "user_id": teacher_id},
            "creation_id,user_id",
        )
    else:
        counts["creation_likes"] = 0

    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="扫描数据表并生成完整演示流程数据")
    parser.add_argument("--teacher-email", help="指定教师账号邮箱")
    parser.add_argument("--student-email", help="指定学生账号邮箱")
    parser.add_argument("--dry-run", action="store_true", help="只扫描和选择账号，不写入数据")
    args = parser.parse_args()

    client = create_client(require_env("SUPABASE_URL"), service_key())
    print("正在扫描数据表...")
    table_counts = scan_tables(client)
    for table, count in table_counts.items():
        print(f"  {table}: {count}")

    users = auth_users(client)
    if not users:
        raise RuntimeError("Supabase Auth 中没有用户。请先在前端注册/登录至少 1 个账号，建议准备老师和学生两个账号。")

    profile_rows = response_rows(client.table("user_profiles").select("id,role").execute())
    teacher = pick_user(users, args.teacher_email, profile_rows, "teacher")
    student = pick_user(users, args.student_email, profile_rows, "student")
    if teacher is None:
        teacher = users[0]
    if student is None:
        student = next((user for user in users if user["id"] != teacher["id"]), users[0])

    print("\n演示账号：")
    print(f"  teacher: {teacher.get('email') or teacher['id']}")
    print(f"  student: {student.get('email') or student['id']}")
    if teacher["id"] == student["id"]:
        print("  提示：当前只有一个账号，脚本会同时用于老师和学生；教师点赞数据会跳过。")

    if args.dry_run:
        print("\ndry-run 完成，未写入数据。")
        return 0

    print("\n正在生成演示数据...")
    counts = seed(client, teacher, student)
    for table, count in counts.items():
        print(f"  {table}: upsert {count}")

    print("\n完成。建议演示顺序：")
    print("  1. 学生账号进入 /learn 和 /explore 查看诗词与知识图谱")
    print("  2. 学生账号进入 /practice 完成练习，再看 /my-learning")
    print("  3. 学生账号进入 /create 查看公开作品")
    print("  4. 教师账号进入 /teacher 查看班级、课堂和任务")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"\n失败：{exc}", file=sys.stderr)
        raise SystemExit(1)
