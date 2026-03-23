"""Validate movie_pool.json data integrity."""

import json
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "app" / "data"

with open(DATA_DIR / "movie_pool.json") as f:
    POOL = json.load(f)["movies"]

with open(DATA_DIR / "tag_taxonomy.json") as f:
    VALID_TAGS = set(json.load(f)["tags"].keys())

with open(DATA_DIR / "phase1_pairs.json") as f:
    PHASE1_PAIRS = json.load(f)

PHASE1_IDS = set()
for pair in PHASE1_PAIRS:
    PHASE1_IDS.add(pair["movie_a"]["tmdb_id"])
    PHASE1_IDS.add(pair["movie_b"]["tmdb_id"])


class TestMoviePoolIntegrity:
    """Data integrity checks for the curated movie pool."""

    def test_all_movies_have_required_fields(self):
        for movie in POOL:
            assert "tmdb_id" in movie, f"Missing tmdb_id: {movie}"
            assert "title_en" in movie, f"Missing title_en: {movie}"
            assert "tags" in movie, f"Missing tags: {movie}"
            assert "region" in movie, f"Missing region: {movie}"
            assert isinstance(movie["tmdb_id"], int)
            assert len(movie["tags"]) > 0, f"Empty tags: {movie['title_en']}"

    def test_no_duplicate_tmdb_ids(self):
        ids = [m["tmdb_id"] for m in POOL]
        assert len(ids) == len(set(ids)), f"Duplicate IDs found: {[x for x in ids if ids.count(x) > 1]}"

    def test_all_tags_are_valid(self):
        for movie in POOL:
            for tag in movie["tags"]:
                assert tag in VALID_TAGS, f"Invalid tag '{tag}' in {movie['title_en']} (tmdb_id={movie['tmdb_id']})"

    def test_minimum_movies_per_tag(self):
        """Every tag should have at least 8 movies in the pool."""
        from collections import Counter
        tag_counts = Counter()
        for movie in POOL:
            for tag in movie["tags"]:
                tag_counts[tag] += 1

        for tag in VALID_TAGS:
            count = tag_counts.get(tag, 0)
            assert count >= 8, f"Tag '{tag}' has only {count} movies (minimum 8)"

    def test_minimum_non_english_ratio(self):
        """Non-US/UK movies should be at least 30% of the pool."""
        non_english = sum(1 for m in POOL if m.get("region") not in ("us", "uk"))
        ratio = non_english / len(POOL)
        assert ratio >= 0.30, f"Non-US/UK ratio is {ratio:.1%}, expected >= 30%"

    def test_pool_size_minimum(self):
        assert len(POOL) >= 300, f"Pool has {len(POOL)} movies, expected >= 300"
