"""Groups router: group discovery and membership."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_current_user, get_db
from app.models.dna_profile import DnaProfile
from app.models.group import group_members
from app.models.group_message import GroupMessage
from app.models.theater_list import TheaterList, TheaterListItem, TheaterListReply
from app.models.user import User
from app.services.group_engine import (
    auto_assign_groups,
    build_group_payload,
    join_group,
    leave_group,
    list_visible_groups,
)
from app.services.notification_service import (
    emit_notification_safely,
    notify_theater_activity,
    notify_theater_assigned,
)
from app.services.r2_storage import normalize_public_object_url
from app.services.theater_list_items import (
    TheaterListItemData,
    item_fingerprint,
    prepare_theater_list_items,
)

router = APIRouter()


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


async def _get_theater_list_with_creator(
    db: AsyncSession,
    *,
    group_id: str,
    list_id: str,
) -> tuple[TheaterList, User]:
    result = await db.execute(
        select(TheaterList, User)
        .join(User, User.id == TheaterList.creator_id)
        .where(
            TheaterList.id == list_id,
            TheaterList.group_id == group_id,
        )
        .execution_options(populate_existing=True)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    return row


async def _get_theater_list_for_response(
    db: AsyncSession,
    *,
    group_id: str,
    list_id: str,
) -> tuple[TheaterList, User]:
    result = await db.execute(
        select(TheaterList, User)
        .join(User, User.id == TheaterList.creator_id)
        .where(
            TheaterList.id == list_id,
            TheaterList.group_id == group_id,
        )
        .options(
            selectinload(TheaterList.items),
            selectinload(TheaterList.replies),
        )
        .execution_options(populate_existing=True)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    return row


async def _require_group_membership(
    db: AsyncSession,
    *,
    group_id: str,
    user_id,
) -> None:
    membership = await db.execute(
        select(group_members).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == user_id,
        )
    )
    if not membership.first():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Join the theater first")


async def _ensure_group_visible_to_user(
    db: AsyncSession,
    *,
    group_id: str,
    user: User,
) -> tuple:
    result = await db.execute(select(group_members).where(
        group_members.c.group_id == group_id,
        group_members.c.user_id == user.id,
    ))
    is_member = result.first() is not None

    from app.models.group import Group

    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if group.is_hidden and not is_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    return group, is_member


async def _notify_group_members_about_activity(
    db: AsyncSession,
    *,
    group_id: str,
    actor: User,
    list_id: str,
    list_title: str,
    activity_type: str,
) -> None:
    membership_result = await db.execute(
        select(group_members.c.user_id).where(group_members.c.group_id == group_id)
    )
    member_ids = [member_id for (member_id,) in membership_result.all() if member_id != actor.id]
    for member_id in member_ids:
        await emit_notification_safely(
            notify_theater_activity,
            db,
            member_id,
            actor_name=actor.name,
            theater_id=group_id,
            list_id=list_id,
            list_title=list_title,
            activity_type=activity_type,
            context=f"theater_activity:{group_id}:{list_id}:{member_id}",
        )


async def _get_reply_authors(
    db: AsyncSession,
    *,
    theater_list: TheaterList,
) -> dict[str, User]:
    reply_user_ids = list({reply.user_id for reply in theater_list.replies})
    if not reply_user_ids:
        return {}

    result = await db.execute(select(User).where(User.id.in_(reply_user_ids)))
    return {str(author.id): author for author in result.scalars().all()}


def _serialize_theater_list(
    theater_list: TheaterList,
    creator: User,
    *,
    viewer_id,
    reply_authors: dict[str, User] | None = None,
) -> TheaterListOut:
    authors = reply_authors or {}
    return TheaterListOut(
        id=str(theater_list.id),
        group_id=theater_list.group_id,
        title=theater_list.title,
        description=theater_list.description,
        visibility=theater_list.visibility,
        created_at=theater_list.created_at.isoformat(),
        updated_at=theater_list.updated_at.isoformat(),
        creator=TheaterListCreatorOut(
            id=str(creator.id),
            name=creator.name,
            avatar_url=normalize_public_object_url(creator.avatar_url),
        ),
        items=[
            TheaterListItemOut(
                id=str(item.id),
                tmdb_id=item.tmdb_id,
                title_en=item.title_en,
                title_zh=item.title_zh,
                poster_url=item.poster_url,
                genres=item.genres or [],
                runtime_minutes=item.runtime_minutes,
                match_tags=item.match_tags or [],
                note=item.note,
                position=item.position,
            )
            for item in theater_list.items
        ],
        replies=[
            TheaterListReplyOut(
                id=str(reply.id),
                body=reply.body,
                created_at=reply.created_at.isoformat(),
                user=TheaterListReplyAuthorOut(
                    id=str(reply_author.id) if reply_author else "",
                    name=reply_author.name if reply_author else "Unknown",
                    avatar_url=normalize_public_object_url(reply_author.avatar_url)
                    if reply_author
                    else None,
                ),
                can_delete=reply.user_id == viewer_id,
            )
            for reply, reply_author in sorted(
                [(reply, authors.get(str(reply.user_id))) for reply in theater_list.replies],
                key=lambda entry: entry[0].created_at,
            )
        ],
    )


async def _prepare_theater_list_items(
    _db: AsyncSession,
    items: list[TheaterListItemCreate],
    existing_items: list[TheaterListItem] | None = None,
) -> list[TheaterListItemCreate]:
    existing_fingerprints = {
        fingerprint
        for item in (existing_items or [])
        if (fingerprint := item_fingerprint(item.tmdb_id, item.title_en, item.title_zh))
    }
    prepared = await prepare_theater_list_items(
        [
            TheaterListItemData(
                tmdb_id=item.tmdb_id,
                title_en=item.title_en.strip()[:255],
                title_zh=(
                    item.title_zh.strip()[:255]
                    if item.title_zh and item.title_zh.strip()
                    else None
                ),
                poster_url=(
                    item.poster_url.strip()[:500]
                    if item.poster_url and item.poster_url.strip()
                    else None
                ),
                genres=item.genres[:5],
                runtime_minutes=item.runtime_minutes,
                match_tags=item.match_tags[:5],
                note=item.note.strip()[:500] if item.note and item.note.strip() else None,
            )
            for item in items
        ],
        existing_fingerprints=existing_fingerprints,
    )
    return [
        TheaterListItemCreate(
            tmdb_id=item.tmdb_id,
            title_en=item.title_en,
            title_zh=item.title_zh,
            poster_url=item.poster_url,
            genres=item.genres or [],
            runtime_minutes=item.runtime_minutes,
            match_tags=item.match_tags or [],
            note=item.note,
        )
        for item in prepared
    ]


@router.get("")
async def list_groups(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[GroupOut]:
    """List all visible groups with membership status."""
    groups = await list_visible_groups(db, user)
    return [GroupOut(**g) for g in groups]


@router.post("/auto-assign")
async def auto_assign(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[GroupOut]:
    """Auto-assign user to groups based on DNA profile."""
    profile_result = await db.execute(
        select(DnaProfile).where(
            DnaProfile.user_id == user.id,
            DnaProfile.is_active.is_(True),
        )
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete DNA sequencing first",
        )

    user.dna_profiles = [profile]
    assigned = await auto_assign_groups(db, user)
    for group in assigned:
        await emit_notification_safely(
            notify_theater_assigned,
            db,
            user.id,
            theater_name=group.name,
            theater_id=group.id,
            context=f"theater_assigned:{group.id}:{user.id}",
        )
    user_group_ids = {g.id for g in assigned}
    return [
        GroupOut(**await build_group_payload(db, g, viewer=user, is_member=g.id in user_group_ids))
        for g in assigned
    ]


@router.get("/{group_id}")
async def get_group(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupOut:
    """Get group details."""
    group, is_member = await _ensure_group_visible_to_user(db, group_id=group_id, user=user)
    return GroupOut(**await build_group_payload(db, group, viewer=user, is_member=is_member))


@router.post("/{group_id}/join")
async def join(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupOut:
    """Join a group."""
    try:
        group = await join_group(db, user.id, group_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return GroupOut(**await build_group_payload(db, group, viewer=user, is_member=True))


@router.post("/{group_id}/leave")
async def leave(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupOut:
    """Leave a group."""
    try:
        group = await leave_group(db, user.id, group_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return GroupOut(**await build_group_payload(db, group, viewer=user, is_member=False))


@router.post("/{group_id}/messages", response_model=GroupMessageOut)
async def create_group_message(
    group_id: str,
    body: GroupMessageCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GroupMessageOut:
    """Create a new message in a group for existing members only."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)

    text = body.body.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty",
        )

    message = GroupMessage(group_id=group_id, user_id=user.id, body=text[:500])
    db.add(message)
    await db.commit()
    await db.refresh(message)

    return GroupMessageOut(
        id=str(message.id),
        body=message.body,
        created_at=message.created_at.isoformat(),
        user=GroupMessageAuthorOut(
            id=str(user.id),
            name=user.name,
            avatar_url=normalize_public_object_url(user.avatar_url),
        ),
        can_delete=True,
    )


