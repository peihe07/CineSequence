# Railway + Cloudflare 部署方案與 Railway 方案評估

## 結論

- 後端維持部署在 Railway。
- 前端如果要保留目前這版的 `middleware`、`rewrites`、同網域 `/api` 代理，**不應繼續走 Cloudflare Pages 的 static Next.js 部署**。
- 正式建議是：
  - 前端：Cloudflare Workers
  - 後端：Railway
  - 主站：`https://cinesequence.xyz`
  - API：`https://api.cinesequence.xyz`

原因很直接：

- 我們現在前端已經依賴 Next `middleware`
- 也依賴 `/api/*` rewrite / proxy 到 backend
- Next.js static export 不支援 `Rewrites`、`Proxy`、`Middleware`
- Cloudflare Pages 官方也明講：**full-stack / SSR 的 Next.js 請改看 Workers guide，不是 Pages static guide**

## 為什麼 Cloudflare Pages 不適合現在這版

目前專案已經改成這個方向：

- 前端預設打 `/api/*`
- Next 會把 `/api/*` 代理到實際 backend
- 未登入時由 middleware 先擋住 `/profile`、`/dna`、`/matches`、`/theaters` 等頁面
- magic link 驗證完成後會回原頁

這些都需要 Next runtime，不是純靜態輸出能完整支援的。

如果硬留在 Cloudflare Pages static：

- middleware 不會是正式保護層
- `/api` rewrite 不會是正式同源代理層
- 會退回以前那種 client-side auth guard 為主的模式
- 之前遇過的 auth 閃動、未授權先 render、preload 警告問題，會更容易回來

## 建議的正式網域配置

- 前端：`https://cinesequence.xyz`
- 後端：`https://api.cinesequence.xyz`
- auth cookie domain：`.cinesequence.xyz`

這樣的好處：

- backend 可以設定 `Domain=.cinesequence.xyz`
- `cinesequence.xyz` 和 `api.cinesequence.xyz` 都看得到這顆 cookie
- frontend middleware 才能讀到登入 cookie
- `/api/*` 代理也能維持同源請求

## 平台設定

### 1. Railway backend

在 Railway backend service：

1. 新增 custom domain：`api.cinesequence.xyz`
2. 在 Cloudflare DNS 建立 Railway 要求的 `CNAME`
3. 確認 backend 對外是 HTTPS

後端環境變數應設成：

```env
FRONTEND_URL=https://cinesequence.xyz
API_URL=https://api.cinesequence.xyz
AUTH_COOKIE_DOMAIN=.cinesequence.xyz
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_SECURE=true
```

補充：

- 如果前後端最終仍是不同「站點」而非同主網域，才需要 `AUTH_COOKIE_SAMESITE=none`
- 目前目標是 `cinesequence.xyz` / `api.cinesequence.xyz`，這種 shared parent domain 可先用 `lax`

### 2. Cloudflare 前端

如果要保留這次做好的 middleware / rewrite 架構，建議走：

- Cloudflare Workers
- Next.js + OpenNext adapter

前端環境變數應設成：

```env
NEXT_PUBLIC_API_URL=/api
API_PROXY_TARGET=https://api.cinesequence.xyz
```

這代表：

- 瀏覽器只會看到 `/api/*`
- 真正轉發到 `https://api.cinesequence.xyz/*`

### 3. 如果你堅持留在 Cloudflare Pages

可以，但要接受這些限制：

- 不把 middleware 當正式 auth 保護層
- 不把 rewrite/proxy 當正式同源代理層
- 受保護頁仍以 client guard 為主
- auth 體驗與穩定性會比 Workers 差

換句話說，**Pages 可以部署一個「能跑」的版本，但不是這次這套 auth 架構的最佳承載平台。**

## 專案內已經補好的設定

這些檔案已經為正式部署做好準備：

- `frontend/next.config.ts`
- `frontend/middleware.ts`
- `frontend/lib/api.ts`
- `backend/app/config.py`
- `backend/app/services/auth_cookies.py`
- `docker/frontend/Dockerfile`
- `docker-compose.prod.yml`
- `.env.example`
- `.env.production.example`

目前程式面缺的不是功能，而是平台上的網域與 env 實際接起來。

## 上線驗證清單

部署後至少做這幾步：

