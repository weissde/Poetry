from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from ..auth import CurrentUser, get_current_user
from ..response import fail, ok
from ..schemas import NoteCreateRequest, NoteUpdateRequest
from ..supabase_client import get_supabase_admin

router = APIRouter(prefix="/api/notes", tags=["notes"])


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


def _norm_text(value: Any) -> str:
    return str(value or "").strip()


def _notes_table_error(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=fail(
            "poem notes table is not ready. Please run migration 006_poem_favorites_notes.sql first.",
            _trace_id(request),
            code=5318,
        ),
    )


def _note_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _norm_text(row.get("id")),
        "poemId": _norm_text(row.get("poem_id")),
        "note": _norm_text(row.get("note")),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


@router.get("")
async def notes_list(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    poemId: str = Query(default=""),
):
    client = get_supabase_admin()
    try:
        query = client.table("poem_notes").select("id,poem_id,note,created_at,updated_at").eq("user_id", user.id)
        poem_id = _norm_text(poemId)
        if poem_id:
            query = query.eq("poem_id", poem_id)
        rows = query.order("updated_at", desc=True).limit(500).execute().data or []
    except Exception:
        return _notes_table_error(request)
    return ok({"items": [_note_payload(row) for row in rows if isinstance(row, dict)]}, _trace_id(request))


@router.post("")
async def notes_create(
    payload: NoteCreateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    try:
        result = (
            client.table("poem_notes")
            .upsert(
                {
                    "user_id": user.id,
                    "poem_id": _norm_text(payload.poemId),
                    "note": _norm_text(payload.note),
                    "updated_at": now,
                },
                on_conflict="user_id,poem_id",
            )
            .execute()
        )
        row = (result.data or [None])[0]
    except Exception:
        return _notes_table_error(request)
    return ok({"item": _note_payload(row if isinstance(row, dict) else {})}, _trace_id(request))


@router.put("/{note_id}")
async def notes_update(
    note_id: str,
    payload: NoteUpdateRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    client = get_supabase_admin()
    try:
        existing = (
            client.table("poem_notes")
            .select("id")
            .eq("id", note_id)
            .eq("user_id", user.id)
            .limit(1)
            .execute()
        )
        if not (existing.data or []):
            raise HTTPException(status_code=404, detail="Note not found")
        result = (
            client.table("poem_notes")
            .update(
                {
                    "note": _norm_text(payload.note),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", note_id)
            .eq("user_id", user.id)
            .execute()
        )
        row = (result.data or [None])[0]
    except HTTPException:
        raise
    except Exception:
        return _notes_table_error(request)
    return ok({"item": _note_payload(row if isinstance(row, dict) else {})}, _trace_id(request))


@router.delete("/{note_id}")
async def notes_delete(note_id: str, request: Request, user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_admin()
    try:
        client.table("poem_notes").delete().eq("id", note_id).eq("user_id", user.id).execute()
    except Exception:
        return _notes_table_error(request)
    return ok({"deleted": True, "noteId": note_id}, _trace_id(request))

