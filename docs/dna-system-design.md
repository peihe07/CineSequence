# DNA System Design

> Last updated: 2026-03-30
> Describes the current production DNA flow after the cinephile pool, Phase 1, and stability upgrades.

## Purpose

The DNA system turns sequencing picks into four user-facing outputs:

- a 35-dimension tag vector
- a 3-axis quadrant profile
- a single archetype
- an AI-written personality reading

This document is intentionally implementation-aligned. It reflects the current backend behavior, not a future redesign.

## System Boundary

Core runtime modules:

- `backend/app/routers/sequencing.py`
- `backend/app/services/pair_engine.py`
- `backend/app/services/ai_pair_engine.py`
- `backend/app/services/dna_builder.py`
- `backend/app/services/ai_personality.py`
- `backend/app/routers/dna.py`

Primary data files:

- `backend/app/data/movie_pool.json`
- `backend/app/data/tag_taxonomy.json`
- `backend/app/data/phase1_pairs.json`
- `backend/app/data/phase1_pair_reviews.json`
- `backend/app/data/archetypes.json`
- `backend/app/data/prompts/pair_picker.txt`
- `backend/app/data/prompts/personality.txt`

## End-To-End Flow

1. User chooses a seed movie.
2. Sequencing serves pairs round by round.
3. Phase 1 uses curated rule-based pairs.
4. Phase 2-3 use Gemini with a curated candidate pool plus hard duplicate prevention.
5. Picks are stored per sequencing session.
6. On sequencing completion, DNA build runs and persists a `DnaProfile`.
7. Result API returns archetype, tag signals, quadrant scores, and personality reading.

## Sequencing Architecture

### Session Model

Sequencing is session-based, not user-global.

- A session tracks `base_rounds`, `total_rounds`, `version`, extension state, and pending pair payload.
- Phase boundaries scale from `base_rounds` through `_get_phase(...)` in `sequencing.py`.
- Default behavior is effectively:
  - Phase 1: rounds 1-7 for a 30-round session
  - Phase 2: rounds 8-18
  - Phase 3: rounds 19+

### Phase 1: Rule-Based Core Profiling

Phase 1 is served by `pair_engine.py`.

- Source data: `phase1_pairs.json`
- Pair count served per session: 7
- Required coverage: at least one pair each for
  - `mainstream_vs_independent`
  - `rational_vs_emotional`
  - `light_vs_dark`
- Remaining slots are filled with weighted sampling from supplementary dimensions.
- Selection is deterministic per session through `session_seed`.
- No movie overlap is allowed inside the selected 7-pair set.

Current design intent:

- Open with interpretable taste contrasts, not generic blockbuster-versus-indie binaries.
- Keep Phase 1 stable, explainable, and cheap.
- Front-load core quadrant signal before adaptive AI exploration begins.

### Phase 2-3: AI-Guided Adaptive Exploration

Phase 2-3 are served by `ai_pair_engine.py`.

Inputs:

- prior picks and skips
- inferred quadrant vector
- tag frequency from prior rounds
- low-confidence tags from `compute_confidence(...)`
- contradicted tags from `compute_consistency(...)`
- curated candidate pool from `movie_pool.json`

Selection flow:

1. Collect all seen TMDB IDs from prior rounds.
2. Build a candidate pool from `movie_pool.json`.
3. Prioritize under-tested tags.
4. In Phase 3, additionally prioritize soul tags, low-confidence tags, and contradicted tags.
5. Enforce minimum region diversity and minimum tag coverage in the candidate pool.
6. Ask Gemini to choose a pair from that candidate pool.
7. Reject duplicates, invalid IDs, same-movie pairs, and invalid `test_dimension` values.
8. Retry up to 3 times.
9. Fall back to a rule-based pool pair if AI retries fail.

Important runtime constraints:

- Candidate selection is session-seeded, so the same session remains stable on refresh.
- Different sessions receive different candidate permutations.
- AI is bounded by curated candidates rather than given open-ended movie generation authority.

## Signal Model

### Tag Taxonomy

The DNA system only scores tags present in `tag_taxonomy.json`.

- `TAG_KEYS` defines the fixed taxonomy order currently used by the persisted vector.
- `TAG_INDEX` maps each supported tag to a vector index.
- Taxonomy-external tags do not count unless first normalized into supported tags.

This is why movie-pool curation must normalize legacy tags before they are useful for scoring.

Current cinephile-specific additions on top of the legacy tag set:

- `artHouseBridge`
- `urbanLoneliness`
- `driftCinema`
- `blackComedy`
- `moralAnxiety`

These were added after the bridge-auteur Phase 1 rebalance so the system could distinguish more specific cinephile signals from broad legacy buckets like `slowburn`, `darkTone`, `satirical`, and `philosophical`.

### Tag Vector Construction

`compute_tag_vector(...)` in `dna_builder.py` combines three signal layers.

1. Explicit signal
   `test_dimension` gets a positive score when the user chooses a side.
   Weight:
   - `watched`: `+1.0`
   - `attracted`: `+0.7`

