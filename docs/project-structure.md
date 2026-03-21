# Cine Sequence — Project Structure

```
movie-dna/
├── frontend/                          # Next.js 15 frontend
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── register/page.tsx      # Registration form
│   │   │   ├── verify/page.tsx        # Magic link verification
│   │   │   └── login/page.tsx         # Login form
│   │   ├── (main)/
│   │   │   ├── sequencing/
│   │   │   │   ├── seed/page.tsx      # Seed movie selection
│   │   │   │   ├── page.tsx           # Sequencing flow (20 rounds)
│   │   │   │   └── complete/page.tsx  # Sequencing complete
│   │   │   ├── dna/page.tsx           # DNA profile results
│   │   │   ├── matches/page.tsx       # Match discovery & listing
│   │   │   ├── profile/page.tsx       # User profile management
│   │   │   ├── theaters/[id]/         # Theater detail (placeholder)
│   │   │   └── ticket/[inviteId]/     # Ticket detail (placeholder)
│   │   ├── globals.css                # CSS variables, font stack, reset
│   │   ├── layout.tsx                 # Root layout (fonts, I18nProvider)
│   │   └── page.tsx                   # Landing page
│   ├── components/
│   │   ├── sequencing/                # SwipePair, MovieCard, PhaseIndicator,
│   │   │                              # LiveTagCloud, SkipActions
│   │   ├── dna/                       # ArchetypeCard, TagCloud, RadarChart, AIReading
│   │   ├── matching/                  # (placeholder)
│   │   ├── email/                     # (placeholder)
│   │   └── ui/                        # Button, Input, LocaleToggle,
│   │                                  # FloatingLocaleToggle
│   ├── lib/
│   │   ├── api.ts                     # API client (fetch wrapper)
│   │   └── i18n.tsx                   # React Context i18n (zh/en)
│   ├── stores/                        # Zustand state management
│   │   ├── authStore.ts
│   │   ├── sequencingStore.ts
│   │   ├── dnaStore.ts
│   │   └── matchStore.ts
│   ├── public/
│   │   └── fonts/
│   │       ├── jf-openhuninn-2.1.ttf  # Chinese font (OFL-1.1)
│   │       └── ATTRIBUTION.md         # Font license attribution
│   └── package.json
│
├── backend/                           # FastAPI backend
│   ├── app/
│   │   ├── main.py                    # FastAPI app + CORS + router mount
│   │   ├── config.py                  # Pydantic Settings (env vars)
│   │   ├── deps.py                    # Dependency injection (DB, auth)
│   │   ├── routers/
│   │   │   ├── auth.py                # /auth/* endpoints
│   │   │   ├── sequencing.py          # /sequencing/* endpoints
│   │   │   ├── dna.py                 # /dna/* endpoints
│   │   │   ├── matches.py             # /matches/* endpoints
│   │   │   ├── profile.py            # /profile/* endpoints
│   │   │   └── groups.py             # /groups/* endpoints (stub)
│   │   ├── services/
│   │   │   ├── auth_utils.py          # JWT + magic link tokens
│   │   │   ├── tmdb_client.py         # TMDB API client
│   │   │   ├── pair_engine.py         # Phase 1 rule-based pairs
│   │   │   ├── ai_pair_engine.py      # Phase 2-3 AI-powered pairs
│   │   │   ├── session_service.py     # Session management (extend/retest)
│   │   │   ├── dna_builder.py         # DNA profile computation
│   │   │   ├── ai_personality.py      # AI personality reading
│   │   │   ├── matcher.py            # Matching + invite + email integration
│   │   │   ├── email_service.py       # Email (magic link, invite, accepted)
│   │   │   ├── group_engine.py        # Group operations (stub)
│   │   │   └── ticket_gen.py          # Ticket image generation (stub)
│   │   ├── models/
│   │   │   ├── user.py                # User + preferences
│   │   │   ├── dna_profile.py         # DNA profile (pgvector)
│   │   │   ├── sequencing_session.py  # Session tracking (extend/retest)
│   │   │   ├── pick.py                # Individual movie picks
│   │   │   ├── match.py               # User matches + status
│   │   │   └── group.py               # Group model (placeholder)
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── sequencing.py
│   │   │   ├── dna.py
│   │   │   ├── match.py
│   │   │   └── profile.py
│   │   ├── tasks/                     # Celery async jobs
│   │   │   ├── celery_app.py
│   │   │   ├── dna_tasks.py
│   │   │   ├── email_tasks.py
│   │   │   └── match_tasks.py
│   │   └── data/
│   │       ├── phase1_pairs.json      # Pre-curated Phase 1 pairs
│   │       ├── archetypes.json        # Cinephile archetype definitions
│   │       ├── tag_taxonomy.json      # Movie tag taxonomy
│   │       ├── groups_seed.json       # Group seed data
│   │       ├── ticket_styles.json     # Ticket style templates
│   │       └── prompts/
│   │           ├── pair_picker.txt    # AI prompt for pair selection
│   │           ├── personality.txt    # AI prompt for personality reading
│   │           └── ice_breaker.txt    # AI prompt for ice breakers
│   ├── tests/
│   │   ├── conftest.py                # Pytest fixtures (async DB)
│   │   ├── test_auth.py
│   │   ├── test_sequencing_router.py
│   │   ├── test_email_notifications.py
│   │   └── unit/
│   │       ├── test_dna_builder.py
│   │       ├── test_pair_engine.py
│   │       └── test_tmdb_client.py
│   ├── migrations/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 001_initial.py
│   │       └── ed7b2fe54c0a_add_sequencing_sessions_extension_and_.py
│   ├── alembic.ini
│   ├── requirements.txt
│   └── pyproject.toml
│
├── docker/
│   ├── frontend/Dockerfile            # Multi-stage: dev + prod
│   └── backend/Dockerfile             # Multi-stage: dev + prod
│
├── scripts/                           # Seed data, prompt testing
├── docs/                              # Architecture docs
├── docker-compose.yml                 # Development (cinesequence-*-dev)
├── docker-compose.prod.yml            # Production (cinesequence-*-prod)
├── .env.example
├── package.json
└── README.md
```

