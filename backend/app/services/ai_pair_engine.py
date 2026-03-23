"""Phase 2-3 AI pair engine: Gemini API generates adaptive movie pairs.

Uses a curated movie pool to guide Gemini toward diverse selections,
with hard duplicate prevention and retry logic.
"""

import json
import logging
import random
from pathlib import Path

from google import genai

from app.config import settings
from app.services.tmdb_client import get_movie

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PROMPT_FILE = DATA_DIR / "prompts" / "pair_picker.txt"
SYSTEM_PROMPT = PROMPT_FILE.read_text(encoding="utf-8")

# Valid tag keys for test_dimension validation
with open(DATA_DIR / "tag_taxonomy.json") as _f:
    _VALID_TAGS = set(json.load(_f)["tags"].keys())

# Curated movie pool for candidate suggestions
with open(DATA_DIR / "movie_pool.json") as _f:
    _MOVIE_POOL: list[dict] = json.load(_f)["movies"]

# Max candidates to send to Gemini per request
_CANDIDATE_LIMIT = 40


def _select_candidates(
    tag_freq: dict[str, int],
    seen_ids: set[int],
    phase: int,
) -> list[dict]:
    """Select relevant candidate movies from the pool.

    Prioritizes movies tagged with undertested dimensions and filters
    out already-seen movies. Returns up to _CANDIDATE_LIMIT candidates.
    """
    # Identify undertested tags (low or zero frequency)
    all_tags = list(_VALID_TAGS)
    tested_tags = set(tag_freq.keys())
    untested_tags = [t for t in all_tags if t not in tested_tags]
    low_tags = [t for t, c in tag_freq.items() if c <= 1]
    priority_tags = set(untested_tags + low_tags)

    # Phase 3 soul tags get extra priority
    if phase == 3:
        soul_tags = {"existential", "antiHero", "romanticCore", "socialCritique", "philosophical", "absurdist"}
        priority_tags.update(soul_tags - tested_tags)

    # Score each movie by relevance
    scored: list[tuple[float, dict]] = []
    for movie in _MOVIE_POOL:
        if movie["tmdb_id"] in seen_ids:
            continue

        movie_tags = set(movie.get("tags", []))
        # Higher score for movies matching priority tags
        priority_overlap = len(movie_tags & priority_tags)
        # Small bonus for non-English diversity
        region_bonus = 0.5 if movie.get("region") not in ("us", "uk") else 0.0
        score = priority_overlap * 2.0 + len(movie_tags) * 0.3 + region_bonus

        scored.append((score, movie))

    # Sort by score descending, take top candidates
    scored.sort(key=lambda x: x[0], reverse=True)
    top = [m for _, m in scored[:_CANDIDATE_LIMIT * 2]]

    # Shuffle within top candidates for variety, then trim
    random.shuffle(top)
    return top[:_CANDIDATE_LIMIT]


def _build_user_context(
    phase: int,
    round_number: int,
    picks: list[dict],
    quadrant_scores: dict,
    candidates: list[dict] | None = None,
) -> str:
    """Build the context string from user's pick history."""
    chosen_movies = []
    skipped_movies = []
    tag_freq: dict[str, int] = {}

    for pick in picks:
        movie_info = {
            "tmdb_id": pick.get("chosen_tmdb_id") or pick.get("movie_a_tmdb_id"),
            "round": pick.get("round_number"),
            "pick_mode": pick.get("pick_mode"),
        }
        if pick.get("chosen_tmdb_id"):
            chosen_movies.append(movie_info)
        else:
            skipped_movies.append(movie_info)

        dim = pick.get("test_dimension")
        if dim:
            tag_freq[dim] = tag_freq.get(dim, 0) + 1

    # Build all seen tmdb_ids to avoid repeats
    seen_ids = set()
    for pick in picks:
        seen_ids.add(pick.get("movie_a_tmdb_id"))
        seen_ids.add(pick.get("movie_b_tmdb_id"))
    seen_ids.discard(None)

    context: dict = {
        "phase": phase,
        "round": round_number,
        "picks": chosen_movies[-10:],
        "skips": skipped_movies[-5:],
        "current_tags": tag_freq,
        "quadrant_vector": quadrant_scores,
        "already_seen_tmdb_ids": list(seen_ids),
    }

    # Include curated candidate pool for Gemini to choose from
    if candidates:
        context["candidate_pool"] = [
            {"tmdb_id": m["tmdb_id"], "title": m["title_en"], "tags": m["tags"]}
            for m in candidates
        ]

    return json.dumps(context, ensure_ascii=False)


def _collect_seen_ids(picks: list[dict]) -> set[int]:
    """Collect all TMDB IDs that have been shown to the user."""
    seen = set()
    for pick in picks:
        if pick.get("movie_a_tmdb_id"):
            seen.add(pick["movie_a_tmdb_id"])
        if pick.get("movie_b_tmdb_id"):
            seen.add(pick["movie_b_tmdb_id"])
    seen.discard(None)
    seen.discard(0)
    return seen


