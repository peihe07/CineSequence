"""Phase 1 pair engine: rule-based pairs from phase1_pairs.json.

Randomly selects 5 pairs per session while guaranteeing coverage of
all 3 quadrant axes (mainstream_vs_independent, rational_vs_emotional,
light_vs_dark). Uses session_seed for deterministic randomness so the
same session always produces the same pair sequence.
"""

import hashlib
import json
import random
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "phase1_pairs.json"

# Load pairs at module level
with open(DATA_FILE) as f:
    ALL_PAIRS: list[dict] = json.load(f)

# Map dimension names to quadrant axes for scoring
DIMENSION_TO_AXIS = {
    "mainstream_vs_independent": "mainstream_independent",
    "rational_vs_emotional": "rational_emotional",
    "light_vs_dark": "light_dark",
}

# Supplementary axes from auxiliary dimensions (C4)
SUPPLEMENTARY_AXIS = {
    "fast_vs_slow": "fast_slow",
    "ensemble_vs_solo": "ensemble_solo",
    "visual_vs_dialogue": "visual_dialogue",
    "spectacle_vs_intimate": "spectacle_intimate",
    "straightforward_vs_meta": "straightforward_meta",
    "realism_vs_fantasy": "realism_fantasy",
    "contemporary_vs_period": "contemporary_period",
    "cynical_vs_sincere": "cynical_sincere",
}

# The 3 required quadrant axes — each session must include at least 1 pair per axis
REQUIRED_AXES = ["mainstream_vs_independent", "rational_vs_emotional", "light_vs_dark"]

PHASE1_COUNT = 7


def _get_pair_by_id(pair_id: str) -> dict | None:
    for pair in ALL_PAIRS:
        if pair["id"] == pair_id:
            return pair
    return None


def _score_pair_relevance(pair: dict, seed_genres: list[str]) -> float:
    """Score how relevant a pair is to the seed movie's genres."""
    if not seed_genres:
        return 0.0

    pair_keywords = pair.get("label", "").lower()
    score = 0.0
    genre_signals = {
        "Action": ["英雄", "腎上腺素", "漫威", "動作", "追逐"],
        "Drama": ["救贖", "階級", "純愛", "劇情", "傳記"],
        "Comedy": ["喜劇", "存在主義", "幽默", "荒謬"],
        "Science Fiction": ["科幻", "燒腦", "太空", "駭客", "科技"],
        "Romance": ["浪漫", "歌舞", "純愛", "初戀", "書信"],
        "Thriller": ["暴力", "反體制", "殺手", "恐懼", "驚悚"],
        "Animation": ["冒險", "奇幻", "動畫", "宮崎駿", "皮克斯"],
        "Horror": ["恐懼", "心理", "黑暗"],
        "War": ["戰爭", "殘酷"],
        "Crime": ["犯罪", "黑幫", "復仇"],
    }

    for genre in seed_genres:
        keywords = genre_signals.get(genre, [])
        for kw in keywords:
            if kw in pair_keywords:
                score += 1.0

    return score


def _session_rng(session_seed: str | None) -> random.Random:
    """Create a deterministic RNG from session seed."""
    if not session_seed:
        return random.Random()
    # Hash the session_seed (UUID string) to get a stable integer seed
    seed_int = int(hashlib.sha256(session_seed.encode()).hexdigest()[:16], 16)
    return random.Random(seed_int)


