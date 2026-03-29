"""Phase 2-3 AI pair engine: Gemini API generates adaptive movie pairs.

Uses a curated movie pool to guide Gemini toward diverse selections,
with hard duplicate prevention and retry logic.
"""

import json
import logging
import random
import time
from copy import deepcopy
from hashlib import sha256
from pathlib import Path

from google import genai

from app.config import settings
from app.services.ai_token_tracker import log_token_usage
from app.services.tmdb_client import get_movie

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PROMPT_FILE = DATA_DIR / "prompts" / "pair_picker.txt"
SYSTEM_PROMPT = PROMPT_FILE.read_text(encoding="utf-8")

# Valid tag keys for test_dimension validation
with open(DATA_DIR / "tag_taxonomy.json") as _f:
    _VALID_TAGS = set(json.load(_f)["tags"].keys())
_NON_TASTE_TAGS = {"nonEnglish"}
_TASTE_TAGS = _VALID_TAGS - _NON_TASTE_TAGS

# Curated movie pool for candidate suggestions
with open(DATA_DIR / "movie_pool.json") as _f:
    _MOVIE_POOL: list[dict] = json.load(_f)["movies"]

# Max candidates to send to Gemini per request
_CANDIDATE_LIMIT = 40


_MIN_NON_ENGLISH = 8  # Minimum non-US/UK candidates
_MIN_TAG_COVERAGE = 15  # Minimum distinct tags across candidates
_PAIR_CACHE_TTL_SECONDS = 300
_AI_PAIR_CACHE: dict[str, tuple[float, dict]] = {}


def _make_ai_pair_cache_key(
    phase: int,
    round_number: int,
    picks: list[dict],
    quadrant_scores: dict,
    extra_excluded_tmdb_ids: list[int] | None = None,
) -> str:
    payload = {
        "phase": phase,
        "round_number": round_number,
        "picks": picks,
        "quadrant_scores": quadrant_scores,
        "extra_excluded_tmdb_ids": sorted(extra_excluded_tmdb_ids or []),
    }
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return sha256(serialized.encode("utf-8")).hexdigest()


def _get_cached_ai_pair(cache_key: str) -> dict | None:
    cached = _AI_PAIR_CACHE.get(cache_key)
    if cached is None:
        return None

    expires_at, result = cached
    if expires_at <= time.monotonic():
        _AI_PAIR_CACHE.pop(cache_key, None)
        return None

    return deepcopy(result)


def _store_cached_ai_pair(cache_key: str, result: dict) -> None:
    _AI_PAIR_CACHE[cache_key] = (
        time.monotonic() + _PAIR_CACHE_TTL_SECONDS,
        deepcopy(result),
    )


def _clear_ai_pair_cache() -> None:
    _AI_PAIR_CACHE.clear()


def _session_rng(session_seed: str | None) -> random.Random:
    if not session_seed:
        return random.Random()
    seed_int = int(sha256(session_seed.encode("utf-8")).hexdigest()[:16], 16)
    return random.Random(seed_int)


