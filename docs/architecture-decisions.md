# Architecture Decision Records

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

**Decision**: Phase 1 rule-based, Phase 2-3 Claude API, DNA result Claude API.

**Rationale**:
- Phase 1 needs to be fast and deterministic — pre-curated pairs avoid API latency
- Phase 2-3 benefit from AI flexibility to probe nuanced taste dimensions
- DNA personality reading is the "wow factor" — worth the API cost
- Prefetch strategy: while user views current pair, backend requests next pair from Claude

**Cost estimate**: ~20 Claude API calls per user (7 Phase 2-3 pairs + 8 Phase 3 pairs + 1 DNA reading + prefetch buffer). At Sonnet pricing (~$3/M input tokens), roughly $0.01-0.02 per user sequencing session.

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