@router.delete("/{group_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_message(
    group_id: str,
    message_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a group message if it belongs to the current user."""
    result = await db.execute(
        select(GroupMessage).where(
            GroupMessage.id == message_id,
            GroupMessage.group_id == group_id,
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own messages",
        )

    await db.delete(message)
    await db.commit()


@router.get("/{group_id}/lists", response_model=list[TheaterListOut])
async def list_theater_lists(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TheaterListOut]:
    """List theater-curated lists for a visible group."""
    await _ensure_group_visible_to_user(db, group_id=group_id, user=user)

    result = await db.execute(
        select(TheaterList, User)
        .join(User, User.id == TheaterList.creator_id)
        .where(TheaterList.group_id == group_id)
        .order_by(TheaterList.created_at.desc())
        .options(
            selectinload(TheaterList.items),
            selectinload(TheaterList.replies),
        )
        .execution_options(populate_existing=True)
    )
    rows = result.all()
    serialized_lists: list[TheaterListOut] = []
    for theater_list, creator in rows:
        reply_authors = await _get_reply_authors(db, theater_list=theater_list)
        serialized_lists.append(
            _serialize_theater_list(
                theater_list, creator, viewer_id=user.id, reply_authors=reply_authors
            )
        )
    return serialized_lists


@router.post("/{group_id}/lists", response_model=TheaterListOut)
async def create_theater_list(
    group_id: str,
    body: TheaterListCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TheaterListOut:
    """Create a theater-curated list for members of the room."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)

    title = body.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="List title cannot be empty"
        )

    theater_list = TheaterList(
        group_id=group_id,
        creator_id=user.id,
        title=title[:120],
        visibility=body.visibility,
        description=body.description.strip()[:1000]
        if body.description and body.description.strip()
        else None,
    )
    db.add(theater_list)
    await db.flush()

    prepared_items = await _prepare_theater_list_items(db, body.items)

    for index, item in enumerate(prepared_items):
        db.add(
            TheaterListItem(
                list_id=theater_list.id,
                tmdb_id=item.tmdb_id,
                title_en=item.title_en.strip()[:255],
                title_zh=(
                    item.title_zh.strip()[:255]
                    if item.title_zh and item.title_zh.strip()
                    else None
                ),
                poster_url=(
                    item.poster_url.strip()[:500]
                    if item.poster_url and item.poster_url.strip()
                    else None
                ),
                genres=item.genres[:5],
                runtime_minutes=item.runtime_minutes,
                match_tags=item.match_tags[:5],
                note=item.note.strip()[:500] if item.note and item.note.strip() else None,
                position=index,
                added_by=user.id,
            )
        )

    await db.commit()
    theater_list, _creator = await _get_theater_list_for_response(
        db,
        group_id=group_id,
        list_id=str(theater_list.id),
    )
    await _notify_group_members_about_activity(
        db,
        group_id=group_id,
        actor=user,
        list_id=str(theater_list.id),
        list_title=theater_list.title,
        activity_type="list_created",
    )
    return _serialize_theater_list(theater_list, user, viewer_id=user.id)


