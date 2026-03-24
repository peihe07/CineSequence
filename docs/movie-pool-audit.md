# Movie Pool Audit

This document audits [movie_pool.json](/Users/peihe/Personal_Projects/movie-dna/backend/app/data/movie_pool.json), which powers the Phase 2-3 AI pair engine.

## Dataset Snapshot

- Movie count: 324
- Region split:
  - `us`: 190
  - `uk`: 24
  - All other regions combined: 110

This means the pool is still majority US/UK even though the pair engine applies region-diversity constraints later.

## Structural Risks

### 1. `nonEnglish` is currently both a metadata flag and a taste tag

Current frequency:
- `nonEnglish`: 115 occurrences

Why this is risky:
- `nonEnglish` is not a taste descriptor in the same sense as `slowburn`, `twist`, or `romanticCore`.
- It describes language/market origin, but the AI pair engine treats all tags as part of the same "undertested taste dimension" logic.
- This can cause the system to over-infer that a user has a coherent aesthetic preference when the signal may only reflect language familiarity or cultural exposure.

Recommendation:
- Remove `nonEnglish` from the taste-tag competition logic, or demote it to metadata rather than a scoring tag.

### 2. Region diversity is partially corrected downstream, but the underlying pool is still US-heavy

Current distribution:
- `us` + `uk`: 214 / 324

Why this matters:
- The engine later forces a minimum number of non-US/UK candidates, but the base pool is still skewed.
- Candidate scoring may therefore still disproportionately favor English-language or Hollywood-adjacent films unless the diversity rules intervene.

Recommendation:
- Rebalance the source pool before selection, not only during candidate filtering.

### 3. Several tags are acting as pseudo-identity or pseudo-prestige signals

Examples:
- `nonEnglish`
- `trueStory`
- `cult`
- `darkTone`

Why this is risky:
- These tags are broad and often correlate with prestige, familiarity, or social identity rather than stable cinematic preference.
- If overused, they can drown out more specific signals like pacing, structure, and emotional mode.

Recommendation:
- Separate tags into:
  - taste tags
  - metadata tags
  - discovery/control tags

Only taste tags should dominate pair-generation logic.

## Concrete Data Issues

### 1. Known inconsistency: `Arrival`

Current entry:
- `Arrival`
  - `region: "us"`
  - tags include `nonEnglish`

Problem:
- This is internally inconsistent and likely just wrong.
- It proves the dataset needs a systematic consistency pass, not only subjective review.

Recommendation:
- Add a validation rule:
  - US/UK entries should not carry `nonEnglish` unless there is a very explicit bilingual-language policy and it is documented.

### 2. Tag granularity is uneven

Examples:
- `darkTone` is very broad and frequent.
- `mindfuck` is narrower and also fairly frequent.
- `heist` and `revenge` are relatively sparse.

Why this matters:
- Broad tags become dominant routing signals.
- Narrow tags get underrepresented unless the candidate selector explicitly boosts them.
- This can create distorted profiles where users are over-described by high-frequency broad tags.

Recommendation:
- Review whether broad tags like `darkTone`, `uplifting`, and `nonEnglish` should have lower model weight or lower selection priority.

## Labeling Quality Risks

### 1. Mixed ontology

Your taxonomy currently mixes:
- style: `visualFeast`, `dialogue`, `experimental`
- tone: `darkTone`, `uplifting`
- theme: `revenge`, `comingOfAge`, `survival`
- concept: `timeTravel`, `dystopia`
- source/metadata: `trueStory`, `nonEnglish`

This is workable for browsing, but risky for modeling because not all tags carry the same semantic type.

Recommendation:
- Split tags by modeling role:
  - aesthetic/form
  - affect/tone
  - narrative/theme
  - metadata

### 2. Possible over-tagging on prestige/non-English classics

Sample pattern seen in the pool:
- many non-English canon films are tagged with multiple "serious" descriptors such as `slowburn`, `existential`, `socialCritique`, `nonEnglish`
- many US mainstream titles are tagged more narrowly around spectacle, plot device, or genre

Why this is risky:
- The result can encode a prestige ladder into the recommendation mechanism.
- The AI may increasingly use world-cinema titles as "depth" probes and Hollywood titles as "surface" probes.

Recommendation:
- Compare average tag count and tag type by region to detect systematic asymmetry.

## Suggested Audit Framework

Review each movie on these columns:

1. `tag_accuracy`
   Are the assigned tags defensible?
2. `tag_specificity`
   Are tags too broad or too generic?
3. `metadata_leakage`
   Are we tagging market origin as if it were taste?
4. `prestige_bias_risk`
   Does this entry carry tags that over-signal seriousness or sophistication?
5. `consistency_with_similar_titles`
   Do comparable films get comparable tags?

## Priority Fixes

1. Correct objective inconsistencies first
   - Example: `Arrival/nonEnglish`
2. Remove or demote `nonEnglish` from taste scoring logic
3. Rebalance broad tags
   - especially `darkTone`, `uplifting`, `nonEnglish`
4. Audit tag asymmetry by region
   - US/UK vs JP/KR/TW/FR/IT
5. Recheck high-impact canonical titles
   - `Parasite`
   - `Oldboy`
   - `Burning`
   - `Spirited Away`
   - `Your Name`
   - `The Matrix`
   - `Inception`
   - `Interstellar`
   - `Joker`
   - `Arrival`

## Recommended Policy Changes

1. Add a machine validation pass before loading the pool:
   - invalid tag keys
   - region/tag conflicts
   - duplicate TMDB IDs
2. Add a human review field per movie:
   - `confidence`
   - `reviewed_by`
   - `last_reviewed_at`
3. Make metadata explicit:
   - `language_group`
   - `is_non_english`
   - `market_region`

Do not overload taste tags with this information.

## Bottom Line

The current pool is usable, but it is not yet neutral.

The biggest risks are:
- overusing `nonEnglish` as a taste signal
- broad-tag dominance
- US-heavy source composition
- inconsistent tag semantics across regions

If Phase 1 shapes the user's initial quadrant, Phase 2-3 can still reinforce those biases because the AI pair engine inherits the same taxonomy and pool assumptions.

