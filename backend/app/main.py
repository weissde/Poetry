from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from .api.ai_api import router as ai_router
from .api.classes_api import router as classes_router
from .api.create_api import router as create_router
from .api.exam_api import router as exam_router
from .api.graph_api import router as graph_router
from .api.lesson_task_api import router as lesson_task_router
from .api.memory_api import router as memory_router
from .api.notes_api import router as notes_router
from .api.poems_api import router as poems_router
from .api.practice_api import router as practice_router
from .api.review_plan_api import router as review_plan_router
from .api.system_api import router as system_router
from .api.teaching_api import router as teaching_router
from .api.user_api import router as user_router
from .api.weakness_api import router as weakness_router
from .api.wrongbook_api import router as wrongbook_router
from .config import get_settings
from .middleware import TraceMiddleware
from .response import fail

settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
)
logger = logging.getLogger('poetry_ai.api')
app = FastAPI(title=settings.app_name, debug=settings.app_debug)

app.add_middleware(TraceMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.add_middleware(GZipMiddleware, minimum_size=600)

app.include_router(review_plan_router)
app.include_router(teaching_router)
app.include_router(user_router)
app.include_router(lesson_task_router)
app.include_router(classes_router)
app.include_router(notes_router)
app.include_router(create_router)
app.include_router(exam_router)
app.include_router(ai_router)
app.include_router(graph_router)
app.include_router(memory_router)
app.include_router(poems_router)
app.include_router(practice_router)
app.include_router(weakness_router)
app.include_router(wrongbook_router)
app.include_router(system_router)


def trace_id(request: Request) -> str | None:
    return getattr(request.state, 'trace_id', None)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception('unhandled_exception path=%s trace_id=%s', request.url.path, trace_id(request))
    message = str(exc) if settings.app_debug else 'Internal server error. Please try again later.'
    return JSONResponse(status_code=500, content=fail(message, trace_id(request), code=5000))


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    status = int(exc.status_code or 400)
    detail = exc.detail
    message = str(detail) if detail is not None else 'Request failed'
    code = status * 10
    if status >= 500:
        logger.error(
            'http_exception status=%s path=%s trace_id=%s detail=%s',
            status,
            request.url.path,
            trace_id(request),
            message,
        )
    return JSONResponse(status_code=status, content=fail(message, trace_id(request), code=code))


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=fail(
            'Invalid request parameters. Please check the payload and retry.',
            trace_id(request),
            code=4220,
            data={'errors': exc.errors()},
        ),
    )
