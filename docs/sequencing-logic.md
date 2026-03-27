# Sequencing Logic — Calculation & Pairing System

> Last updated: 2026-03-27

## Overview

The sequencing system determines a user's cinematic DNA through 30 base rounds of binary movie choices. Each round presents two films; the user picks one (or skips). Choices produce signals across multiple dimensions that converge into a DNA profile. Legacy sessions created with `base_rounds=20` still use the older boundaries, but all new sessions default to 30 rounds.

## Phase Structure

| Phase | Rounds | Engine | Purpose |
|-------|--------|--------|---------|
| Phase 1 | 1–7 | Rule-based pairs from `phase1_pairs.json` | Quadrant axis calibration (12 axes) |
| Phase 2 | 8–18 | Gemini AI-generated pairs from `movie_pool.json` | Adaptive tag exploration |
| Phase 3 | 19–30 | Gemini AI + soul tags + confidence-driven | Convergence verification & tie-breaking |

Phase boundaries are computed proportionally from `base_rounds`:
- P1 end = `round(base_rounds × 0.23)` → 7 for base=30, 5 for base=20
- P2 end = `round(base_rounds × 0.6)` → 18 for base=30, 12 for base=20

## Signal Layers

Each pick produces three layers of signal:

### Layer 1 — Explicit Signal (test_dimension)
Each round tests a specific tag (`test_dimension`). Picking a movie confirms affinity.
- `watched` mode: weight **1.0** (confirmed taste)
- `attracted` mode: weight **0.7** (aspirational taste)

### Layer 2 — Implicit Signal (movie tags)
Both movies carry multiple tags from the pool. Choosing movie A over movie B sends:
- All of A's tags: **+0.3** each (implicit positive)
- All of B's tags: **−0.15** each (implicit negative)
- Excludes `test_dimension` to avoid double-counting.

### Layer 3 — Skip Signal
Skipping both movies means neither appeals. The round's `test_dimension` receives **−0.3**.

## Tag Vector (30 dimensions)

Raw scores from all three layers are accumulated per tag, then:
1. Negatives clamped to 0
2. Log-dampened: `log(1 + x)` — prevents a tag tested 5× from dominating one tested once
3. Normalized to [0, 1] range

The top 8 tags become the user's `tag_labels`. Tags scoring 0.0 are `excluded_tags`.

## Quadrant Scores (12 axes)

### Core Axes (3) — from Phase 1
| Axis | Scale |
|------|-------|
| mainstream ↔ independent | 1.0 – 5.0 |
| rational ↔ emotional | 1.0 – 5.0 |
| light ↔ dark | 1.0 – 5.0 |

Phase 1 picks shift ±0.5 per pick on the pair's designated axis.

### Supplementary Axes (up to 9) — from Phase 1
fast↔slow, ensemble↔solo, visual↔dialogue, western↔eastern, spectacle↔intimate, straightforward↔meta, realism↔fantasy, contemporary↔period, cynical↔sincere.

### Phase 2-3 Quadrant Contribution
AI-generated pairs also influence quadrant through a tag-to-axis mapping:
| Tag | Axis | Direction |
|-----|------|-----------|
| cult, experimental, absurdist | mainstream↔independent | +0.3 (toward independent) |
| mindfuck, philosophical | rational↔emotional | −0.3 (toward rational) |
| tearjerker, romanticCore | rational↔emotional | +0.3 (toward emotional) |
| darkTone | light↔dark | +0.3 (toward dark) |
| uplifting | light↔dark | −0.3 (toward light) |
| slowburn | fast↔slow | +0.3 (toward slow) |
| visualFeast | visual↔dialogue | −0.3 (toward visual) |
| dialogue | visual↔dialogue | +0.3 (toward dialogue) |
| trueStory | realism↔fantasy | −0.3 (toward realism) |
| dystopia, timeTravel | realism↔fantasy | +0.3 (toward fantasy) |
| satirical | cynical↔sincere | −0.3 (toward cynical) |
| nostalgic | cynical↔sincere | +0.3 (toward sincere) |

All axes clamped to [1.0, 5.0].

## Confidence Score

Each tag tracks how many times it has been encountered (explicit + implicit movie-tag exposure from both sides of the pair).
```
confidence = min(1.0, encounter_count / 3)
```
Tags with confidence < 0.5 are prioritized for testing in Phase 3.

## Consistency Score

Tracks per-tag pick-for vs. pick-against ratio across all signals.
```
consistency = picks_for / (picks_for + picks_against)
```
- ~1.0 = strong preference
- ~0.5 = contradictory (user picked and rejected this tag roughly equally)
- ~0.0 = strong avoidance

`picks_against` includes both explicit skips on `test_dimension` and implicit negatives from tags attached to the rejected movie. Only tags with at least 2 total encounters are included.

Tags with consistency in [0.35, 0.65] are flagged as contradicted and get priority re-testing in Phase 3.

## Candidate Selection (Phase 2-3)

1. Score each movie in pool by relevance:
   - Undertested tag overlap × 2.0
   - Total tag count × 0.3
   - Non-English region bonus: +0.5
   - Overtested tag penalty: −0.5
2. Phase 3 extras: soul tags, low-confidence tags, and contradicted tags all enter the priority set
3. Ensure ≥8 non-English candidates and ≥15 distinct tags across candidates
4. Start from the top 40 scored candidates, then allow a small overflow buffer when backfilling missing tag coverage; in practice up to 45 candidates may be passed to Gemini

## Genre Vector

Built from chosen movies' TMDB genres:
- `watched`: weight 1.0, `attracted`: weight 0.7
- Normalized to [0, 1]

## Archetype Assignment

12 archetypes scored by:

``` 
score = IDF_weighted_tag_sum + genre_affinity − quadrant_distance × 0.3 − negative_tag_penalty
```

- **IDF-weighted tag sum**: `Σ (user_tag_score × log(N / archetype_count))` — rare tags carry more weight
- **Genre affinity**: average matching genre score × 0.5
- **Quadrant distance**: Euclidean distance between user's 3 core quadrant values and archetype's ideal profile
- **Negative tag penalty**: subtracts raw negative evidence on the archetype's own match tags, so active avoidance counts against an otherwise plausible fit

Highest score wins.

## Match Scoring

Match discovery first fetches eligible candidates by tag-vector cosine distance, then re-ranks them with quadrant proximity:

```
tag_similarity = 1 - cosine_distance(tag_vector_a, tag_vector_b)
combined_score = 0.7 * tag_similarity + 0.3 * quadrant_similarity
```

- Reciprocal preference filters are applied before scoring unless a candidate opted into pure-taste matching
- Matches below `match_threshold` are discarded; the current default is `0.8`
- Each created match stores `candidate_percentile` and `candidate_pool_size` based on the eligible pool at discovery time

## Extension System

After 30 base rounds:
- Up to 2 extension batches of 3 rounds each (max 36 total)
- Extensions are Phase 3 (soul tags + convergence)
- User can also choose to finalize without extending

## Backward Compatibility

Sessions created with base_rounds=20 retain their phase boundaries:
- P1: 1-5, P2: 6-12, P3: 13+
- Migration adds 10 extra rounds (all Phase 3)
