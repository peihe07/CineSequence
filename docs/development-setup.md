# Development Setup

> Last updated: 2026-03-30
> 涵蓋從零開始到本地跑起完整 stack 的所有步驟。

## Prerequisites

| 工具 | 最低版本 | 建議取得方式 |
|------|---------|------------|
| Node.js | 20+ | [nvm](https://github.com/nvm-sh/nvm)（專案根目錄有 `.nvmrc`） |
| Python | 3.12+ | [pyenv](https://github.com/pyenv/pyenv)（專案根目錄有 `.python-version`） |
| Docker | 任意近期版本 | Docker Desktop |

```bash
# 切到正確的 Node 版本
nvm use

# 確認 Python 版本（pyenv 會自動選取 .python-version）
python --version  # 應為 3.12.x
```

## 環境變數設定

```bash
cp .env.example .env
```

開啟 `.env`，填入以下必填值：

| 變數 | 說明 | 哪裡取得 |
|------|------|---------|
| `TMDB_API_KEY` | TMDB 電影資料 API | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| `GEMINI_API_KEY` | Gemini AI（pair 生成 + personality） | [Google AI Studio](https://aistudio.google.com/) |
| `RESEND_API_KEY` | 信件寄送 | [resend.com](https://resend.com/)（dev 模式可留空，信件會 log 到 console） |
| `JWT_SECRET` | Session 簽名 | 任意強亂數字串，例如 `openssl rand -hex 32` |
| `MAGIC_LINK_SECRET` | Magic link 簽名 | 同上，另取一組不同的字串 |

以下在本地開發時可保留預設值：

```env
DATABASE_URL=postgresql+asyncpg://dev:dev@localhost:5432/cinesequence
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=http://localhost:8000
ENVIRONMENT=development
```

R2 Storage（`S3_*` 相關變數）在本地開發時可留空，上傳 avatar / ticket image 功能會 fail，但其餘功能不受影響。

## 三種啟動方式

### 方式一：完整 Docker（最快）

```bash
npm run docker:dev
# 等同於：docker compose up --build
```

啟動的服務：

| 服務 | Port |
|------|------|
| Frontend (Next.js) | 3000 |
| Backend (FastAPI) | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Celery Worker | — |
| Celery Beat | — |
| Prometheus | 9090 |
| Grafana | 3001 |

> **注意**：第一次啟動會自動跑 `alembic upgrade head`，之後每次 backend 啟動也會跑。不需要手動跑 migration。

### 方式二：DB 用 Docker，Backend + Frontend 本地跑

適合需要快速 reload 或 debug 的情況。

```bash
# 1. 啟動基礎設施
docker compose up postgres redis -d

# 2. Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # 第一次或有新 migration 時跑
uvicorn app.main:app --reload
# 或用 root 指令：
npm run dev:backend           # 會自動跑 alembic upgrade head

# 3. Frontend（另開 terminal）
cd frontend
npm install
npm run dev
# 或用 root 指令：
npm run dev:frontend
```

### 方式三：只跑部分服務

只測 backend 時：

```bash
docker compose up postgres redis -d
npm run dev:backend
```

只測 frontend 時（backend 必須已在跑）：

```bash
npm run dev:frontend
```

## 服務位址

| 服務 | URL |
|------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Backend Swagger UI | http://localhost:8000/docs |
| Backend ReDoc | http://localhost:8000/redoc |
| Grafana | http://localhost:3001（admin / admin） |
| Prometheus | http://localhost:9090 |

## 常用指令

### 驗證腳本

```bash
# 電影池 tag 驗證
npm run validate:movie-pool
node scripts/validate_movie_pool.js   # 同上

# Phase 1 pair 驗證
npm run validate:phase1-pairs
node scripts/validate_phase1_pairs.js  # 同上
```

### 測試

```bash
# Backend 快速 unit tests（不需要 DB）
npm run test:backend:unit

# Backend 完整測試（需要 local Postgres）
npm run test:backend

# Backend integration tests 單獨跑
npm run test:backend:integration

# Backend security/regression suite
npm run test:backend:security

# Smoke check（確認 backend 啟動正常）
npm run smoke:backend

# Frontend typecheck
npm run typecheck:frontend
```

### Migration

```bash
cd backend
source .venv/bin/activate

# 查看目前 migration 狀態
alembic current

# 套用所有待跑的 migration
alembic upgrade head

# 建立新的 migration（改 model 後）
alembic revision --autogenerate -m "your message"
```

### Celery

```bash
cd backend
source .venv/bin/activate

# 手動啟動 worker
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2

# 手動啟動 beat（定時任務）
celery -A app.tasks.celery_app beat --loglevel=info
```

## 資料與重置

### 重置本地 DB

```bash
docker compose down -v          # 移除 postgres volume
docker compose up postgres -d   # 重新啟動
npm run dev:backend              # 會自動跑 alembic upgrade head
```

### Backfill 缺少的 ticket URL

```bash
cd backend
.venv/bin/python scripts/backfill_personal_tickets.py

# 強制重建所有 ticket（謹慎使用）
.venv/bin/python scripts/backfill_personal_tickets.py --force
```

## 常見問題

### `alembic upgrade head` 報錯

通常是 `DATABASE_URL` 指向的 DB 未啟動。確認 Docker postgres 已 healthy：

```bash
docker compose ps
```

### `TMDB_API_KEY not set` 警告

部分功能（seed movie search、pair generation）依賴 TMDB。在 `.env` 填入有效的 API key 即可。

### Gemini API 返回錯誤

Phase 2-3 pair generation 與 personality reading 都依賴 Gemini 2.5 Flash。確認 `GEMINI_API_KEY` 有效，且 quota 未超限。

### Frontend 無法連到 Backend

確認 `.env` 的 `API_PROXY_TARGET=http://localhost:8000` 設定正確，以及 backend 實際在 8000 port 跑起來了。
