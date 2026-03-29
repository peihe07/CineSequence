# Cine Sequence - Progress

> Last updated: 2026-03-29
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
| Manual review metadata process | DONE | 2026-03-29 | Added a maintenance workflow document covering pair review fields, movie-pool review expectations, controlled confound labels, and validation steps. |
| Progress tracking file | DONE | 2026-03-29 | This file replaces week-based tracking for current execution work. |

## Current Snapshot

### Completed Before This Tracking File

- `movie_pool.json` already received a non-mainstream expansion per `docs/cinephile-upgrade-plan.md`.
- `phase1_pairs.json` already has the first 6 upgraded sample pairs drafted.
- Validator scripts already exist for movie pool and phase 1 pair integrity.
- Pair engine already supports deterministic seeded selection with required-axis coverage.

### Immediate Next Step

- Decide whether movie-pool review metadata should stay document-based or move into a dedicated `movie_pool_reviews.json` file.

## Verification Log

| Date | Scope | Verification | Result | Notes |
|------|-------|--------------|--------|-------|
| 2026-03-29 | Progress tracking setup | Created execution-facing progress document aligned with `cinephile-upgrade-plan.md` and `roadmap.md` | PASS | No code behavior change. Documentation only. |
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

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-29 | Use a single rolling progress document instead of week-based planning | Current work is better tracked by workstream status, verification, and decision history than by calendar slices. |
| 2026-03-29 | Keep 16 archetypes and 5-axis redesign out of active execution | Too much QA and backfill cost before input/scoring quality is stabilized. |
| 2026-03-29 | Prioritize movie-pool normalization before pair or archetype work | This is the only currently confirmed issue that directly prevented newly added films from affecting DNA scoring. |
| 2026-03-29 | Remove `western_vs_eastern` instead of trying to rebalance it | The dimension itself is structurally confounded by culture familiarity and language proximity, so replacing its pairs without removing the axis would keep the wrong signal. |
| 2026-03-29 | Use contradiction-aware weighting before larger DNA model changes | Stabilizing tag confidence with existing signals is lower risk than redesigning the archetype system first. |
| 2026-03-29 | Introduce session-seeded randomness for Phase 2-3 candidate selection | Fresh users were converging on overly similar candidate pools even when relevance constraints were satisfied. |

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
