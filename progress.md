# Movie DNA - Development Progress

## Phase 1: Data Layer - Models + Schemas + Migration
- [x] User model (with seed_movie_tmdb_id for seed movie feature)
- [x] Pick model
- [x] DnaProfile model (pgvector Vector(30))
- [x] Match model (with unique pair constraint)
- [x] Group model + group_members association table
- [x] Auth schemas (RegisterRequest, LoginRequest, VerifyRequest, TokenResponse, UserResponse)
- [x] Sequencing schemas (PairResponse, PickRequest, ProgressResponse, SeedMovieRequest, MovieSearchResult)
- [x] DNA schemas (DnaResultResponse, DnaBuildResponse, ArchetypeInfo, QuadrantScores)
- [x] Match schemas (MatchResponse, InviteRequest, InviteResponse, RespondRequest)
- [x] Profile schemas (ProfileResponse, ProfileUpdateRequest)
- [x] Alembic initial migration (create all tables + pgvector extension + HNSW index)
- [x] Seed script (load groups_seed.json into DB)

## Phase 2: Authentication
- [x] Auth utilities (magic link token + JWT creation/verification)
- [x] Email service (send magic link via Resend, console fallback in dev)
- [x] Auth router (POST /auth/register, /auth/verify, /auth/login)
- [x] Auth dependency (get_current_user from Bearer token)
- [x] Frontend API client (fetch wrapper with JWT)
- [x] Auth store (Zustand: user, token, register, verify, login, logout)
- [x] Register page (form: email, name, gender, region + validation)
- [x] Verify page (read token from URL, store JWT, redirect)
- [x] Login page (email input, send magic link)
- [x] UI components (Button, Input)
- [x] Tests: backend auth flow (unit + integration)
- [ ] UI components (Avatar, ProgressBar) — deferred to when needed

## Phase 3: Sequencing Engine (Core Feature)
- [x] TMDB client (movie details fetch + Redis cache)
- [x] Pair engine - Phase 1 (rule-based from phase1_pairs.json, reorder by seed movie)
- [x] AI pair engine - Phase 2-3 (Claude API + pair_picker.txt prompt)
- [x] Sequencing router (GET /pair, POST /pick, POST /skip, GET /progress, POST /seed-movie)
- [x] Quadrant calculator (compute quadrant vector from Phase 1 picks)
- [x] Sequencing store (Zustand: currentPair, round, phase, liveTags, optimistic updates)
- [x] TMDB search UI (autocomplete for seed movie input - pre-sequencing step)
- [x] Sequencing page (split-screen A/B, VS neon divider, phase indicator, progress bar)
- [x] MovieCard (tarot-style flip entrance, hover background color extraction)
- [x] SwipePair (Framer Motion enter/exit transitions)
- [x] PhaseIndicator + LiveTagCloud + SkipActions
- [ ] Liquid DNA tube animation (Canvas/WebGL) — deferred to Phase 7 polish
- [ ] Sound effects (punch hole sound) — deferred to Phase 7 polish
- [x] Dynamic background color shift (genre-based: thriller=purple, comedy=yellow)
- [ ] Server Components for initial movie data fetch (Next.js 15 RSC) — deferred to Phase 7
- [x] Tests: pair engine, TMDB client, pick/skip flow

## Phase 4: DNA Builder + Result
- [x] DNA builder service (tag vector computation, archetype assignment)
- [x] AI personality service (Claude API + personality.txt prompt)
- [x] DNA router (POST /dna/build, GET /dna/result)
- [x] DNA result page (loading animation, archetype, tags, AI reading)
- [x] ArchetypeCard + TagCloud
- [x] SVG Radar chart (3 axes: mainstream/independent, rational/emotional, light/dark)
- [ ] Three.js star nebula (each dot=movie, selected movies form constellation lines) — deferred to Phase 7
- [ ] Atmosphere effects (dark films=smoke particles, musicals=dancing light dots) — deferred to Phase 7
- [x] AIReading (typewriter animation via Framer Motion)
- [x] Tests: tag vector math, archetype matching, DNA build (19 unit tests)

## Phase 5: Matching + Invite
- [ ] Matcher service (pgvector cosine similarity >= 0.8 + preference filters)
- [ ] Ice breaker generation (Claude API + ice_breaker.txt prompt)
- [ ] Ticket generation service (Pillow image + R2 upload)
- [ ] R2 storage utility (upload/get_public_url)
- [ ] Matches router (GET /matches, POST /invite, GET /invites, POST /respond)
- [ ] Match store (Zustand: matches, invites, sendInvite, respond)
- [ ] Matches page (grid of match cards sorted by similarity)
- [ ] TicketCard (clip-path punch holes, scan lines, holographic laser hover, 3D tilt, flip to back)
- [ ] TearRitual (drag gesture to tear ticket from perforated line, reveals match)
- [ ] MatchList + TheaterCard
- [ ] Ticket invite page (/ticket/[inviteId] - deep link from email)
- [ ] Tests: matcher query, preference filtering, invite flow

## Phase 6: Groups + Profile
- [ ] Group engine (auto-assign by DNA tags, hidden group discovery, activation)
- [ ] Groups router (GET /groups, POST /groups/:id/join, GET /groups/:id)
- [ ] Profile router (GET /profile, PATCH /profile, POST /profile/avatar)
- [ ] Theaters pages (group list + group detail)
- [ ] Profile page (DNA summary, edit preferences, avatar upload)
- [ ] Tests: group assignment, activation threshold, profile CRUD

## Phase 7: Celery Tasks + Email + Polish
- [ ] Celery app configuration (Redis broker/backend, autodiscovery)
- [ ] DNA tasks (async DNA build + AI reading, trigger matching on completion)
- [ ] Match tasks (async find_matches, periodic batch_rematch via Celery beat)
- [ ] Email tasks (async magic link + invite email via Resend)
- [ ] Email service full implementation (magic link + invite HTML emails)
- [ ] Email template (TicketInvite - React Email or HTML)
- [ ] Landing page (hero, how it works, CTA)
- [ ] Layout + navigation (route guard, nav bar for authenticated users)
- [ ] Frontend constants + utilities (TMDB image URLs, phase labels)
- [ ] E2E test (full user flow: register -> sequencing -> DNA -> matches)
