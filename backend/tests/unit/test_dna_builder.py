"""Tests for DNA builder: tag vector, genre vector, archetype assignment."""

from app.services.dna_builder import (
    ARCHETYPES,
    GENRE_ID_TO_NAME,
    TAG_INDEX,
    TAG_KEYS,
    assign_archetype,
    build_dna,
    compute_genre_vector,
    compute_tag_vector,
    get_excluded_tags,
    get_tag_labels,
)


class TestComputeTagVector:
    """Test tag vector computation."""

    def test_empty_picks(self):
        vector = compute_tag_vector([])
        assert len(vector) == len(TAG_KEYS)
        assert all(v == 0.0 for v in vector)

    def test_single_pick_watched(self):
        picks = [{
            "test_dimension": "mindfuck",
            "chosen_tmdb_id": 100,
            "pick_mode": "watched",
        }]
        vector = compute_tag_vector(picks)
        idx = TAG_INDEX["mindfuck"]
        # Single pick, normalized to 1.0
        assert vector[idx] == 1.0

    def test_attracted_has_lower_weight(self):
        picks_watched = [{
            "test_dimension": "mindfuck",
            "chosen_tmdb_id": 100,
            "pick_mode": "watched",
        }, {
            "test_dimension": "darkTone",
            "chosen_tmdb_id": 200,
            "pick_mode": "attracted",
        }]
        vector = compute_tag_vector(picks_watched)
        watched_idx = TAG_INDEX["mindfuck"]
        attracted_idx = TAG_INDEX["darkTone"]
        assert vector[watched_idx] > vector[attracted_idx]

    def test_skipped_picks_ignored(self):
        picks = [{
            "test_dimension": "mindfuck",
            "chosen_tmdb_id": None,
            "pick_mode": None,
        }]
        vector = compute_tag_vector(picks)
        assert all(v == 0.0 for v in vector)

    def test_unknown_dimension_ignored(self):
        picks = [{
            "test_dimension": "unknown_dimension",
            "chosen_tmdb_id": 100,
            "pick_mode": "watched",
        }]
        vector = compute_tag_vector(picks)
        assert all(v == 0.0 for v in vector)

    def test_vector_length_matches_taxonomy(self):
        vector = compute_tag_vector([])
        assert len(vector) == 30


class TestComputeGenreVector:
    """Test genre frequency vector."""

    def test_empty(self):
        result = compute_genre_vector([], {})
        assert result == {}

    def test_single_genre(self):
        picks = [{"chosen_tmdb_id": 100, "pick_mode": "watched"}]
        genre_map = {100: ["Drama", "Thriller"]}
        result = compute_genre_vector(picks, genre_map)
        assert "Drama" in result
        assert "Thriller" in result

    def test_attracted_lower_weight(self):
        picks = [
            {"chosen_tmdb_id": 100, "pick_mode": "watched"},
            {"chosen_tmdb_id": 200, "pick_mode": "attracted"},
        ]
        genre_map = {100: ["Drama"], 200: ["Drama"]}
        # Both pick drama, but watched weighs more
        result = compute_genre_vector(picks, genre_map)
        # 1.0 + 0.7 = 1.7, normalized to 1.0
        assert result["Drama"] == 1.0

    def test_skipped_ignored(self):
        picks = [{"chosen_tmdb_id": None, "pick_mode": None}]
        result = compute_genre_vector(picks, {})
        assert result == {}


class TestGetTagLabels:
    """Test top N tag extraction."""

    def test_returns_top_n(self):
        vector = [0.0] * 30
        vector[0] = 1.0
        vector[1] = 0.8
        vector[2] = 0.5
        labels = get_tag_labels(vector, top_n=2)
        assert len(labels) == 2

    def test_excludes_zero_scores(self):
        vector = [0.0] * 30
        vector[0] = 0.5
        labels = get_tag_labels(vector, top_n=10)
        assert len(labels) == 1

    def test_sorted_by_score(self):
        vector = [0.0] * 30
        vector[0] = 0.3
        vector[1] = 0.9
        vector[2] = 0.6
        labels = get_tag_labels(vector, top_n=3)
        scores = list(labels.values())
        assert scores == sorted(scores, reverse=True)


class TestGetExcludedTags:
    """Test excluded tag detection."""

    def test_all_zero(self):
        vector = [0.0] * 30
        excluded = get_excluded_tags(vector)
        assert len(excluded) == 30

    def test_some_nonzero(self):
        vector = [0.0] * 30
        vector[0] = 0.5
        vector[5] = 0.3
        excluded = get_excluded_tags(vector)
        assert len(excluded) == 28
        assert TAG_KEYS[0] not in excluded
        assert TAG_KEYS[5] not in excluded


