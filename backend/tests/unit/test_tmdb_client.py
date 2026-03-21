"""Tests for TMDB client: parsing and utility functions."""

from app.services.tmdb_client import MovieInfo, _parse_movie, _poster_url


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
