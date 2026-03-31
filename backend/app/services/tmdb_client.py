"""TMDB API client with Redis caching."""

import json
import logging
import re
import unicodedata
from dataclasses import dataclass, field

import httpx

from app.config import settings
from app.deps import redis_client

logger = logging.getLogger(__name__)

TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"
CACHE_PREFIX = "tmdb:movie:"
SEARCH_LANGUAGES = ("zh-TW", "ja-JP", "en-US")


@dataclass
class MovieInfo:
    tmdb_id: int
    title_en: str
    title_zh: str | None
    poster_url: str | None
    year: int | None
    genres: list[str] = field(default_factory=list)
    runtime_minutes: int | None = None
    overview: str | None = None
    popularity: float = 0.0


def _poster_url(path: str | None, size: str = "w500") -> str | None:
    if not path:
        return None
    return f"{TMDB_IMAGE_BASE}/{size}{path}"


# English articles & short prepositions to ignore when comparing titles.
_STOP_WORDS = frozenset({"the", "a", "an", "of", "and", "in", "on", "at", "to", "for", "is", "le", "la", "les", "der", "die", "das", "el", "il"})


def _normalize_title(title: str | None) -> str:
    if not title:
        return ""
    lowered = unicodedata.normalize("NFKD", unicodedata.normalize("NFKC", title))
    lowered = "".join(ch for ch in lowered if not unicodedata.combining(ch)).casefold()
    return re.sub(r"[^a-z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+", "", lowered)


def _strip_stopwords(text: str) -> str:
    """Remove articles and short prepositions so 'Godfather' matches 'The Godfather'."""
    if not text:
        return ""
    tokens = _tokenize_search_text(text)
    return "".join(t for t in tokens if t not in _STOP_WORDS)


def _tokenize_search_text(title: str | None) -> list[str]:
    if not title:
        return []
    normalized = unicodedata.normalize("NFKD", unicodedata.normalize("NFKC", title))
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch)).casefold()
    spaced = re.sub(r"[^a-z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+", " ", normalized)
    return [token for token in spaced.split() if token]


def _levenshtein(s: str, t: str) -> int:
    """Compute Levenshtein edit distance between two strings.

    Uses a single-row DP approach (O(min(m,n)) space) to stay lightweight.
    """
    if len(s) < len(t):
        return _levenshtein(t, s)
    if not t:
        return len(s)
    prev = list(range(len(t) + 1))
    for i, sc in enumerate(s, 1):
        curr = [i] + [0] * len(t)
        for j, tc in enumerate(t, 1):
            cost = 0 if sc == tc else 1
            curr[j] = min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[-1]


def _score_release_year(query: str, year: int | None) -> int:
    if year is None:
        return 0
    return int(str(year) in unicodedata.normalize("NFKC", query))


def _parse_movie(data: dict) -> MovieInfo:
    """Parse TMDB movie response into MovieInfo."""
    release_date = data.get("release_date", "")
    year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None
    genres = [g["name"] for g in data.get("genres", [])]

    return MovieInfo(
        tmdb_id=data["id"],
        title_en=data.get("original_title") or data.get("title", ""),
        title_zh=data.get("title"),
        poster_url=_poster_url(data.get("poster_path")),
        year=year,
        genres=genres,
        runtime_minutes=data.get("runtime"),
        overview=data.get("overview"),
        popularity=float(data.get("popularity") or 0.0),
    )


async def get_movie(tmdb_id: int) -> MovieInfo | None:
    """Fetch movie details from TMDB with Redis caching."""
    cache_key = f"{CACHE_PREFIX}{tmdb_id}"

    # Check cache
    cached = await redis_client.get(cache_key)
    if cached:
        data = json.loads(cached)
        return MovieInfo(**data)

    # Fetch from TMDB
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{TMDB_BASE_URL}/movie/{tmdb_id}",
                params={
                    "api_key": settings.tmdb_api_key,
                    "language": "zh-TW",
                    "append_to_response": "credits",
                },
                timeout=10.0,
            )
            response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("TMDB API error for movie %s", tmdb_id)
        return None

    movie = _parse_movie(response.json())

    # Cache the result
    cache_data = json.dumps({
        "tmdb_id": movie.tmdb_id,
        "title_en": movie.title_en,
        "title_zh": movie.title_zh,
        "poster_url": movie.poster_url,
        "year": movie.year,
        "genres": movie.genres,
        "runtime_minutes": movie.runtime_minutes,
        "overview": movie.overview,
        "popularity": movie.popularity,
    })
    await redis_client.set(cache_key, cache_data, ex=settings.tmdb_cache_ttl)

    return movie


async def get_movies(tmdb_ids: list[int]) -> dict[int, MovieInfo]:
    """Fetch multiple movies in parallel."""
    results: dict[int, MovieInfo] = {}
    for tmdb_id in tmdb_ids:
        movie = await get_movie(tmdb_id)
        if movie:
            results[tmdb_id] = movie
    return results


