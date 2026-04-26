# 文档归档说明

- frontend/
  - 01_功能规格文档_前端参考.md
  - 02_前端UI设计文档.md
- backend/
  - 01_功能规格文档_后端参考.md
  - 03_技术框架文档.md
  - 04_api_openapi_refactor_2026-04-23.md
- competition/
  - 01_教学设计文档.md
  - 02_课堂演示流程稿.md
  - 03_作品亮点说明稿.md
  - 04_教学案例文档_静夜思.md
- 执行文档
  - 功能补齐执行计划_2026-03-31.md
  - 诗词数据规模补齐执行指南_2026-04-01.md

说明：当前为“复制归档”，原始文档仍保留在项目根目录，避免影响现有引用。

新增说明：
- `competition/` 目录用于收纳与竞赛展示直接相关的教学材料，可直接转为 PDF 使用。
- 上述文档以 `yy.docx` 的重构边界为准，内容默认只描述当前系统已实现或已完成重构包装的能力。

自动审计：
- 在项目根目录执行 `npm run audit:progress`，会输出：
  - `docs/项目功能完成度审计_YYYY-MM-DD.md`
  - `logs/progress-audit-YYYYMMDD-HHMMSS.json`
- 在项目根目录执行 `npm run audit:runtime`，会输出：
  - `docs/运行时验收审计_YYYY-MM-DD.md`
  - `logs/runtime-audit-YYYYMMDD-HHMMSS.json`
  - 并附带考试模板专项质量指标：`模板命中率`、`主观题目标达成率`
- 在项目根目录执行 `npm run audit:all`，会自动串联两者并输出：
  - `docs/综合审计报告_YYYY-MM-DD.md`
  - `logs/audit-all-YYYYMMDD-HHMMSS.json`
- 在项目根目录执行 `npm run audit:all:auth`，会优先从 `backend/.env`（以及可选的 `ProfileEnvPath`）读取鉴权变量后再执行综合审计。