def _select_candidates(
    tag_freq: dict[str, int],
    seen_ids: set[int],
    phase: int,
    low_confidence_tags: set[str] | None = None,
    contradicted_tags: set[str] | None = None,
    session_seed: str | None = None,
) -> list[dict]:
    """Select relevant candidate movies from the pool.

    Prioritizes movies tagged with undertested dimensions, ensures
    region diversity and tag coverage, and filters out already-seen movies.
    Returns up to _CANDIDATE_LIMIT candidates.

    low_confidence_tags: tags with confidence < 0.5 (need more testing)
    contradicted_tags: tags with consistency ∈ [0.35, 0.65] (ambiguous signal)
    """
    rng = _session_rng(session_seed)

    # Identify undertested tags (low or zero frequency)
    all_tags = list(_TASTE_TAGS)
    tested_tags = set(tag_freq.keys())
    untested_tags = [t for t in all_tags if t not in tested_tags]
    low_tags = [t for t, c in tag_freq.items() if c <= 1]
    priority_tags = set(untested_tags + low_tags)

    # Phase 3: soul tags + low confidence + contradicted tags get extra priority
    if phase == 3:
        soul_tags = {
            "existential", "antiHero", "romanticCore",
            "socialCritique", "philosophical", "absurdist",
        }
        priority_tags.update(soul_tags - tested_tags)
        if low_confidence_tags:
            priority_tags.update(low_confidence_tags)
        if contradicted_tags:
            priority_tags.update(contradicted_tags)

    # Penalize overtested tags
    overtested_tags = {t for t, c in tag_freq.items() if c >= 3}

    # Score each available movie by relevance
    available: list[dict] = []
    scored: list[tuple[float, dict]] = []
    for movie in _MOVIE_POOL:
        if movie["tmdb_id"] in seen_ids:
            continue
        available.append(movie)

        movie_tags = set(movie.get("tags", []))
        priority_overlap = len(movie_tags & priority_tags)
        overtested_overlap = len(movie_tags & overtested_tags)
        region_bonus = 0.5 if movie.get("region") not in ("us", "uk") else 0.0
        score = (
            priority_overlap * 2.0
            + len(movie_tags) * 0.3
            + region_bonus
            - overtested_overlap * 0.5
        )
        scored.append((score, movie))

    # Sort by score descending, take top pool
    scored.sort(key=lambda x: x[0], reverse=True)
    top = [m for _, m in scored[:_CANDIDATE_LIMIT * 2]]

    # Shuffle within top candidates for variety, then trim
    rng.shuffle(top)
    candidates = top[:_CANDIDATE_LIMIT]

    # B4: Ensure region diversity — at least _MIN_NON_ENGLISH non-US/UK
    non_english_count = sum(
        1 for m in candidates if m.get("region") not in ("us", "uk")
    )
    if non_english_count < _MIN_NON_ENGLISH:
        # Find non-English movies not already in candidates
        candidate_ids = {m["tmdb_id"] for m in candidates}
        non_english_pool = [
            m for m in available
            if m.get("region") not in ("us", "uk")
            and m["tmdb_id"] not in candidate_ids
        ]
        rng.shuffle(non_english_pool)
        needed = _MIN_NON_ENGLISH - non_english_count
        # Replace lowest-scored English candidates
        english_candidates = [
            m for m in candidates if m.get("region") in ("us", "uk")
        ]
        for replacement in non_english_pool[:needed]:
            if english_candidates:
                to_remove = english_candidates.pop()
                candidates.remove(to_remove)
                candidates.append(replacement)

    # B4: Ensure tag coverage — at least _MIN_TAG_COVERAGE distinct tags
    covered_tags = set()
    for m in candidates:
        covered_tags.update(m.get("tags", []))
    if len(covered_tags) < _MIN_TAG_COVERAGE:
        candidate_ids = {m["tmdb_id"] for m in candidates}
        missing_tags = _TASTE_TAGS - covered_tags
        for tag in missing_tags:
            tagged_movies = [
                m for m in available
                if tag in m.get("tags", []) and m["tmdb_id"] not in candidate_ids
            ]
            if tagged_movies and len(candidates) < _CANDIDATE_LIMIT + 5:
                pick = rng.choice(tagged_movies)
                candidates.append(pick)
                candidate_ids.add(pick["tmdb_id"])
                covered_tags.update(pick.get("tags", []))
            if len(covered_tags) >= _MIN_TAG_COVERAGE:
                break

    return candidates[:_CANDIDATE_LIMIT + 5]


