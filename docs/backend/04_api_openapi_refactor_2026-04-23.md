# 后端 API 文档补充（2026-04-23）

本文件记录设计系统重构阶段的后端接口补充与兼容约定。

## OpenAPI

- 运行后端后可直接访问：
  - `GET /openapi.json`：OpenAPI Schema
  - `GET /docs`：Swagger UI
  - `GET /redoc`：ReDoc

## 新增/扩展接口

### Teaching

- `GET /api/teaching/units`
- `GET /api/teaching/units/{unit_id}`
- `GET /api/teaching/objectives?poemId=...`
- `GET /api/teaching/objectives?poem_id=...`（兼容参数）
- `GET /api/teaching/sessions/latest`
- `POST /api/teaching/sessions`
- `PATCH /api/teaching/sessions/{session_id}/advance-step`
- `PATCH /api/teaching/sessions/{session_id}/end`
- `GET /api/teaching/lesson-tasks`
- `POST /api/teaching/lesson-tasks`

### User

- `GET /api/user/summary`
- `GET /api/user/today-tasks`
- `GET /api/user/learning-summary`
- `GET /api/user/coverage`
- `GET /api/user/role`
- `PATCH /api/user/role`

### Poems

- `GET /api/poems/{poem_id}/exam-points`
  - 数据优先级：`poems.exam_points -> analysis_cache(model=exam) -> teaching_objectives -> heuristic`
  - 兼容返回字段：
    - camelCase: `poemId`, `poemTitle`, `examPoints`
    - snake_case: `poem_id`, `poem_title`, `exam_points`

### Practice

- `POST /api/practice/answers`
  - 写入 `user_answers`
  - 后台异步触发 weakness profile 更新（不阻塞主响应）

### Wrongbook

- `GET /api/wrongbook/trend?interval=daily|weekly&days=...`

### AI

- `POST /api/ai/learning-report`（SSE 流式）

## 迁移依赖

- `016_teaching_units.sql`
- `017_class_sessions.sql`
- `018_poems_teaching_fields.sql`
- `019_user_role.sql`
- `020_lesson_tasks.sql`
- `021_wrongquestions_question_id.sql`

## 备注

- 所有接口统一返回 `ok()/fail()` 包装结构：
  - `code`, `message`, `data`, `traceId`
