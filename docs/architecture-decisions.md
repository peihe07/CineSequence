# Cine Sequence — Architecture Decision Records

## ADR-001: Monorepo with flat structure

**Decision**: Use a flat monorepo structure with `frontend/` and `backend/` directories.

**Rationale**: Simple and clear separation. Single git history makes it easier to trace
feature changes across the stack. Docker setup references both directories from root context.

**Trade-off**: No shared package system between frontend/backend. Acceptable since
TypeScript and Python don't share code directly.

---

## ADR-002: FastAPI over Django/Express

**Decision**: Use FastAPI (Python) for the backend API.

**Rationale**:
- Native async support — critical for Claude API + TMDB API calls (I/O bound)
- Pydantic integration for request/response validation
- Developer familiarity with Python ecosystem
- Auto-generated OpenAPI docs for frontend integration

**Trade-off**: Django has built-in admin panel and ORM. FastAPI requires SQLAlchemy separately.
For this project, the async advantage outweighs Django's batteries.

---

## ADR-003: pgvector for matching

**Decision**: Use PostgreSQL + pgvector extension for DNA profile matching.

**Rationale**:
- Cosine similarity matching happens at the DB level (single SQL query)
- No need for a separate vector database (Pinecone, Weaviate)
- Keeps infrastructure simple — one database for everything
- pgvector supports IVFFlat and HNSW indexes for scale

**Example query**:
```sql
SELECT u.id, u.name, 1 - (dp.tag_vector <=> :user_vector) AS similarity
FROM dna_profiles dp
JOIN users u ON u.id = dp.user_id
WHERE 1 - (dp.tag_vector <=> :user_vector) >= 0.8
ORDER BY dp.tag_vector <=> :user_vector
LIMIT 50;
```

---

## ADR-004: Resend over SendGrid for email

**Decision**: Use Resend for transactional email delivery.

**Rationale**:
- React Email integration — write email templates in JSX (same as frontend)
- Cleaner API than SendGrid
- Better developer experience, simpler setup
- Sufficient free tier for MVP (3000 emails/month)

---

## ADR-005: Hybrid AI strategy for sequencing

**Decision**: Phase 1 rule-based, Phase 2-3 Gemini API, DNA result Gemini API.

**Rationale**:
- Phase 1 needs to be fast and deterministic — pre-curated pairs avoid API latency
- Phase 2-3 benefit from AI flexibility to probe nuanced taste dimensions
- DNA personality reading is the "wow factor" — worth the API cost
- Prefetch strategy: while user views current pair, backend requests next pair from Gemini

**Cost estimate**: See ADR-014 for detailed token/cost analysis.

---

## ADR-006: Magic link auth over password

**Decision**: Email magic link authentication, no passwords.

**Rationale**:
- Lower friction registration (no password to remember)
- Email is already verified as part of signup
- Matches the "email-centric" product design (ticket invites via email)
- Simpler to implement and more secure (no password storage)

---

## ADR-007: Celery for async tasks

**Decision**: Use Celery + Redis for background task processing.

**Tasks that run async**:
1. DNA analysis (Claude personality reading) — 3-5s latency
2. Email sending (ticket invite generation + Resend API) — 1-2s
3. Batch re-matching (when new users complete sequencing) — periodic
4. Group auto-generation (tag clustering) — periodic

**Alternative considered**: FastAPI BackgroundTasks. Rejected because it doesn't survive
server restarts and lacks retry/scheduling capabilities.

---

## ADR-008: Cloudflare R2 over AWS S3

**Decision**: Use Cloudflare R2 for object storage (avatars, ticket images).

**Rationale**:
- S3-compatible API (drop-in replacement)
- No egress fees (major cost savings for serving ticket images in emails)
- 10GB free tier sufficient for MVP
- Simple integration with boto3/aioboto3

---

## ADR-009: CSS Modules over Tailwind

**Decision**: Use CSS Modules for styling instead of Tailwind CSS.

**Rationale**:
- Built-in Next.js support, zero additional dependencies
- Standard CSS with scoped class names — no utility class bloat in JSX
- Lower learning curve, better readability for component-scoped styles
- Sufficient for project scope without needing a design system framework

---

## ADR-010: Lightweight i18n over next-intl/i18next

**Decision**: Use a custom React Context-based i18n system instead of next-intl or react-i18next.

**Rationale**:
- Only two locales (zh-TW, en) — full i18n frameworks are overkill
- Simple `t(key, vars?)` function with `{{var}}` interpolation
- localStorage persistence for locale preference
- No routing changes needed (no `/en/`, `/zh/` path prefixes)
- Entire dictionary fits in a single file (`lib/i18n.tsx`)