def _build_user_context(
    phase: int,
    round_number: int,
    picks: list[dict],
    quadrant_scores: dict,
    candidates: list[dict] | None = None,
    retry_rejected_tmdb_ids: list[int] | None = None,
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
        if dim in _NON_TASTE_TAGS:
            continue
        if dim:
            tag_freq[dim] = tag_freq.get(dim, 0) + 1

    context: dict = {
        "phase": phase,
        "round": round_number,
        "picks": chosen_movies[-10:],
        "skips": skipped_movies[-5:],
        "current_tags": tag_freq,
        "quadrant_vector": quadrant_scores,
    }

    # Include curated candidate pool for Gemini to choose from
    if candidates:
        context["candidate_pool"] = [
            {"tmdb_id": m["tmdb_id"], "title": m["title_en"], "tags": m["tags"]}
            for m in candidates
        ]

    # A2: Explicitly tell Gemini which IDs were rejected in previous retry attempts
    if retry_rejected_tmdb_ids:
        context["retry_rejected_tmdb_ids"] = retry_rejected_tmdb_ids

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


async def _pool_fallback(
    tag_freq: dict[str, int],
    excluded_ids: set[int],
    phase: int,
    session_seed: str | None = None,
) -> dict | None:
    """Rule-based fallback: pick a pair from the pool when AI retries all fail.

    Finds the least-tested tag, then picks two movies from the pool —
    one that has the tag (movie_a) and one that doesn't (movie_b).
    """
    rng = _session_rng(session_seed)
    available = [m for m in _MOVIE_POOL if m["tmdb_id"] not in excluded_ids]
    if len(available) < 2:
        return None

    # Find least-tested tag
    all_tags = sorted(_TASTE_TAGS)
    tag_counts = {t: tag_freq.get(t, 0) for t in all_tags}
    target_tag = min(tag_counts, key=tag_counts.get)

    # Split pool: movies with vs without the target tag
    with_tag = [m for m in available if target_tag in m.get("tags", [])]
    without_tag = [m for m in available if target_tag not in m.get("tags", [])]

    if not with_tag or not without_tag:
        # Fallback: just pick any two different movies
        rng.shuffle(available)
        pick_a, pick_b = available[0], available[1]
        target_tag = ""
    else:
        pick_a = rng.choice(with_tag)
        pick_b = rng.choice(without_tag)

    # Validate both movies exist on TMDB
    movie_a = await get_movie(pick_a["tmdb_id"])
    movie_b = await get_movie(pick_b["tmdb_id"])
    if not movie_a or not movie_b:
        return None

    logger.info(
        "Pool fallback: A=%s B=%s dimension=%s",
        pick_a["tmdb_id"], pick_b["tmdb_id"], target_tag,
    )

    return {
        "movie_a_tmdb_id": pick_a["tmdb_id"],
        "movie_b_tmdb_id": pick_b["tmdb_id"],
        "movie_a": movie_a,
        "movie_b": movie_b,
        "test_dimension": target_tag,
    }


async def _call_gemini(user_context: str, round_number: int) -> dict | None:
    """Single Gemini API call, returns parsed result or None."""
    client = genai.Client(api_key=settings.gemini_api_key)
    response = None
    model_used = ""

    for model_name in settings.gemini_model_candidates:
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=f"{SYSTEM_PROMPT}\n\n---\n\n{user_context}",
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.8,
                    "max_output_tokens": 1024,
                    "thinking_config": {"thinking_budget": 0},
                },
            )
            model_used = model_name
            break
        except Exception:
            logger.exception(
                "Gemini API error for round %s with model %s",
                round_number,
                model_name,
            )

    if response is None:
        return None

    await log_token_usage(response, call_type="ai_pair", model=model_used)

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
    session_seed: str | None = None,
) -> dict | None:
    """Call Gemini API to generate the next movie pair for Phase 2 or 3.

    Validates returned TMDB IDs against seen history and retries up to
    MAX_RETRIES times if duplicates are detected.
    """
    cache_key = _make_ai_pair_cache_key(
        phase,
        round_number,
        picks,
        quadrant_scores,
        extra_excluded_tmdb_ids,
    )
    cached = _get_cached_ai_pair(cache_key)
    if cached is not None:
        logger.info("Using cached AI pair for round %s", round_number)
        return cached

    seen_ids = _collect_seen_ids(picks)
    if extra_excluded_tmdb_ids:
        seen_ids.update(extra_excluded_tmdb_ids)

    # Build tag frequency for candidate selection
    tag_freq: dict[str, int] = {}
    for pick in picks:
        dim = pick.get("test_dimension")
        if dim in _NON_TASTE_TAGS:
            continue
        if dim:
            tag_freq[dim] = tag_freq.get(dim, 0) + 1

    # Compute confidence and consistency for smarter candidate selection
    from app.services.dna_builder import compute_confidence, compute_consistency

    confidence = compute_confidence(picks)
    consistency = compute_consistency(picks)
    low_confidence_tags = {t for t, c in confidence.items() if c < 0.5}
    contradicted_tags = {t for t, c in consistency.items() if 0.35 <= c <= 0.65}

    retry_excluded: list[int] = []

    for attempt in range(1, MAX_RETRIES + 1):
        # Select fresh candidates each attempt (excludes seen + retry-excluded)
        all_excluded = seen_ids | set(retry_excluded)
        candidates = _select_candidates(
            tag_freq, all_excluded, phase,
            low_confidence_tags=low_confidence_tags,
            contradicted_tags=contradicted_tags,
            session_seed=f"{session_seed or 'default'}:{phase}:{round_number}:{attempt}",
        )

        user_context = _build_user_context(
            phase, round_number, picks, quadrant_scores,
            candidates, retry_excluded if retry_excluded else None,
        )
        result = await _call_gemini(user_context, round_number)

        if not result:
            continue

        movie_a_id = result.get("movie_a", {}).get("tmdb_id")
        movie_b_id = result.get("movie_b", {}).get("tmdb_id")

        if not movie_a_id or not movie_b_id:
            logger.error("Gemini returned missing tmdb_ids: %s", result)
            continue

        # A1: Reject same movie in both slots
        if movie_a_id == movie_b_id:
            logger.warning(
                "Attempt %d/%d: Gemini returned same movie for A and B (tmdb_id=%s), retrying",
                attempt, MAX_RETRIES, movie_a_id,
            )
            retry_excluded.append(movie_a_id)
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
        if test_dim not in _TASTE_TAGS:
            logger.warning("Gemini returned invalid test_dimension '%s', discarding", test_dim)
            test_dim = ""

        final_result = {
            "movie_a_tmdb_id": movie_a_id,
            "movie_b_tmdb_id": movie_b_id,
            "movie_a": movie_a,
            "movie_b": movie_b,
            "test_dimension": test_dim,
        }
        _store_cached_ai_pair(cache_key, final_result)
        return final_result

    # A4: Rule-based fallback when all AI retries fail
    logger.warning(
        "All %d AI attempts failed for round %s, using pool fallback",
        MAX_RETRIES, round_number,
    )
    fallback = await _pool_fallback(
        tag_freq,
        seen_ids | set(retry_excluded),
        phase,
        session_seed=f"{session_seed or 'default'}:{phase}:{round_number}:fallback",
    )
    if fallback:
        _store_cached_ai_pair(cache_key, fallback)
        return fallback

    logger.error("Pool fallback also failed for round %s", round_number)
    return None