1. 開 `https://cinesequence.xyz/profile`
2. 未登入時應被導到 `/login?next=%2Fprofile`
3. 點 magic link 完成驗證後，應回 `/profile`
4. 瀏覽器 cookie 應看到 `cine_sequence_session`
5. 該 cookie 的 domain 應為 `.cinesequence.xyz`
6. Network request 應打到 `/api/*`，不是直接打 `localhost` 或裸 backend URL

## Railway 是否需要升級付費

### 先講結論

- 如果你目前是 **Free**：要，至少升到 **Hobby**
- 如果你目前已經是 **Hobby**：**不一定需要升到 Pro，升級本身不會自動讓伺服器更順**
- 如果你目前流量還小、主要是一人維護的 side project：大多數情況下 **Hobby 足夠**

### 為什麼「升級方案」不等於「直接變快」

Railway 現在的計費是：

- 方案費 + 實際資源使用量
- CPU / RAM 是按使用計價
- 方案主要影響的是：
  - included usage credit
  - 可用 replicas / volume / 團隊功能上限
  - workspace / 協作能力

也就是說：

- **Pro 不會自動幫你把 app 變快**
- 真正影響順暢度的是：
  - 你給 service 的資源上限
  - 你的 CPU / RAM 是否打滿
  - 是否需要更多 replicas
  - backend worker 數是否過高或過低

### 目前這個專案的實際判斷

你現在 backend 啟動是：

- `gunicorn ... -w 4 ...`

也就是 4 個 worker。

這代表：

- 如果 Railway 給 backend 的實際記憶體太小，4 workers 反而可能造成記憶體壓力
- 如果 CPU / memory 根本沒打滿，單純把方案從 Hobby 升到 Pro 不會有感

所以「要不要升級」不能只看感覺，要先看 Railway Metrics：

- CPU 是否長時間 > 70%
- Memory 是否長時間 > 70%
- 是否有 OOM / restart / crash
- 請求尖峰時延遲是否明顯上升

### 什麼情況下不用急著升 Pro

如果你目前符合大多數這些條件，先留 Hobby：

- 單人維護
- 流量還不大
- backend 沒有持續高 CPU / 高 RAM
- 沒有頻繁 crash / restart
- 每月用量遠低於 Pro 內含額度需求

### 什麼情況下建議升 Pro

升 Pro 比較合理的情況：

- 你需要多人協作權限
- 你要更多 replicas
- 你每月實際用量已經接近或超過 Hobby 的 included usage
- 你需要更大的 volume / 更長期的正式營運配置
- 你已經從 metrics 證明需要更高資源上限

### 我對你目前的建議

比較務實的順序是：

1. 先把同網域 auth 架構部署好
2. 部署後觀察 Railway Metrics 3 到 7 天
3. 如果 CPU / RAM 有明顯瓶頸，再加資源或升 Pro

也就是說：

- **先修正架構**
- **再看 metrics**
- **最後才決定要不要升級方案**

目前沒有足夠證據顯示你「一定要升 Pro 才會順」。

## 我對 Railway 方案的最終建議

### 建議 A：如果你現在是 Free

直接升 **Hobby**。

理由：

- production app 不適合卡在 Free
- Hobby 至少是合理的正式環境起點
- Railway 官方現在 Hobby 為 $5/月，且包含 $5 的 usage credit

### 建議 B：如果你現在已經是 Hobby

先不要因為「怕不順」就升 Pro。

先做：

1. 把這次的 auth / 同網域部署上去
2. 看 Railway Metrics
3. 如果 backend 長時間 CPU / RAM 高，再決定：
   - 調高資源
   - 調整 worker 數
   - 或升 Pro

## 參考資料

- Railway Pricing: https://docs.railway.com/pricing
- Railway Pricing Plans: https://docs.railway.com/reference/pricing/plans
- Railway Metrics: https://docs.railway.com/diagnose/metrics
- Railway Scaling: https://docs.railway.com/reference/scaling
- Railway Cost Control: https://docs.railway.com/reference/usage-limits
- Railway Custom Domains: https://docs.railway.com/networking/domains/working-with-domains
- Cloudflare Pages Next.js guide: https://developers.cloudflare.com/pages/framework-guides/nextjs/
- Cloudflare Workers Next.js guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Next.js static export guide: https://nextjs.org/docs/pages/guides/static-exports
