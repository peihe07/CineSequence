"""DNA builder: compute tag vector, genre vector, and assign archetype from picks."""

import json
import math
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

# TMDB genre ID → name mapping for archetype genre matching
GENRE_ID_TO_NAME: dict[int, str] = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 53: "Thriller",
    10752: "War", 37: "Western",
}


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

    # Log-dampened normalization: compress repeated-test advantage,
    # then scale to [0, 1]. log(1+x) ensures a tag tested 3 times
    # (raw=3.0) doesn't dominate one tested once (raw=1.0) by 3x.
    vector = [math.log1p(v) for v in vector]
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
        # Tag affinity: average of user's tag scores for archetype's match_tags
        match_tags = [t for t in archetype.get("match_tags", []) if t in TAG_INDEX]
        tag_score = (
            sum(tag_vector[TAG_INDEX[t]] for t in match_tags) / len(match_tags)
            if match_tags
            else 0.0
        )

        # Genre affinity: average of matching genre scores
        archetype_genre_names = {
            GENRE_ID_TO_NAME[gid]
            for gid in archetype.get("match_genres", [])
            if gid in GENRE_ID_TO_NAME
        }
        matching_genres = [
            genre_vector[g] for g in genre_vector if g in archetype_genre_names
        ]
        genre_score = (
            sum(matching_genres) / len(matching_genres) * 0.3
            if matching_genres
            else 0.0
        )

        score = tag_score + genre_score

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
