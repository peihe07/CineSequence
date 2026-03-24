# Phase 1 Pair Audit

This document audits the current Phase 1 taste-pair dataset in [phase1_pairs.json](/Users/peihe/Personal_Projects/movie-dna/backend/app/data/phase1_pairs.json) for accuracy, confounds, and cultural bias risk.

## Scope

- Dataset size: 40 pairs
- Core dimensions:
  - `mainstream_vs_independent` (6)
  - `rational_vs_emotional` (7)
  - `light_vs_dark` (7)
- Supplementary dimensions: 20 pairs across 9 dimensions

## Audit Rubric

Each pair should be reviewed on five axes:

1. Single-variable clarity
   Does the pair mainly isolate one intended dimension?
2. Confound risk
   Does the choice also strongly reflect language, region, era, budget, fame, franchise status, or gender-coded genre norms?
3. Direction validity
   Is it defensible that `movie_a` consistently leans toward the first side of the dimension and `movie_b` toward the second?
4. Cultural fairness
   Is the pair accidentally encoding "Hollywood vs world cinema", "male-coded vs female-coded", or "commercial vs sophisticated"?
5. User inference quality
   If a user picks one side, is the inferred taste signal likely to be true rather than accidental?

## High-Risk Findings

### 1. `mainstream_vs_independent` is currently over-coupled to Hollywood vs non-English cinema

High-risk pairs:
- `p1_01` `The Dark Knight` vs `Parasite`
- `p1_02` `Avengers: Infinity War` vs `Pan's Labyrinth`
- `p1_04` `Frozen` vs `A Separation`
- `p1_05` `Skyfall` vs `4 Months, 3 Weeks and 2 Days`
- `p1_06` `Inside Out` vs `Burning`

Why this is risky:
- These are not just measuring mainstreamness.
- They also measure language familiarity, region familiarity, art-house tolerance, festival exposure, and sometimes age/education/cultural capital.
- A user may choose the Hollywood title simply because they have seen it, not because they dislike independent film.

Recommended action:
- Rebuild this dimension with pairs that stay closer on language/region while varying mainly on formal accessibility or studio scale.

### 2. `rational_vs_emotional` is currently entangled with genre and gender-coded storytelling

High-risk pairs:
- `p1_07` `Inception` vs `La La Land`
- `p1_08` `Interstellar` vs `Call Me by Your Name`
- `p1_10` `The Matrix` vs `Amélie`
- `p1_12` `The Imitation Game` vs `Me Before You`
- `p1_13` `The Martian` vs `The Notebook`

Why this is risky:
- These pairs often compare science-fiction/problem-solving films against romance or intimacy-driven films.
- That can turn the dimension into "STEM-coded vs romance-coded" rather than a stable rational/emotional taste axis.
- It also risks encoding gender bias into the tag system.

Recommended action:
- Keep genre and tone more aligned within pairs.
- Example target structure: cerebral drama vs affective drama, or puzzle-thriller vs mood-thriller, instead of sci-fi vs romance.

### 3. `light_vs_dark` often mixes darkness with violence, crime, or horror

High-risk pairs:
- `p1_14` `The Lord of the Rings` vs `Fight Club`
- `p1_16` `Toy Story` vs `The Silence of the Lambs`
- `p1_18` `Harry Potter and the Philosopher's Stone` vs `The Shining`
- `p1_19` `Spirited Away` vs `Oldboy`
- `p1_20` `Monsters, Inc.` vs `Saving Private Ryan`

Why this is risky:
- The current implementation often measures family-friendliness vs violence, not "light vs dark" in a pure tonal sense.
- Horror tolerance, crime tolerance, and comfort with brutality become hidden confounds.

Recommended action:
- Rebuild with more tone-matched pairs.
- Example target structure: hopeful drama vs bleak drama, whimsical fantasy vs unsettling fantasy.

### 4. `western_vs_eastern` is especially vulnerable to essentialism

High-risk pairs:
- `p1_28` `The Godfather` vs `Seven Samurai`
- `p1_29` `Gladiator` vs `Your Name`
- `p1_30` `The Empire Strikes Back` vs `Yi Yi`

Why this is risky:
- These pairs compress multiple differences into one label: region, era, pacing, production culture, narrative style, and familiarity.
- This dimension risks becoming a proxy for cultural distance rather than taste.

Recommended action:
- Treat this as a lower-confidence signal at most.
- Consider removing it from Phase 1 entirely unless there is a very clear product reason to preserve it.

### 5. Some supplementary pairs have obvious mismatch problems

Examples:
- `p1_22` `Joker` vs `Cinema Paradiso` under `fast_vs_slow`
  - This also mixes darkness, era, tone, and prestige associations.
- `p1_27` `Ex Machina` vs `Rear Window` under `visual_vs_dialogue`
  - This is not a clean modern "visual spectacle vs dialogue-driven" pair.
- `p1_32` `Titanic` vs `The Departed` under `spectacle_vs_intimate`
  - `The Departed` is not a clear "intimate" counterpart.
- `p1_35` `The Prestige` vs `The Grand Budapest Hotel` under `realism_vs_fantasy`
  - The left side is not especially realist; both films are stylized.
- `p1_37` `Joker` vs `Schindler's List` under `contemporary_vs_period`
  - The pair introduces moral gravity and historical trauma as major confounds.

## Priority Ranking

Review order:

1. `mainstream_vs_independent`
2. `rational_vs_emotional`
3. `light_vs_dark`
4. `western_vs_eastern`
5. `spectacle_vs_intimate`
6. `realism_vs_fantasy`

Reason:
- The first three dimensions heavily influence the session because Phase 1 guarantees coverage of them.
- If these are biased, the downstream quadrant scores and AI pair selection become biased too.

## Recommended Redesign Rules

When replacing a pair, apply these constraints:

1. Keep language/region aligned when possible.
2. Keep era proximity within roughly 15 years unless era is the intended variable.
3. Avoid pairing franchise blockbuster vs arthouse world-cinema as the default contrast.
4. Avoid romance-vs-science-fiction and family-film-vs-horror shortcuts.
5. Ensure each side can be preferred for multiple legitimate reasons, not one obvious familiarity reason.
6. For every dimension, require at least 3 pair variants reviewed by more than one person.

## Confidence Labels

Use these during review:

- `green`: mostly clean single-variable pair
- `yellow`: usable but has notable confounds
- `red`: should be replaced

Current rough assessment:
- `mainstream_vs_independent`: red
- `rational_vs_emotional`: red
- `light_vs_dark`: yellow/red
- `western_vs_eastern`: red
- `fast_vs_slow`: yellow
- `ensemble_vs_solo`: green/yellow
- `visual_vs_dialogue`: yellow/red
- `straightforward_vs_meta`: yellow
- `realism_vs_fantasy`: red
- `contemporary_vs_period`: yellow/red
- `cynical_vs_sincere`: yellow

## Next Steps

1. Create a replacement shortlist for the three core dimensions.
2. Remove or de-prioritize `western_vs_eastern` until it can be justified more rigorously.
3. Add a review column to each pair:
   - `confidence`
   - `confounds`
   - `why_valid`
   - `replacement_needed`
4. Run the same audit on [movie_pool.json](/Users/peihe/Personal_Projects/movie-dna/backend/app/data/movie_pool.json), because Phase 2-3 inherits the same taxonomy risks.

