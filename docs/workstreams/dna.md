# DNA Workstream

> Last updated: 2026-03-30
> Scope: active DNA maintenance, follow-up improvements, and the reference docs that support the sequencing and scoring system.

## Current State

Completed in the last upgrade cycle:

- movie pool tag normalization
- Phase 1 core pair rewrite
- Phase 1 expansion to 60 pairs
- removal of `western_vs_eastern`
- pair review metadata
- contradiction-aware DNA consistency weighting
- Phase 2-3 session-seeded randomness
- archetype overlap tuning
- structured movie pool review metadata

This means the earlier cinephile upgrade is no longer an active execution plan. It is now reference history.

## Backend Improvements

### Open Follow-Ups

- [ ] Continue improving seed movie search quality and tolerance.
  Reason: this is still one of the highest-leverage entry points for cinephile users.
  Current status: first pass shipped for query trimming, normalization, year-aware ranking, empty-result guidance, and clearer selection confirmation. More search-quality tuning can continue later.

- [ ] Validate pricing-aware sequencing behavior once entitlement tests can run against a working local test database.
  Reason: retest and extend are now coupled to sequencing behavior, even though payment is paused.

- [ ] Reassess whether any new DNA-result fields should become first-class schema outputs rather than staying presentation-level only.

### Deferred System Changes

- [ ] Archetype expansion to 16 types
- [ ] Quadrant expansion from 3 axes to 5

These stay deferred because they would expand QA and backfill cost before current signal quality fully settles.

## Frontend Improvements

### Open Follow-Ups

- [x] Match empty-state and sequencing-resume experience.
- [x] Clarify skip/reroll meaning for users.
- [ ] Consider a proper “dislike both” mechanic if sequencing friction remains high.
  Current status: Phase A shipped. `dislike_both` is now a separate event and UI action, but it is still excluded from DNA scoring pending real usage data.
- [ ] Keep DNA result copy aligned with real sequencing behavior and entitlement state.

## Product And UX Follow-Ups

- [ ] DNA share card
- [ ] user feedback survey once the flow is more stable
- [ ] seasonal retest limits once pricing and entitlements are fully decided

## Reference Docs

Keep these as supporting references for the DNA system:

- `docs/dna-system-design.md`
- `docs/movie-pool-changelog.md`
- `docs/manual-review-metadata-process.md`
- `docs/progress.md`
- `docs/archive/cinephile-upgrade-plan.md`

## Priority Order

1. Improve user-facing sequencing and entry UX.
2. Keep search quality and signal quality stable.
3. Revisit larger DNA model redesign only after the current system has had enough live usage.
