# Improvement Plan — Phase 4.5

> Last updated: 2026-04-06
> Scope: Phase 4 completion → Phase 5 preparation
> Owner: peihe

## Status Legend

- `READY` — No blockers, can start immediately
- `IN_PROGRESS` — Work started, partial scope completed, more remains
- `BLOCKED(reason)` — Cannot start until gate is cleared
- `DECISION(question)` — Requires product decision before implementation
- `DONE` — Completed and validated

---

## Track A — Immediate (no blockers, no decisions needed)

All items are `READY`. Execute in listed order.

### A1. Monetization Terminology

**Goal**: Replace e-commerce language with archive/intelligence language across payment UI.

| Aspect | Detail |
|--------|--------|
| Status | `DONE` |
| Owner | Frontend |
| Est. | 30min |
| Gate | None |

**Changes**:

| Current | Target (en) | Target (zh) |
|---------|-------------|-------------|
| Checkout | REQUEST CLEARANCE | 請求權限 |
| Buy Now | DECLASSIFY | 解密檔案 |
| Purchase complete | CLEARANCE GRANTED | 權限已開通 |
| Product card titles | Use "Clearance Level" framing | 使用「解密等級」框架 |

**Files**:
- `frontend/components/ui/PaymentModal.tsx` — button labels, product card copy
- `frontend/lib/i18n.tsx` — all payment-related keys

**Done when**:
- [x] Zero instances of "Buy", "Checkout", "Purchase" in payment-related i18n keys
- [x] zh and en both updated
- [x] PaymentModal renders correctly in both locales

---

### A2. SQL Query Cleanup

**Goal**: Eliminate Python-level list reversals by handling ordering in SQL.

| Aspect | Detail |
|--------|--------|
| Status | `DONE` |
| Owner | Backend |
| Est. | 30min |
| Gate | None |

**Current problem** (`backend/app/services/group_engine.py`):
- Line 228-256: `_recent_messages` queries `ORDER BY desc`, then `reversed()` in Python
- Line 559: same pattern in `list_visible_groups`
- Line 321: `activity.sort()` in Python instead of SQL

**Fix**:
```python
# Before (line 228-256):
.order_by(GroupMessage.created_at.desc()).limit(limit)
...
return list(reversed(messages))

# After:
subq = (
    select(GroupMessage.id)
    .where(GroupMessage.group_id == group_id)
    .order_by(GroupMessage.created_at.desc())
    .limit(limit)
    .subquery()
)
result = await db.execute(
    select(GroupMessage, User)
    .join(User, User.id == GroupMessage.user_id)
    .where(GroupMessage.id.in_(select(subq.c.id)))
    .order_by(GroupMessage.created_at.asc())
)
```

**Files**:
- `backend/app/services/group_engine.py`
- `backend/tests/` — add ordering assertion

**Done when**:
- [x] Zero `reversed()` calls on message/activity lists in `group_engine.py`
- [x] Existing tests pass
- [x] New test asserts message order is chronological (oldest first)

---

### A3. Notification Copy Overhaul

**Goal**: All notification titles/bodies use intel-briefing tone.

| Aspect | Detail |
|--------|--------|
| Status | `DONE` |
| Owner | Backend (service) + Frontend (i18n) |
| Est. | 3hr |
| Gate | None |

**Tone mapping**:

| Event | Current style | Target style |
|-------|---------------|--------------|
| Match invite | "You have a new match invite" | "SIGNAL DETECTED — New match intel in your dossier" |
| Invite accepted | "Your invite was accepted" | "CONTACT ESTABLISHED — Secure channel open" |
| Theater message | "New message in [theater]" | "THEATER DISPATCH — Transmission from [theater]" |
| Theater assigned | "You've been assigned to a theater" | "ASSIGNMENT ORDER — Report to [theater]" |

**Files**:
- `backend/app/services/notification_service.py` — audit all `emit_notification_safely` / `notify_*` calls
- `frontend/lib/i18n.tsx` — notification display keys
- `frontend/components/ui/NotificationBell.tsx` — verify rendering