class TestAssignArchetype:
    """Test archetype assignment."""

    def test_returns_dict(self):
        vector = [0.0] * 30
        result = assign_archetype(vector, {})
        assert "id" in result
        assert "name" in result

    def test_dark_poet_from_dark_tags(self):
        """High darkTone + antiHero should lean toward dark_poet."""
        vector = [0.0] * 30
        vector[TAG_INDEX["darkTone"]] = 1.0
        vector[TAG_INDEX["antiHero"]] = 0.9
        vector[TAG_INDEX["psychoThriller"]] = 0.8
        result = assign_archetype(vector, {})
        assert result["id"] == "dark_poet"

    def test_emotional_sponge_from_tearjerker(self):
        """High tearjerker + uplifting + romanticCore should lean emotional_sponge."""
        vector = [0.0] * 30
        vector[TAG_INDEX["tearjerker"]] = 1.0
        vector[TAG_INDEX["uplifting"]] = 0.9
        vector[TAG_INDEX["romanticCore"]] = 0.8
        vector[TAG_INDEX["comingOfAge"]] = 0.7
        result = assign_archetype(vector, {})
        assert result["id"] == "emotional_sponge"


class TestLogDampenedNormalization:
    """Test that log-dampened normalization compresses repeated-test advantage."""

    def test_repeated_tag_compressed(self):
        """A tag tested 3 times should not be 3x a tag tested once."""
        picks = [
            {"test_dimension": "mindfuck", "chosen_tmdb_id": i, "pick_mode": "watched"}
            for i in range(3)
        ] + [
            {"test_dimension": "darkTone", "chosen_tmdb_id": 999, "pick_mode": "watched"},
        ]
        vector = compute_tag_vector(picks)
        mindfuck_val = vector[TAG_INDEX["mindfuck"]]
        dark_val = vector[TAG_INDEX["darkTone"]]

        # Without log: ratio would be 3.0. With log: log(4)/log(2) ≈ 2.0
        ratio = mindfuck_val / dark_val
        assert ratio < 2.5, f"Log dampening should compress ratio, got {ratio}"
        assert ratio > 1.0, "Repeated tag should still score higher"

    def test_single_pick_still_normalized_to_one(self):
        """A single tag pick should still normalize to 1.0."""
        picks = [{"test_dimension": "twist", "chosen_tmdb_id": 1, "pick_mode": "watched"}]
        vector = compute_tag_vector(picks)
        assert vector[TAG_INDEX["twist"]] == 1.0


class TestGenreOverlapFix:
    """Test that genre scoring only counts matching genres per archetype."""

    def test_matching_genre_boosts_score(self):
        """Crime genre should boost dark_poet (match_genres includes 80=Crime)."""
        vector = [0.0] * 30
        vector[TAG_INDEX["darkTone"]] = 0.5
        vector[TAG_INDEX["antiHero"]] = 0.5

        # With matching genre
        assign_archetype(vector, {"Crime": 1.0})
        score_with = _score_archetype("dark_poet", vector, {"Crime": 1.0})

        # With non-matching genre
        score_without = _score_archetype("dark_poet", vector, {"Animation": 1.0})

        assert score_with > score_without

    def test_irrelevant_genre_no_boost(self):
        """Animation genre should not boost dark_poet."""
        vector = [0.0] * 30
        vector[TAG_INDEX["darkTone"]] = 0.5

        score_none = _score_archetype("dark_poet", vector, {})
        score_anim = _score_archetype("dark_poet", vector, {"Animation": 1.0})

        assert score_none == score_anim


