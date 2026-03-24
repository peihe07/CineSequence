# Cloudflare Workers + Railway 實作設定清單

這份是照平台操作順序整理的版本。

目標結果：

- 前端：`https://cinesequence.xyz`
- 後端：`https://api.cinesequence.xyz`
- 前端請求：`/api/*`
- Next runtime 代理到 Railway backend
- auth cookie domain：`.cinesequence.xyz`

## 0. 先做安全處理

你目前 repo 內的正式 env 有真實 secrets，這件事要先處理。

先做：

1. 旋轉這些正式金鑰
2. 把新金鑰改存到 Railway / Cloudflare 平台環境變數
3. 不再把正式 secrets 留在 repo

至少要 rotate：

- `JWT_SECRET`
- `MAGIC_LINK_SECRET`
- `TMDB_API_KEY`
- `GEMINI_API_KEY`
- `RESEND_API_KEY`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- DB / Redis credentials

## 1. Railway 後端設定

### 1.1 綁定 custom domain

在 Railway backend service：

1. 進到 backend service
2. 打開 `Settings`
3. 找 `Networking`
4. 在 `Public Networking` 新增 custom domain
5. 填入：`api.cinesequence.xyz`
6. Railway 會提供一筆 DNS 記錄

先不要關頁，下一步要去 Cloudflare DNS 加那筆記錄。

### 1.2 Railway 環境變數

在 backend service 設這些值：

```env
FRONTEND_URL=https://cinesequence.xyz
API_URL=https://api.cinesequence.xyz
AUTH_COOKIE_DOMAIN=.cinesequence.xyz
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_SECURE=true
```

其他原本就要有的 production env 也確認：

```env
DATABASE_URL=...
REDIS_URL=...
JWT_SECRET=...
MAGIC_LINK_SECRET=...
TMDB_API_KEY=...
GEMINI_API_KEY=...
RESEND_API_KEY=...
S3_BUCKET=...
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_PUBLIC_URL=...
ENVIRONMENT=production
ADMIN_EMAILS=...
```

### 1.3 部署後確認

部署完成後確認：

1. Railway logs 沒有 migration error
2. `https://api.cinesequence.xyz/health` 可開
3. `https://api.cinesequence.xyz/readiness` 回 `200`

## 2. Cloudflare DNS 設定

在 Cloudflare DNS：

### 2.1 API 子網域

新增 Railway 要求的那筆記錄。

通常會是：

- Type: `CNAME`
- Name: `api`
- Target: Railway 提供的 `xxxxx.up.railway.app`

Proxy 狀態：

- 先用 `DNS only` 也可以
- 若之後確定沒問題，再決定是否要橘雲代理

### 2.2 前端主網域

把 `cinesequence.xyz` 指到你的 Cloudflare Workers / Pages 專案綁定方式。

如果是 Cloudflare 自家前端託管，通常 Cloudflare 會引導完成，不需要你自己手填很多 DNS。

## 3. Cloudflare 前端部署方式

這次建議不要再用純 Pages static。

建議方向：

- 用 Cloudflare Workers 部署 Next.js runtime

原因：

- 現在專案用了 Next `middleware`
- 也用了 `/api/*` rewrite/proxy
- 這需要 runtime，不適合 static export

## 4. Cloudflare 前端環境變數

在前端部署平台設：

```env
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=https://api.cinesequence.xyz
AUTH_COOKIE_NAME=cine_sequence_session
ENVIRONMENT=production
```

重點：

- `NEXT_PUBLIC_API_URL` 必須是 `/api`
- 不是直接填 Railway URL
- `API_PROXY_TARGET` 才是真正 backend 位址

## 5. 前端部署前確認

確認 repo 目前已經有：

- `frontend/middleware.ts`
- `frontend/next.config.ts`
- `frontend/lib/api.ts`

以及 Docker 方向也已補：

- `docker/frontend/Dockerfile`
- `docker-compose.prod.yml`

這表示程式碼本身已經準備好，現在缺的是平台接線。

## 6. 實測流程

部署完成後，照這個順序測：

### 6.1 未登入保護

1. 直接開 `https://cinesequence.xyz/profile`
2. 應被導到：

```text
/login?next=%2Fprofile
```

### 6.2 Magic link 回原頁

1. 在 login 輸入 email
2. 點 magic link
3. 驗證完成後應回 `/profile`

### 6.3 Cookie

在瀏覽器 DevTools 看 cookie：

- Name：`cine_sequence_session`
- Domain：`.cinesequence.xyz`
- Secure：true
- HttpOnly：true

### 6.4 API 路徑

在 Network 看請求：

- 前端應打 `/api/profile`
- 不應直接從 browser 打 `https://api.cinesequence.xyz/profile`

### 6.5 登出

1. 登入後按 logout
2. 再開 `/profile`
3. 應重新被導回 `/login`

## 7. Railway 是否要升級

### 7.1 如果你現在是 Free

建議升到 `Hobby`。

原因：

- production 服務不適合長期放 Free
- 至少要有穩定的正式環境起點

### 7.2 如果你現在已經是 Hobby

先不要急著升 `Pro`。

先看 Railway Metrics：

- CPU
- Memory
- Restart 次數
- OOM
- latency

### 7.3 什麼情況才考慮升 Pro

有這些狀況再考慮：

- CPU 長時間高
- memory 長時間高
- 明顯 restart / crash
- 需要更多 replicas
- 每月使用量接近或超過 Hobby 內含額度

### 7.4 我對你目前的建議

順序應該是：

1. 先把同網域 auth 部署完成
2. 觀察 3 到 7 天 metrics
3. 再決定要不要升 Pro

## 8. 你現在最需要做的事情

照順序做：

1. 先 rotate 正式 secrets
2. Railway backend 綁 `api.cinesequence.xyz`
3. backend env 改成 shared-domain cookie 版本
4. Cloudflare 前端改成 runtime 型部署
5. 前端 env 設 `/api` + `API_PROXY_TARGET`
6. 部署後照上面實測

## 9. 如果你要我下一步繼續幫

我可以接著幫你做兩種其中一種：

1. 幫你把 repo 補成 Cloudflare Workers 部署所需設定檔
2. 幫你列一份 Railway UI / Cloudflare UI 的逐步點擊清單
