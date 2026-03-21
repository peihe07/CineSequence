import uuid

from pydantic import BaseModel

from app.models.user import Gender, GenderPref


class ProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    gender: Gender
    birth_year: int | None = None
    region: str
    avatar_url: str | None = None
    match_gender_pref: GenderPref | None = None
    match_age_min: int | None = None
    match_age_max: int | None = None
    pure_taste_match: bool = False
    sequencing_status: str
    seed_movie_tmdb_id: int | None = None

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    birth_year: int | None = None
    region: str | None = None
    match_gender_pref: GenderPref | None = None
    match_age_min: int | None = None
    match_age_max: int | None = None
    pure_taste_match: bool | None = None
