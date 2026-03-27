"""TMDB API client with Redis caching."""

import json
import logging
from dataclasses import dataclass

import httpx

from app.config import settings
from app.deps import redis_client

logger = logging.getLogger(__name__)

TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"
CACHE_PREFIX = "tmdb:movie:"


@dataclass
class MovieInfo:
    tmdb_id: int
    title_en: str
    title_zh: str | None
    poster_url: str | None
    year: int | None
    genres: list[str]
    runtime_minutes: int | None
    overview: str | None


def _poster_url(path: str | None, size: str = "w500") -> str | None:
    if not path:
        return None
    return f"{TMDB_IMAGE_BASE}/{size}{path}"


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


async def search_movies(query: str, limit: int = 8) -> list[MovieInfo]:
    """Search TMDB for movies by title. Used for seed movie autocomplete."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{TMDB_BASE_URL}/search/movie",
                params={
                    "api_key": settings.tmdb_api_key,
                    "language": "zh-TW",
                    "query": query,
                    "page": 1,
                },
                timeout=10.0,
            )
            response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("TMDB search error for query '%s'", query)
        return []

    results = response.json().get("results", [])[:limit]
    movies = []
    for item in results:
        release_date = item.get("release_date", "")
        year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None
        movies.append(MovieInfo(
            tmdb_id=item["id"],
            title_en=item.get("original_title") or item.get("title", ""),
            title_zh=item.get("title"),
            poster_url=_poster_url(item.get("poster_path")),
            year=year,
            genres=[],
            runtime_minutes=None,
            overview=item.get("overview"),
        ))
    return movies
