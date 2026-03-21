from pydantic import BaseModel

from app.models.pick import PickMode


class MovieInfo(BaseModel):
    tmdb_id: int
    title_en: str
    title_zh: str
    poster_url: str | None = None
    year: int | None = None
    genres: list[str] = []
    overview: str | None = None


class PairResponse(BaseModel):
    round_number: int
    phase: int
    movie_a: MovieInfo
    movie_b: MovieInfo
    test_dimension: str | None = None
    completed: bool = False


class PickRequest(BaseModel):
    chosen_tmdb_id: int
    pick_mode: PickMode
    response_time_ms: int | None = None


class SkipRequest(BaseModel):
    response_time_ms: int | None = None


class ProgressResponse(BaseModel):
    round_number: int
    phase: int
    total_rounds: int = 20
    completed: bool = False
    seed_movie_tmdb_id: int | None = None


class SeedMovieRequest(BaseModel):
    tmdb_id: int


class MovieSearchResult(BaseModel):
    tmdb_id: int
    title_en: str
    title_zh: str | None = None
    poster_url: str | None = None
    year: int | None = None
