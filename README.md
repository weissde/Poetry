# Poetry AI（诗境通）

## 项目结构

- `backend/`：FastAPI 后端 + Supabase SQL
- `frontend/`：React + Vite 前端
- `docs/`：需求、技术与进度文档
- `scripts/`：Windows 启动/停止/健康检查脚本

## 默认端口（已统一）

- 后端 API：`http://127.0.0.1:8000`
- 前端页面：`http://127.0.0.1:5173`

## 快速启动（推荐）

在项目根目录执行：

```powershell
npm run dev
```

这条命令会并行拉起前后端，并把日志写入 `logs/`。

## 常用命令

```powershell
# 启动后端（单独）
npm run dev:backend

# 启动前端（单独）
npm run dev:frontend

# 停止 npm run dev 拉起的进程
npm run dev:stop

# 后端健康检查 + 诗词检索冒烟
npm run health

# 关键接口耗时巡检（生成 logs/api-latency-report-*.json）
npm run profile:api

# 关键链路冒烟验收（生成 logs/api-smoke-report-*.json）
npm run smoke:api
```

## 环境变量

- 后端模板：`backend/.env.example`（复制为 `backend/.env`）
- 前端模板：`frontend/.env.example`（复制为 `frontend/.env.local`）

注意：前端仅保存 Supabase 与后端 API 地址，不保存 AI 私钥。

## 接口耗时巡检说明

- `npm run profile:api` 默认巡检公共接口 + 受保护接口（无 token 时会自动跳过受保护接口）。
- 若需要包含登录态接口，请先设置环境变量再执行：

```powershell
$env:PROFILE_BEARER_TOKEN = "你的 access token"
npm run profile:api
```

## 冒烟验收说明

- `npm run smoke:api` 会按关键链路执行一轮 API 验收，失败步骤会返回非 0 退出码。
- 默认会跳过需要登录态的接口（若未提供 token）。
- 若你希望“必须包含登录态接口”，可使用：

```powershell
$env:PROFILE_BEARER_TOKEN = "你的 access token"
powershell -ExecutionPolicy Bypass -File scripts/smoke-api.ps1 -RequireAuth
```

- 也可用“邮箱密码自动换 token”模式（无需手动复制 access token）：

```powershell
$env:PROFILE_SUPABASE_URL = "https://你的项目.supabase.co"
$env:PROFILE_SUPABASE_ANON_KEY = "你的 anon key"
$env:PROFILE_EMAIL = "你的登录邮箱"
$env:PROFILE_PASSWORD = "你的登录密码"
powershell -ExecutionPolicy Bypass -File scripts/smoke-api.ps1 -RequireAuth
```
