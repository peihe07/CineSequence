"""Shared helpers for group routers."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.group import Group, group_members
from app.models.theater_list import TheaterList, TheaterListItem
from app.models.user import User
from app.schemas.groups import (
    TheaterListCreatorOut,
    TheaterListItemCreate,
    TheaterListItemOut,
    TheaterListOut,
    TheaterListReplyAuthorOut,
    TheaterListReplyOut,
)
from app.services.notification_service import (
    emit_notification_safely,
    notify_theater_activity,
)
from app.services.r2_storage import normalize_public_object_url
from app.services.theater_list_items import (
    TheaterListItemData,
    item_fingerprint,
    prepare_theater_list_items,
)


async def require_group_membership(
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


async def ensure_group_visible_to_user(
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

    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if group.is_hidden and not is_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    return group, is_member


async def get_theater_list_with_creator(
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


async def get_theater_list_for_response(
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


async def get_reply_authors(
    db: AsyncSession,
    *,
    theater_list: TheaterList,
) -> dict[str, User]:
    reply_user_ids = list({reply.user_id for reply in theater_list.replies})
    if not reply_user_ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(reply_user_ids)))
    return {str(author.id): author for author in result.scalars().all()}


def serialize_theater_list(
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


async def notify_group_members_about_activity(
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


async def prepare_items(
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


def theater_list_contains_item(
    existing_items: list[TheaterListItem],
    item: TheaterListItemCreate,
) -> bool:
    fingerprint = item_fingerprint(item.tmdb_id, item.title_en, item.title_zh)
    if not fingerprint:
        return False
    return any(
        item_fingerprint(existing.tmdb_id, existing.title_en, existing.title_zh) == fingerprint
        for existing in existing_items
    )
