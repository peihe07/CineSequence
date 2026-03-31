# Cine Sequence - Progress

> Last updated: 2026-03-30
> Source of truth for current execution progress. This file tracks active workstreams and decision history without splitting by week.

## How To Use

- Update `Status`, `Last touched`, and `Notes` whenever an item changes state.
- Add completed validation in the `Verification Log`.
- Record scope changes or tradeoffs in the `Decision Log`.
- Keep roadmap as planning, keep this file as execution history.

Status legend:

- `TODO`: not started
- `IN PROGRESS`: actively being worked on
- `BLOCKED`: cannot proceed until dependency or decision is resolved
- `DONE`: implemented and validated at the current expected level

## Active Workstreams

### 1. DNA Input Quality

| Item | Status | Last touched | Notes |
|------|--------|--------------|-------|
| Movie pool tag mapping normalization | DONE | 2026-03-29 | Mapped all newly introduced legacy tags back to existing taxonomy tags in `movie_pool.json`. |
| Movie pool validation hardening | DONE | 2026-03-29 | Added a unit test to explicitly forbid legacy tags from reappearing alongside the existing validator script. |
| Phase 1 core pair rewrite | DONE | 2026-03-29 | Reworked the opening core-axis pairs and kept the core dimensions as the front door of Phase 1. |
| Phase 1 pair pool expansion to 60-80 | DONE | 2026-03-29 | Expanded `phase1_pairs.json` from 40 to 60 pairs while preserving seeded deterministic selection and no-overlap constraints. |
| Remove or refactor `western_vs_eastern` | DONE | 2026-03-29 | Removed the dimension from pair data, validator rules, and supplementary-axis scoring. |
| Pair review metadata | DONE | 2026-03-29 | Added standalone `phase1_pair_reviews.json` plus validator and test coverage for `confidence`, `confounds`, `why_valid`, and `replacement_needed`. |
| Bridge-auteur phase 1 direction | DONE | 2026-03-30 | Replaced the first batch of Phase 1 pairs with bridge-auteur anchors and used Wim Wenders, Paul Thomas Anderson, and the Coen brothers as the first expansion path. |
| Movie pool cinephile signal expansion | DONE | 2026-03-30 | Added bridge-auteur follow-up titles, introduced five cinephile taxonomy signals, expanded DNA vector dimensionality from 30 to 35, and mapped the first signal batch into `movie_pool.json`. |

Definition of done:

1. `movie_pool.json` contains no tags outside taxonomy.
2. Phase 1 always covers the 3 required core axes after data changes.
3. Pair pool expansion does not break deterministic session selection or no-overlap rules.

### 2. DNA Stability

| Item | Status | Last touched | Notes |
|------|--------|--------------|-------|
| Archetype scheme A tuning | DONE | 2026-03-29 | Reduced overlap across `dark_poet`, `lone_wolf`, `dream_weaver`, and adjacent archetypes with low-risk tag adjustments in `archetypes.json`. |
| DNA consistency weighting | DONE | 2026-03-29 | Added contradiction-aware weighting in `dna_builder.py` so unstable tag signals are downweighted relative to stable preferences. |
| Phase 2-3 candidate randomness | DONE | 2026-03-29 | Added session-seeded candidate variation in `ai_pair_engine.py` and threaded the session seed through sequencing routes. |

Definition of done:

1. Retest outcomes are more stable under repeated sampling.
2. Archetype overlap is reduced without introducing new blind spots.
3. Candidate selection no longer over-converges on the same pool.

### 3. Documentation And Reviewability

| Item | Status | Last touched | Notes |
|------|--------|--------------|-------|
| `dna-system-design.md` | DONE | 2026-03-29 | Added an implementation-aligned design document covering sequencing, scoring, archetype assignment, AI reading, and retrieval flow. |
| `movie-pool-changelog.md` | DONE | 2026-03-29 | Added a changelog covering pool expansion, taxonomy normalization, Phase 1 rebuild, metadata coverage, and DNA stability follow-up work. |
| Manual review metadata process | DONE | 2026-03-29 | Added a maintenance workflow document and moved movie-pool review into dedicated structured metadata with validator and unit-test coverage. |
| Progress tracking file | DONE | 2026-03-29 | This file replaces week-based tracking for current execution work. |

### 4. Sequencing Entry And Flow UX

