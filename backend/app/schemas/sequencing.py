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
    test_dimension: str | None = None


class SkipRequest(BaseModel):
    response_time_ms: int | None = None
    test_dimension: str | None = None


class ProgressResponse(BaseModel):
    round_number: int
    phase: int
    total_rounds: int = 20
    completed: bool = False
    seed_movie_tmdb_id: int | None = None
    # Extension fields
    can_extend: bool = False
    extension_batches: int = 0
    max_extension_batches: int = 3
    session_version: int = 1
    is_extending: bool = False


class SeedMovieRequest(BaseModel):
    tmdb_id: int


class MovieSearchResult(BaseModel):
    tmdb_id: int
    title_en: str
    title_zh: str | None = None
    poster_url: str | None = None
    year: int | None = None


class ExtendResponse(BaseModel):
    total_rounds: int
    extension_batches: int
    max_extension_batches: int


class RetestResponse(BaseModel):
    version: int
    message: str = "New sequencing session started"