**Trade-off**: No SSR locale detection, no pluralization rules. Acceptable for a bilingual app with simple string interpolation needs.

---

## ADR-011: Self-hosted Chinese font

**Decision**: Self-host jf Open Huninn (粉圓體) via `next/font/local` instead of using Google Fonts for Chinese text.

**Rationale**:
- jf Open Huninn is not available on Google Fonts
- `next/font/local` provides the same optimization (preload, font-display: swap)
- SIL OFL-1.1 license allows free redistribution
- Font stack: jf Open Huninn (Chinese) → Inconsolata (English body) → Silkscreen (display/logo)

**Trade-off**: 4.8MB TTF added to the repository. Acceptable for a font that covers all CJK characters needed.

---

## ADR-012: Fire-and-forget email notifications

**Decision**: Email notifications (invite, match accepted) are sent asynchronously and failures do not block the main flow.

**Rationale**:
- Core matching/invite flow must not fail due to email provider issues
- Email sends wrapped in `try/except` with `logger.exception()` — silent degradation
- `asyncio.run_in_executor` prevents blocking the event loop with sync Resend SDK
- All user-supplied content is HTML-escaped before interpolation (XSS prevention)
- Dev mode logs email content to console instead of sending

---

## ADR-013: Extension and seasonal retest

**Decision**: Support extending sequencing sessions (+5 rounds) and seasonal retest (fresh session).

**Rationale**:
- Extension allows users who want finer profiling to continue beyond 20 rounds
- Seasonal retest lets users refresh their DNA profile as taste evolves
- SequencingSession model tracks session state (round count, extension status)
- DNA profiles are versioned — retest creates a new version, old versions remain accessible via `/dna/history`

---

## ADR-014: Gemini API token budget and cost analysis

**Decision**: Use Gemini 2.5 Flash for all AI features. Budget ~$0.005 USD per user.

### API call points (2 total)

| Call site | When | Model | max_output_tokens |
|-----------|------|-------|-------------------|
| `ai_pair_engine.get_ai_pair()` | Phase 2-3, once per round | gemini-2.5-flash | 500 |
| `ai_personality.generate_personality()` | DNA build, once | gemini-2.5-flash | 800 |

Note: `ice_breaker.txt` prompt exists but ice breakers are currently rule-based (no API call).

### Calls per user

| Scenario | Pair generation | Personality | Total calls |
|----------|----------------|-------------|-------------|
| Standard 20 rounds | 15 (rounds 6-20) | 1 | **16** |
| Extension +5 rounds | 20 (rounds 6-25) | 1 | **21** |
| Seasonal retest | +15 to +20 | +1 | +16 to +21 |

### Token estimate per call

**ai_pair_engine (per call, average across rounds):**
- System prompt (pair_picker.txt): ~730 tokens
- User context (picks, quadrant, seen_ids): ~100 tokens (round 6) to ~500 tokens (round 20), avg ~300
- **Input avg: ~1,030 tokens/call**
- **Output avg: ~150 tokens/call** (max 500, actual JSON response ~150)

**ai_personality (single call):**
- System prompt (personality.txt): ~580 tokens
- User context (all picks + tag_vector + genre_vector + quadrant): ~830 tokens
- **Input: ~1,410 tokens**
- **Output: ~500 tokens** (max 800, actual ~500 for 150-250 word Chinese reading)

### Per-user token totals

| Scenario | Input tokens | Output tokens | Total tokens |
|----------|-------------|---------------|--------------|
| Standard 20 rounds | ~16,860 | ~2,750 | **~19,610** |
| Extension 25 rounds | ~22,010 | ~3,550 | **~25,560** |
| Retest (additional) | +16,860 to +22,010 | +2,750 to +3,550 | +19,610 to +25,560 |

### Cost per user (Gemini 2.5 Flash pricing, as of 2026-03)

| | Rate | Standard 20 | Extension 25 |
|--|------|-------------|--------------|
| Input | $0.15 / 1M tokens | $0.0025 | $0.0033 |
| Output | $0.60 / 1M tokens | $0.0017 | $0.0021 |
| **Total** | | **~$0.004** | **~$0.005** |

### Scale projections

| Users | Standard cost | With 20% extension | With 10% retest |
|-------|-------------|---------------------|-----------------|
| 1,000 | $4.0 | $4.4 | $4.8 |
| 10,000 | $40 | $44 | $48 |
| 100,000 | $400 | $440 | $480 |

### Optimization notes
- Phase 1 (rounds 1-5) is fully rule-based — zero API cost
- User context grows linearly per round; capping `picks[-10:]` keeps input bounded
- `response_mime_type: "application/json"` reduces wasted output tokens
- If ice breakers are upgraded to AI-generated, add ~1 call per match (~500 input + 100 output tokens)