@router.patch("/{group_id}/lists/{list_id}", response_model=TheaterListOut)
async def update_theater_list(
    group_id: str,
    list_id: str,
    body: TheaterListUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TheaterListOut:
    """Update theater list title and description."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await _get_theater_list_with_creator(
        db,
        group_id=group_id,
        list_id=list_id,
    )

    title = body.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="List title cannot be empty",
        )

    theater_list.title = title[:120]
    theater_list.description = (
        body.description.strip()[:1000]
        if body.description and body.description.strip()
        else None
    )

    await db.commit()
    theater_list, creator = await _get_theater_list_for_response(
        db,
        group_id=group_id,
        list_id=list_id,
    )
    reply_authors = await _get_reply_authors(db, theater_list=theater_list)
    return _serialize_theater_list(
        theater_list,
        creator,
        viewer_id=user.id,
        reply_authors=reply_authors,
    )


@router.delete("/{group_id}/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_theater_list(
    group_id: str,
    list_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a theater list."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, _creator = await _get_theater_list_with_creator(
        db,
        group_id=group_id,
        list_id=list_id,
    )
    await db.delete(theater_list)
    await db.commit()


@router.post("/{group_id}/lists/{list_id}/items", response_model=TheaterListOut)
async def append_theater_list_item(
    group_id: str,
    list_id: str,
    body: TheaterListItemCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TheaterListOut:
    """Append a new movie item to an existing theater list."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await _get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id
    )

    title = body.title_en.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Item title cannot be empty"
        )

    prepared_items = await _prepare_theater_list_items(db, [body], theater_list.items)
    if not prepared_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Movie already exists in this list",
        )

    prepared = prepared_items[0]

    db.add(
        TheaterListItem(
            list_id=theater_list.id,
            tmdb_id=prepared.tmdb_id,
            title_en=prepared.title_en[:255],
            title_zh=(
                prepared.title_zh.strip()[:255]
                if prepared.title_zh and prepared.title_zh.strip()
                else None
            ),
            poster_url=(
                prepared.poster_url.strip()[:500]
                if prepared.poster_url and prepared.poster_url.strip()
                else None
            ),
            genres=(prepared.genres or [])[:5],
            runtime_minutes=prepared.runtime_minutes,
            match_tags=(prepared.match_tags or [])[:5],
            note=prepared.note.strip()[:500] if prepared.note and prepared.note.strip() else None,
            position=len(theater_list.items),
            added_by=user.id,
        )
    )
    await db.commit()
    theater_list, creator = await _get_theater_list_for_response(
        db,
        group_id=group_id,
        list_id=list_id,
    )
    await _notify_group_members_about_activity(
        db,
        group_id=group_id,
        actor=user,
        list_id=str(theater_list.id),
        list_title=theater_list.title,
        activity_type="list_replied",
    )
    reply_authors = await _get_reply_authors(db, theater_list=theater_list)
    return _serialize_theater_list(
        theater_list, creator, viewer_id=user.id, reply_authors=reply_authors
    )


