# Production Deployment Guide

> Last updated: 2026-03-30
> 對應 ADR-016（Cloudflare Workers + Railway 架構）

## 架構概覽

```
使用者瀏覽器
    │
    ▼
cinesequence.xyz (Cloudflare Workers)
    │  /api/* 同源代理
    ▼
Railway Backend (FastAPI + Celery)
    │
    ├── Railway PostgreSQL (pgvector)
    └── Railway Redis
```

- **Frontend**：Cloudflare Workers（需要 Next.js middleware 與 runtime rewrite）
- **Backend**：Railway（`railway.json` 設定自動 deploy）
- **DB / Redis / Celery**：Railway internal services
- **Storage**：Cloudflare R2（avatars、ticket images）
- **Email**：Resend

## Backend 部署（Railway）

### 首次設定

1. 在 Railway 建立新專案，加入以下 services：
   - **Backend**（從 GitHub repo deploy，`railway.json` 會自動指向 `docker/backend/Dockerfile`）
   - **PostgreSQL**（Railway template，需啟用 pgvector extension）
   - **Redis**（Railway template）

2. 在 Railway Backend service 設定 Environment Variables，參考 `.env.production.example`：

   | 變數 | 說明 |
   |------|------|
   | `DATABASE_URL` | Railway PostgreSQL internal URL |
   | `REDIS_URL` | Railway Redis internal URL |
   | `CELERY_BROKER_URL` | `redis://<internal>/1` |
   | `CELERY_RESULT_BACKEND` | `redis://<internal>/2` |
   | `TMDB_API_KEY` | TMDB API |
   | `GEMINI_API_KEY` | Gemini AI |
   | `RESEND_API_KEY` | Resend Email |
   | `JWT_SECRET` | 強亂數字串（`openssl rand -hex 32`） |
   | `MAGIC_LINK_SECRET` | 另一組強亂數字串 |
   | `AUTH_COOKIE_SAMESITE` | `none` |
   | `AUTH_COOKIE_SECURE` | `true` |
   | `AUTH_COOKIE_DOMAIN` | `.cinesequence.xyz` |
   | `FRONTEND_URL` | `https://cinesequence.xyz` |
   | `S3_BUCKET` / `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_PUBLIC_URL` | Cloudflare R2 |
   | `ENVIRONMENT` | `production` |

3. 啟用 pgvector：在 Railway PostgreSQL 的 Query 介面執行：

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

4. 確認 `railway.json` 中的 `watchPatterns` 只包含 backend 相關路徑，避免 frontend 改動觸發 backend redeploy。

### 後續部署

推送到 `main` branch 後，Railway 會依照 `railway.json` 自動 build 並 deploy。

Backend Dockerfile 啟動前會自動跑 `alembic upgrade head`，不需手動處理 migration。

### Celery Worker / Beat

Railway 目前只能部署單一服務進程。Celery worker 與 beat 需要額外設定：

- **選項 A**：在 Railway 建立兩個額外 service，用相同的 Dockerfile，覆寫 `CMD` 為：
  - Worker：`celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2`
  - Beat：`celery -A app.tasks.celery_app beat --loglevel=info`
- **選項 B**：在 backend 主進程啟動時同時啟動 worker（簡化部署，但失去隔離性）

## Frontend 部署（Cloudflare Workers）

### 前置條件

- Cloudflare 帳號，綁定 `cinesequence.xyz` domain
- `wrangler` CLI 已安裝

```bash
npm install -g wrangler
wrangler login
```

### 部署步驟

```bash
cd frontend

# 建立 production build
npm run build

# Deploy 到 Cloudflare Workers
wrangler deploy
```

> Workers 部署需要 `wrangler.toml`（或 `wrangler.json`），設定 `name`、`main`、`compatibility_date` 與 route。目前設定請參考 `frontend/` 目錄。

### Same-origin API Proxy

Frontend 的 Next.js config 需將 `/api/*` rewrites 到後端 Railway origin：

```js
// frontend/next.config.js（簡化示意）
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.API_PROXY_TARGET}/:path*`,
    },
  ]
}
```

`API_PROXY_TARGET` 在 production 設定為 Railway backend 的 public URL。

### Cookie 設定

Production 環境 frontend (`cinesequence.xyz`) 與 backend (Railway) 屬於跨站，所以必須：

```env
AUTH_COOKIE_SAMESITE=none
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_DOMAIN=.cinesequence.xyz
```

若未來 frontend 與 backend 移到同一個 parent domain，可改回：

```env
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_SECURE=true
```

## CI/CD

GitHub Actions（`.github/workflows/ci.yml`）在 push 到 `main` 或 PR 時自動執行：

| Job | 步驟 |
|-----|------|
| frontend | lint → typecheck → unit tests → build |
| backend | lint (ruff) → alembic upgrade → seed groups → pytest |

CI job 使用真實 PostgreSQL + pgvector + Redis，所以 integration tests 也會在 CI 跑。

## 驗證建議

部署完成後執行：

```bash
# 從本地打 production backend
npm run smoke:backend  # 需先設 BASE_URL
BASE_URL=https://your-railway-backend.up.railway.app npm run smoke:backend
```

詳細驗證步驟請看 `docs/deployment-checklist.md`。
