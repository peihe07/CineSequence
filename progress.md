# Cine Sequence - Development Progress

> Last updated: 2026-03-24

## Overall Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Data Layer | Done | 100% |
| Phase 2: Authentication | Done | 100% |
| Phase 3: Sequencing Engine | Done | 100% |
| Phase 4: DNA Builder + Result | In progress | 95% |
| Phase 5: Matching + Invite | Done | 100% |
| Phase 6: Groups + Profile | Done | 100% |
| Phase 7: Polish + Infrastructure | In progress | 98% |
| Cross-cutting | Done | 100% |
| **Overall** | | **~98%** |

---

## Phase 1: Data Layer - Models + Schemas + Migration ✓
- [x] User model (with seed_movie_tmdb_id for seed movie feature)
- [x] Pick model
- [x] DnaProfile model (pgvector Vector(30))
- [x] Match model (with unique pair constraint)
- [x] Group model + group_members association table
- [x] SequencingSession model (extension + retest tracking)
- [x] Auth schemas (RegisterRequest, LoginRequest, VerifyRequest, TokenResponse, UserResponse)
- [x] Sequencing schemas (PairResponse, PickRequest, ProgressResponse, SeedMovieRequest, MovieSearchResult)
- [x] DNA schemas (DnaResultResponse, DnaBuildResponse, ArchetypeInfo, QuadrantScores)
- [x] Match schemas (MatchResponse, InviteRequest, InviteResponse, RespondRequest)
- [x] Profile schemas (ProfileResponse, ProfileUpdateRequest)
- [x] Alembic initial migration (create all tables + pgvector extension + HNSW index)
- [x] Alembic migration: SequencingSession + extension columns
- [x] Seed script (load groups_seed.json into DB)

## Phase 2: Authentication ✓
- [x] Auth utilities (magic link token + JWT creation/verification)
- [x] Email service (send magic link via Resend, console fallback in dev)
- [x] Auth router (POST /auth/register, /auth/verify, /auth/login)
- [x] Auth dependency (get_current_user from Bearer token)
- [x] Frontend API client (fetch wrapper with JWT)
- [x] Auth store (Zustand: user, token, register, verify, login, logout)
- [x] Register page (form: email, name, gender, region, birth_year + validation)
- [x] Verify page (read token from URL, store JWT, redirect, Suspense boundary)
- [x] Login page (email input, send magic link)
- [x] UI components (Button, Input)
- [x] Tests: backend auth flow (unit + integration)
- [x] Birth year required, 18+ age validation (backend Pydantic + frontend)
- [x] Privacy policy scroll-to-read consent UX
- [x] Route guard (redirect unauthenticated users) ✓

## Phase 3: Sequencing Engine ✓
- [x] TMDB client (movie details fetch + Redis cache)
- [x] Pair engine - Phase 1 (rule-based from phase1_pairs.json, reorder by seed movie)
- [x] AI pair engine - Phase 2-3 (Gemini API + pair_picker.txt prompt)
- [x] Session service (extend +5 rounds, seasonal retest)
- [x] Sequencing router (GET /pair, POST /pick, POST /skip, GET /progress, POST /seed-movie, GET /search, POST /extend, POST /retest)
- [x] Quadrant calculator (compute quadrant vector from Phase 1 picks)
- [x] Sequencing store (Zustand: currentPair, round, phase, liveTags, optimistic updates)
- [x] TMDB search UI (autocomplete for seed movie input)
- [x] Seed movie page (locale-aware bilingual title display)
- [x] Sequencing page (split-screen A/B, VS neon divider, phase indicator, progress bar)
- [x] Sequencing complete page (with i18n)
- [x] MovieCard (tarot-style flip entrance, hover background color extraction)
- [x] SwipePair (Framer Motion enter/exit transitions)
- [x] PhaseIndicator + LiveTagCloud + SkipActions
- [x] Dynamic background color shift (genre-based)
- [x] Tests: pair engine, TMDB client, pick/skip flow
- [x] Liquid DNA tube animation (Canvas 2D) ✓
- [x] Sound effects (SoundManager + MuteToggle) ✓
- [ ] Server Components for initial data fetch (Next.js 15 RSC) → Phase 7

