from __future__ import annotations

import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings

logger = logging.getLogger('poetry_ai.request')


class TraceMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        settings = get_settings()
        self.slow_request_threshold_ms = max(1, int(settings.slow_request_threshold_ms))
        self.exclude_paths = {item.strip() for item in settings.request_log_exclude_paths.split(',') if item.strip()}

    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get('x-trace-id') or str(uuid.uuid4())
        request.state.trace_id = trace_id
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = int((time.perf_counter() - start) * 1000)
            logger.exception(
                'request_exception method=%s path=%s query=%s duration_ms=%s trace_id=%s',
                request.method,
                request.url.path,
                request.url.query,
                duration_ms,
                trace_id,
            )
            raise

        duration_ms = int((time.perf_counter() - start) * 1000)
        response.headers['x-trace-id'] = trace_id
        response.headers['x-duration-ms'] = str(duration_ms)

        path = request.url.path
        if path not in self.exclude_paths:
            status_code = response.status_code
            if status_code >= 500:
                logger.error(
                    'request_failed method=%s path=%s query=%s status=%s duration_ms=%s trace_id=%s',
                    request.method,
                    path,
                    request.url.query,
                    status_code,
                    duration_ms,
                    trace_id,
                )
            elif duration_ms >= self.slow_request_threshold_ms:
                logger.warning(
                    'request_slow method=%s path=%s query=%s status=%s duration_ms=%s threshold_ms=%s trace_id=%s',
                    request.method,
                    path,
                    request.url.query,
                    status_code,
                    duration_ms,
                    self.slow_request_threshold_ms,
                    trace_id,
                )

        return response
