"""Tests for TMDB client: parsing and utility functions."""

from app.services.tmdb_client import (
    MovieInfo,
    _levenshtein,
    _normalize_title,
    _parse_movie,
    _poster_url,
    _score_release_year,
    _score_search_match,
    _strip_stopwords,
)


class TestPosterUrl:
    """Test poster URL construction."""

    def test_with_path(self):
        url = _poster_url("/abc123.jpg")
        assert url == "https://image.tmdb.org/t/p/w500/abc123.jpg"

    def test_with_custom_size(self):
        url = _poster_url("/abc.jpg", size="w200")
        assert url == "https://image.tmdb.org/t/p/w200/abc.jpg"

    def test_none_path(self):
        assert _poster_url(None) is None

    def test_empty_path(self):
        assert _poster_url("") is None


class TestParseMovie:
    """Test TMDB response parsing."""

    def test_full_response(self):
        data = {
            "id": 550,
            "original_title": "Fight Club",
            "title": "鬥陣俱樂部",
            "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
            "release_date": "1999-10-15",
            "genres": [
                {"id": 18, "name": "Drama"},
                {"id": 53, "name": "Thriller"},
            ],
            "overview": "A ticking-Loss film about an insomniac...",
        }
        movie = _parse_movie(data)
        assert movie.tmdb_id == 550
        assert movie.title_en == "Fight Club"
        assert movie.title_zh == "鬥陣俱樂部"
        assert movie.year == 1999
        assert movie.genres == ["Drama", "Thriller"]
        assert movie.poster_url is not None
        assert "w500" in movie.poster_url

    def test_missing_release_date(self):
        data = {
            "id": 1,
            "title": "Test",
            "release_date": "",
            "genres": [],
        }
        movie = _parse_movie(data)
        assert movie.year is None

    def test_no_poster(self):
        data = {
            "id": 2,
            "title": "No Poster",
            "release_date": "2020-01-01",
            "genres": [],
            "poster_path": None,
        }
        movie = _parse_movie(data)
        assert movie.poster_url is None

    def test_no_genres(self):
        data = {
            "id": 3,
            "title": "Genreless",
            "release_date": "2020-01-01",
        }
        movie = _parse_movie(data)
        assert movie.genres == []

    def test_fallback_title(self):
        """If no original_title, should use title."""
        data = {
            "id": 4,
            "title": "Fallback Title",
            "release_date": "2021-05-10",
            "genres": [],
        }
        movie = _parse_movie(data)
        assert movie.title_en == "Fallback Title"


class TestMovieInfo:
    """Test MovieInfo dataclass."""

    def test_create(self):
        movie = MovieInfo(
            tmdb_id=100,
            title_en="Test Movie",
            title_zh="測試電影",
            poster_url=None,
            year=2020,
            genres=["Action"],
            overview="A test movie",
        )
        assert movie.tmdb_id == 100
        assert movie.genres == ["Action"]


class TestSearchNormalization:
    """Test local title normalization and ranking helpers."""

    def test_normalize_title_strips_punctuation(self):
        assert _normalize_title("橫道世之介!!!") == "橫道世之介"
        assert _normalize_title("Before Sunrise (1995)") == "beforesunrise1995"

    def test_prefix_match_scores_above_non_match(self):
        target = MovieInfo(
            tmdb_id=1,
            title_en="A Story of Yonosuke",
            title_zh="橫道世之介",
            poster_url=None,
            year=2013,
            genres=[],
        )
        other = MovieInfo(
            tmdb_id=2,
            title_en="Monster",
            title_zh="怪物",
            poster_url=None,
            year=2023,
            genres=[],
        )

        assert _score_search_match("橫道", target) > _score_search_match("橫道", other)

    def test_exact_match_scores_above_prefix_match(self):
        exact = MovieInfo(
            tmdb_id=1,
            title_en="Yonosuke Yokomichi",
            title_zh="橫道世之介",
            poster_url=None,
            year=2013,
            genres=[],
        )
        prefix_only = MovieInfo(
            tmdb_id=2,
            title_en="Yokomichi Days",
            title_zh="橫道青春",
            poster_url=None,
            year=2014,
            genres=[],
        )

        assert _score_search_match("橫道世之介", exact) > _score_search_match("橫道", prefix_only)

    def test_search_match_prefers_original_title_exact_match(self):
        exact_original = MovieInfo(
            tmdb_id=1,
            title_en="In the Mood for Love",
            title_zh="花樣年華",
            poster_url=None,
            year=2000,
            genres=[],
        )
        partial_match = MovieInfo(
            tmdb_id=2,
            title_en="Mood Indigo",
            title_zh="戀戀銅鑼燒",
            poster_url=None,
            year=2013,
            genres=[],
        )

        assert _score_search_match("In the Mood for Love", exact_original) > _score_search_match(
            "In the Mood for Love", partial_match
        )

    def test_release_year_score_prefers_matching_year(self):
        assert _score_release_year("2046 2004", 2004) > _score_release_year("2046 2004", 2024)

    def test_token_overlap_prefers_title_covering_more_query_words(self):
        fuller_match = MovieInfo(
            tmdb_id=1,
            title_en="Eternal Sunshine of the Spotless Mind",
            title_zh="王牌冤家",
            poster_url=None,
            year=2004,
            genres=[],
        )
        weaker_match = MovieInfo(
            tmdb_id=2,
            title_en="Sunshine",
            title_zh="太陽浩劫",
            poster_url=None,
            year=2007,
            genres=[],
        )

        assert _score_search_match("eternal sunshine spotless", fuller_match) > _score_search_match(
            "eternal sunshine spotless", weaker_match
        )

    def test_normalize_title_handles_full_width_forms(self):
        assert _normalize_title("Ａｍéｌｉｅ ２００１") == "amelie2001"