2. Implicit signal
   Tags on the chosen movie and rejected movie create weaker secondary evidence.
   Weight:
   - chosen movie tags: `+0.3`
   - rejected movie tags: `-0.15`

3. Skip signal
   If the user skips both movies, `test_dimension` gets `-0.3`.

After raw accumulation:

- negative scores are clamped to zero for display vector purposes
- contradictory tags are downweighted with a consistency multiplier
- scores are log-dampened with `log1p`
- final values are normalized to `[0, 1]`

### Confidence And Consistency

The system computes two diagnostics from the same pick history.

`compute_confidence(...)`

- estimates how often a tag has been encountered
- saturates at `1.0` after roughly 3 encounters

`compute_consistency(...)`

- estimates pick-vs-against ratio per tag
- only includes tags with at least 2 total encounters
- interpretation:
  - `0.0`: consistently avoided
  - `0.5`: contradictory
  - `1.0`: consistently preferred

These metrics are used in two places:

- candidate selection in Phase 2-3
- result explanation and personality prompt grounding

### Quadrant Scores

`compute_quadrant_from_picks(...)` in `pair_engine.py` produces the current quadrant vector.

Core axes:

- `mainstream_independent`
- `rational_emotional`
- `light_dark`

Supplementary axes also exist for sequencing guidance, but archetype fit currently uses only the 3 core axes.

Quadrant scores are updated from:

- explicit Phase 1 dimension picks
- implicit tag-to-axis nudges in later phases

The score scale is centered around `3.0`, where `3.0` is neutral.

## Archetype Assignment

Archetype matching is handled in `assign_archetype(...)`.

Inputs:

- normalized tag vector
- genre vector from chosen movies
- quadrant scores
- raw tag scores for negative-penalty handling

Scoring components:

1. IDF-weighted tag affinity
   Tags shared by fewer archetypes count more.

2. Genre affinity
   Matching TMDB genres add a smaller positive score.

3. Quadrant fit penalty
   Euclidean distance from the archetype's ideal 3-axis profile reduces the score.

4. Negative evidence penalty
   If a user strongly rejects signals tied to an archetype, the score is reduced.

Current archetype source of truth:

- `backend/app/data/archetypes.json`

Current tuning intent:

- keep the 12-type system
- reduce major overlap before any 16-type or 5-axis redesign

## Personality Reading

The AI personality reading is generated by `ai_personality.py`.

Prompt grounding includes:

- top tags
- top-tag score, confidence, and consistency
- low-affinity tags
- contradiction tags
- genre vector
- quadrant vector
- archetype id
- pick history stripped down to sequencing metadata

Notably, current prompt context does not include chosen movie titles. It uses signal summaries rather than title lists.

Output contract:

- `personality_reading`
- `hidden_traits`
- `conversation_style`
- `ideal_movie_date`

The result is normalized for length and shape before persistence.

## Persistence And Retrieval

### Build Step

`/dna/build` in `backend/app/routers/dna.py`:

- loads picks for the active session
- fetches TMDB genre data
- calls `build_dna(...)`
- calls `generate_personality(...)`
- writes or updates `DnaProfile`

DNA profiles are versioned by sequencing session version.

### Result Step

`/dna/result` returns:

- archetype info
- full tag vector
- ranked tag labels
- `top_tags`
- `supporting_signals`
- `avoided_signals`
- `mixed_signals`
- genre vector
- quadrant scores
- personality reading fields
- ticket style
- version
- `can_extend`

This means the result page is not just showing a final label. It exposes the underlying support, avoidance, and contradiction signals.

## Validation And Guardrails

The current system relies on three layers of protection.

1. Data validation
   - `scripts/validate_movie_pool.js`
   - `scripts/validate_phase1_pairs.js`

2. Unit tests
   - `backend/tests/unit/test_movie_pool.py`
   - `backend/tests/unit/test_pair_engine.py`
   - `backend/tests/unit/test_ai_pair_engine.py`
   - `backend/tests/unit/test_dna_builder.py`
   - `backend/tests/unit/test_ai_personality.py`

3. Runtime fallbacks
   - AI pair retries on duplicates or invalid output
   - pool fallback if all AI retries fail
   - DNA build enqueue fallback to in-process execution

## Current Design Tradeoffs

- The 30-tag taxonomy is stable and explainable, but limits nuance unless pool curation keeps mapping rich films back into those tags carefully.
- Phase 1 is highly interpretable, but still bounded by curated pair quality rather than learned user embeddings.
- Phase 2-3 use AI for adaptivity, but AI is intentionally constrained by a curated pool and validation checks.
- Archetype scoring is more stable after consistency weighting and overlap tuning, but still sits on a relatively compact 12-type system.
- Personality writing is grounded better than before, but remains a presentation layer over the scored DNA, not a separate classifier.

## Out Of Scope For Current System

These are explicitly not part of the current design:

- 16-type archetype expansion
- 5-axis quadrant redesign
- title-level explanation as first-class scoring evidence
- unconstrained LLM pair generation without curated candidate filtering

Those belong to a later redesign, not this implementation baseline.