## API Endpoints

### Authentication (`/auth`)
```
POST   /auth/register              # Create account (magic link email)
POST   /auth/login                 # Request magic link
POST   /auth/verify                # Verify magic link token → JWT
GET    /health                     # Health check
```

### Sequencing (`/sequencing`)
```
POST   /sequencing/seed-movie      # Set seed movie for warm signal
GET    /sequencing/search          # Search movies (TMDB proxy)
GET    /sequencing/pair            # Get current movie pair
POST   /sequencing/pick            # Submit pick for current round
POST   /sequencing/skip            # Skip current pair
GET    /sequencing/progress        # Get session progress
POST   /sequencing/extend          # Unlock 5 extra rounds (20→25)
POST   /sequencing/retest          # Start fresh session (seasonal)
```

### DNA Profile (`/dna`)
```
POST   /dna/build                  # Build DNA profile from picks
GET    /dna/result                 # Get DNA result (optional ?version=)
GET    /dna/history                # List all DNA versions
```

### Matching (`/matches`)
```
GET    /matches                    # Get user's matches
POST   /matches/discover           # Run matching algorithm
POST   /matches/invite             # Send invite to match
POST   /matches/respond            # Accept/decline invite
```

### Profile (`/profile`)
```
GET    /profile                    # Get user profile
PATCH  /profile                    # Update profile
```

### Groups (`/groups`) — Not yet implemented
```
GET    /groups                     # List groups (stub)
POST   /groups/:id/join            # Join group (stub)
GET    /groups/:id                 # Group detail (stub)
```

## Font Stack

| Font | Usage | Source |
|------|-------|--------|
| jf Open Huninn 2.1 | Chinese text | Self-hosted TTF (OFL-1.1) |
| Inconsolata | English body text | Google Fonts (OFL-1.1) |
| Silkscreen | Logo / display titles | Google Fonts (OFL-1.1) |

CSS variables: `--font-zh`, `--font-sans`, `--font-display`
