from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path
from typing import Any, Iterable

VALID_GRADES = {"primary", "middle", "high"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build chunked Supabase seed SQL files from poem datasets (JSON/JSONL/CSV)."
    )
    parser.add_argument("--input", required=True, help="Source file path (.json/.jsonl/.csv)")
    parser.add_argument(
        "--output-dir",
        default="backend/supabase/seeds/generated",
        help="Directory for generated SQL files",
    )
    parser.add_argument("--chunk-size", type=int, default=500, help="Rows per SQL file")
    parser.add_argument("--prefix", default="poems_bulk", help="Output filename prefix")
    parser.add_argument(
        "--min-target",
        type=int,
        default=3000,
        help="Warn when normalized row count is below this number",
    )
    return parser.parse_args()


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def norm_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r", "\n").strip()
    return text


def parse_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [norm_text(item) for item in value if norm_text(item)]
    text = norm_text(value)
    if not text:
        return []
    splitter = ","
    if "，" in text:
        splitter = "，"
    return [item.strip() for item in text.split(splitter) if item.strip()]


def normalize_grade_levels(value: Any) -> list[str]:
    raw_items = parse_list(value)
    mapped: list[str] = []
    for item in raw_items:
        key = item.lower()
        if key in VALID_GRADES:
            mapped.append(key)
            continue
        if any(token in item for token in ["小学", "primary", "小"]):
            mapped.append("primary")
        elif any(token in item for token in ["初中", "middle", "中"]):
            mapped.append("middle")
        elif any(token in item for token in ["高中", "high", "高"]):
            mapped.append("high")
    deduped = []
    seen = set()
    for item in mapped:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped


def pick(record: dict[str, Any], keys: Iterable[str]) -> Any:
    for key in keys:
        if key in record:
            return record[key]
    return None


def normalize_record(record: dict[str, Any]) -> dict[str, Any] | None:
    title = norm_text(pick(record, ["title", "poem_title", "name"]))
    author = norm_text(pick(record, ["author", "poet", "writer"]))
    dynasty = norm_text(pick(record, ["dynasty", "era", "period"])) or "未知"
    content = norm_text(pick(record, ["content", "poem", "text", "body"]))
    tags = parse_list(pick(record, ["tags", "tag_list", "category"]))
    grade_level = normalize_grade_levels(pick(record, ["grade_level", "grade", "grades", "school_stage"]))

    if not (title and author and content):
        return None

    return {
        "title": title,
        "author": author,
        "dynasty": dynasty,
        "content": content,
        "tags": tags,
        "grade_level": grade_level,
    }


def read_source(path: Path) -> list[dict[str, Any]]:
    suffix = path.suffix.lower()
    text = path.read_text(encoding="utf-8-sig")
    if suffix == ".json":
        payload = json.loads(text)
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]
        if isinstance(payload, dict):
            for key in ["items", "data", "rows", "poems"]:
                obj = payload.get(key)
                if isinstance(obj, list):
                    return [item for item in obj if isinstance(item, dict)]
        raise ValueError("Unsupported JSON structure. Expect list or object with items/data/rows/poems.")

    if suffix == ".jsonl":
        rows: list[dict[str, Any]] = []
        for line in text.splitlines():
            text = line.strip()
            if not text:
                continue
            obj = json.loads(text)
            if isinstance(obj, dict):
                rows.append(obj)
        return rows

    if suffix == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            return [dict(row) for row in reader]

    raise ValueError(f"Unsupported input format: {path.suffix}")


def to_array_sql(items: list[str]) -> str:
    if not items:
        return "array[]::text[]"
    return "array[" + ", ".join(sql_literal(item) for item in items) + "]"


def build_insert_sql(rows: list[dict[str, Any]]) -> str:
    values_sql = []
    for row in rows:
        values_sql.append(
            "(" + ", ".join([
                sql_literal(row["title"]),
                sql_literal(row["author"]),
                sql_literal(row["dynasty"]),
                sql_literal(row["content"]),
                to_array_sql(row["tags"]),
                to_array_sql(row["grade_level"]),
            ]) + ")"
        )

    return (
        "insert into poems (title, author, dynasty, content, tags, grade_level)\n"
        "select *\n"
        "from (\n"
        "  values\n    "
        + ",\n    ".join(values_sql)
        + "\n"
        ") as v(title, author, dynasty, content, tags, grade_level)\n"
        "where not exists (\n"
        "  select 1\n"
        "  from poems p\n"
        "  where p.title = v.title\n"
        "    and p.author = v.author\n"
        "    and p.content = v.content\n"
        ");\n"
    )


def write_sql_files(rows: list[dict[str, Any]], output_dir: Path, chunk_size: int, prefix: str) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    total_chunks = max(1, math.ceil(len(rows) / chunk_size))
    files: list[Path] = []

    for index in range(total_chunks):
        start = index * chunk_size
        chunk = rows[start : start + chunk_size]
        chunk_no = index + 1
        target = output_dir / f"{prefix}_{chunk_no:03d}.sql"
        sql = "-- Auto-generated by scripts/build-poem-seeds.py\n" + build_insert_sql(chunk)
        target.write_text(sql, encoding="utf-8")
        files.append(target)

    return files


def main() -> None:
    args = parse_args()
    source = Path(args.input)
    if not source.exists():
        raise FileNotFoundError(f"Source not found: {source}")

    raw_rows = read_source(source)
    normalized: list[dict[str, Any]] = []
    seen = set()
    for row in raw_rows:
        item = normalize_record(row)
        if not item:
            continue
        dedupe_key = (item["title"], item["author"], item["content"])
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        normalized.append(item)

    if not normalized:
        raise RuntimeError("No valid rows after normalization.")

    output_dir = Path(args.output_dir)
    files = write_sql_files(normalized, output_dir, max(1, args.chunk_size), args.prefix)

    manifest = {
        "source": str(source),
        "total_raw": len(raw_rows),
        "total_normalized": len(normalized),
        "chunk_size": args.chunk_size,
        "chunk_count": len(files),
        "files": [str(path) for path in files],
    }
    manifest_path = output_dir / f"{args.prefix}_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Source rows: {len(raw_rows)}")
    print(f"Normalized rows: {len(normalized)}")
    print(f"Chunks: {len(files)}")
    print(f"Manifest: {manifest_path}")

    if len(normalized) < args.min_target:
        print(
            f"WARNING: normalized row count ({len(normalized)}) is below target ({args.min_target}). "
            "Please merge additional datasets before import."
        )


if __name__ == "__main__":
    main()
