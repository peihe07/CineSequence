"""Group theater lists router: CRUD for curated lists, items, and replies."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_current_user, get_db
from app.models.theater_list import TheaterList, TheaterListItem, TheaterListReply
from app.models.user import User
from app.routers._group_helpers import (
    ensure_group_visible_to_user,
    get_reply_authors,
    get_theater_list_for_response,
    get_theater_list_with_creator,
    notify_group_members_about_activity,
    prepare_items,
    require_group_membership,
    serialize_theater_list,
    theater_list_contains_item,
)
from app.schemas.groups import (
    TheaterListCreate,
    TheaterListItemCreate,
    TheaterListItemReorder,
    TheaterListItemUpdate,
    TheaterListOut,
    TheaterListReplyCreate,
    TheaterListUpdate,
)

router = APIRouter()


@router.get("/{group_id}/lists", response_model=list[TheaterListOut])
async def list_theater_lists(
    group_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TheaterListOut]:
    """List theater-curated lists for a visible group."""
    await ensure_group_visible_to_user(db, group_id=group_id, user=user)

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
        reply_authors = await get_reply_authors(db, theater_list=theater_list)
        serialized_lists.append(
            serialize_theater_list(
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
    await require_group_membership(db, group_id=group_id, user_id=user.id)

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

    prepared_items = await prepare_items(db, body.items)

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
    theater_list, _creator = await get_theater_list_for_response(
        db,
        group_id=group_id,
        list_id=str(theater_list.id),
    )
    await notify_group_members_about_activity(
        db,
        group_id=group_id,
        actor=user,
        list_id=str(theater_list.id),
        list_title=theater_list.title,
        activity_type="list_created",
    )
    return serialize_theater_list(theater_list, user, viewer_id=user.id)


@router.patch("/{group_id}/lists/{list_id}", response_model=TheaterListOut)
async def update_theater_list(
    group_id: str,
    list_id: str,
    body: TheaterListUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TheaterListOut:
    """Update theater list title and description."""
    await require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await get_theater_list_with_creator(
        db, group_id=group_id, list_id=list_id,
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
    theater_list, creator = await get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id,
    )
    reply_authors = await get_reply_authors(db, theater_list=theater_list)
    return serialize_theater_list(
        theater_list, creator, viewer_id=user.id, reply_authors=reply_authors,
    )


@router.delete("/{group_id}/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_theater_list(
    group_id: str,
    list_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a theater list."""
    await require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, _creator = await get_theater_list_with_creator(
        db, group_id=group_id, list_id=list_id,
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
    await require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id
    )

    title = body.title_en.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Item title cannot be empty"
        )

    prepared_items = await prepare_items(db, [body], theater_list.items)
    if not prepared_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Movie already exists in this list",
        )

    prepared = prepared_items[0]
    if theater_list_contains_item(theater_list.items, prepared):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Movie already exists in this list",
        )

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
    theater_list, creator = await get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id,
    )
    await notify_group_members_about_activity(
        db,
        group_id=group_id,
        actor=user,
        list_id=str(theater_list.id),
        list_title=theater_list.title,
        activity_type="list_replied",
    )
    reply_authors = await get_reply_authors(db, theater_list=theater_list)
    return serialize_theater_list(
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
    await require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await get_theater_list_for_response(
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
    theater_list, creator = await get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id,
    )
    reply_authors = await get_reply_authors(db, theater_list=theater_list)
    return serialize_theater_list(
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
    await require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await get_theater_list_for_response(
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
    theater_list, creator = await get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id,
    )
    reply_authors = await get_reply_authors(db, theater_list=theater_list)
    return serialize_theater_list(
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
    await require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id
    )

    item = next((entry for entry in theater_list.items if str(entry.id) == item_id), None)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List item not found")

    item.note = body.note.strip()[:500] if body.note and body.note.strip() else None

    await db.commit()
    theater_list, creator = await get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id,
    )
    reply_authors = await get_reply_authors(db, theater_list=theater_list)
    return serialize_theater_list(
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
    await require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await get_theater_list_for_response(
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
    theater_list, creator = await get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id,
    )
    await notify_group_members_about_activity(
        db,
        group_id=group_id,
        actor=user,
        list_id=str(theater_list.id),
        list_title=theater_list.title,
        activity_type="list_replied",
    )
    reply_authors = await get_reply_authors(db, theater_list=theater_list)
    return serialize_theater_list(
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
    await require_group_membership(db, group_id=group_id, user_id=user.id)
    theater_list, creator = await get_theater_list_for_response(
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
    theater_list, creator = await get_theater_list_for_response(
        db, group_id=group_id, list_id=list_id,
    )
    reply_authors = await get_reply_authors(db, theater_list=theater_list)
    return serialize_theater_list(
        theater_list, creator, viewer_id=user.id, reply_authors=reply_authors
    )