## Phase 4: DNA Builder + Result ✓
- [x] DNA builder service (tag vector computation, archetype assignment)
- [x] AI personality service (Gemini API + personality.txt prompt)
- [x] DNA router (POST /dna/build, GET /dna/result, GET /dna/history)
- [x] DNA result page (loading animation, archetype, tags, AI reading, i18n)
- [x] ArchetypeCard + TagCloud
- [x] SVG Radar chart (3 axes: mainstream/independent, rational/emotional, light/dark)
- [x] AIReading (typewriter animation via Framer Motion)
- [x] Tests: tag vector math, archetype matching, DNA build (19 unit tests)
- [x] Star nebula (Canvas 2D constellation with archetype colors) ✓
- [ ] Atmosphere effects (smoke particles, dancing lights) → Phase 7

## Phase 5: Matching + Invite ✓
- [x] Matcher service (pgvector cosine similarity >= 0.8 + preference filters)
- [x] Ice breaker generation (Gemini API + ice_breaker.txt prompt)
- [x] Matches router (GET /matches, POST /discover, POST /invite, POST /respond)
- [x] Match store (Zustand: matches, discover, sendInvite, respond)
- [x] Matches page (grid of match cards, i18n, Suspense boundary)
- [x] Email: invite notification (send_invite_email with XSS protection)
- [x] Email: match accepted notification (send_match_accepted_email)
- [x] Email deep link support (?respond= and ?match= URL params, highlighted card)
- [x] Tests: email notifications (13 unit tests — XSS, dev/prod, truncation, archetype)
- [x] R2 storage utility (upload_bytes, get_public_url, S3v4 signature)
- [x] Ticket generation service (Pillow image, 5 style palettes, punch holes, scan lines)
- [x] Ticket auto-generated on match accept (saved to R2 or local dev output/)
- [x] TicketCard component (clip-path punch holes, scan lines, holographic hover, 3D tilt)
- [x] TearRitual (drag gesture to tear ticket from perforated line) ✓
- [x] Ticket invite page (`/ticket?inviteId=<match_id>` - deep link from accepted-match email with ticket, shared tags, ice breakers)
- [x] Match visibility rule: `discovered` visible to initiator only
- [x] Invite authority rule: only initiator (`user_a`) can send invite
- [x] Respond authority rule: only recipient (`user_b`) can accept/decline
- [x] Reciprocal preference filtering added to matcher
- [x] Unordered pair protection: app-level reverse-pair check + DB unique index

## Phase 6: Groups + Profile ✓
- [x] Profile router (GET /profile, PATCH /profile)
- [x] Profile page (basic CRUD with i18n)
- [x] Group engine (auto-assign by DNA tag affinity, hidden group filtering, activation threshold)
- [x] Groups router (GET /groups, POST /auto-assign, POST /:id/join, POST /:id/leave, GET /:id)
- [x] Group store (Zustand: fetchGroups, autoAssign, joinGroup, leaveGroup)
- [x] Theaters page (group list with join/leave, auto-assign button, i18n)
- [x] Profile: avatar upload (POST /profile/avatar, R2 prod / local dev, 2MB limit, JPEG/PNG/WebP)
- [x] Tests: group affinity computation + threshold boundaries (12 unit tests)
- [x] Tests: ticket image generation across 5 style palettes (12 unit tests)
- [x] Tests: profile CRUD (12 integration tests)

## Phase 7: Polish + Infrastructure (in progress)

