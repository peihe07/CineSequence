# Pricing Workstream

> Last updated: 2026-04-06
> Scope: relaunch monetization strategy, payment integration (ECPay), and feature-level pricing.

## Relaunch Plan

On relaunch, all registered users will be reset:

- `sequencing_status` → `not_started`
- `active_session_id` → `NULL`
- All `sequencing_sessions` → `finalized`
- All `dna_profiles` → `is_active = false`
- `free_retest_credits` → `0`

Users get one free initial sequencing (30 rounds) after reset.

### Relaunch 用戶溝通計畫

1. **Reset 前 7 天**：發通知信（Email / 站內公告）
   - 告知系統升級，DNA 將重新定序
   - 建議截圖保存目前的 DNA 結果
   - 強調重啟後提供一次免費定序
2. **保留舊 DNA 可查看**：`dna_profiles.is_active = false` 不刪資料，前端加「查看歷史 DNA」入口（唯讀 list + detail page，標記日期）
3. **Migration safety check**：migration 執行時 log 受影響的 user count，並實作 `downgrade()` 可還原 status 欄位

## Pricing Table

| Feature | Price (TWD) | Notes |
|---------|-------------|-------|
| Initial sequencing (30 rounds) | Free | One-time after relaunch reset |
| Extension (10 rounds) | NT$59 | Changed from 3 rounds to 10 rounds per batch |
| Retest (30 rounds) | NT$129 | Full re-sequencing, generates new DNA |
| Bundle: 1 retest + 2 extensions | NT$199 | ~20% discount |
| DNA share card (premium) | NT$39-59 | Beautiful image card for social sharing |
| Match unlimited invite unlock | NT$99 | Permanent unlock, no expiration |
| Match message board | Free | Async-only, unlocks after match accepted |

### Pricing Rationale

- AI cost per user is negligible (~NT$0.3 per 30-round session using gemini-2.5-flash-lite)
- Pricing is based on perceived user value, not cost
- NT$59-129 range targets impulse purchase threshold (coffee-priced)
- Target: 5-10% conversion rate from 844 completed users

## Product Rules

### Sequencing

- First sequencing: free (30 rounds)
- Extension: paid only, 10 rounds per batch (changed from 3)
- Retest: paid only, no free retest credits
- `beta_entitlement_override` bypasses all gating (admin only)

### Match / Invite

- All match data is visible for free (full profile, shared tags, ice breakers)
- Free users get 5 invite credits
- NT$99 unlocks unlimited invites, permanent (no expiration)
- Responding to received invites is always free
- Accepted matches unlock a message board (留言板) for async communication — free for both sides
- No real-time chat; message board only (fits cinephile tone, async-first)
- Future consideration: monthly subscription tier when user base exceeds 5,000+

### DNA Share Card

- Free version: plain text / simple layout
- Paid version (NT$39-59): premium visual card with full DNA visualization, character mirror, seed movie
  - Multiple theme styles (film strip, ticket stub, poster style)
  - One-tap share to IG Story / Threads / LINE
- **付費粒度**：綁定特定 `dna_profile_id`
  - Retest 產生新 DNA 後，舊卡仍可下載，但新 DNA 需重新購買
  - 回購折扣：已購買過 share card 的用戶，下次購買 5 折（NT$19-29）
  - 前端邏輯：current profile 已購 → 直接下載；有歷史購買 → 顯示折扣價；無 → 原價

## Cost Structure

### Variable Cost (per user, per action)

| Action | Gemini Calls | Cost (USD) |
|--------|-------------|------------|
| Initial sequencing (30 rounds) | ~23 AI pair + 1 personality + 1 character mirror | ~$0.009 |
| Extension (10 rounds) | 10 AI pair + 1 DNA rebuild | ~$0.004 |
| Retest (30 rounds) | ~23 AI pair + 1 personality | ~$0.009 |

Based on actual production data: 88,098 AI pair calls across 1,131 users, total AI spend ~$33 USD.

