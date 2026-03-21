import uuid

from pydantic import BaseModel

from app.models.match import MatchStatus


class MatchUserSummary(BaseModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None = None
    archetype_id: str | None = None


class MatchResponse(BaseModel):
    id: uuid.UUID
    partner: MatchUserSummary
    similarity_score: float
    shared_tags: list[str] = []
    ice_breakers: list[str] = []
    status: MatchStatus

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    match_id: uuid.UUID


class InviteResponse(BaseModel):
    id: uuid.UUID
    sender: MatchUserSummary
    similarity_score: float
    shared_tags: list[str] = []
    ice_breakers: list[str] = []
    ticket_image_url: str | None = None
    status: MatchStatus

    model_config = {"from_attributes": True}


class RespondRequest(BaseModel):
    accept: bool
