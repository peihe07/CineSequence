# Movie Pool Changelog

> Last updated: 2026-03-29
> Tracks major curation, scoring, and sequencing changes that affect the cinephile-facing movie pool.

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