### Fixed Cost (monthly)

| Item | Estimate |
|------|----------|
| Railway (VPS + DB) | ~$20-60/month |
| TMDB API | Free |
| Domain + SSL | ~$1/month |

### Payment Gateway Fees

| Provider | Fee |
|----------|-----|
| ECPay (selected, pending approval) | 2.75% |

## Implementation Plan

### Phase 1: Backend Reset + Extension Change

Goal: prepare the backend for relaunch pricing rules.

#### 1a. Relaunch Reset Migration

File: `backend/migrations/versions/relaunch_reset.py`

```sql
-- Reset all users
UPDATE users SET
  sequencing_status = 'not_started',
  active_session_id = NULL,
  free_retest_credits = 0,
  paid_sequencing_credits = 0;

-- Finalize all sessions
UPDATE sequencing_sessions SET status = 'finalized'
  WHERE status != 'finalized';

-- Deactivate all DNA profiles
UPDATE dna_profiles SET is_active = false;
```

- [ ] Write Alembic migration with the above logic
- [ ] Add `invite_credits` (int, default 5) and `invite_unlocked` (bool, default false) to `users` table
- [ ] Test migration against staging DB before production

#### 1b. Extension 10 Rounds

Files to change:

- `backend/app/models/sequencing_session.py` — change `base_extension_rounds` from 3 to 10
- `backend/app/services/session_service.py` — update `start_extension()` to add 10 rounds
- `backend/app/routers/sequencing.py` — update extension CTA copy
- `backend/app/schemas/sequencing.py` — update ProgressResponse if needed

Decision: max_extension_batches stays at 2 (so max total = 30 + 20 = 50 rounds).

#### 1c. Remove Free Retest

Files changed:

- `backend/app/models/user.py` — `free_retest_credits` default set to 0
- `backend/app/services/sequencing_entitlements.py` — legacy free retest path removed; all gating now uses `user_entitlements` table exclusively

Tasks:

- [x] Change extension rounds from 3 to 10
- [x] Set `free_retest_credits` default to 0
- [x] Remove legacy free retest path from entitlement logic
- [x] Update tests in `backend/tests/`

---

### Phase 2: ECPay Integration

Goal: accept payments and grant credits/unlocks.

#### 2a. New Models: Payment Order + User Entitlement

File: `backend/app/models/payment_order.py`

```python
class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id: UUID
    user_id: UUID (FK users.id)
    order_no: str (unique, for ECPay MerchantTradeNo)
    product_type: str  # "extension" | "retest" | "bundle" | "invite_unlock" | "share_card"
    amount: int  # TWD
    status: str  # "pending" | "paid" | "failed" | "refunded"
    refund_amount: int | None  # 部分退款金額（TWD）
    ecpay_trade_no: str | None  # ECPay TradeNo returned on callback
    paid_at: datetime | None
    created_at: datetime
```

File: `backend/app/models/user_entitlement.py`

取代原本的 `paid_sequencing_credits` 共用欄位，每筆 credit 獨立追蹤來源與消耗狀態。

```python
class UserEntitlement(Base):
    __tablename__ = "user_entitlements"

    id: UUID
    user_id: UUID  # FK users.id
    order_id: UUID | None  # FK payment_orders.id, NULL = system grant (e.g. free invite)
    type: str  # "extension" | "retest" | "invite"
    status: str  # "available" | "consumed" | "revoked"
    consumed_at: datetime | None
    created_at: datetime
```

設計要點：
- Bundle 購買時寫入 1 筆 retest + 2 筆 extension entitlement，各自獨立消耗
- 註冊時自動寫入 5 筆 `type="invite", status="available", order_id=NULL`
- `users.invite_unlocked = True` 時跳過 entitlement 檢查
- 查餘額：`SELECT count(*) FROM user_entitlements WHERE user_id=:uid AND type=:t AND status='available'`
- 移除 `users.paid_sequencing_credits` 欄位

