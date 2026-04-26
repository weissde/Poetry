# Poetry AI Backend (FastAPI)

## Quick Start

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## API Base

- `http://127.0.0.1:8000/api`

## Notes

- 必须在 `backend/.env` 中配置 Supabase 与 AI 网关参数。
- 前端只调用后端 API，AI 请求统一由后端代理。
- 若从项目根目录启动，推荐直接使用 `npm run dev:backend`。