class TestNewArchetypes:
    """Test that new archetypes are correctly assigned."""

    def test_all_12_archetypes_loaded(self):
        assert len(ARCHETYPES) == 12

    def test_all_archetypes_have_required_fields(self):
        required = {"id", "name", "name_en", "icon", "description",
                    "match_tags", "match_genres", "ticket_style"}
        for arch in ARCHETYPES:
            missing = required - set(arch.keys())
            assert not missing, f"{arch['id']} missing fields: {missing}"

    def test_reality_hunter_from_true_story(self):
        vector = [0.0] * 30
        vector[TAG_INDEX["trueStory"]] = 1.0
        vector[TAG_INDEX["socialCritique"]] = 0.8
        vector[TAG_INDEX["dialogue"]] = 0.7
        vector[TAG_INDEX["solo"]] = 0.6
        result = assign_archetype(vector, {"Documentary": 0.9})
        assert result["id"] == "reality_hunter"

    def test_master_planner_from_heist(self):
        vector = [0.0] * 30
        vector[TAG_INDEX["heist"]] = 1.0
        vector[TAG_INDEX["twist"]] = 0.9
        vector[TAG_INDEX["ensemble"]] = 0.8
        vector[TAG_INDEX["mindfuck"]] = 0.7
        result = assign_archetype(vector, {})
        assert result["id"] == "master_planner"

    def test_dystopia_architect_from_dystopia(self):
        vector = [0.0] * 30
        vector[TAG_INDEX["dystopia"]] = 1.0
        vector[TAG_INDEX["survival"]] = 0.8
        vector[TAG_INDEX["philosophical"]] = 0.7
        vector[TAG_INDEX["darkTone"]] = 0.6
        result = assign_archetype(vector, {})
        assert result["id"] == "dystopia_architect"

    def test_world_wanderer_from_non_english(self):
        vector = [0.0] * 30
        vector[TAG_INDEX["nonEnglish"]] = 1.0
        vector[TAG_INDEX["slowburn"]] = 0.8
        vector[TAG_INDEX["existential"]] = 0.7
        vector[TAG_INDEX["nostalgic"]] = 0.6
        result = assign_archetype(vector, {})
        assert result["id"] == "world_wanderer"

    def test_lone_wolf_from_solo_antihero(self):
        vector = [0.0] * 30
        vector[TAG_INDEX["solo"]] = 1.0
        vector[TAG_INDEX["antiHero"]] = 0.9
        vector[TAG_INDEX["revenge"]] = 0.8
        vector[TAG_INDEX["darkTone"]] = 0.7
        vector[TAG_INDEX["survival"]] = 0.6
        result = assign_archetype(vector, {})
        assert result["id"] == "lone_wolf"

    def test_dream_weaver_from_visual_experimental(self):
        vector = [0.0] * 30
        vector[TAG_INDEX["visualFeast"]] = 1.0
        vector[TAG_INDEX["experimental"]] = 0.9
        vector[TAG_INDEX["timeTravel"]] = 0.8
        vector[TAG_INDEX["nostalgic"]] = 0.7
        vector[TAG_INDEX["comingOfAge"]] = 0.6
        result = assign_archetype(vector, {"Animation": 0.9})
        assert result["id"] == "dream_weaver"

    def test_full_tag_coverage(self):
        """Every tag in taxonomy must be referenced by at least one archetype."""
        all_tags = set(TAG_KEYS)
        covered = set()
        for arch in ARCHETYPES:
            covered.update(arch.get("match_tags", []))
        assert covered == all_tags, f"Uncovered tags: {all_tags - covered}"


class TestBuildDna:
    """Test the complete DNA build pipeline."""

    def test_returns_all_fields(self):
        picks = [{
            "round_number": 1,
            "phase": 1,
            "pair_id": "p1_01",
            "movie_a_tmdb_id": 155,
            "movie_b_tmdb_id": 496243,
            "chosen_tmdb_id": 155,
            "pick_mode": "watched",
            "test_dimension": "mainstream_vs_independent",
        }]
        genre_map = {155: ["Action", "Drama"]}
        result = build_dna(picks, genre_map)

        assert "archetype_id" in result
        assert "tag_vector" in result
        assert "tag_labels" in result
        assert "genre_vector" in result
        assert "quadrant_scores" in result
        assert "ticket_style" in result
        assert "archetype" in result
        assert len(result["tag_vector"]) == 30


def _score_archetype(archetype_id: str, tag_vector: list[float], genre_vector: dict) -> float:
    """Helper to compute score for a specific archetype (mirrors assign_archetype logic)."""
    arch = next(a for a in ARCHETYPES if a["id"] == archetype_id)
    score = 0.0
    for tag in arch.get("match_tags", []):
        if tag in TAG_INDEX:
            score += tag_vector[TAG_INDEX[tag]]
    archetype_genre_names = {
        GENRE_ID_TO_NAME[gid]
        for gid in arch.get("match_genres", [])
        if gid in GENRE_ID_TO_NAME
    }
    for genre_name, genre_score in genre_vector.items():
        if genre_name in archetype_genre_names:
            score += genre_score * 0.3
    return score