#### 2b. Payment Service

File: `backend/app/services/payment_service.py`

Responsibilities:

1. `create_order(user_id, product_type)` — create PaymentOrder, generate ECPay form params
2. `verify_callback(params)` — verify ECPay CheckMacValue + IP 白名單, update order status
3. `grant_entitlements(order)` — based on product_type,寫入 `user_entitlements`：
   - `extension` → 1 筆 entitlement (type=extension)
   - `retest` → 1 筆 entitlement (type=retest)
   - `bundle` → 1 筆 retest + 2 筆 extension entitlements
   - `invite_unlock` → `users.invite_unlocked = True`
   - `share_card` → grant per-profile flag
4. `process_refund(order_id)` — 退款處理（見下方退款規則）

#### Callback 安全性

三層防護：

1. **Idempotency**：`verify_callback` 先檢查 order status，若已 `paid` 直接回 `1|OK`。order status 更新與 entitlement 寫入包在同一個 DB transaction。
2. **CheckMacValue**：SHA256 驗證（已規劃）。
3. **IP 白名單**：ECPay server IP 寫入環境變數 `ECPAY_CALLBACK_IPS`，在 route handler 開頭驗證 `request.client.host`，不符合直接 403。

#### 退款規則

| 情境 | 處理 |
|------|------|
| Credit 未使用 | 退款 + entitlement 標記 `revoked` |
| Credit 已全部使用 | 不退款 |
| 部分使用（bundle） | 退未使用部分的比例金額 |

退款邏輯：
- 查詢該 order 的所有 entitlements
- `available` 的標記為 `revoked`
- `refund_amount = order.amount × (available_count / total_count)`
- 呼叫 ECPay 退款 API
- 前端購買確認頁需標示：「已使用的額度不予退費」

#### 2c. API Endpoints

File: `backend/app/routers/payments.py`

```
POST /payments/checkout
  Body: { product_type: str }
  Returns: { order_no: str, ecpay_form_html: str }
  → Frontend renders ECPay form or redirects to ECPay

POST /payments/callback  (ECPay server-to-server)
  → Verify CheckMacValue
  → Update order status
  → Grant credits/unlocks
  → Return "1|OK"

POST /payments/return  (ECPay browser redirect)
  → Redirect user back to frontend with order status

GET /payments/history
  → List user's payment orders
```

#### 2d. ECPay Integration Details

- Use ECPay All-in-One SDK (credit card)
- MerchantTradeNo format: `CS{timestamp}{random}` (20 chars max)
- CheckMacValue: SHA256 with HashKey/HashIV from env vars
- Environment variables: `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`
- Staging: use ECPay sandbox credentials for testing

Tasks:

- [x] Create `PaymentOrder` model + Alembic migration（含 `refund_amount` 欄位）
- [x] Create `UserEntitlement` model + Alembic migration
- [ ] 移除 `users.paid_sequencing_credits` 欄位（relaunch migration 時一併處理）
- [x] 註冊流程寫入 5 筆 invite entitlements
- [x] Implement `payment_service.py`（order creation, callback verification, entitlement granting, refund）
- [x] Implement `routers/payments.py`（checkout, callback, history）
- [x] Callback 安全性：idempotency + CheckMacValue + IP 白名單
- [x] Add ECPay env vars to config（含 `ECPAY_CALLBACK_IPS`）
- [x] Write tests with mocked ECPay responses
- [x] `MerchantTradeDate` 使用 UTC+8（台灣時間）
- [x] `invite_unlock` 退款時 revoke `user.invite_unlocked` flag
- [x] `build_ecpay_form_html` 加 HTML escape 防護
- [x] Frontend `/payments/return` 頁面（付款後重導 + 狀態輪詢）
- [ ] Test full flow on ECPay sandbox

---

### Phase 3: Frontend Payment Wall

Goal: guide users to pay when blocked, show credit state clearly.

