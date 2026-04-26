from __future__ import annotations

from collections import Counter
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app


def main() -> None:
    paths = [route.path for route in app.routes if hasattr(route, "path")]
    method_paths = [
        f"{','.join(sorted(getattr(route, 'methods', []) or []))} {route.path}"
        for route in app.routes
        if hasattr(route, "path")
    ]
    methods = set(method_paths)
    duplicate_method_paths = [key for key, count in Counter(method_paths).items() if count > 1]
    double_prefix = [path for path in paths if "/api/api" in path]

    print(f"TOTAL_ROUTES={len(paths)}")
    print(f"DOUBLE_PREFIX={len(double_prefix)}")
    for path in double_prefix:
        print(f"[DOUBLE_PREFIX] {path}")

    print(f"DUPLICATE_METHOD_PATHS={len(duplicate_method_paths)}")
    for key in duplicate_method_paths:
        print(f"[DUPLICATE] {key}")

    required = [
        "/api/teaching/lesson-tasks",
        "/api/lesson-tasks",
        "/api/ai/chat/stream",
        "/api/classes",
        "/api/notes",
        "/api/poems/{poem_id}/exam-points",
    ]
    for item in required:
        matched = any(item == path for path in paths)
        print(f"[REQUIRED] {item} -> {'OK' if matched else 'MISSING'}")

    print(f"UNIQUE_METHOD_PATHS={len(methods)}")


if __name__ == "__main__":
    main()