**Done when**:
- [x] All notification strings audited and rewritten
- [x] zh and en both updated
- [x] NotificationBell renders new copy without layout breaks

---

### A4. Design Token Regression Scan + Migration

**Goal**: Eliminate hardcoded colors/sizes, enforce token usage.

| Aspect | Detail |
|--------|--------|
| Status | `IN_PROGRESS` |
| Owner | Frontend |
| Est. | 1 day |
| Gate | None |

**Progress snapshot (2026-04-06)**:
- Scan completed for hardcoded accent/fallback patterns in CSS modules
- `scripts/lint-design-tokens.sh` added and wired to root `package.json` as `npm run lint:design-tokens`
- First-pass migration completed for `PaymentModal`, `MessageBoard`, `theaters`, `matches`, `profile`, and several shared UI modules
- Remaining scope: repo-wide legacy alias cleanup (`var(--accent)`, `var(--accent-hover)`, `var(--error)`, `var(--success)`) and selective conversion of non-tokenized accent rgba values where a semantic token match is appropriate

**Phase 1 — Scan** (output: migration list)

Run these greps against `frontend/**/*.module.css` excluding `globals.css`:
1. Raw hex: `#[0-9a-fA-F]{3,8}` that aren't in comments
2. Raw accent: `rgba(229, 126, 49` not wrapped in `var()`
3. Raw error/success: `#b33a3a`, `#2d8659`, `rgba(220, 60, 60`
4. Font sizes below `--text-xs` that aren't intentional micro-text (status tags, etc.)

**Phase 2 — Migrate**

Token mapping (defined in `globals.css`):
| Hardcoded | Token |
|-----------|-------|
| `#e57e31` | `var(--color-accent-noir)` |
| `rgba(229,126,49,0.14)` | `var(--color-accent-noir-subtle)` |
| `rgba(229,126,49,0.6)` | `var(--color-accent-noir-muted)` |
| `#b33a3a` | `var(--color-error)` |
| `#2d8659` | `var(--color-success)` |
| `var(--accent, #e57e31)` | `var(--color-accent-noir)` (remove fallback) |

Exception list (keep hardcoded):
- `rgba(255,255,255,...)` transparency variants — too many unique values to tokenize
- One-off gradient stops in page-level backgrounds
- CSS module variables that shadow global tokens on purpose

**Phase 3 — Lint rule**

Add `scripts/lint-design-tokens.sh`:
```bash
#!/bin/bash
# Fail if legacy fallback patterns remain in CSS modules
rg 'var\(--accent,\s*#e57e31\)|var\(--accent-hover,\s*#cf6e2a\)|var\(--color-accent-noir,\s*#e57e31\)|#b33a3a|#2d8659' \
  --glob '*.module.css' \
  --glob '!globals.css' \
  frontend/
```
Hook into `package.json` scripts or pre-commit.

**Done when**:
- [x] Scan report generated and reviewed
- [ ] All migratable values replaced (count before/after documented)
- [x] `lint-design-tokens.sh` passes with zero violations
- [ ] Visual spot-check: landing, DNA, matches, profile, theaters pages

---

## Track B — Requires Product Decision

Items that need an explicit decision before implementation can begin.

### B1. Theater Layout Refactor

**Status**: `DECISION(surface type + IA)`

**Decision needed**:
1. What is the primary writing surface in a theater — list-scoped replies, room-level messages, or both?
2. Should "recommended" mean highest DNA overlap, curator-picked, or newest?
3. Modal vs Slide-over vs dedicated sub-page for list editing?

**Recommendation**: Slide-over for list CRUD, Modal for single-item add. But this depends on answers to #1 and #2.

**Once decided**:
| Aspect | Detail |
|--------|--------|
| Owner | Frontend (component extraction + layout) |
| Est. | 2-3 days |
| Gate | Decision on IA questions above |

Steps:
1. Extract list CRUD into `TheaterListEditor` component
2. Build `SlideOver` component or reuse existing Modal
3. Refactor detail page to read-focused layout
4. Integrate TMDB search (B1 depends on D1 search being ready)
5. Mobile responsiveness pass