#### 3a. Sequencing Payment Wall

Trigger: backend returns 403 with `reason: "payment_required"` on retest/extend.

Flow:

```
DNA Result Page
  ├─ [Retest] → has paid credits? → proceed
  │             → no credits? → show PaymentModal (retest NT$129)
  │
  ├─ [Extend +10] → has paid credits? → proceed
  │                → no credits? → show PaymentModal (extension NT$59)
  │
  └─ [Bundle offer] → show bundle CTA (NT$199) if user has 0 credits
```

Components:

- `frontend/components/PaymentModal.tsx` — product selection, price display, ECPay redirect
- `frontend/components/CreditBadge.tsx` — shows remaining credits on DNA result page

#### 3b. Match Invite Payment Wall

Flow:

```
Match List Page
  ├─ Each match card: full info visible (free)
  ├─ [Send Invite] → invite_unlocked? → proceed
  │                 → available invite entitlements > 0? → consume 1 entitlement → proceed
  │                 → 0 remaining? → show PaymentModal (unlimited unlock NT$99)
  │
  └─ Invite counter: "3/5 invites remaining" or "∞ Unlimited"
```

Components:

- `frontend/components/InviteButton.tsx` — shows remaining count, triggers modal when 0
- Update `frontend/components/matches/MatchCard.tsx` — add invite counter

#### 3c. DNA Share Card Payment Wall

Flow:

```
DNA Result Page → [Share] button
  ├─ Free: copy link / plain text share
  └─ Premium: show card preview (blurred) → PaymentModal (NT$39-59)
      → paid → generate & download high-res card
```

Tasks:

- [x] Build `PaymentModal` component (glassmorphism style, product selection, ECPay redirect)
- [x] Add credit state to DNA result page (from existing ProgressResponse)
- [x] Add invite credit counter + unlock CTA on match page
- [ ] Add share card free/premium split on DNA result page
- [x] Handle ECPay return redirect (success/failure state)

---

### Phase 4: Match Message Board

Goal: async communication for accepted matches. No real-time chat.

#### 4a. Data Model

File: `backend/app/models/match_message.py`

```python
class MatchMessage(Base):
    __tablename__ = "match_messages"

    id: UUID
    match_id: UUID (FK matches.id, CASCADE)
    sender_id: UUID (FK users.id, CASCADE)
    body: str  # max 500 chars
    created_at: datetime
```

Index: `(match_id, created_at)` for chronological fetch.

#### 4b. API Endpoints

File: `backend/app/routers/match_messages.py`

```
GET /matches/{match_id}/messages?cursor=&limit=20
  → Gate: match.status == "accepted" AND user is participant
  → Returns: paginated messages, newest last

POST /matches/{match_id}/messages
  Body: { body: str }
  → Gate: same as above
  → Validate: body length <= 500, rate limit (see below)
  → Returns: created message
```

#### 4c. Frontend

Flow:

```
Match Detail Page (accepted match)
  └─ Message Board section
      ├─ Scrollable message list (newest at bottom)
      ├─ Simple text input + send button
      ├─ Pull-to-refresh or manual refresh (no WebSocket)
      └─ Empty state: "Start a conversation about your shared taste"
```

Components:

- `frontend/components/matches/MessageBoard.tsx` — message list + input
- `frontend/components/matches/MessageBubble.tsx` — single message display

Design:

- Glassmorphism card style, consistent with existing UI
- No typing indicators, no read receipts, no online status
- Mature, minimal tone — no emoji reactions or stickers

Tasks:

- [x] Create `MatchMessage` model + Alembic migration
- [x] Implement `routers/match_messages.py` (list + create)
- [x] Add rate limiting（配對後前 24h: 60 msgs/hour, 之後: 20 msgs/hour）
- [x] Build `MessageBoard` component (optimistic UI, polling, status tags)
- [x] Add message board section to match detail page
- [ ] Add notification: "New message from {name}" on new message

---