def get_phase1_pairs(
    seed_movie_genres: list[str] | None = None,
    session_seed: str | None = None,
) -> list[dict]:
    """Return PHASE1_COUNT randomly selected pairs for Phase 1.

    Guarantees at least 1 pair per required quadrant axis, then fills
    remaining slots prioritizing uncovered dimensions (supplementary axes).
    Uses session_seed for deterministic selection across calls.
    Seed movie genres influence the weighting of pair selection.
    """
    rng = _session_rng(session_seed)

    # Group pairs by dimension
    axis_pairs: dict[str, list[dict]] = {axis: [] for axis in REQUIRED_AXES}
    other_pairs: list[dict] = []

    for pair in ALL_PAIRS:
        dim = pair.get("dimension", "")
        if dim in axis_pairs:
            axis_pairs[dim].append(pair)
        else:
            other_pairs.append(pair)

    selected: list[dict] = []
    used_tmdb_ids: set[int] = set()

    # Step 1: Pick 1 pair per required axis (weighted by seed relevance)
    for axis in REQUIRED_AXES:
        candidates = axis_pairs[axis]
        if not candidates:
            continue

        weights = [
            _score_pair_relevance(p, seed_movie_genres or []) + 1.0
            for p in candidates
        ]
        chosen = rng.choices(candidates, weights=weights, k=1)[0]
        selected.append(chosen)
        used_tmdb_ids.add(chosen["movie_a"]["tmdb_id"])
        used_tmdb_ids.add(chosen["movie_b"]["tmdb_id"])

    # Step 2: Fill remaining slots, prioritizing uncovered dimensions
    remaining_slots = PHASE1_COUNT - len(selected)
    if remaining_slots > 0:
        selected_ids = {p["id"] for p in selected}
        covered_dims = {p.get("dimension") for p in selected}
        pool = [
            p for p in ALL_PAIRS
            if p["id"] not in selected_ids
            and p["movie_a"]["tmdb_id"] not in used_tmdb_ids
            and p["movie_b"]["tmdb_id"] not in used_tmdb_ids
        ]

        def _compute_weights(
            candidates: list[dict],
            genres: list[str],
            covered: set[str],
        ) -> list[float]:
            """Weight candidates: bonus for uncovered dimensions."""
            ws = []
            for p in candidates:
                base = _score_pair_relevance(p, genres) + 1.0
                dim_bonus = 3.0 if p.get("dimension") not in covered else 0.0
                ws.append(base + dim_bonus)
            return ws

        while remaining_slots > 0 and pool:
            weights = _compute_weights(pool, seed_movie_genres or [], covered_dims)
            chosen = rng.choices(pool, weights=weights, k=1)[0]
            selected.append(chosen)
            used_tmdb_ids.add(chosen["movie_a"]["tmdb_id"])
            used_tmdb_ids.add(chosen["movie_b"]["tmdb_id"])
            covered_dims.add(chosen.get("dimension"))

            # Remove chosen and any overlapping pairs from pool
            idx = pool.index(chosen)
            pool.pop(idx)

            # Filter out pairs that share movies with the newly selected pair
            pool = [
                p for p in pool
                if (p["movie_a"]["tmdb_id"] not in used_tmdb_ids
                    and p["movie_b"]["tmdb_id"] not in used_tmdb_ids)
            ]
            remaining_slots -= 1

    # Shuffle final order (deterministic)
    rng.shuffle(selected)
    return selected


def get_pair_for_round(
    round_number: int,
    seed_movie_genres: list[str] | None = None,
    session_seed: str | None = None,
) -> dict:
    """Get the specific pair for a given Phase 1 round."""
    pairs = get_phase1_pairs(seed_movie_genres, session_seed)
    index = round_number - 1
    if 0 <= index < len(pairs):
        return pairs[index]
    raise ValueError(f"Invalid Phase 1 round number: {round_number}")


def get_reroll_pair_for_round(
    round_number: int,
    seed_movie_genres: list[str] | None = None,
    used_pair_ids: set[str] | None = None,
    exclude_tmdb_ids: set[int] | None = None,
    reserved_tmdb_ids: set[int] | None = None,
) -> dict | None:
    """Return an alternate Phase 1 pair for the same round without consuming it."""
    if not 1 <= round_number <= PHASE1_COUNT:
        raise ValueError(f"Invalid Phase 1 round number: {round_number}")

    used_pair_ids = used_pair_ids or set()
    exclude_tmdb_ids = exclude_tmdb_ids or set()
    reserved_tmdb_ids = reserved_tmdb_ids or set()
    ordered_pairs = sorted(
        ALL_PAIRS,
        key=lambda pair: _score_pair_relevance(pair, seed_movie_genres or []),
        reverse=True,
    )

    for pair in ordered_pairs:
        if pair["id"] in used_pair_ids:
            continue
        pair_movie_ids = {
            pair["movie_a"]["tmdb_id"],
            pair["movie_b"]["tmdb_id"],
        }
        if pair_movie_ids & exclude_tmdb_ids:
            continue
        if pair_movie_ids & reserved_tmdb_ids:
            continue
        return pair

    return None


