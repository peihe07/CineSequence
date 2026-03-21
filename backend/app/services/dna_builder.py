"""DNA builder: compute tag vector, genre vector, and assign archetype from picks."""

import json
from pathlib import Path

from app.services.pair_engine import compute_quadrant_from_picks

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

with open(DATA_DIR / "tag_taxonomy.json") as f:
    TAXONOMY = json.load(f)

with open(DATA_DIR / "archetypes.json") as f:
    ARCHETYPES: list[dict] = json.load(f)

# Ordered list of tag keys matching the 30-dim vector
TAG_KEYS = list(TAXONOMY["tags"].keys())
TAG_INDEX = {tag: i for i, tag in enumerate(TAG_KEYS)}


def compute_tag_vector(picks: list[dict]) -> list[float]:
    """Build a 30-dimensional tag frequency vector from test_dimension signals.

    Each pick's test_dimension maps to a tag. We also consider pick_mode:
    - watched: weight 1.0 (confirmed taste)
    - attracted: weight 0.7 (aspirational taste)
    - skipped (no chosen_tmdb_id): weight 0 (neutral)
    """
    vector = [0.0] * len(TAG_KEYS)

    for pick in picks:
        dim = pick.get("test_dimension")
        if not dim or dim not in TAG_INDEX:
            continue
        if pick.get("chosen_tmdb_id") is None:
            continue

        mode = pick.get("pick_mode", "watched")
        weight = 1.0 if mode == "watched" else 0.7
        vector[TAG_INDEX[dim]] += weight

    # Normalize to [0, 1] range
    max_val = max(vector) if vector else 1.0
    if max_val > 0:
        vector = [v / max_val for v in vector]

    return vector


def compute_genre_vector(picks: list[dict], genre_map: dict[int, list[str]]) -> dict[str, float]:
    """Build genre frequency map from chosen movies' genres.

    genre_map: {tmdb_id: [genre_name, ...]} — pre-fetched from TMDB.
    """
    freq: dict[str, float] = {}

    for pick in picks:
        chosen = pick.get("chosen_tmdb_id")
        if chosen is None:
            continue

        genres = genre_map.get(chosen, [])
        mode = pick.get("pick_mode", "watched")
        weight = 1.0 if mode == "watched" else 0.7

        for genre in genres:
            freq[genre] = freq.get(genre, 0.0) + weight

    # Normalize
    max_val = max(freq.values()) if freq else 1.0
    if max_val > 0:
        freq = {k: round(v / max_val, 3) for k, v in freq.items()}

    return freq


def get_tag_labels(vector: list[float], top_n: int = 8) -> dict[str, float]:
    """Return the top N tag labels with their scores from the vector."""
    pairs = [(TAG_KEYS[i], vector[i]) for i in range(len(vector)) if vector[i] > 0]
    pairs.sort(key=lambda x: x[1], reverse=True)
    return {tag: round(score, 3) for tag, score in pairs[:top_n]}


def get_excluded_tags(vector: list[float]) -> list[str]:
    """Return tags that scored exactly 0 — consistently avoided."""
    return [TAG_KEYS[i] for i in range(len(vector)) if vector[i] == 0.0]


def assign_archetype(
    tag_vector: list[float],
    genre_vector: dict[str, float],
) -> dict:
    """Score each archetype by overlap with user's tags and genres, return best match."""
    best_score = -1.0
    best_archetype = ARCHETYPES[0]

    for archetype in ARCHETYPES:
        score = 0.0

        # Tag overlap: sum of user's tag scores for archetype's match_tags
        for tag in archetype.get("match_tags", []):
            if tag in TAG_INDEX:
                score += tag_vector[TAG_INDEX[tag]]

        # Genre overlap: secondary signal
        for genre_name, genre_score in genre_vector.items():
            score += genre_score * 0.1

        if score > best_score:
            best_score = score
            best_archetype = archetype

    return best_archetype


def build_dna(
    picks: list[dict],
    genre_map: dict[int, list[str]],
) -> dict:
    """Build complete DNA profile data from user's picks.

    Returns a dict ready to populate DnaProfile fields.
    """
    tag_vector = compute_tag_vector(picks)
    genre_vector = compute_genre_vector(picks, genre_map)
    quadrant_scores = compute_quadrant_from_picks(picks)
    archetype = assign_archetype(tag_vector, genre_vector)
    tag_labels = get_tag_labels(tag_vector)
    excluded_tags = get_excluded_tags(tag_vector)

    return {
        "archetype_id": archetype["id"],
        "tag_vector": tag_vector,
        "tag_labels": tag_labels,
        "excluded_tags": excluded_tags,
        "genre_vector": genre_vector,
        "quadrant_scores": quadrant_scores,
        "ticket_style": archetype["ticket_style"],
        "archetype": archetype,
    }