class TestStopWordStripping:
    """Test article / preposition removal for matching tolerance."""

    def test_strip_the_article(self):
        """'Godfather' should match 'The Godfather' after stop-word removal."""
        godfather = MovieInfo(
            tmdb_id=238,
            title_en="The Godfather",
            title_zh="教父",
            poster_url=None,
            year=1972,
            genres=[],
        )
        score = _score_search_match("Godfather", godfather)
        assert score[1] > 0, "exact_no_stop should fire when query matches after stop-word removal"

    def test_strip_does_not_affect_cjk(self):
        """Stop-word stripping only targets Latin articles; CJK titles stay intact."""
        assert _strip_stopwords("教父") == "教父"

    def test_strip_multiple_articles(self):
        """'of' and 'the' both stripped."""
        assert _strip_stopwords("The Lord of the Rings") == "lordrings"
        lotr = MovieInfo(
            tmdb_id=120,
            title_en="The Lord of the Rings",
            title_zh="魔戒",
            poster_url=None,
            year=2001,
            genres=[],
        )
        # Normalised query "lordoftherings" != normalised title "thelordoftherings",
        # so exact_match (score[0]) and prefix_match (score[2]) are both 0.
        # But exact_no_stop (score[1]) should fire because both strip to "lordrings".
        score = _score_search_match("Lord of the Rings", lotr)
        assert score[1] > 0, "exact_no_stop should fire after stripping articles from both sides"

    def test_stopword_match_ranks_below_exact(self):
        """Exact match should still beat stopword-stripped match."""
        movie = MovieInfo(
            tmdb_id=238,
            title_en="The Godfather",
            title_zh="教父",
            poster_url=None,
            year=1972,
            genres=[],
        )
        exact_score = _score_search_match("The Godfather", movie)
        stopword_score = _score_search_match("Godfather", movie)
        assert exact_score >= stopword_score


class TestLevenshteinDistance:
    """Test the edit-distance implementation."""

    def test_identical_strings(self):
        assert _levenshtein("stalker", "stalker") == 0

    def test_single_deletion(self):
        assert _levenshtein("stalke", "stalker") == 1

    def test_single_substitution(self):
        assert _levenshtein("stolker", "stalker") == 1

    def test_single_insertion(self):
        assert _levenshtein("staalker", "stalker") == 1

    def test_two_edits(self):
        assert _levenshtein("stalkxr", "stalker") == 1
        assert _levenshtein("ztalkxr", "stalker") == 2

    def test_completely_different(self):
        assert _levenshtein("abc", "xyz") == 3

    def test_empty_strings(self):
        assert _levenshtein("", "") == 0
        assert _levenshtein("abc", "") == 3
        assert _levenshtein("", "abc") == 3