# Tag → quadrant axis mapping for Phase 2-3 implicit quadrant signals.
# When a picked movie has these tags, it nudges the corresponding axis.
# Format: {tag: (axis, direction)} where direction is +1 (toward second end)
# or -1 (toward first end).
TAG_TO_QUADRANT: dict[str, tuple[str, float]] = {
    # mainstream ↔ independent
    "cult": ("mainstream_independent", +0.3),
    "experimental": ("mainstream_independent", +0.3),
    "absurdist": ("mainstream_independent", +0.3),
    # rational ↔ emotional
    "mindfuck": ("rational_emotional", -0.3),
    "philosophical": ("rational_emotional", -0.3),
    "tearjerker": ("rational_emotional", +0.3),
    "romanticCore": ("rational_emotional", +0.3),
    # light ↔ dark
    "darkTone": ("light_dark", +0.3),
    "uplifting": ("light_dark", -0.3),
    # fast ↔ slow
    "slowburn": ("fast_slow", +0.3),
    # visual ↔ dialogue
    "visualFeast": ("visual_dialogue", -0.3),
    "dialogue": ("visual_dialogue", +0.3),
    # realism ↔ fantasy
    "trueStory": ("realism_fantasy", -0.3),
    "dystopia": ("realism_fantasy", +0.3),
    "timeTravel": ("realism_fantasy", +0.3),
    # cynical ↔ sincere
    "satirical": ("cynical_sincere", -0.3),
    "nostalgic": ("cynical_sincere", +0.3),
}


def compute_quadrant_from_picks(picks: list[dict]) -> dict:
    """Compute quadrant scores from all picks across all phases.

    Phase 1: rule-based pairs with known dimension → ±0.5 shift per pick.
    Phase 2-3: AI pairs contribute via tag-to-axis mapping with ±0.3 shift,
    derived from the chosen movie's tags in the movie pool.

    Scale: 1-5 where 3 is neutral.
    """
    scores = {
        "mainstream_independent": 3.0,
        "rational_emotional": 3.0,
        "light_dark": 3.0,
    }

    for pick in picks:
        chosen = pick.get("chosen_tmdb_id")
        if chosen is None:
            continue

        phase = pick.get("phase")

        if phase == 1:
            # Phase 1: rule-based pair dimension shift
            pair_id = pick.get("pair_id")
            pair = _get_pair_by_id(pair_id)
            if not pair:
                continue

            dimension = pair.get("dimension", "")
            axis = DIMENSION_TO_AXIS.get(dimension) or SUPPLEMENTARY_AXIS.get(dimension)
            if not axis:
                continue

            if axis not in scores:
                scores[axis] = 3.0

            movie_a_id = pair["movie_a"]["tmdb_id"]
            shift = -0.5 if chosen == movie_a_id else 0.5
            scores[axis] = max(1.0, min(5.0, scores[axis] + shift))

        else:
            # Phase 2-3: infer quadrant shifts from chosen movie's tags
            from app.services.dna_builder import _POOL_TAGS

            chosen_tags = _POOL_TAGS.get(chosen, [])
            for tag in chosen_tags:
                if tag not in TAG_TO_QUADRANT:
                    continue
                axis, direction = TAG_TO_QUADRANT[tag]
                if axis not in scores:
                    scores[axis] = 3.0
                scores[axis] = max(1.0, min(5.0, scores[axis] + direction))

    return scores
