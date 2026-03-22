# Cine Sequence - Development Progress

> Last updated: 2026-03-22

## Overall Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Data Layer | Done | 100% |
| Phase 2: Authentication | Done | 90% |
| Phase 3: Sequencing Engine | Done | 85% |
| Phase 4: DNA Builder + Result | Done | 80% |
| Phase 5: Matching + Invite | Done | 100% |
| Phase 6: Groups + Profile | Done | 95% |
| Phase 7: Polish + Infrastructure | In progress | 80% |
| Cross-cutting | Done | 95% |
| **Overall** | | **~85%** |

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
- [x] Register page (form: email, name, gender, region + validation)
- [x] Verify page (read token from URL, store JWT, redirect, Suspense boundary)
- [x] Login page (email input, send magic link)
- [x] UI components (Button, Input)
- [x] Tests: backend auth flow (unit + integration)
- [ ] UI components (Avatar, ProgressBar) — deferred to when needed
- [ ] Route guard (redirect unauthenticated users) → Phase 7

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

## Phase 5: Matching + Invite (in progress)
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
- [x] Ticket invite page (/ticket/[inviteId] - deep link from email with ticket, shared tags, ice breakers)

## Phase 6: Groups + Profile (in progress)
- [x] Profile router (GET /profile, PATCH /profile)
- [x] Profile page (basic CRUD with i18n)
- [x] Group engine (auto-assign by DNA tag affinity, hidden group filtering, activation threshold)
- [x] Groups router (GET /groups, POST /auto-assign, POST /:id/join, POST /:id/leave, GET /:id)
- [x] Group store (Zustand: fetchGroups, autoAssign, joinGroup, leaveGroup)
- [x] Theaters page (group list with join/leave, auto-assign button, i18n)
- [x] Profile: avatar upload (POST /profile/avatar, R2 prod / local dev, 2MB limit, JPEG/PNG/WebP)
- [x] Tests: group affinity computation + threshold boundaries (12 unit tests)
- [x] Tests: ticket image generation across 5 style palettes (12 unit tests)
- [ ] Tests: profile CRUD

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
- [x] Fix: group activation logic extracted to should_activate_group, applied on join/leave/auto-assign
- [x] Fix: matcher only discovers active DNA profiles (is_active filter)
- [x] Fix: auth tests use stored magic_link_token (token reuse + superseded rejection tests)
- [x] Fix: authStore fetchProfile only clears token on 401/403, not network errors
- [x] Fix: API URL default changed to 127.0.0.1 (avoid localhost DNS issues)
- [x] Fix: next.config outputFileTracingRoot for workspace root detection
- [x] All 9 frontend routes return 200 (/, /login, /register, /verify, /sequencing, /sequencing/seed, /sequencing/complete, /dna, /matches, /profile)
- [x] Frontend API client uses correct paths (verified all stores + page-level api calls)
- [x] No frontend build errors or runtime errors
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
- [ ] Integration tests (backend API with real DB)
- [ ] Frontend component tests (Vitest + Testing Library)

### 7e: Deploy
- [ ] Vercel (frontend) configuration
- [ ] Railway (backend + PostgreSQL + Redis) configuration
- [ ] CI/CD pipeline (GitHub Actions: lint, test, build, deploy)
- [ ] Production environment variables + secrets management
- [ ] Domain + SSL setup

---

## Cross-cutting (completed) ✓
- [x] i18n system (React Context, zh/en, localStorage persistence)
- [x] Locale toggle (pill-shaped 中/EN, floating fixed position)
- [x] Font stack: Open Huninn (中文) + ProperScript (EN display) + system monospace (body)
- [x] Font attribution (ATTRIBUTION.md)
- [x] Separate zh/en display fonts on landing page (--font-display vs --font-display-en)
- [x] All page text converted to t() calls
- [x] Design system (warm palette, glassmorphism, borderless style)
- [x] Documentation (README, project-structure, architecture-decisions)
- [x] Mature cinephile tone for all user-facing copy

---

## Pending Requirements
- **隱私政策 / 使用者同意條款** — 註冊時需同意條款。揭露給配對對象：顯示名稱、原型、品味標籤、ice breaker、相似度。不揭露：email、真實姓名、出生年份、性別。未來若加入個人照片/興趣簡介需額外同意。需前後端頁面 + 註冊勾選。

## Deferred Decisions
- **N-V-E-P-S 5-dimension DNA system** — replace current 3-axis model after core flow is complete
- **Bilingual movie titles** — backend has title_en + title_zh, seed page is locale-aware, other pages TBD

## Suggested Next Steps
1. **Phase 5 remaining** — Ticket invite deep link page (/ticket/[inviteId])
2. **Phase 6 remaining** — Profile avatar upload (R2), profile CRUD tests
3. **Phase 7d (continue)** — Integration tests (backend API with real DB), frontend component tests
4. **Pending** — 隱私政策頁面 + 註冊同意勾選
5. **Phase 7e** — Deploy (Vercel + Railway + CI/CD)
