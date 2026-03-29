"""DNA builder: compute tag vector, genre vector, and assign archetype from picks.

Scoring uses three signal layers:
1. Explicit signal: test_dimension tag from each round (weight 1.0/0.7)
2. Implicit signal: all tags on the chosen movie get a weak positive boost,
   all tags on the rejected movie get a weak negative nudge.
3. Skip signal: test_dimension gets a negative weight when user skips both.
"""

import json
import math
from pathlib import Path

from app.services.pair_engine import compute_quadrant_from_picks

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

with open(DATA_DIR / "tag_taxonomy.json") as f:
    TAXONOMY = json.load(f)

with open(DATA_DIR / "archetypes.json") as f:
    ARCHETYPES: list[dict] = json.load(f)

# Movie pool lookup for implicit tag signals
with open(DATA_DIR / "movie_pool.json") as f:
    _POOL_MOVIES: list[dict] = json.load(f)["movies"]
_POOL_TAGS: dict[int, list[str]] = {m["tmdb_id"]: m.get("tags", []) for m in _POOL_MOVIES}

# Implicit signal weights
_IMPLICIT_POSITIVE = 0.3    # Chosen movie's tags
_IMPLICIT_NEGATIVE = -0.15  # Rejected movie's tags
_SKIP_WEIGHT = -0.3         # Skip = weak negative on test_dimension

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

# IDF 權重：tag 被越少原型共用，鑑別力越高
_TAG_ARCHETYPE_COUNT: dict[str, int] = {}
for _arch in ARCHETYPES:
    for _tag in _arch.get("match_tags", []):
        _TAG_ARCHETYPE_COUNT[_tag] = _TAG_ARCHETYPE_COUNT.get(_tag, 0) + 1

_NUM_ARCHETYPES = len(ARCHETYPES)
TAG_IDF: dict[str, float] = {
    tag: math.log(_NUM_ARCHETYPES / count)
    for tag, count in _TAG_ARCHETYPE_COUNT.items()
}


def _compute_raw_tag_scores(picks: list[dict]) -> list[float]:
    """Accumulate signed raw tag scores from explicit, implicit, and skip signals."""
    raw = [0.0] * len(TAG_KEYS)

    for pick in picks:
        dim = pick.get("test_dimension")
        chosen_id = pick.get("chosen_tmdb_id")
        movie_a_id = pick.get("movie_a_tmdb_id")
        movie_b_id = pick.get("movie_b_tmdb_id")

        if chosen_id is None:
            # Layer 3: skip negative signal
            if dim and dim in TAG_INDEX:
                raw[TAG_INDEX[dim]] += _SKIP_WEIGHT
            continue

        # Layer 1: explicit signal from test_dimension
        if dim and dim in TAG_INDEX:
            mode = pick.get("pick_mode", "watched")
            weight = 1.0 if mode == "watched" else 0.7
            raw[TAG_INDEX[dim]] += weight

        # Layer 2: implicit signals from movie tags
        rejected_id = movie_b_id if chosen_id == movie_a_id else movie_a_id
        chosen_tags = _POOL_TAGS.get(chosen_id, [])
        rejected_tags = _POOL_TAGS.get(rejected_id, [])

        for tag in chosen_tags:
            if tag in TAG_INDEX and tag != dim:
                raw[TAG_INDEX[tag]] += _IMPLICIT_POSITIVE

        for tag in rejected_tags:
            if tag in TAG_INDEX and tag != dim:
                raw[TAG_INDEX[tag]] += _IMPLICIT_NEGATIVE

    return raw


def compute_tag_vector(picks: list[dict]) -> list[float]:
    """Build a 30-dimensional display tag vector from three signal layers.

    Layer 1 — Explicit signal (test_dimension):
      - watched: +1.0, attracted: +0.7

    Layer 2 — Implicit signal (movie tags from pool):
      - Chosen movie's tags: +0.3 each
      - Rejected movie's tags: -0.15 each
      (Only for tags that exist in TAG_INDEX, excludes test_dimension
       to avoid double-counting)

    Layer 3 — Skip signal:
      - Skip (no chosen movie): test_dimension gets -0.3

    Raw scores are log-dampened and normalized to [0, 1].
    Negative values are preserved as 0 after normalization.
    """
    raw = _compute_raw_tag_scores(picks)

    # Clamp negatives to 0, then log-dampen and normalize to [0, 1]
    vector = [max(0.0, v) for v in raw]
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