@router.delete("/{group_id}/lists/{list_id}/items/{item_id}", response_model=TheaterListOut)
async def delete_theater_list_item(
    group_id: str,
    list_id: str,
    item_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TheaterListOut:
    """Remove a movie item from a theater list."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await _get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id
    )

    item = next((entry for entry in theater_list.items if str(entry.id) == item_id), None)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List item not found")
    if item.added_by not in (None, user.id) and creator.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own list items unless you own the list",
        )

    remaining_items = [entry for entry in theater_list.items if str(entry.id) != item_id]
    await db.delete(item)
    await db.flush()

    for index, remaining in enumerate(remaining_items):
        remaining.position = index

    await db.commit()
    theater_list, creator = await _get_theater_list_for_response(
        db,
        group_id=group_id,
        list_id=list_id,
    )
    reply_authors = await _get_reply_authors(db, theater_list=theater_list)
    return _serialize_theater_list(
        theater_list, creator, viewer_id=user.id, reply_authors=reply_authors
    )


@router.patch("/{group_id}/lists/{list_id}/items/reorder", response_model=TheaterListOut)
async def reorder_theater_list_items(
    group_id: str,
    list_id: str,
    body: TheaterListItemReorder,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TheaterListOut:
    """Reorder movie items inside a theater list."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await _get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id
    )

    current_ids = [str(item.id) for item in theater_list.items]
    requested_ids = body.item_ids
    if current_ids and sorted(requested_ids) != sorted(current_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item order must include every list item exactly once",
        )

    item_lookup = {str(item.id): item for item in theater_list.items}
    for index, item_id in enumerate(requested_ids):
        item_lookup[item_id].position = index

    await db.commit()
    theater_list, creator = await _get_theater_list_for_response(
        db,
        group_id=group_id,
        list_id=list_id,
    )
    reply_authors = await _get_reply_authors(db, theater_list=theater_list)
    return _serialize_theater_list(
        theater_list, creator, viewer_id=user.id, reply_authors=reply_authors
    )