| Item | Status | Last touched | Notes |
|------|--------|--------------|-------|
| Seed movie search UX | DONE | 2026-03-31 | Added popularity tiebreaker (TMDB `popularity` field) for same-title disambiguation; fixed empty genre tag display in seed search results. |
| Skip / reroll guidance | DONE | 2026-03-30 | Added inline action hints, updated onboarding wording, and mirrored the same meaning in the sequencing info modal. |
| Sequencing resume checkpoint | DONE | 2026-03-30 | Returning users with an in-progress session now land on a resume checkpoint instead of dropping straight into the next pair. |
| Match empty state | DONE | 2026-03-30 | Existing empty-state UI on the matches page was confirmed and synced back into roadmap state. |
| Dislike both mechanic (Phase A) | DONE | 2026-03-30 | Added a separate `dislike_both` decision path, endpoint, migration, UI action, and DNA-result diagnostics while intentionally keeping the event out of DNA scoring for now. |
| Seen one side mechanic (Phase A) | DONE | 2026-03-31 | Added `seen_one_side` enum value, Alembic migration, `POST /sequencing/seen-one-side` endpoint, store action, i18n copy, and UI button in SkipActions extended area. No DNA scoring impact in Phase A. |

### 5. Site-wide UI Upgrade

| Item | Status | Last touched | Notes |
|------|--------|--------------|-------|
| Phase 1 foundation tokens | DONE | 2026-03-30 | Added global typography, line-height, and dark-surface elevation tokens in `frontend/app/globals.css`. |
| Phase 2 hardcoded type cleanup | DONE | 2026-03-30 | Replaced undersized meta/label text across the major product surfaces and aligned high-traffic dark pages to the new surface palette. |
| Phase 3 theaters layout pass | DONE | 2026-03-30 | Completed the first layout pass across theater list and detail views: tabbed library detail panels, overview shelf tabs + carousel controls, collapsed list detail, collapsible replies, and summary chips. |
| Phase 3 ticket module | DONE | 2026-03-30 | Spacing + RWD adjustments and hardcoded font sizes replaced with tokens. |
| Phase 3 admin module | DONE | 2026-03-30 | Chart labels, tooltips, and card density aligned to global tokens. Phase 3 complete. |

## Current Snapshot

### Completed Before This Tracking File

- `movie_pool.json` already received a non-mainstream expansion per `docs/archive/cinephile-upgrade-plan.md`.
- `phase1_pairs.json` already has the first 6 upgraded sample pairs drafted.
- Validator scripts already exist for movie pool and phase 1 pair integrity.
- Pair engine already supports deterministic seeded selection with required-axis coverage.

### Immediate Next Step

- Run manual DNA result spot checks after the 35-dimension taxonomy rollout, then decide whether to add a second cinephile signal batch or more pair-level adoption.

### 5. Character Mirror & Match Threshold

| Item | Status | Last touched | Notes |
|------|--------|--------------|-------|
| `character_profiles.json` dataset | DONE | 2026-03-31 | 83 characters, 35-dim tag_vector, 7 psych frameworks. |
| `character_mirror.py` resonance engine | DONE | 2026-03-31 | Cosine similarity + quadrant proximity + archetype affinity. Diversity constraints enforced. 19 unit tests pass. |
| `character_mirror.txt` Gemini prompt | DONE | 2026-03-31 | Per-character mirror reading prompt, Traditional Chinese output. |
| Match threshold per-user setting | DONE | 2026-03-31 | `User.match_threshold` column (default 0.85, range 0.75–0.95), migration, profile API read/write, matcher uses per-user value. Frontend 5-button selector in ProfilePreferencesCard. |
| Character Mirror API + result UI | DONE | 2026-03-31 | `GET /dna/mirror` endpoint, `CharacterMirror` frontend component with skeleton loading, added to DNA result page between AIReading and diagnostics sections. |

## Verification Log