### 7a: End-to-End Integration (in progress — 2026-03-22)
- [x] Docker compose up — all 4 services running (postgres, redis, backend, frontend)
- [x] Alembic migration at head (ed7b2fe54c0a)
- [x] Health check: backend /health OK, frontend 200
- [x] Auth flow: register → magic link email (dev console log) → verify → JWT ✓
- [x] Seed movie: POST /sequencing/seed-movie (Fight Club, tmdb_id=550) ✓
- [x] Phase 1 sequencing: rounds 1-5 pair/pick cycle ✓
- [x] Phase transition: round 6 correctly enters Phase 2 ✓
- [x] Profile endpoint: GET /profile/profile ✓
- [x] Search endpoint: GET /sequencing/search?q=inception ✓
- [x] Progress endpoint: GET /sequencing/progress ✓
- [x] Fix: added logging.basicConfig to main.py (app logger was at WARNING, email logs invisible)
- [x] Fix: profile router paths `/profile/profile` → `/profile` (prefix duplication)
- [x] Fix: matches router paths `/matches/matches/*` → `/matches/*` (prefix duplication)
- [x] Fix: added NEXT_PUBLIC_API_URL to .env and .env.example
- [x] Fix: gemini-2.0-flash deprecated → upgraded to gemini-2.5-flash
- [x] Fix: thinking_budget=0 to prevent thinking tokens consuming output budget
- [x] Phase 2-3 sequencing: all 15 AI-generated rounds completed successfully ✓
- [x] DNA build: POST /dna/build → "ready" ✓
- [x] DNA result: archetype, personality reading, genre vector, quadrant scores ✓
- [x] Fix: numpy array truth check in dna.py (`if tag_vector` → `if tag_vector is not None`)
- [x] Fix: tag_vector all zeros — updated pair_picker prompt to return TAG_KEY, added validation in ai_pair_engine, frontend sends test_dimension back on pick/skip
- [x] Retest flow: version 2 session created, full 20 rounds, DNA build with correct tag_vector (10 non-zero dims) ✓
- [x] Matches discover: 2nd user created + DNA built, discover returns match (similarity 0.6933) ✓
- [x] Fix: matcher _compute_shared_genres ValueError (int cast on Chinese genre strings) → use strings
- [x] Fix: Match model MissingGreenlet → added lazy="selectin" to user_a/user_b relationships
- [x] Matches invite: User A sends invite → status "invited" ✓
- [x] Matches respond: User B accepts → status "accepted" ✓
- [x] Full match flow verified: discover → invite → respond (accept) ✓
- [x] Fix: accepted-match email link updated to `/ticket?inviteId=<match_id>`
- [x] Fix: recipient cannot see `discovered` matches before invite
- [x] Fix: only initiator may invite; only recipient may respond
- [x] Fix: matcher now honors reciprocal preferences
- [x] Fix: unordered match pair unique index added via Alembic migration
- [x] Fix: group activation logic extracted to should_activate_group, applied on join/leave/auto-assign
- [x] Fix: matcher only discovers active DNA profiles (is_active filter)
- [x] Fix: auth tests use stored magic_link_token (token reuse + superseded rejection tests)
- [x] Fix: authStore fetchProfile only clears token on 401/403, not network errors
- [x] Fix: auth verify now persists returned access_token; frontend API client sends Bearer token when available
- [x] Fix: API URL default changed to 127.0.0.1 (avoid localhost DNS issues)
- [x] Fix: next.config outputFileTracingRoot for workspace root detection
- [x] All 9 frontend routes return 200 (/, /login, /register, /verify, /sequencing, /sequencing/seed, /sequencing/complete, /dna, /matches, /profile)
- [x] Frontend API client uses correct paths (verified all stores + page-level api calls)
- [x] No frontend build errors or runtime errors
- [x] Fix: sequencingStore restores current pair after pick/skip failures; optimistic liveTags rollback on submit failure
- [x] Fix: legal pages (`/terms`, `/privacy`) text contrast improved for readability
- [x] Fix: register page tests updated to cover birth year validation + scroll-to-read consent unlock
- [ ] Frontend browser walkthrough (manual test in browser — needs Gemini quota for full flow)
- [x] Route guard: (main) layout redirects unauthenticated users to /login ✓
- [x] Nav bar: bottom tab navigation (Sequence, DNA, Matches, Profile) with i18n ✓

### 7b: Celery Async Tasks ✓
- [x] Celery app configuration (Redis broker/backend, autodiscovery, beat schedule)
- [x] DNA tasks (async DNA build + AI reading, trigger matching on completion)
- [x] Match tasks (async find_matches, periodic batch_rematch daily at 3 AM UTC)
- [x] Email tasks (send_invite_email_task, send_accepted_email_task with retry)
- [x] Docker compose: celery-worker + celery-beat services

