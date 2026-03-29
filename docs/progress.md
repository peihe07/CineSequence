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
| Archetype scheme A tuning | TODO | 2026-03-29 | Only low-risk overlap reduction. No 16-type expansion in this track. |
| DNA consistency weighting | TODO | 2026-03-29 | Reduce instability from contradicted tags and retest drift. |
| Phase 2-3 candidate randomness | TODO | 2026-03-29 | Increase variation for fresh sessions without losing relevance. |

Definition of done:

1. Retest outcomes are more stable under repeated sampling.
2. Archetype overlap is reduced without introducing new blind spots.
3. Candidate selection no longer over-converges on the same pool.

### 3. Documentation And Reviewability

| Item | Status | Last touched | Notes |
|------|--------|--------------|-------|
| `dna-system-design.md` | TODO | 2026-03-29 | Document current DNA flow after input-quality fixes settle. |
| `movie-pool-changelog.md` | TODO | 2026-03-29 | Track major pool curation changes and rationale. |
| Manual review metadata process | TODO | 2026-03-29 | Keep pair and pool quality review auditable. |
| Progress tracking file | DONE | 2026-03-29 | This file replaces week-based tracking for current execution work. |

## Current Snapshot

### Completed Before This Tracking File

- `movie_pool.json` already received a non-mainstream expansion per `docs/cinephile-upgrade-plan.md`.
- `phase1_pairs.json` already has the first 6 upgraded sample pairs drafted.
- Validator scripts already exist for movie pool and phase 1 pair integrity.
- Pair engine already supports deterministic seeded selection with required-axis coverage.

### Immediate Next Step

- Start with movie pool tag mapping normalization and validation, because it is the only currently identified issue that directly breaks scoring correctness.

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

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-29 | Use a single rolling progress document instead of week-based planning | Current work is better tracked by workstream status, verification, and decision history than by calendar slices. |
| 2026-03-29 | Keep 16 archetypes and 5-axis redesign out of active execution | Too much QA and backfill cost before input/scoring quality is stabilized. |
| 2026-03-29 | Prioritize movie-pool normalization before pair or archetype work | This is the only currently confirmed issue that directly prevented newly added films from affecting DNA scoring. |
| 2026-03-29 | Remove `western_vs_eastern` instead of trying to rebalance it | The dimension itself is structurally confounded by culture familiarity and language proximity, so replacing its pairs without removing the axis would keep the wrong signal. |

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