def _score_search_match(query: str, movie: MovieInfo) -> tuple[int, int, int, int, int, int, int]:
    """Score how well *query* matches *movie*'s titles.

    Returns a 7-element tuple ordered by descending priority:
      1. exact_match          – full normalised string match
      2. exact_no_stop        – match after stripping articles / prepositions
      3. prefix_match         – title starts with the query
      4. contains_match       – title contains the query as a substring
      5. token_overlap        – # of query tokens found in title tokens
      6. token_prefix_overlap – # of query tokens that are a *prefix* of a title token
      7. fuzzy_match          – edit-distance ≤ 2 on stopword-stripped normalised form
    """
    normalized_query = _normalize_title(query)
    normalized_zh = _normalize_title(movie.title_zh)
    normalized_en = _normalize_title(movie.title_en)
    query_tokens = _tokenize_search_text(query)
    title_tokens = set(
        _tokenize_search_text(movie.title_zh)
        + _tokenize_search_text(movie.title_en)
    )

    if not normalized_query:
        return (0, 0, 0, 0, 0, 0, 0)

    # --- Layer 1: exact match ---
    exact_match = int(
        normalized_query == normalized_zh or normalized_query == normalized_en
    )

    # --- Layer 2: exact match with stopwords removed ---
    query_no_stop = _strip_stopwords(query)
    zh_no_stop = _strip_stopwords(movie.title_zh or "")
    en_no_stop = _strip_stopwords(movie.title_en)
    exact_no_stop = int(
        query_no_stop != "" and (
            query_no_stop == zh_no_stop or query_no_stop == en_no_stop
        )
    ) if not exact_match else 0  # only used as tiebreaker

    # --- Layer 3: prefix match ---
    prefix_match = int(
        normalized_zh.startswith(normalized_query)
        or normalized_en.startswith(normalized_query)
    )

    # --- Layer 4: substring match ---
    contains_match = int(
        normalized_query in normalized_zh or normalized_query in normalized_en
    )

    # --- Layer 5: token overlap (exact tokens) ---
    token_overlap = sum(1 for token in query_tokens if token in title_tokens)

    # --- Layer 6: token prefix overlap ---
    # e.g. query "eter" matches title token "eternal"
    token_prefix_overlap = sum(
        1 for qt in query_tokens
        if qt not in title_tokens  # don't double-count exact hits
        and any(tt.startswith(qt) for tt in title_tokens)
    )

    # --- Layer 7: fuzzy match (Levenshtein ≤ 2) ---
    # Only compute when the query is long enough that edit-distance makes sense
    # (short queries like "刀" would match too many things).
    fuzzy_match = 0
    if len(query_no_stop) >= 4:
        for candidate in (en_no_stop, zh_no_stop):
            if candidate and _levenshtein(query_no_stop, candidate) <= 2:
                fuzzy_match = 1
                break

    return (
        exact_match,
        exact_no_stop,
        prefix_match,
        contains_match,
        token_overlap,
        token_prefix_overlap,
        fuzzy_match,
    )


async def _search_movies_for_language(
    client: httpx.AsyncClient,
    query: str,
    *,
    language: str,
    page: int = 1,
) -> list[MovieInfo]:
    response = await client.get(
        f"{TMDB_BASE_URL}/search/movie",
        params={
            "api_key": settings.tmdb_api_key,
            "language": language,
            "query": query,
            "page": page,
        },
        timeout=10.0,
    )
    response.raise_for_status()

    results = []
    for item in response.json().get("results", []):
        release_date = item.get("release_date", "")
        year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None
        results.append(MovieInfo(
            tmdb_id=item["id"],
            title_en=item.get("original_title") or item.get("title", ""),
            title_zh=item.get("title"),
            poster_url=_poster_url(item.get("poster_path")),
            year=year,
            genres=[],
            runtime_minutes=None,
            overview=item.get("overview"),
            popularity=float(item.get("popularity") or 0.0),
        ))
    return results


async def search_movies(query: str, limit: int = 8) -> list[MovieInfo]:
    """Search TMDB for movies by title. Used for seed movie autocomplete."""
    normalized_query = _normalize_title(query.strip())
    if not normalized_query:
        return []

    try:
        async with httpx.AsyncClient() as client:
            merged: dict[int, MovieInfo] = {}
            for language in SEARCH_LANGUAGES:
                for movie in await _search_movies_for_language(client, query, language=language):
                    existing = merged.get(movie.tmdb_id)
                    if existing is None:
                        merged[movie.tmdb_id] = movie
                        continue
                    if not existing.title_zh and movie.title_zh:
                        merged[movie.tmdb_id] = movie
    except httpx.HTTPError:
        logger.exception("TMDB search error for query '%s'", query)
        return []

    movies = list(merged.values())
    movies.sort(
        key=lambda movie: (
            _score_search_match(query, movie),
            # Only boost by year when title relevance is already non-zero;
            # prevents a recent obscure film from ranking above an exact-match
            # classic (e.g. a 1970s Tarkovsky film).
            _score_release_year(query, movie.year),
            # Popularity as final tiebreaker so well-known films surface above
            # obscure same-name entries when all title signals are equal.
            movie.popularity,
        ),
        reverse=True,
    )
    return movies[:limit]