### 7c: UX Polish ✓
- [x] Landing page (hero, how it works 3 steps, CTA, Framer Motion fade-up, i18n)
- [x] Liquid DNA tube animation (Canvas 2D sine wave, genre-colored, round indicator dots)
- [x] Star nebula (Canvas 2D constellation: radial genre stars, constellation lines, ambient particles, archetype-colored)
- [x] Sound effects (SoundManager singleton, 6 sounds: pick/skip/flip/tear/complete/match, MuteToggle in layout)
- [x] Card flip animation (rotateY 180° entrance, cardBack face, spring physics, staggered delay)
- [x] Tear gesture for ticket reveal (TearRitual: drag-to-tear, perforation line, gap animation, hint arrow)

### 7c-2: UX Gaps (identified 2026-03-22)
- [x] Global error boundary (app/error.tsx)
- [x] Global 404 page (app/not-found.tsx)
- [x] Global loading state (app/loading.tsx)
- [x] Toast/notification system (ToastContainer + toastStore)
- [x] Flow-dependent route guards (FlowGuard: no sequencing → block /dna, no DNA → block /matches + /theaters)
- [x] Onboarding overlay for first-time users (OnboardingOverlay on sequencing page)
- [x] "What's next" guidance on DNA result page (→ go to matches button already existed)
- [x] Confirmation dialogs (ConfirmDialog: logout, leave group)
- [x] Empty state CTAs (matches: discover button, theaters: auto-assign button)
- [x] Mobile responsive refinements (640px breakpoints, 44px touch targets, fluid MovieCard, reduced padding)
- [x] Accessibility (focus-visible, aria-labels, aria-live toasts, dialog roles, semantic main element, srOnly utility)
- [x] TAG_ZH/TAG_EN deduplication (shared lib/tagLabels.ts, matches + theaters pages use getTagLabel)

### 7c-3: Terminal Landing Page ✓
- [x] CRT terminal aesthetic (dark background, amber text, scan lines, flicker)
- [x] Sequential typewriter line animation (5 lines with staggered delays)
- [x] Keyboard input (press Y to start)
- [x] CSS custom properties for terminal palette (--terminal-bg, --terminal-line, etc.)

### 7c-4: Inner Page Layout Review ✓ (2026-03-24)
- [x] Fix nested `main` landmarks — layout `.page` div → `<main>`, 4 pages `<main>` → `<div>`
- [x] Header uses archive nav (no route titles / no back button) — duplicated titles & admin back button N/A
- [x] Removed `min-height: 100vh` from all page containers (shell + archive already guarantee full height)
- [x] Removed `calc(7rem + safe-area)` bottom padding from 6 pages (Footer is flow-positioned, not fixed)
- [x] Fixed ArchiveWrapper min-height calc (72px → 68px to match actual header height)
- [x] Build verification: all 16 routes export successfully, zero errors

### 7c-5: Visual Overhaul — Cinematic Charcoal ✓ (2026-03-24)
- [x] **配色系統** — `#0c0a09` → `#0a0b0c` (Obsidian Grey)，全站暖色光暈 → 中性白光/冰灰
- [x] **globals.css** — archive-bg, archive-glow, glass-glow, body gradients 全部中性化
- [x] **全頁面 CSS** — 8 個頁面 background gradient 從褐色 → 碳灰色
- [x] **Header** — 背景色、底線、nav 下劃線全部中性化；font-weight hover transition
- [x] **首頁 Spotlight** — 隨滑鼠移動的 radial-gradient 聚光燈
- [x] **首頁 Parallax** — Panel hover 時圖片 translateX(2%) 視差位移
- [x] **首頁景深模糊** — 非 hover 的 Panel 加 blur(2px) depth-of-field
- [x] **Film-strip 指示器** — 行動版底部掃描線式進度條（scroll-driven）
- [x] **Magnetic buttons** — CTA 按鈕隨滑鼠位置的磁吸微位移
- [x] **LoginModal Glassmorphism** — backdrop-filter: blur(20px), 半透明背景, 內發光邊框
- [x] **LoginModal Scan-line** — 開啟時 scanReveal clip-path + scanLine 垂直掃描動畫
- [x] **LoginModal 灰階化** — intro 全灰階 monospace，移除暖色 kicker/status/note
- [x] **Auth Forms** — LoginForm + RegisterForm 暖色 → 中性色
- [x] **跨頁面過渡** — PageTransition 元件 (framer-motion fade + slide)
- [x] **ArchiveWrapper 分級化** — full density (sequencing/dna/matches) vs minimal (profile/admin)
- [x] Build verification: all 16 routes, zero errors

