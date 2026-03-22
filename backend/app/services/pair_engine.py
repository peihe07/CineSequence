"""Phase 1 pair engine: rule-based pairs from phase1_pairs.json."""

import json
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

# Default selection: 5 pairs covering all 3 quadrant axes + 2 extra dimensions
DEFAULT_PAIR_IDS = ["p1_01", "p1_02", "p1_03", "p1_05", "p1_07"]


def _get_pair_by_id(pair_id: str) -> dict | None:
    for pair in ALL_PAIRS:
        if pair["id"] == pair_id:
            return pair
    return None


def _score_pair_relevance(pair: dict, seed_genres: list[str]) -> float:
    """Score how relevant a pair is to the seed movie's genres."""
    if not seed_genres:
        return 0.0

    # Simple heuristic: check if pair's movies share genres with seed
    pair_keywords = pair.get("label", "").lower()
    score = 0.0
    genre_signals = {
        "Action": ["英雄", "腎上腺素", "漫威"],
        "Drama": ["救贖", "階級", "純愛"],
        "Comedy": ["喜劇", "存在主義"],
        "Science Fiction": ["科幻", "燒腦"],
        "Romance": ["浪漫", "歌舞", "純愛"],
        "Thriller": ["暴力", "反體制"],
        "Animation": ["冒險", "奇幻"],
    }

    for genre in seed_genres:
        keywords = genre_signals.get(genre, [])
        for kw in keywords:
            if kw in pair_keywords:
                score += 1.0

    return score


def get_phase1_pairs(seed_movie_genres: list[str] | None = None) -> list[dict]:
    """Return 5 ordered pairs for Phase 1. Reorders by seed movie relevance if provided."""
    # Start with the default 5 pairs
    selected = [_get_pair_by_id(pid) for pid in DEFAULT_PAIR_IDS]
    selected = [p for p in selected if p is not None]

    if seed_movie_genres:
        # Reorder: most relevant pair first, but ensure all quadrant axes are covered
        selected.sort(key=lambda p: _score_pair_relevance(p, seed_movie_genres), reverse=True)

    return selected


def get_pair_for_round(round_number: int, seed_movie_genres: list[str] | None = None) -> dict:
    """Get the specific pair for a given round (1-5)."""
    pairs = get_phase1_pairs(seed_movie_genres)
    index = round_number - 1
    if 0 <= index < len(pairs):
        return pairs[index]
    raise ValueError(f"Invalid Phase 1 round number: {round_number}")


def get_reroll_pair_for_round(
    round_number: int,
    seed_movie_genres: list[str] | None = None,
    used_pair_ids: set[str] | None = None,
    exclude_tmdb_ids: set[int] | None = None,
) -> dict | None:
    """Return an alternate Phase 1 pair for the same round without consuming it."""
    if not 1 <= round_number <= 5:
        raise ValueError(f"Invalid Phase 1 round number: {round_number}")

    used_pair_ids = used_pair_ids or set()
    exclude_tmdb_ids = exclude_tmdb_ids or set()
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
        return pair

    return None


def compute_quadrant_from_picks(picks: list[dict]) -> dict:
    """Compute quadrant scores from Phase 1 picks.

    Each pick shifts the score on the relevant axis.
    Choosing movie_a shifts toward one end, movie_b toward the other.
    Scale: 1-5 where 3 is neutral.
    """
    scores = {
        "mainstream_independent": 3.0,
        "rational_emotional": 3.0,
        "light_dark": 3.0,
    }

    for pick in picks:
        if pick.get("phase") != 1:
            continue

        pair_id = pick.get("pair_id")
        pair = _get_pair_by_id(pair_id)
        if not pair:
            continue

        dimension = pair.get("dimension", "")
        axis = DIMENSION_TO_AXIS.get(dimension)
        if not axis:
            continue

        chosen = pick.get("chosen_tmdb_id")
        if chosen is None:
            continue

        # movie_a is typically the "mainstream/rational/light" option
        # movie_b is typically the "independent/emotional/dark" option
        movie_a_id = pair["movie_a"]["tmdb_id"]
        shift = -0.5 if chosen == movie_a_id else 0.5
        scores[axis] = max(1.0, min(5.0, scores[axis] + shift))

    return scores
