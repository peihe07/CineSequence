# Manual Review Metadata Process

> Last updated: 2026-03-29
> Defines how to review, document, and validate curation changes for Phase 1 pairs and the movie pool.

## Purpose

This process exists to keep curation work auditable.

Use it whenever you:

- add or replace Phase 1 pairs
- change a pair's intended taste signal
- add movies to `movie_pool.json`
- retag existing movies
- mark weak pairs or weak pool entries for later replacement

The goal is not to create heavy process. The goal is to make future edits explainable and reviewable.

## Review Surfaces

### 1. Phase 1 Pair Review

Source files:

- `backend/app/data/phase1_pairs.json`
- `backend/app/data/phase1_pair_reviews.json`

Every pair must have a matching review entry keyed by `pair.id`.

Required fields:

- `confidence`
  Allowed values:
  - `high`
  - `medium`
  - `low`
- `confounds`
  Array of short machine-readable confound labels.
- `why_valid`
  One short sentence explaining why the pair is still worth using.
- `replacement_needed`
  Boolean flag for pairs that should stay visible in the data but be queued for replacement.

### 2. Movie Pool Review

Source files:

- `backend/app/data/movie_pool.json`
- `backend/app/data/movie_pool_reviews.json`

Every pool movie now has a matching review entry keyed by `tmdb_id` as a string.

Current required fields:

- `title_en`
- `confidence`
  Allowed values:
  - `high`
  - `medium`
  - `low`
- `coverage_reason`
  Current allowed values:
  - `phase1_anchor`
  - `region_balance`
  - `tag_coverage`
- `confounds`
- `replacement_needed`
- `notes`

Major pool changes should still be summarized in:

- [movie-pool-changelog.md](/Users/peihe/Personal_Projects/movie-dna/docs/movie-pool-changelog.md)
- [progress.md](/Users/peihe/Personal_Projects/movie-dna/docs/progress.md) when part of an active workstream

## Review Standards

### Pair Review Standard

When reviewing a pair, answer these questions in order:

1. Is the pair primarily testing one taste variable?
2. Is the strongest confound acceptable and explicit?
3. Would a reasonably cinephile user understand the contrast quickly?
4. Is the pair measuring taste rather than familiarity, language comfort, or prestige bias?
5. Is the pair still useful enough to keep if it is not perfect?

Use `replacement_needed: true` when the pair is still serviceable enough to keep temporarily but should not be treated as settled.

### Movie Pool Review Standard

When reviewing a pool entry, check:

1. All tags are inside `tag_taxonomy.json`.
2. Tags describe taste signal, not catalog trivia.
3. The entry adds meaningful coverage rather than duplicating the same niche repeatedly.
4. Region and language diversity improve or at least do not regress.
5. The movie is a credible candidate for sequencing, not just a personally liked title.

If a movie is worth keeping but the tag mapping is weak, fix tags first. Do not leave taxonomy-external tags in the file.

## Controlled Vocabulary

Use short stable confound labels instead of long prose.

Current confound labels already in use:

- `budget_signal`
- `canon_familiarity`
- `form_vs_theme`
- `genre_overlap`
- `humor_variation`
- `prestige_signal`
- `satire_overlap`
- `scope_vs_structure`
- `style_overlap`
- `tone_overlap`
- `tone_vs_genre`

Add a new confound label only when an existing label clearly does not fit.

## Update Workflow

### A. Updating A Phase 1 Pair

1. Edit `backend/app/data/phase1_pairs.json`.
2. Add or update the matching entry in `backend/app/data/phase1_pair_reviews.json`.
3. If the change affects pair strategy, add a short note to `docs/progress.md` or `docs/movie-pool-changelog.md`.
4. Run validation:
   - `node scripts/validate_phase1_pairs.js`
   - `cd backend && ./.venv/bin/python -m pytest tests/unit/test_pair_engine.py`

### B. Updating The Movie Pool

1. Edit `backend/app/data/movie_pool.json`.
2. Add or update the matching entry in `backend/app/data/movie_pool_reviews.json`.
3. Confirm all tags map to `backend/app/data/tag_taxonomy.json`.
4. Record notable curation rationale in `docs/movie-pool-changelog.md`.
5. If the change is part of active upgrade work, update `docs/progress.md`.
6. Run validation:
   - `node scripts/validate_movie_pool.js`
   - `cd backend && ./.venv/bin/python -m pytest tests/unit/test_movie_pool.py`

### C. Updating DNA Interpretation

If pool or pair changes are large enough to affect scoring interpretation:

1. Re-run relevant DNA unit tests.
2. Review archetype fit and contradiction handling.
3. Update `docs/dna-system-design.md` if behavior or design assumptions changed.

Recommended verification:

- `cd backend && ./.venv/bin/python -m pytest tests/unit/test_dna_builder.py`
- `cd backend && ./.venv/bin/python -m pytest tests/unit/test_ai_pair_engine.py`
- `cd backend && ./.venv/bin/python -m pytest tests/unit/test_ai_personality.py`
- `npm run test:backend:unit`

## Writing Guidance

### Good `why_valid`

- Explains the intended taste signal.
- Names the main acceptable tradeoff.
- Stays short enough to skim in diff review.

Example:

`The pair isolates pacing tolerance better than worldview, even though both films still carry some canon familiarity bias.`

### Bad `why_valid`

- Repeats the pair label.
- Uses vague praise like "good contrast".
- Hides known confounds.

### When To Use `low` Confidence

Use `low` when:

- the pair depends heavily on familiarity with one canon title
- the intended signal is plausible but not clean
- you would not remove it immediately, but you would not defend it as stable ground truth

## Review Cadence

Minimum expected review points:

- after any batch pair rewrite
- after any major movie-pool expansion
- before treating a new pair set as stable
- when user feedback or retest drift points to repeated confusion

## Future Extension

The current pool review file is intentionally lightweight. As curation quality increases, expand `coverage_reason`, `confounds`, and `notes` beyond bootstrap defaults for high-impact titles first.
