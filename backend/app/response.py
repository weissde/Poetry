from __future__ import annotations

from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar('T')


class ApiResponse(BaseModel, Generic[T]):
    code: int = 0
    message: str = 'ok'
    data: T | None = None
    traceId: str | None = None


def ok(data: T | None = None, trace_id: str | None = None, message: str = 'ok') -> dict:
    return ApiResponse[T](code=0, message=message, data=data, traceId=trace_id).model_dump()


def fail(message: str, trace_id: str | None = None, code: int = 1, data: dict | None = None) -> dict:
    return ApiResponse[dict | None](code=code, message=message, data=data, traceId=trace_id).model_dump()