@router.patch("/{group_id}/lists/{list_id}/items/{item_id}", response_model=TheaterListOut)
async def update_theater_list_item(
    group_id: str,
    list_id: str,
    item_id: str,
    body: TheaterListItemUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TheaterListOut:
    """Update note metadata for an existing theater list item."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await _get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id
    )

    item = next((entry for entry in theater_list.items if str(entry.id) == item_id), None)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List item not found")

    item.note = body.note.strip()[:500] if body.note and body.note.strip() else None

    await db.commit()
    theater_list, creator = await _get_theater_list_for_response(
        db,
        group_id=group_id,
        list_id=list_id,
    )
    reply_authors = await _get_reply_authors(db, theater_list=theater_list)
    return _serialize_theater_list(
        theater_list, creator, viewer_id=user.id, reply_authors=reply_authors
    )


@router.post("/{group_id}/lists/{list_id}/replies", response_model=TheaterListOut)
async def create_theater_list_reply(
    group_id: str,
    list_id: str,
    body: TheaterListReplyCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TheaterListOut:
    """Create a flat reply under a theater list."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await _get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id
    )

    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reply cannot be empty")

    db.add(
        TheaterListReply(
            list_id=theater_list.id,
            user_id=user.id,
            body=text[:500],
        )
    )
    await db.commit()
    theater_list, creator = await _get_theater_list_for_response(
        db,
        group_id=group_id,
        list_id=list_id,
    )
    await _notify_group_members_about_activity(
        db,
        group_id=group_id,
        actor=user,
        list_id=str(theater_list.id),
        list_title=theater_list.title,
        activity_type="list_replied",
    )
    reply_authors = await _get_reply_authors(db, theater_list=theater_list)
    return _serialize_theater_list(
        theater_list, creator, viewer_id=user.id, reply_authors=reply_authors
    )


@router.delete("/{group_id}/lists/{list_id}/replies/{reply_id}", response_model=TheaterListOut)
async def delete_theater_list_reply(
    group_id: str,
    list_id: str,
    reply_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TheaterListOut:
    """Delete a reply from a theater list if it belongs to the current user."""
    await _require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await _get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id
    )

    reply = next((entry for entry in theater_list.replies if str(entry.id) == reply_id), None)
    if not reply:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found")
    if reply.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own replies",
        )

    await db.delete(reply)
    await db.commit()
    theater_list, creator = await _get_theater_list_for_response(
        db,
        group_id=group_id,
        list_id=list_id,
    )
    reply_authors = await _get_reply_authors(db, theater_list=theater_list)
    return _serialize_theater_list(
        theater_list, creator, viewer_id=user.id, reply_authors=reply_authors
    )
