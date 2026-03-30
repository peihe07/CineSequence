"""Helpers for enriching and deduplicating theater list items."""

from __future__ import annotations

import re
from dataclasses import dataclass, replace

from app.services.tmdb_client import get_movie, search_movies


@dataclass(slots=True)
class TheaterListItemData:
    tmdb_id: int
    title_en: str
    title_zh: str | None = None
    poster_url: str | None = None
    genres: list[str] | None = None
    runtime_minutes: int | None = None
    match_tags: list[str] | None = None
    note: str | None = None


def normalize_movie_title(title: str | None) -> str:
    """Normalize a movie title for fuzzy duplicate matching."""
    if not title:
        return ""
    lowered = title.casefold()
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", lowered)


def item_fingerprint(
    tmdb_id: int,
    title_en: str,
    title_zh: str | None = None,
) -> tuple[str, str | int] | None:
    """Build a stable identity key for dedupe checks."""
    if tmdb_id > 0:
        return ("tmdb", tmdb_id)

    normalized = normalize_movie_title(title_zh or title_en)
    if not normalized:
        return None
    return ("title", normalized)


def _pick_best_search_match(query: str, candidates):
    normalized_query = normalize_movie_title(query)
    best_prefix_match = None
    best_contains_match = None

    for candidate in candidates:
        normalized_zh = normalize_movie_title(candidate.title_zh)
        normalized_en = normalize_movie_title(candidate.title_en)

        if normalized_zh == normalized_query:
            return candidate
        if normalized_en == normalized_query:
            return candidate

        if best_prefix_match is None and (
            normalized_zh.startswith(normalized_query)
            or normalized_en.startswith(normalized_query)
        ):
            best_prefix_match = candidate

        if best_contains_match is None and (
            normalized_query in normalized_zh
            or normalized_query in normalized_en
        ):
            best_contains_match = candidate

    if best_prefix_match is not None:
        return best_prefix_match

    if best_contains_match is not None and len(normalized_query) >= 4:
        return best_contains_match

    return candidates[0] if candidates else None


async def enrich_theater_list_item(item: TheaterListItemData) -> TheaterListItemData:
    """Fill missing metadata from TMDB when possible."""
    if item.tmdb_id > 0:
        movie = await get_movie(item.tmdb_id)
        if not movie:
            return item
        return replace(
            item,
            title_en=item.title_en or movie.title_en,
            title_zh=item.title_zh or movie.title_zh,
            poster_url=item.poster_url or movie.poster_url,
            genres=item.genres or movie.genres,
            runtime_minutes=item.runtime_minutes or movie.runtime_minutes,
        )

    query = (item.title_zh or item.title_en).strip()
    if not query:
        return item

    search_results = await search_movies(query, limit=5)
    match = _pick_best_search_match(query, search_results)
    if not match:
        return item

    detailed = await get_movie(match.tmdb_id)
    movie = detailed or match
    return replace(
        item,
        tmdb_id=movie.tmdb_id,
        title_en=movie.title_en,
        title_zh=movie.title_zh,
        poster_url=movie.poster_url,
        genres=movie.genres,
        runtime_minutes=movie.runtime_minutes,
    )


async def prepare_theater_list_items(
    items: list[TheaterListItemData],
    *,
    existing_fingerprints: set[tuple[str, str | int]] | None = None,
) -> list[TheaterListItemData]:
    """Enrich items and drop duplicates while preserving order."""
    seen = set(existing_fingerprints or set())
    prepared: list[TheaterListItemData] = []

    for item in items:
        enriched = await enrich_theater_list_item(item)
        fingerprint = item_fingerprint(enriched.tmdb_id, enriched.title_en, enriched.title_zh)
        if fingerprint and fingerprint in seen:
            continue
        if fingerprint:
            seen.add(fingerprint)
        prepared.append(
            replace(
                enriched,
                genres=(enriched.genres or [])[:5],
                match_tags=(enriched.match_tags or [])[:5],
            )
        )

    return prepared