**Files**:
- `frontend/app/(main)/theaters/detail/page.tsx`
- `frontend/app/(main)/theaters/detail/useTheaterDetail.ts`
- New: `frontend/components/theaters/TheaterListEditor.tsx`
- New: `frontend/components/ui/SlideOver.tsx` (if chosen)

Reference: `docs/workstreams/theaters.md` — Open Questions section

### B2. Email Templates

**Status**: `DECISION(email service provider)`

**Decision needed**:
1. Which email service? Options: Resend (simple, good DX), AWS SES (cheap at scale), SendGrid
2. Budget ceiling for email send volume?
3. Which events trigger emails? (match invite, accept, payment, sequencing complete — all or subset?)

**Once decided**:
| Aspect | Detail |
|--------|--------|
| Owner | Backend (service + templates) |
| Est. | 2-3 days |
| Gate | Service provider chosen + API key provisioned |

---

## Track C — Blocked on External

Items that cannot proceed until an external dependency clears.

### C1. Declassify Animation + Payment Success Flow

**Status**: `BLOCKED(ECPay approval)`

**What's ready**: PaymentModal, checkout flow, callback endpoint — all implemented.

**What's blocked**: Cannot test the success redirect flow without a live ECPay merchant ID.

**Once unblocked**:
| Aspect | Detail |
|--------|--------|
| Owner | Frontend |
| Est. | 1 day |

Steps:
1. Create `DeclassifyAnimation` component
   - Visual: scanline sweep → glitch text → "CLEARANCE GRANTED" → fade to content
   - framer-motion `AnimatePresence` + sequential `motion.div`
   - Duration: ~2.5s, skippable on click
2. Create `/payment/success` page (ECPay redirect target)
   - Parse `MerchantTradeNo` from query params
   - Show `DeclassifyAnimation` → navigate to relevant page
   - Handle refresh mid-animation (check order status, skip animation if already processed)
3. Wire PaymentModal close → navigate to success page

**Done when**:
- [ ] Payment success triggers animation before content reveal
- [ ] Refreshing `/payment/success` doesn't replay animation or error
- [ ] Skipping animation works

---

## Track D — Phase 5 Prep (start after Track A complete)

### D1. TMDB Movie Search in List Authoring

**Status**: `READY` (can start after Track A, independent of B/C)

| Aspect | Detail |
|--------|--------|
| Owner | Backend (endpoint) + Frontend (search component) |
| Est. | 2-3 days |
| Gate | None |