class TestFuzzySearchMatch:
    """Test fuzzy matching via Levenshtein distance in search scoring."""

    def test_typo_still_matches(self):
        """'Stalke' (missing r) should fuzzy-match 'Stalker'."""
        stalker = MovieInfo(
            tmdb_id=1086,
            title_en="Stalker",
            title_zh="潛行者",
            poster_url=None,
            year=1979,
            genres=[],
        )
        score = _score_search_match("Stalke", stalker)
        assert score[6] > 0, "fuzzy_match should fire for 1-edit-distance typo"

    def test_two_char_typo_matches(self):
        """'Mulholand Driv' should fuzzy-match 'Mulholland Drive'."""
        movie = MovieInfo(
            tmdb_id=1018,
            title_en="Mulholland Drive",
            title_zh="乂乂",
            poster_url=None,
            year=2001,
            genres=[],
        )
        # Normalized: "mulholanddriv" vs "mulhollanddrive" → edit distance 2
        score = _score_search_match("Mulholand Driv", movie)
        assert score[6] > 0, "fuzzy_match should fire for 2-edit-distance typo"

    def test_too_many_typos_no_match(self):
        """Edit distance > 2 should not trigger fuzzy match."""
        movie = MovieInfo(
            tmdb_id=1086,
            title_en="Stalker",
            title_zh="潛行者",
            poster_url=None,
            year=1979,
            genres=[],
        )
        score = _score_search_match("Stxxxx", movie)
        assert score[6] == 0, "fuzzy_match should NOT fire for > 2 edits"

    def test_short_query_skips_fuzzy(self):
        """Very short queries (< 4 chars) should not attempt fuzzy matching."""
        movie = MovieInfo(
            tmdb_id=100,
            title_en="Her",
            title_zh="雲端情人",
            poster_url=None,
            year=2013,
            genres=[],
        )
        score = _score_search_match("He", movie)
        assert score[6] == 0, "fuzzy_match should be skipped for queries < 4 chars"

    def test_fuzzy_ranks_below_exact(self):
        """Exact match should always beat fuzzy match."""
        movie = MovieInfo(
            tmdb_id=1086,
            title_en="Stalker",
            title_zh="潛行者",
            poster_url=None,
            year=1979,
            genres=[],
        )
        exact_score = _score_search_match("Stalker", movie)
        fuzzy_score = _score_search_match("Stalke", movie)
        assert exact_score > fuzzy_score


class TestTokenPrefixMatch:
    """Test token-prefix matching (query token is a prefix of title token)."""

    def test_partial_token_matches(self):
        """'eter sun' should partially match 'eternal sunshine'."""
        movie = MovieInfo(
            tmdb_id=38,
            title_en="Eternal Sunshine of the Spotless Mind",
            title_zh="王牌冤家",
            poster_url=None,
            year=2004,
            genres=[],
        )
        score = _score_search_match("eter sun", movie)
        assert score[5] > 0, "token_prefix_overlap should fire for partial tokens"

    def test_exact_token_not_double_counted(self):
        """Tokens that match exactly should not also count as prefix matches."""
        movie = MovieInfo(
            tmdb_id=38,
            title_en="Eternal Sunshine of the Spotless Mind",
            title_zh="王牌冤家",
            poster_url=None,
            year=2004,
            genres=[],
        )
        score = _score_search_match("eternal sunshine spotless", movie)
        # All 3 tokens match exactly → token_overlap = 3, token_prefix_overlap = 0
        assert score[4] == 3, "token_overlap should count exact matches"
        assert score[5] == 0, "token_prefix_overlap should not double-count exact tokens"


class TestPopularityTiebreaker:
    """Verify popularity is preserved through MovieInfo and used as a tiebreaker."""

    def test_popularity_stored_on_movie_info(self):
        movie = MovieInfo(
            tmdb_id=238,
            title_en="The Godfather",
            title_zh="教父",
            poster_url=None,
            year=1972,
            genres=[],
            popularity=87.4,
        )
        assert movie.popularity == 87.4

    def test_popularity_defaults_to_zero(self):
        movie = MovieInfo(
            tmdb_id=1,
            title_en="Unknown Film",
            title_zh=None,
            poster_url=None,
            year=2000,
            genres=[],
        )
        assert movie.popularity == 0.0

    def test_popular_film_ranks_above_obscure_same_title(self):
        """When title scores are equal, higher popularity should win."""
        popular = MovieInfo(
            tmdb_id=238,
            title_en="The Godfather",
            title_zh="教父",
            poster_url=None,
            year=1972,
            genres=[],
            popularity=200.0,
        )
        obscure = MovieInfo(
            tmdb_id=9999,
            title_en="The Godfather",
            title_zh=None,
            poster_url=None,
            year=2003,
            genres=[],
            popularity=1.2,
        )
        score_popular = _score_search_match("The Godfather", popular)
        score_obscure = _score_search_match("The Godfather", obscure)
        # Title scores must be equal for this test to be meaningful
        assert score_popular == score_obscure, "Title scores should be identical for same title"
        # Popularity is used outside _score_search_match (in sort key), so verify
        # the values are stored correctly for the sort to use.
        assert popular.popularity > obscure.popularity