MAX_RETRIES = 3


async def _call_gemini(user_context: str, round_number: int) -> dict | None:
    """Single Gemini API call, returns parsed result or None."""
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{SYSTEM_PROMPT}\n\n---\n\n{user_context}",
            config={
                "response_mime_type": "application/json",
                "temperature": 0.8,
                "max_output_tokens": 1024,
                "thinking_config": {"thinking_budget": 0},
            },
        )
    except Exception:
        logger.exception("Gemini API error for round %s", round_number)
        return None

    response_text = response.text.strip()

    # Extract JSON from potential markdown code block
    if "```" in response_text:
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        response_text = response_text[start:end]

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        logger.error("Failed to parse Gemini response: %s", response_text[:200])
        return None


async def get_ai_pair(
    phase: int,
    round_number: int,
    picks: list[dict],
    quadrant_scores: dict,
    extra_excluded_tmdb_ids: list[int] | None = None,
) -> dict | None:
    """Call Gemini API to generate the next movie pair for Phase 2 or 3.

    Validates returned TMDB IDs against seen history and retries up to
    MAX_RETRIES times if duplicates are detected.
    """
    seen_ids = _collect_seen_ids(picks)
    if extra_excluded_tmdb_ids:
        seen_ids.update(extra_excluded_tmdb_ids)

    # Build base context picks with extra exclusions
    context_picks = list(picks)
    if extra_excluded_tmdb_ids:
        context_picks.extend(
            {
                "movie_a_tmdb_id": tmdb_id,
                "movie_b_tmdb_id": None,
                "chosen_tmdb_id": None,
                "round_number": round_number,
                "pick_mode": None,
                "test_dimension": None,
            }
            for tmdb_id in extra_excluded_tmdb_ids
        )

    # Build tag frequency for candidate selection
    tag_freq: dict[str, int] = {}
    for pick in picks:
        dim = pick.get("test_dimension")
        if dim:
            tag_freq[dim] = tag_freq.get(dim, 0) + 1

    retry_excluded: list[int] = []

    for attempt in range(1, MAX_RETRIES + 1):
        # Add retry-excluded IDs to context for this attempt
        attempt_picks = list(context_picks)
        if retry_excluded:
            attempt_picks.extend(
                {
                    "movie_a_tmdb_id": tmdb_id,
                    "movie_b_tmdb_id": None,
                    "chosen_tmdb_id": None,
                    "round_number": round_number,
                    "pick_mode": None,
                    "test_dimension": None,
                }
                for tmdb_id in retry_excluded
            )

        # Select fresh candidates each attempt (excludes seen + retry-excluded)
        all_excluded = seen_ids | set(retry_excluded)
        candidates = _select_candidates(tag_freq, all_excluded, phase)

        user_context = _build_user_context(
            phase, round_number, attempt_picks, quadrant_scores, candidates
        )
        result = await _call_gemini(user_context, round_number)

        if not result:
            continue

        movie_a_id = result.get("movie_a", {}).get("tmdb_id")
        movie_b_id = result.get("movie_b", {}).get("tmdb_id")

        if not movie_a_id or not movie_b_id:
            logger.error("Gemini returned missing tmdb_ids: %s", result)
            continue

        # Hard duplicate check
        duplicates = {movie_a_id, movie_b_id} & seen_ids
        if duplicates:
            logger.warning(
                "Attempt %d/%d: Gemini returned duplicate TMDB IDs %s, retrying",
                attempt, MAX_RETRIES, duplicates,
            )
            retry_excluded.extend(duplicates)
            continue

        # Validate movies exist on TMDB
        movie_a = await get_movie(movie_a_id)
        movie_b = await get_movie(movie_b_id)

        if not movie_a or not movie_b:
            logger.warning("TMDB validation failed for pair (%s, %s)", movie_a_id, movie_b_id)
            # Add invalid IDs to retry exclusion
            if not movie_a:
                retry_excluded.append(movie_a_id)
            if not movie_b:
                retry_excluded.append(movie_b_id)
            continue

        # Validate test_dimension is a known tag key
        test_dim = result.get("test_dimension", "")
        if test_dim not in _VALID_TAGS:
            logger.warning("Gemini returned invalid test_dimension '%s', discarding", test_dim)
            test_dim = ""

        return {
            "movie_a_tmdb_id": movie_a_id,
            "movie_b_tmdb_id": movie_b_id,
            "movie_a": movie_a,
            "movie_b": movie_b,
            "test_dimension": test_dim,
        }

    logger.error("All %d attempts failed for round %s", MAX_RETRIES, round_number)
    return None
