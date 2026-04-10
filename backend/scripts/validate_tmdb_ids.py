"""Validate curated TMDB ids used by sequencing data files.

Checks every TMDB movie id referenced by:
- app/data/movie_pool.json
- app/data/phase1_pairs.json
- app/data/character_profiles.json

Requires TMDB_API_KEY in the environment.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

import httpx

TMDB_BASE_URL = "https://api.themoviedb.org/3"
DATA_DIR = Path(__file__).resolve().parent.parent / "app" / "data"
CONCURRENCY = 12


def _load_json(path: Path) -> dict | list:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _collect_tmdb_references() -> dict[int, list[str]]:
    references: dict[int, list[str]] = defaultdict(list)

    movie_pool = _load_json(DATA_DIR / "movie_pool.json")
    for movie in movie_pool["movies"]:
        references[int(movie["tmdb_id"])].append(f"movie_pool:{movie['title_en']}")

    phase1_pairs = _load_json(DATA_DIR / "phase1_pairs.json")
    for pair in phase1_pairs:
        references[int(pair["movie_a"]["tmdb_id"])].append(f"phase1_pairs:{pair['id']}:movie_a")
        references[int(pair["movie_b"]["tmdb_id"])].append(f"phase1_pairs:{pair['id']}:movie_b")

    character_profiles = _load_json(DATA_DIR / "character_profiles.json")
    for profile in character_profiles:
        references[int(profile["tmdb_id"])].append(f"character_profiles:{profile['id']}")

    return references


async def _validate_one(client: httpx.AsyncClient, tmdb_id: int, api_key: str) -> tuple[int, int]:
    response = await client.get(
        f"{TMDB_BASE_URL}/movie/{tmdb_id}",
        params={"api_key": api_key, "language": "en-US"},
        timeout=15.0,
    )
    return tmdb_id, response.status_code


async def _validate_all(tmdb_ids: list[int], api_key: str) -> dict[int, int]:
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async with httpx.AsyncClient() as client:
        async def run(tmdb_id: int) -> tuple[int, int]:
            async with semaphore:
                return await _validate_one(client, tmdb_id, api_key)

        results = await asyncio.gather(*(run(tmdb_id) for tmdb_id in tmdb_ids))

    return dict(results)


def main() -> int:
    api_key = os.environ.get("TMDB_API_KEY")
    if not api_key:
        print("TMDB_API_KEY is required for validate_tmdb_ids.py", file=sys.stderr)
        return 2

    references = _collect_tmdb_references()
    tmdb_ids = sorted(references.keys())
    statuses = asyncio.run(_validate_all(tmdb_ids, api_key))

    invalid = {
        tmdb_id: status
        for tmdb_id, status in statuses.items()
        if status != 200
    }

    if invalid:
        print("TMDB id validation failed:")
        for tmdb_id in sorted(invalid):
            print(f"- {tmdb_id} returned HTTP {invalid[tmdb_id]}")
            for ref in references[tmdb_id]:
                print(f"  source: {ref}")
        return 1

    print(f"TMDB id validation passed ({len(tmdb_ids)} ids checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
