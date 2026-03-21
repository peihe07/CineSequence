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
- [ ] Auth utilities (magic link token + JWT creation/verification)
- [ ] Email service (send magic link via Resend, console fallback in dev)
- [ ] Auth router (POST /auth/register, /auth/verify, /auth/login)
- [ ] Auth dependency (get_current_user from Bearer token)
- [ ] Frontend API client (fetch wrapper with JWT)
- [ ] Auth store (Zustand: user, token, register, verify, login, logout)
- [ ] Register page (form: email, name, gender, region + zod validation)
- [ ] Verify page (read token from URL, store JWT, redirect)
- [ ] Login page (email input, send magic link)
- [ ] UI components (Button, Input, Avatar, ProgressBar)
- [ ] Tests: backend auth flow + frontend form validation

## Phase 3: Sequencing Engine (Core Feature)
- [ ] TMDB client (movie details fetch + Redis cache)
- [ ] Pair engine - Phase 1 (rule-based from phase1_pairs.json, reorder by seed movie)
- [ ] AI pair engine - Phase 2-3 (Claude API + pair_picker.txt prompt)
- [ ] Sequencing router (GET /pair, POST /pick, POST /skip, GET /progress)
- [ ] Quadrant calculator (compute quadrant vector from Phase 1 picks)
- [ ] Sequencing store (Zustand: currentPair, round, phase, liveTags)
- [ ] Sequencing page (two movie cards, phase indicator, progress bar, live tag cloud)
- [ ] Sequencing components (MovieCard, SwipePair, PhaseIndicator, LiveTagCloud, SkipActions)
- [ ] TMDB search UI (autocomplete for seed movie input)
- [ ] Animations (card selection, phase transition, tag cloud)
- [ ] Tests: pair engine, TMDB client, pick/skip flow

## Phase 4: DNA Builder + Result
- [ ] DNA builder service (tag vector computation, archetype assignment)
- [ ] AI personality service (Claude API + personality.txt prompt)
- [ ] DNA router (POST /dna/build, GET /dna/result)
- [ ] DNA result page (loading animation, archetype, tags, radar, AI reading)
- [ ] DNA components (ArchetypeCard, TagCloud, GenreRadar, AIReading)
- [ ] Tests: tag vector math, archetype matching, DNA build endpoint

## Phase 5: Matching + Invite
- [ ] Matcher service (pgvector cosine similarity >= 0.8 + preference filters)
- [ ] Ice breaker generation (Claude API + ice_breaker.txt prompt)
- [ ] Ticket generation service (Pillow image + R2 upload)
- [ ] R2 storage utility (upload/get_public_url)
- [ ] Matches router (GET /matches, POST /invite, GET /invites, POST /respond)
- [ ] Match store (Zustand: matches, invites, sendInvite, respond)
- [ ] Matches page (grid of match cards sorted by similarity)
- [ ] Matching components (MatchList, TicketCard, TearRitual, TheaterCard)
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
