# Poetry AI Frontend (React + Vite)

## Quick Start

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

## Environment

1. 复制 `.env.example` 为 `.env.local`
2. 至少配置以下变量：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_TIMEOUT_MS=12000
```

## Notes

- 前端不会保存豆包或其他 AI 私钥。
- 默认通过 `VITE_API_BASE_URL` 访问后端 `/api/*`。
