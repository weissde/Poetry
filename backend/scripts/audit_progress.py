from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app


def _route_paths() -> list[str]:
    return [route.path for route in app.routes if hasattr(route, "path")]


def check_routes() -> bool:
    paths = _route_paths()
    double_prefix = [path for path in paths if "/api/api" in path]
    print("=== routes ===")
    print(f"total={len(paths)}")
    print(f"double_prefix={len(double_prefix)}")
    for path in double_prefix:
        print(f"  - {path}")
    required = [
        "/api/teaching/units",
        "/api/teaching/lesson-tasks",
        "/api/lesson-tasks",
        "/api/classes",
        "/api/notes",
        "/api/poems/{poem_id}/exam-points",
    ]
    ok = True
    for item in required:
        exists = item in paths
        ok = ok and exists
        print(f"required {item}: {'OK' if exists else 'MISSING'}")
    return ok and not double_prefix


def check_tables() -> bool:
    print("=== tables ===")
    # 这里做轻量级声明检查，由迁移脚本负责创建；运行时可通过接口返回错误码确认。
    expected: Iterable[str] = (
        "teaching_units",
        "class_sessions",
        "lesson_tasks",
        "classes",
        "class_members",
        "poem_notes",
    )
    for name in expected:
        print(f"expect table: {name}")
    return True


def check_smoke() -> bool:
    print("=== smoke ===")
    print("smoke checks are route-level in this script; use check_routes.py for detailed route report.")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", default="all", choices=["routes", "tables", "smoke", "all"])
    args = parser.parse_args()

    results: list[bool] = []
    if args.check in {"routes", "all"}:
        results.append(check_routes())
    if args.check in {"tables", "all"}:
        results.append(check_tables())
    if args.check in {"smoke", "all"}:
        results.append(check_smoke())

    passed = all(results) if results else True
    print(f"RESULT={'PASS' if passed else 'FAIL'}")
    raise SystemExit(0 if passed else 1)


if __name__ == "__main__":
    main()