| Date | Scope | Verification | Result | Notes |
|------|-------|--------------|--------|-------|
| 2026-03-29 | Progress tracking setup | Created execution-facing progress document aligned with `archive/cinephile-upgrade-plan.md` and `roadmap.md` | PASS | No code behavior change. Documentation only. |
| 2026-03-29 | Movie pool tag mapping normalization | `node scripts/validate_movie_pool.js` | PASS | Validator now passes with 365 movies and no taxonomy-external tags. |
| 2026-03-29 | Movie pool unit coverage | `cd backend && ./.venv/bin/python -m pytest tests/unit/test_movie_pool.py` | PASS | 7 tests passed, including new legacy-tag regression coverage. |
| 2026-03-29 | Phase 1 pair data integrity | `node scripts/validate_phase1_pairs.js` | PASS | Validator passes with 60 pairs and no duplicate TMDB IDs across pairs. |
| 2026-03-29 | Phase 1 pair engine coverage | `cd backend && ./.venv/bin/python -m pytest tests/unit/test_pair_engine.py` | PASS | 29 tests passed, including deterministic seeded selection and no deprecated `western_vs_eastern` dimension. |
| 2026-03-29 | Backend unit suite | `npm run test:backend:unit` | PASS | 182 passed, 5 skipped, 159 deselected. |
| 2026-03-29 | Pair review metadata coverage | `node scripts/validate_phase1_pairs.js` + `cd backend && ./.venv/bin/python -m pytest tests/unit/test_pair_engine.py` | PASS | Review metadata now covers all 60 pairs with schema validation and pair-id parity checks. |
| 2026-03-29 | Backend unit suite after review metadata | `npm run test:backend:unit` | PASS | 184 passed, 5 skipped, 159 deselected. |
| 2026-03-29 | DNA consistency weighting | `cd backend && ./.venv/bin/python -m pytest tests/unit/test_dna_builder.py` | PASS | Contradicted tags are now downweighted relative to stable tags. |
| 2026-03-29 | Phase 2-3 candidate randomness | `cd backend && ./.venv/bin/python -m pytest tests/unit/test_ai_pair_engine.py` | PASS | Session-seeded candidate selection is deterministic within a session and varied across sessions. |
| 2026-03-29 | Archetype tuning + AI personality context | `cd backend && ./.venv/bin/python -m pytest tests/unit/test_ai_personality.py` | PASS | Archetype refinements and prompt-context cleanup both pass unit coverage. |
| 2026-03-29 | Backend unit suite after DNA stability work | `npm run test:backend:unit` | PASS | 188 passed, 5 skipped, 159 deselected. |
| 2026-03-29 | DNA system documentation | Added `docs/dna-system-design.md` aligned to current backend flow and updated progress tracking | PASS | Documentation only. No behavior change. |
| 2026-03-29 | Manual review metadata process | Added `docs/manual-review-metadata-process.md` and updated progress tracking | PASS | Documentation only. No behavior change. |
| 2026-03-29 | Movie pool review metadata coverage | `node scripts/validate_movie_pool.js` + `cd backend && ./.venv/bin/python -m pytest tests/unit/test_movie_pool.py` | PASS | Added `movie_pool_reviews.json` parity and schema validation for all 365 pool entries. |
| 2026-03-30 | Seed movie search UX first pass | `cd backend && ./.venv/bin/python -m pytest tests/unit/test_tmdb_client.py` + `cd frontend && npx vitest run 'app/(main)/sequencing/seed/page.test.tsx'` | PASS | Added normalization, year-aware ranking, guided empty state, and selected-movie confirmation UI. |
| 2026-03-30 | Skip / reroll UX hint | `cd frontend && npx vitest run 'components/sequencing/SkipActions.test.tsx' 'components/sequencing/OnboardingOverlay.test.tsx'` | PASS | Action semantics are now exposed inline and in first-time guidance. |
| 2026-03-30 | Sequencing resume UX | `cd frontend && npx vitest run 'app/(main)/sequencing/page.test.tsx'` | PASS | In-progress sessions now stop on a resume checkpoint before loading the next pair. |
| 2026-03-30 | Dislike both mechanic Phase A | `cd frontend && npx vitest run 'components/sequencing/SkipActions.test.tsx' 'stores/sequencingStore.test.ts' 'app/(main)/sequencing/page.test.tsx' 'app/(main)/dna/page.test.tsx'` + `cd backend && ./.venv/bin/python -m pytest tests/unit/test_dna_builder.py tests/test_sequencing_router.py -k 'dislike or skip or dna'` | PASS | Separated `dislike_both` from `skip`, moved the UI action into a secondary options area, and exposed lightweight interaction diagnostics on the DNA result page. |
| 2026-03-30 | Bridge-auteur Phase 1 rebalance | `node scripts/validate_phase1_pairs.js` + `cd backend && ./.venv/bin/python -m pytest tests/unit/test_pair_engine.py` | PASS | Replaced the first batch of candidate pairs with `Wings of Desire`, `Phantom Thread`, `Inside Llewyn Davis`, and `Paris, Texas` anchors while preserving deterministic coverage and no-overlap rules. |
| 2026-03-30 | Bridge-auteur movie-pool follow-up | `node scripts/validate_movie_pool.js` + `cd backend && ./.venv/bin/python -m pytest tests/unit/test_movie_pool.py` | PASS | Added `Paris, Texas`, `Wings of Desire`, `Inside Llewyn Davis`, `Phantom Thread`, `A Serious Man`, `Fargo`, and `There Will Be Blood` to the pool with review metadata parity. |
| 2026-03-30 | Cinephile taxonomy signal rollout | `node scripts/validate_movie_pool.js` + `cd backend && ./.venv/bin/python -m pytest tests/unit/test_movie_pool.py tests/unit/test_dna_builder.py tests/unit/test_ai_pair_engine.py tests/unit/test_group_engine.py` | PASS | Added five new taxonomy signals, expanded the persisted tag vector to 35 dimensions, updated archetype/prompt alignment, and mapped the first cinephile signal batch into the pool. |
| 2026-03-30 | Site-wide UI upgrade Phase 1-2 | `cd frontend && npx vitest run 'components/auth/LoginModal.test.tsx' 'components/auth/LoginForm.admin.test.tsx' 'components/ui/Header.test.tsx' 'components/ui/NotificationBell.test.tsx' 'app/(main)/profile/page.test.tsx' 'app/(main)/dna/page.test.tsx' 'app/(main)/notifications/page.test.tsx' 'app/(main)/ticket/page.test.tsx' 'app/(main)/matches/page.test.tsx' 'app/(main)/theaters/page.test.tsx' 'app/(main)/sequencing/complete/page.test.tsx'` | PASS | Global tokens and first-pass refactoring are in place across major product surfaces; the remaining work is layout-level rather than typography baseline. |
| 2026-03-30 | Site-wide UI upgrade Phase 3 theaters pass | `cd frontend && npx vitest run 'app/(main)/theaters/page.test.tsx' 'app/(main)/theaters/detail/page.test.tsx'` | PASS | Theaters now ship a reduced-scan layout across library and detail surfaces, including overview panel tabs, carousel controls, collapsible list detail, collapsible replies, and list summary chips. |
| 2026-03-31 | Match threshold frontend | `cd frontend && npx vitest run 'app/(main)/profile/page.test.tsx'` | PASS | 6 tests pass including threshold display and PATCH payload verification. |
| 2026-03-31 | Character Mirror API + result UI | `cd frontend && npx vitest run 'app/(main)/dna/page.test.tsx'` | PASS | 6 tests pass; mock store updated with mirror state fields. |
| 2026-03-31 | Seen one side mechanic Phase A | `cd frontend && npx vitest run 'components/sequencing/SkipActions.test.tsx' 'stores/sequencingStore.test.ts' 'app/(main)/sequencing/page.test.tsx'` | PASS | 12 tests pass across SkipActions, store, and page. Integration test added to `test_sequencing_router.py`. |
| 2026-03-31 | Seed search popularity tiebreaker | `cd backend && ./.venv/bin/python -m pytest tests/unit/test_tmdb_client.py -q` + `cd frontend && npx vitest run 'app/(main)/sequencing/seed/page.test.tsx'` | PASS | 36 backend unit tests pass (2 pre-existing failures unrelated); 3 frontend tests pass. |

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-29 | Use a single rolling progress document instead of week-based planning | Current work is better tracked by workstream status, verification, and decision history than by calendar slices. |
| 2026-03-29 | Keep 16 archetypes and 5-axis redesign out of active execution | Too much QA and backfill cost before input/scoring quality is stabilized. |
| 2026-03-29 | Prioritize movie-pool normalization before pair or archetype work | This is the only currently confirmed issue that directly prevented newly added films from affecting DNA scoring. |
| 2026-03-29 | Remove `western_vs_eastern` instead of trying to rebalance it | The dimension itself is structurally confounded by culture familiarity and language proximity, so replacing its pairs without removing the axis would keep the wrong signal. |
| 2026-03-29 | Use contradiction-aware weighting before larger DNA model changes | Stabilizing tag confidence with existing signals is lower risk than redesigning the archetype system first. |
| 2026-03-29 | Introduce session-seeded randomness for Phase 2-3 candidate selection | Fresh users were converging on overly similar candidate pools even when relevance constraints were satisfied. |
| 2026-03-30 | Prioritize `phase1_pairs` before `movie_pool` for the next cinephile upgrade pass | Phase 1 is the actual front door of sequencing, so earlier non-mainstream signal depends more on pair framing than on expanding the downstream pool alone. |
| 2026-03-30 | Use Wim Wenders, Paul Thomas Anderson, and the Coen Brothers as bridge-auteur anchors | They provide a clearer path toward auteur / non-mainstream preference detection without making the opening rounds too hard or too festival-specific. |
| 2026-03-30 | Expand the taxonomy instead of continuing unlimited pool growth | After the bridge-auteur pool follow-up, the system needed clearer cinephile-specific signals more than more titles tagged only with generic descriptors like `slowburn` or `darkTone`. |
| 2026-03-30 | Start Phase 3 UI work with theaters instead of ticket | The theaters library had the clearest scan-cost problem after the typography cleanup, and its layout changes are lower risk than changing ticket density first. |
| 2026-03-30 | Stop the current theater pass after scan-cost reduction instead of polishing indefinitely | Theaters now cover the main layout issues, so further gains are likely smaller than moving Phase 3 to ticket and admin. |

## Update Template

Copy this block when advancing an item:

```md
### YYYY-MM-DD

- Item:
- Change:
- Validation:
- Result:
- Follow-up:
```
