# Movie DNA Sequencing — Project Structure

```
movie-dna/
├── frontend/                          # Next.js 15 frontend
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── register/page.tsx
│   │   │   ├── verify/page.tsx
│   │   │   └── login/page.tsx
│   │   ├── (main)/
│   │   │   ├── sequencing/page.tsx
│   │   │   ├── dna/page.tsx
│   │   │   ├── matches/page.tsx
│   │   │   ├── theaters/page.tsx
│   │   │   ├── theaters/[id]/page.tsx
│   │   │   ├── ticket/[inviteId]/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx                   # Landing page
│   ├── components/
│   │   ├── sequencing/                # MovieCard, SwipePair, PhaseIndicator, LiveTagCloud, SkipActions
│   │   ├── dna/                       # ArchetypeCard, TagCloud, GenreRadar, AIReading
│   │   ├── matching/                  # TicketCard, MatchList, TheaterCard, TearRitual
│   │   ├── email/                     # TicketInvite (React Email template)
│   │   └── ui/                        # Button, Input, Avatar, ProgressBar
│   ├── lib/                           # api.ts, tmdb.ts, constants.ts
│   ├── stores/                        # Zustand: sequencingStore, authStore, matchStore
│   └── package.json
│
├── backend/                           # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── deps.py
│   │   ├── routers/                   # auth, sequencing, dna, matches, groups, profile
│   │   ├── services/                  # pair_engine, ai_pair_engine, dna_builder,
│   │   │                              # ai_personality, matcher, group_engine,
│   │   │                              # ticket_gen, email_service, tmdb_client
│   │   ├── models/                    # user, pick, dna_profile, match, group
│   │   ├── schemas/                   # Pydantic request/response schemas
│   │   ├── tasks/                     # Celery: dna_tasks, email_tasks, match_tasks
│   │   └── data/
│   │       ├── phase1_pairs.json
│   │       ├── archetypes.json
│   │       ├── tag_taxonomy.json
│   │       ├── groups_seed.json
│   │       ├── ticket_styles.json
│   │       └── prompts/               # pair_picker.txt, personality.txt, ice_breaker.txt
│   ├── migrations/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── pyproject.toml
│
├── docker/
│   ├── frontend/
│   │   └── Dockerfile                 # Multi-stage: dev + prod
│   └── backend/
│       └── Dockerfile                 # Multi-stage: dev + prod
│
├── scripts/                           # Seed data, prompt testing
├── docs/                              # Architecture docs
├── docker-compose.yml                 # Development (target: dev)
├── docker-compose.prod.yml            # Production (target: prod)
├── package.json
└── README.md
```

## API Endpoints

```
POST   /auth/register
POST   /auth/verify
POST   /auth/login

GET    /sequencing/pair
POST   /sequencing/pick
POST   /sequencing/skip
GET    /sequencing/progress

POST   /dna/build
GET    /dna/result

GET    /matches
POST   /matches/invite
GET    /matches/invites
POST   /matches/invites/:id/respond

GET    /groups
POST   /groups/:id/join
GET    /groups/:id

GET    /profile
PATCH  /profile
POST   /profile/avatar
```
