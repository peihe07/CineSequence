"""Pydantic schemas for group-related endpoints."""

from typing import Literal

from pydantic import BaseModel, Field


class GroupMemberOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class GroupMovieOut(BaseModel):
    tmdb_id: int
    title_en: str
    poster_url: str | None = None
    match_tags: list[str]


class GroupWatchlistMovieOut(GroupMovieOut):
    supporter_count: int


class GroupMessageAuthorOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class GroupMessageOut(BaseModel):
    id: str
    body: str
    created_at: str
    user: GroupMessageAuthorOut
    can_delete: bool = False


class GroupMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=500)


class GroupActivityActorOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class GroupActivityOut(BaseModel):
    id: str
    type: str
    created_at: str
    actor: GroupActivityActorOut
    list_id: str
    list_title: str
    body: str | None = None


class GroupOut(BaseModel):
    id: str
    name: str
    subtitle: str
    icon: str
    primary_tags: list[str]
    is_hidden: bool
    member_count: int
    is_active: bool
    is_member: bool = False
    shared_tags: list[str] = []
    member_preview: list[GroupMemberOut] = []
    recent_messages: list[GroupMessageOut] = []
    recent_activity: list[GroupActivityOut] = []
    recommended_movies: list[GroupMovieOut] = []
    shared_watchlist: list[GroupWatchlistMovieOut] = []

    model_config = {"from_attributes": True}


class TheaterListCreatorOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class TheaterListItemCreate(BaseModel):
    tmdb_id: int
    title_en: str = Field(..., min_length=1, max_length=255)
    title_zh: str | None = Field(default=None, max_length=255)
    poster_url: str | None = Field(default=None, max_length=500)
    genres: list[str] = Field(default_factory=list, max_length=5)
    runtime_minutes: int | None = Field(default=None, ge=0, le=600)
    match_tags: list[str] = Field(default_factory=list, max_length=5)
    note: str | None = Field(default=None, max_length=500)


class TheaterListItemReorder(BaseModel):
    item_ids: list[str] = Field(..., max_length=50)


class TheaterListItemUpdate(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class TheaterListItemOut(BaseModel):
    id: str
    tmdb_id: int
    title_en: str
    title_zh: str | None = None
    poster_url: str | None = None
    genres: list[str] = []
    runtime_minutes: int | None = None
    match_tags: list[str]
    note: str | None = None
    position: int


class TheaterListReplyAuthorOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class TheaterListReplyCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=500)


class TheaterListReplyOut(BaseModel):
    id: str
    body: str
    created_at: str
    user: TheaterListReplyAuthorOut
    can_delete: bool = False


class TheaterListCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    visibility: Literal["group"] = "group"
    items: list[TheaterListItemCreate] = Field(default_factory=list, max_length=50)


class TheaterListUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)


class TheaterListOut(BaseModel):
    id: str
    group_id: str
    title: str
    description: str | None = None
    visibility: str
    created_at: str
    updated_at: str
    creator: TheaterListCreatorOut
    items: list[TheaterListItemOut]
    replies: list[TheaterListReplyOut]