def get_top_tags(vector: list[float], top_n: int = 3) -> list[str]:
    """Return the strongest tag names in ranked order."""
    pairs = [(TAG_KEYS[i], vector[i]) for i in range(len(vector)) if vector[i] > 0]
    pairs.sort(key=lambda x: x[1], reverse=True)
    return [tag for tag, _ in pairs[:top_n]]


def get_excluded_tags(vector: list[float]) -> list[str]:
    """Return tags that scored exactly 0 — consistently avoided."""
    return [TAG_KEYS[i] for i in range(len(vector)) if vector[i] == 0.0]


def compute_confidence(picks: list[dict]) -> dict[str, float]:
    """Compute confidence score for each tag based on test frequency.

    Counts how many times each tag appeared as test_dimension or as an
    implicit signal (via movie tags). Confidence = min(1.0, count / 3),
    meaning a tag needs ~3 encounters to reach full confidence.

    Returns {tag_key: confidence} for all tags with any signal.
    """
    encounter_count: dict[str, int] = {}

    for pick in picks:
        # Direct test_dimension encounter
        dim = pick.get("test_dimension")
        if dim and dim in TAG_INDEX:
            encounter_count[dim] = encounter_count.get(dim, 0) + 1

        # Implicit encounters from movie tags
        for tmdb_id in (pick.get("movie_a_tmdb_id"), pick.get("movie_b_tmdb_id")):
            if tmdb_id:
                for tag in _POOL_TAGS.get(tmdb_id, []):
                    if tag in TAG_INDEX and tag != dim:
                        encounter_count[tag] = encounter_count.get(tag, 0) + 1

    return {tag: min(1.0, count / 3) for tag, count in encounter_count.items()}


def compute_consistency(picks: list[dict]) -> dict[str, float]:
    """Compute consistency ratio for each tag: how often it was picked vs skipped.

    Tracks per-tag pick/skip counts across all signal sources:
    - Explicit: test_dimension picked → +1 pick, skipped → +1 skip
    - Implicit: chosen movie's tag → +1 pick, rejected movie's tag → +1 skip

    Returns {tag: ratio} where ratio ∈ [0, 1].
    0.0 = always avoided, 0.5 = contradictory, 1.0 = always preferred.
    Only includes tags with ≥2 encounters.
    """
    picks_for: dict[str, int] = {}
    picks_against: dict[str, int] = {}

    for pick in picks:
        dim = pick.get("test_dimension")
        chosen_id = pick.get("chosen_tmdb_id")
        movie_a_id = pick.get("movie_a_tmdb_id")
        movie_b_id = pick.get("movie_b_tmdb_id")

        if chosen_id is None:
            # Skip: count against the test_dimension
            if dim and dim in TAG_INDEX:
                picks_against[dim] = picks_against.get(dim, 0) + 1
            continue

        # Explicit signal
        if dim and dim in TAG_INDEX:
            picks_for[dim] = picks_for.get(dim, 0) + 1

        # Implicit signals
        rejected_id = movie_b_id if chosen_id == movie_a_id else movie_a_id
        for tag in _POOL_TAGS.get(chosen_id, []):
            if tag in TAG_INDEX and tag != dim:
                picks_for[tag] = picks_for.get(tag, 0) + 1
        for tag in _POOL_TAGS.get(rejected_id, []):
            if tag in TAG_INDEX and tag != dim:
                picks_against[tag] = picks_against.get(tag, 0) + 1

    all_tags = set(picks_for) | set(picks_against)
    result = {}
    for tag in all_tags:
        f = picks_for.get(tag, 0)
        a = picks_against.get(tag, 0)
        total = f + a
        if total >= 2:
            result[tag] = round(f / total, 3)

    return result