**Backend**:
1. Add `GET /movies/search?q={query}&lang={zh|en}` endpoint
2. Proxy to TMDB Search API with rate limiting (server-side, don't expose TMDB key)
3. Response: `[{ tmdb_id, title_en, title_zh, year, poster_url, genres }]`
4. Cache results for 1hr (same query → same results)
5. Reuse existing TMDB client if available in `backend/app/services/`

**Frontend**:
1. Create `MovieSearchInput` component
   - Debounced input (300ms)
   - Dropdown with poster thumbnail + title + year
   - Selection fires `onSelect({ tmdb_id, title, poster_url, ... })`
2. Integrate into theater list creation flow (replace manual title input)
3. Integrate into "add item" flow in theater detail
4. Loading + empty + error states

**Files**:
- Backend: new endpoint in `backend/app/routers/groups.py` or dedicated `movies.py`
- Backend: `backend/app/services/tmdb_client.py` (extend or create)
- Frontend: new `frontend/components/theaters/MovieSearchInput.tsx`
- Frontend: `frontend/app/(main)/theaters/detail/page.tsx`

**Done when**:
- [ ] Typing a movie name returns TMDB results within 500ms
- [ ] Selecting a result auto-fills all metadata fields
- [ ] Works in both create-list and add-item flows
- [ ] Backend test for search endpoint
- [ ] Frontend handles TMDB being unreachable gracefully

### D2. Group Resonance Score

**Status**: `READY`

| Aspect | Detail |
|--------|--------|
| Owner | Backend (computation) + Frontend (badge) |
| Est. | 1 day |
| Gate | None |

**Backend**:
1. Add `GET /groups/{id}/resonance` endpoint
2. Load all members with `dna_profiles` that have `tag_vector`
3. Compute: pairwise cosine similarity of tag vectors → average
4. Return `{ resonance_score: float, member_count: int, computed_at: str }`
5. Cache per group for 30min (invalidate on member join/leave)

**Frontend**:
1. Fetch resonance on theater detail mount
2. Display glassmorphism pill in theater header: `DNA RESONANCE: 87%`
3. Fallback: hide badge if `member_count < 2`

**Done when**:
- [ ] Badge displays on theater detail for groups with 2+ DNA profiles
- [ ] Score is mathematically correct (verified by unit test with known vectors)
- [ ] Badge hidden gracefully when insufficient data

### D3. DNA Share Card

**Status**: `READY` (but lower priority, start after D1/D2)

| Aspect | Detail |
|--------|--------|
| Owner | Frontend (image gen) + Backend (premium gate) |
| Est. | 3-5 days |
| Gate | None (tech), but premium gate depends on ECPay |

**Technical approach**: Satori + `@vercel/og`
- JSX → SVG → PNG, no Puppeteer
- Runs on Edge Runtime (Vercel native)

**Card variants**:
| Size | Use case |
|------|----------|
| 1200×630 | OG / Twitter / Facebook |
| 1080×1080 | Instagram / Threads |

**Card content**:
- Archetype name + clearance rank
- Top 3 tags as pills
- Mini radar or genre bar
- 1-3 representative movie posters
- User name
- CineSequence watermark (free) or clean (paid NT$39-59)

**Steps**:
1. Install `@vercel/og` dependency
2. Create `app/api/og/dna-card/route.tsx`
3. Design card JSX (film noir aesthetic: dark bg, monospace labels, grain overlay)
4. Add "Share DNA" button on DNA result page
5. Frontend: Web Share API → fallback to download
6. Backend: `GET /dna/share-card-token` returns signed short-lived URL (prevents scraping)
7. Premium gate: watermark overlay for free, clean for paid (`share_card` product type already exists in `PaymentOrder`)

**Done when**:
- [ ] Card generates in < 2s
- [ ] Both sizes render correctly
- [ ] Share button works on mobile (Web Share API) and desktop (download)
- [ ] Free version has visible but non-intrusive watermark
- [ ] Premium version clean after payment

---

## Execution Sequence

```
Track A (sequential, start immediately):
  A1 → A2 → A3 → A4

Track B (park until decisions made):
  B1: waiting on IA decision
  B2: waiting on email provider decision

Track C (park until external clears):
  C1: waiting on ECPay approval

Track D (start after A completes):
  D1 → D2 → D3
  (D1 and D2 can run in parallel if desired)
```

**No fixed week assignments** — items flow based on completion and unblocking, not calendar slots.

**Interrupt rules**:
- If ECPay approves during Track A → finish current A item, then do C1 before continuing A
- If IA decisions land during Track D → slot B1 after current D item
- Hotfixes and production incidents take priority over all tracks

---

## Validation Criteria (per item)

Every item must pass before marking `DONE`:

| Check | Scope |
|-------|-------|
| Unit tests | Backend items: pytest. Frontend items: vitest. New code must have tests. |
| Type check | `npx tsc --noEmit` — zero new errors (pre-existing errors excluded) |
| Visual check | Frontend items: manual check on landing, DNA, matches, profile, theaters |
| i18n check | Both zh and en verified for any copy change |
| Regression | No unrelated test failures introduced |

For CSS-heavy items (A4, C1, D3), add:
- Screenshot comparison before/after on 3 pages minimum
- Mobile viewport check (375px width)

---

## Related Documents

- `docs/roadmap.md` — phase-level execution plan
- `docs/workstreams/theaters.md` — theater IA questions and backend hotspots
- `docs/workstreams/pricing.md` — product catalog and payment flow
- `docs/workstreams/ui.md` — design token definitions and maintenance rules
