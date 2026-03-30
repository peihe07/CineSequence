# Movie Pool Changelog

> Last updated: 2026-03-30
> Tracks major curation, scoring, and sequencing changes that affect the cinephile-facing movie pool.

## 2026-03-30

### Scope

- Bridge-auteur pool follow-up after the first Phase 1 rebalance pass
- First cinephile taxonomy signal expansion

### Pool Curation

- Added `Paris, Texas`, `Wings of Desire`, `Inside Llewyn Davis`, and `Phantom Thread` to `backend/app/data/movie_pool.json`.
- Added `A Serious Man`, `Fargo`, and `There Will Be Blood` as the second bridge-auteur follow-up batch.
- Used these additions to connect the new Phase 1 bridge-auteur pairs back into the downstream Phase 2-3 candidate pool.
- Strengthened coverage for Wim Wenders, Paul Thomas Anderson, and the Coen brothers without requiring a broader taxonomy redesign first.

### Reviewability

- Added matching entries in `backend/app/data/movie_pool_reviews.json` for all four new titles.
- Marked all four as `phase1_anchor` so future reviews can distinguish them from generic tag-coverage additions.

### Taxonomy Expansion

- Added `artHouseBridge`, `urbanLoneliness`, `driftCinema`, `blackComedy`, and `moralAnxiety` to `backend/app/data/tag_taxonomy.json`.
- Mapped the first batch of bridge-auteur, drift, black-comedy, and moral-anxiety titles onto those new tags inside `backend/app/data/movie_pool.json`.
- Updated the DNA vector schema and prompt surface so the new taxonomy can be scored end-to-end instead of living as dead metadata.

### Verification

- `node scripts/validate_movie_pool.js`
- `cd backend && ./.venv/bin/python -m pytest tests/unit/test_movie_pool.py`

## 2026-03-29

### Scope

- Non-mainstream movie pool expansion
- Tag normalization back into taxonomy
- Phase 1 pair rebuild and pool expansion
- Pair review metadata coverage
- DNA stability tuning tied to pool interpretation

### Pool Curation

- Expanded `backend/app/data/movie_pool.json` with 41 non-mainstream titles across Taiwan, Hong Kong, Japan, Korea, Southeast Asia, Europe, Iran, Africa, and Latin America.
- Reduced the US share of the pool from roughly 59% to 52%.
- Raised the non-English share of the pool from roughly 41% to 48%.
- Strengthened representation for Tsai Ming-liang, Hou Hsiao-hsien, Wong Kar Wai, Jia Zhangke, Bi Gan, Apichatpong Weerasethakul, Hong Sang-soo, Satoshi Kon, Bela Tarr, Abbas Kiarostami, Michael Haneke, and other festival-canon filmmakers.

### Tag Taxonomy Normalization

- Removed taxonomy-external tags from `movie_pool.json` so new additions affect scoring instead of silently dropping signal.
- Mapped legacy curation tags such as `auteur`, `slowCinema`, `wuxia`, `urbanDread`, `anime`, and `scifi` back to supported taxonomy tags in `backend/app/data/tag_taxonomy.json`.
- Added regression coverage to prevent legacy tags from re-entering the pool unnoticed.

### Phase 1 Sequencing

- Expanded `backend/app/data/phase1_pairs.json` from 40 to 60 pairs.
- Rebuilt the core opening pairs around stronger taste contrasts instead of basic blockbuster-versus-indie splits.
- Removed the `western_vs_eastern` dimension because it measured familiarity and culture proximity more than taste.
- Preserved deterministic session behavior while keeping no-overlap and required-axis coverage rules intact.

### Pair Reviewability

- Added `backend/app/data/phase1_pair_reviews.json` for pair-by-pair review metadata.
- Required every pair to carry `confidence`, `confounds`, `why_valid`, and `replacement_needed`.
- Extended validator and unit-test coverage so pair data and review metadata stay in sync.

### Pool Reviewability

- Added `backend/app/data/movie_pool_reviews.json` so every curated pool entry now has a matching review record.
- Bootstrapped lightweight coverage metadata using `phase1_anchor`, `region_balance`, and `tag_coverage` as the first controlled vocabulary for pool review.
- Extended movie-pool validation and unit-test coverage so review metadata stays in parity with `movie_pool.json`.

### DNA Stability Follow-Up

- Added consistency weighting in `backend/app/services/dna_builder.py` so contradicted tags are downweighted relative to stable tags.
- Added session-seeded candidate randomness in `backend/app/services/ai_pair_engine.py` so fresh sessions do not collapse into near-identical Phase 2-3 pools.
- Tuned `backend/app/data/archetypes.json` to reduce overlap between `dark_poet`, `lone_wolf`, `dream_weaver`, and adjacent archetypes.

### Verification

- `node scripts/validate_movie_pool.js`
- `node scripts/validate_phase1_pairs.js`
- `cd backend && ./.venv/bin/python -m pytest tests/unit/test_movie_pool.py`
- `cd backend && ./.venv/bin/python -m pytest tests/unit/test_pair_engine.py`
- `cd backend && ./.venv/bin/python -m pytest tests/unit/test_dna_builder.py`
- `cd backend && ./.venv/bin/python -m pytest tests/unit/test_ai_pair_engine.py`
- `cd backend && ./.venv/bin/python -m pytest tests/unit/test_ai_personality.py`
- `npm run test:backend:unit`