### 7d: Testing + Security (in progress)
- [x] E2E tests: 17 passing (landing page 6, auth 5, protected routes 6)
- [x] Security review completed (15 findings: 2 CRITICAL, 5 HIGH, 5 MEDIUM, 3 LOW)
- [x] Fix: secret validation in config.py (warn if default jwt/magic_link secrets)
- [x] Fix: rate limiting via slowapi (auth: 5/min, verify: 10/min, global: 60/min)
- [x] Fix: security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS in prod)
- [x] Fix: user enumeration prevented (register returns existing user, login always same message)
- [x] Fix: search endpoint requires authentication
- [x] Fix: profile update field allowlist (prevent mass assignment)
- [x] Fix: input length validation on RegisterRequest (name, region, birth_year)
- [x] Fix: CORS allow_credentials=False (Bearer token auth, no cookies needed)
- [x] Fix: production error handler hides internal details
- [x] Fix: docs endpoint disabled in production
- [x] Integration tests: admin dashboard (10 tests) + profile CRUD (12 tests)
- [x] Frontend component tests: toast (6), ConfirmDialog (6), FlowGuard (5), Onboarding (4) = 21 tests
- [x] Fix: email test updated for ticket deep link URL

### 7e: Admin Dashboard + Monitoring ✓
- [x] Admin role field on User model + Alembic migration
- [x] Admin auth middleware (require_admin dependency)
- [x] GET /admin/stats endpoint (user count, DNA count, match count, invite/accept rates, funnel)
- [x] GET /admin/stats/daily endpoint (daily registration, DNA builds, matches over time)
- [x] GET /admin/api-usage endpoint (Gemini calls, TMDB queries, Resend emails)
- [x] Prometheus metrics endpoint (/metrics — request latency, error rate, in-flight, Celery queue depth, app gauges)
- [x] Grafana dashboard config (request rate, latency percentiles, error rate, queue depth, user funnel)
- [x] Frontend /admin page (stats overview, funnel chart, daily mini charts, API usage cards)
- [x] Docker compose: Prometheus + Grafana services (dev + prod)

### 7f: Deploy (in progress — 2026-03-24)
- [x] Cloudflare Workers (frontend runtime) — OpenNext + wrangler deployment
- [x] Railway (backend + PostgreSQL + Redis + Celery worker/beat)
- [x] Production env vars configured (.env.production template)
- [x] Same-origin frontend `/api/*` proxy to Railway backend public origin
- [x] Production auth cookie on `.cinesequence.xyz`
- [x] Production login/session verified on `https://cinesequence.xyz`
- [x] CI/CD pipeline (GitHub Actions: lint, test, build on push/PR to main)
- [x] Frontend custom domain + SSL setup
- [x] Production end-to-end verification
- [ ] Separate public API hostname (`https://api.cinesequence.xyz`) cleanup

---

## Cross-cutting (completed) ✓
- [x] i18n system (React Context, zh/en, localStorage persistence)
- [x] Locale toggle (pill-shaped 中/EN, floating fixed position)
- [x] Font stack: Inter (sans-serif) + Noto Sans TC (中文) + system monospace
- [x] Font attribution (ATTRIBUTION.md)
- [x] Separate zh/en display fonts on landing page (--font-display vs --font-display-en)
- [x] All page text converted to t() calls
- [x] Design system (warm palette, glassmorphism, borderless style)
- [x] Documentation (README, project-structure, architecture-decisions)
- [x] Mature cinephile tone for all user-facing copy

---

