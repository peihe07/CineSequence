# Deployment Checklist

> Last updated: 2026-03-30
> 每次部署到 production 後應確認的最低驗證清單。

## 1. Backend Smoke Check

```bash
BASE_URL=https://your-railway-backend.up.railway.app npm run smoke:backend
```

確認以下端點回應正常：

- [ ] `GET /health` → `200`
- [ ] `GET /readiness` → `200`
- [ ] 基本 auth endpoint 回應正常

## 2. DB Migration

確認 migration 已套用（Railway deploy log 中應能看到 `alembic upgrade head` 成功）：

- [ ] Railway deploy log 無 alembic 錯誤
- [ ] 如有疑慮，可在 Railway 的 backend service 執行：
  ```bash
  alembic current
  ```

## 3. Frontend 可訪問性

- [ ] `https://cinesequence.xyz` 正常載入首頁
- [ ] `https://cinesequence.xyz/api/health` 透過同源代理正常回應（驗證 Workers proxy 路由）
- [ ] 登入流程可正常收到 magic link 信件

## 4. Cookie Auth

- [ ] 登入後 cookie 正確設定（`SameSite=None; Secure; Domain=.cinesequence.xyz`）
- [ ] 重整頁面後登入狀態保持

## 5. 核心功能快速驗證

每次大版本部署後手動跑一遍以下流程：

- [ ] 種子電影搜尋回傳正確結果
- [ ] 測序流程可正常進入 Phase 1（出現第一組比對）
- [ ] Phase 2 pair 可正常由 AI 回傳（確認 Gemini API key 有效）
- [ ] DNA 結果頁可正常顯示

## 6. 有條件的驗證

以下情境才需要：

| 情境 | 驗證項目 |
|------|---------|
| 有新 migration | 確認舊資料欄位未遺失；有 backfill 需求時執行對應 script |
| 有 Celery task 改動 | 確認新 task 可正常入列並執行（看 Celery worker log） |
| 有 R2 storage 改動 | 上傳 avatar 並確認 URL 可公開存取 |
| 有 email 樣板改動 | 手動觸發一次 magic link 並確認信件格式正確 |

## 7. Load Test（視需要）

對 staging 或新 Railway deployment 跑基準負載測試：

```bash
BASE_URL=https://staging.example.com npm run loadtest:home
BASE_URL=https://staging.example.com npm run loadtest:profile
BASE_URL=https://staging.example.com npm run loadtest:sequencing
```