# Ideal quadrant profile for each archetype (axis → expected value).
# Only core 3 axes are used; missing axes default to 3.0 (neutral).
# Scale: 1.0-5.0 where 3.0 is neutral.
ARCHETYPE_QUADRANT: dict[str, dict[str, float]] = {
    "time_traveler": {
        "mainstream_independent": 3.8,
        "rational_emotional": 2.0,
        "light_dark": 3.5,
    },
    "dark_poet": {
        "mainstream_independent": 4.0,
        "rational_emotional": 2.5,
        "light_dark": 4.5,
    },
    "emotional_sponge": {
        "mainstream_independent": 2.5,
        "rational_emotional": 4.5,
        "light_dark": 2.5,
    },
    "chaos_theorist": {
        "mainstream_independent": 4.5,
        "rational_emotional": 3.0,
        "light_dark": 3.5,
    },
    "quiet_observer": {
        "mainstream_independent": 3.8,
        "rational_emotional": 3.5,
        "light_dark": 3.0,
    },
    "adrenaline_junkie": {
        "mainstream_independent": 1.8,
        "rational_emotional": 2.5,
        "light_dark": 3.5,
    },
    "reality_hunter": {
        "mainstream_independent": 3.5,
        "rational_emotional": 3.0,
        "light_dark": 3.5,
    },
    "world_wanderer": {
        "mainstream_independent": 4.0,
        "rational_emotional": 3.5,
        "light_dark": 3.0,
    },
    "master_planner": {
        "mainstream_independent": 2.5,
        "rational_emotional": 2.0,
        "light_dark": 3.0,
    },
    "dystopia_architect": {
        "mainstream_independent": 3.5,
        "rational_emotional": 2.5,
        "light_dark": 4.5,
    },
    "dream_weaver": {
        "mainstream_independent": 4.2,
        "rational_emotional": 3.5,
        "light_dark": 3.0,
    },
    "lone_wolf": {
        "mainstream_independent": 3.5,
        "rational_emotional": 2.5,
        "light_dark": 4.0,
    },
}

_QUADRANT_WEIGHT = 0.3  # How much quadrant distance affects archetype scoring


def assign_archetype(
    tag_vector: list[float],
    genre_vector: dict[str, float],
    quadrant_scores: dict[str, float] | None = None,
    raw_tag_scores: list[float] | None = None,
) -> dict:
    """Score each archetype using IDF-weighted tag sum + genre affinity + quadrant fit.

    IDF weighting: tags shared by fewer archetypes carry more discriminative
    power. Weighted sum (not average) so archetypes with more matching tags
    aren't penalised when the user genuinely matches multiple signals.

    Quadrant fit: euclidean distance between user's quadrant and archetype's
    ideal quadrant profile, penalized with _QUADRANT_WEIGHT.
    """
    best_score = -1.0
    best_archetype = ARCHETYPES[0]

    for archetype in ARCHETYPES:
        # IDF-weighted tag affinity: sum of user_score × idf_weight
        match_tags = [t for t in archetype.get("match_tags", []) if t in TAG_INDEX]
        tag_score = sum(
            tag_vector[TAG_INDEX[t]] * TAG_IDF.get(t, 1.0)
            for t in match_tags
        )
        negative_penalty = 0.0
        if raw_tag_scores is not None:
            negative_penalty = sum(
                abs(min(raw_tag_scores[TAG_INDEX[t]], 0.0)) * TAG_IDF.get(t, 1.0)
                for t in match_tags
            )

        # Genre affinity: average of matching genre scores × 0.5
        archetype_genre_names = {
            GENRE_ID_TO_NAME[gid]
            for gid in archetype.get("match_genres", [])
            if gid in GENRE_ID_TO_NAME
        }
        matching_genres = [
            genre_vector[g] for g in genre_vector if g in archetype_genre_names
        ]
        genre_score = (
            sum(matching_genres) / len(matching_genres) * 0.5
            if matching_genres
            else 0.0
        )

        # Quadrant distance penalty
        quadrant_penalty = 0.0
        arch_profile = ARCHETYPE_QUADRANT.get(archetype["id"])
        if quadrant_scores and arch_profile:
            dist_sq = sum(
                (quadrant_scores.get(axis, 3.0) - arch_profile.get(axis, 3.0)) ** 2
                for axis in ("mainstream_independent", "rational_emotional", "light_dark")
            )
            quadrant_penalty = math.sqrt(dist_sq) * _QUADRANT_WEIGHT

        score = tag_score + genre_score - quadrant_penalty - negative_penalty

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
    raw_tag_scores = _compute_raw_tag_scores(picks)
    tag_vector = compute_tag_vector(picks)
    genre_vector = compute_genre_vector(picks, genre_map)
    quadrant_scores = compute_quadrant_from_picks(picks)
    archetype = assign_archetype(tag_vector, genre_vector, quadrant_scores, raw_tag_scores)
    tag_labels = get_tag_labels(tag_vector)
    excluded_tags = get_excluded_tags(tag_vector)
    confidence = compute_confidence(picks)
    consistency = compute_consistency(picks)

    return {
        "archetype_id": archetype["id"],
        "tag_vector": tag_vector,
        "tag_labels": tag_labels,
        "top_tags": get_top_tags(tag_vector),
        "excluded_tags": excluded_tags,
        "genre_vector": genre_vector,
        "quadrant_scores": quadrant_scores,
        "ticket_style": archetype["ticket_style"],
        "archetype": archetype,
        "tag_confidence": confidence,
        "tag_consistency": consistency,
    }