## Pending Requirements
- ~~**隱私政策 / 使用者同意條款**~~ ✓ 已完成
  - /privacy 頁面（zh/en，蒐集/揭露/不揭露/儲存/第三方/權利/聯繫）
  - 註冊 checkbox（agreed_to_terms 必填，連結至 /privacy）
  - User model 新增 agreed_to_terms_at，Alembic migration
  - 後端驗證 agreed_to_terms=true 才允許註冊

### 7g: Legal & Ethical Features ✓ (2026-03-23)
- [x] Terms of Service 頁面 (/terms，10 sections)
- [x] Cookie consent banner (glassmorphism，localStorage 記錄)
- [x] Account deletion (DELETE /profile API + UI confirm dialog)
- [x] Data export (GET /profile/export API)
- [x] AI-generated content disclaimers (DNA 頁面、Matches 頁面)
- [x] 註冊 birth_year 必填 + 18 歲以上驗證
- [x] Privacy policy scroll-to-read（必須捲到底才能勾選同意）
- [x] 註冊 consent 連結 Terms + Privacy

### 7h: AI Movie Selection Improvement ✓ (2026-03-23)
- [x] **A. 硬性防重複** — same-movie-in-pair rejection, retry_rejected_tmdb_ids 傳入 context, prompt 增加排除規則
- [x] **A. Fallback** — 3 次 AI retry 全失敗時，規則式從 pool 挑選（不再回 502）
- [x] **B. 擴大候選池** — movie_pool.json 266→324 部（每 tag >= 19 部，非英語 34%）
- [x] **B. 優化選取** — 候選加入地區多元性（>= 8 部非英語）+ tag 覆蓋度（>= 15 個）+ overtested 懲罰
- [x] **B. Prompt** — MUST pick from pool（允許 1 部例外）
- [x] **C. Phase 1 資料修復** — 修正 16 個錯誤 TMDB ID + 53 個 title_zh 佔位符
- [x] **C. Dimension 多元性** — Step 2 優先選未覆蓋 dimension（5 對至少 4-5 個不同 dimension）
- [x] **C. 輔助 axis** — 9 個輔助 dimension 選擇結果納入 quadrant scores 傳給 AI
- [x] Tests: 52 unit tests (pool integrity 6, ai_pair_engine 18, pair_engine 28)

### 7i: Notification System
> 分階段實作，MVP 先做輕量版

| Phase | 做法 | 時機 |
|-------|------|------|
| Phase 1 | Header 鈴鐺 + dropdown（靜態 polling） | ✓ 完成 |
| Phase 2 | 獨立通知頁面 + 已讀管理 | 用戶量成長後 |
| Phase 3 | 即時推播（WebSocket / SSE） | 需要即時性時 |

通知場景：
- 配對成功通知（有新 match）
- Sequencing 完成（DNA 分析結果出來）
- 系統公告（維護、新功能）

- [x] **Phase 1**: Header 鈴鐺 icon + 未讀紅點 + dropdown list
  - [x] Notification model + Alembic migration (notifications table)
  - [x] Notification service (create, query, mark read, convenience creators)
  - [x] Notification router (GET list, GET unread-count, PATCH read, PATCH read-all)
  - [x] Hook: discover → notify_match_found, invite → notify_invite_received, accept → notify_match_accepted
  - [x] Hook: DNA build task → notify_dna_ready
  - [x] notificationStore (Zustand, 30s polling, optimistic updates)
  - [x] NotificationBell component (bell icon, badge, glassmorphism dropdown, i18n)
  - [x] Tests: backend 17 integration tests, frontend 5 unit tests
- [ ] **Phase 2**: 獨立 /notifications 頁面 + 已讀/未讀狀態
- [ ] **Phase 3**: WebSocket / SSE 即時推播

## Deferred Decisions
- **N-V-E-P-S 5-dimension DNA system** — replace current 3-axis model after core flow is complete
- **Bilingual movie titles** — backend has title_en + title_zh, seed page is locale-aware, other pages TBD

## Suggested Next Steps
1. **Phase 7e** — Admin dashboard: Prometheus + Grafana monitoring
2. **Phase 7f** — Optional `api.cinesequence.xyz` hostname cleanup
3. **Phase 7i-2** — Notification system Phase 2 (standalone page + read management)