### Phase 5: DNA Share Card

Goal: premium visual cards for social sharing.

#### 5a. Card Generation

Approach: server-side image generation using Python (Pillow or html2image).

Why server-side:

- Consistent output across devices
- Can cache generated images in R2 (already used for tickets)
- User downloads a ready image, no client rendering issues

File: `backend/app/services/share_card_generator.py`

Input: DNA profile (tags, scores, archetype, seed movie, character mirror)
Output: PNG image (1080x1920 for IG Story, 1200x630 for OG/Threads)

#### 5b. Card Themes

Start with 3 themes:

1. **Film Strip** — vertical film strip with DNA tags as frames
2. **Ticket Stub** — movie ticket style (reuse existing ticket aesthetic)
3. **Poster** — cinematic poster layout with DNA visualization

Each theme = a template function that arranges the same data differently.

#### 5c. API Endpoints

File: `backend/app/routers/share_card.py`

```
GET /dna/share-card/preview?theme=film_strip
  → Returns: low-res preview image (free, watermarked)

POST /dna/share-card/generate
  Body: { theme: str, format: "story" | "og" }
  → Gate: user has purchased share card for this DNA profile
  → Generate high-res image → upload to R2 → return URL

GET /dna/share-card/download/{card_id}
  → Returns: signed R2 URL for download
```

#### 5d. Data Model

File: `backend/app/models/share_card.py`

```python
class ShareCard(Base):
    __tablename__ = "share_cards"

    id: UUID
    user_id: UUID (FK users.id)
    dna_profile_id: UUID (FK dna_profiles.id)
    theme: str  # "film_strip" | "ticket_stub" | "poster"
    format: str  # "story" | "og"
    image_url: str  # R2 URL
    is_paid: bool (default false)
    created_at: datetime
```

Tasks:

- [ ] Create `ShareCard` model + migration
- [ ] Implement card generation service (Pillow or html2image)
- [ ] Design 3 theme templates
- [ ] Implement share card endpoints (preview, generate, download)
- [ ] Build frontend share card UI (theme picker, preview, payment, download)
- [ ] Social sharing meta tags (og:image) for shared card links

---

## Execution Order

```
Phase 1 (no dependency)        Phase 2 (needs ECPay approval)
  ├─ Reset migration              ├─ PaymentOrder model
  ├─ Extension → 10 rounds        ├─ ECPay service
  └─ Remove free retest           └─ Payment endpoints
          │                              │
          └──────────┬───────────────────┘
                     ▼
              Phase 3: Frontend Payment Wall
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
  Phase 4: Message Board   Phase 5: Share Card
  (independent)            (independent)
```

Phase 1 can start immediately. Phase 2 is blocked on ECPay approval.
Phase 3 depends on both Phase 1 + 2.
Phase 4 and 5 are independent and can be built in parallel.

## Future Monetization (Not Scheduled)

| Feature | Estimated Price | Notes |
|---------|----------------|-------|
| Festival sequencing pack | NT$79-149 | Limited-time themed packs (Cannes, Venice, Golden Horse) |
| Director theme pack | NT$79 | Deep sequencing for a specific director |
| Duo comparison report | NT$69 | Compare two users' DNA side by side |
| Annual review report | NT$79 | Year-end taste evolution summary |
| Personalized recommendation list | NT$79/time or NT$149/month | AI-generated watch list based on DNA |
| Group sequencing | NT$199/group | Find movies a group would all enjoy |

## Data Notes (2026-04-02)

- Movie pool: 372 movies (414 unique movies actually used in picks)
- Tags: 35 (3 nearly unused: artHouseBridge, moralAnxiety, urbanLoneliness — fix before expanding)
- No need to expand movie pool or tags before monetization launch
- User-reported issues (pair repetition, forced choices) are algorithm problems, not pool size

## Reference Docs

- `docs/archive/pricing-and-entitlement.md`
- `docs/archive/pricing-implementation-spec.md`
