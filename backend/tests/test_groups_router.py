from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.dna_profile import DnaProfile
from app.models.group import Group, group_members
from app.models.user import SequencingStatus, User
from app.services.auth_utils import create_access_token


@pytest_asyncio.fixture
async def auth_user(db_session):
    user = User(
        email="groups@test.com",
        name="Group User",
        gender="other",
        region="TW",
        sequencing_status=SequencingStatus.completed,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token(user.id, user.auth_version)
    headers = {"Authorization": f"Bearer {token}"}
    return user, headers


@pytest.mark.asyncio
async def test_member_can_post_group_message(client, auth_user, db_session):
    user, headers = auth_user
    group = Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck", "twist"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=1,
        is_active=True,
    )
    db_session.add(group)
    await db_session.commit()
    await db_session.execute(
        group_members.insert().values(user_id=user.id, group_id=group.id)
    )
    await db_session.commit()

    response = await client.post(
        f"/groups/{group.id}/messages",
        json={"body": "Arrival should headline this room."},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["body"] == "Arrival should headline this room."
    assert data["user"]["name"] == "Group User"
    assert data["can_delete"] is True


@pytest.mark.asyncio
async def test_non_member_cannot_post_group_message(client, auth_user, db_session):
    _, headers = auth_user
    db_session.add(Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=0,
        is_active=False,
    ))
    await db_session.commit()

    response = await client.post(
        "/groups/mobius_loop/messages",
        json={"body": "Let me in."},
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_groups_list_includes_recent_messages(client, auth_user, db_session):
    user, headers = auth_user
    profile = DnaProfile(
        user_id=user.id,
        archetype_id="time_traveler",
        tag_vector=[0.8] * 30,
        genre_vector={},
        quadrant_scores={},
        ticket_style="classic",
        version=1,
        is_active=True,
    )
    group = Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck", "twist"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=1,
        is_active=True,
    )
    db_session.add_all([profile, group])
    await db_session.commit()
    await db_session.execute(
        group_members.insert().values(user_id=user.id, group_id=group.id)
    )
    await db_session.commit()

    await client.post(
        "/groups/mobius_loop/messages",
        json={"body": "Primer belongs on the watchlist."},
        headers=headers,
    )

    response = await client.get("/groups", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["recent_messages"][-1]["body"] == "Primer belongs on the watchlist."
    assert payload[0]["recent_messages"][-1]["can_delete"] is True


@pytest.mark.asyncio
async def test_author_can_delete_own_group_message(client, auth_user, db_session):
    user, headers = auth_user
    group = Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck", "twist"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=1,
        is_active=True,
    )
    db_session.add(group)
    await db_session.commit()
    await db_session.execute(group_members.insert().values(user_id=user.id, group_id=group.id))
    await db_session.commit()

    create_response = await client.post(
        f"/groups/{group.id}/messages",
        json={"body": "Delete me."},
        headers=headers,
    )
    message_id = create_response.json()["id"]

    delete_response = await client.delete(
        f"/groups/{group.id}/messages/{message_id}",
        headers=headers,
    )
    assert delete_response.status_code == 204


@pytest.mark.asyncio
async def test_user_cannot_delete_others_group_message(client, auth_user, db_session):
    user, headers = auth_user
    other_user = User(
        email="other@test.com",
        name="Other User",
        gender="other",
        region="TW",
        sequencing_status=SequencingStatus.completed,
    )
    group = Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=2,
        is_active=True,
    )
    db_session.add_all([other_user, group])
    await db_session.commit()
    await db_session.refresh(other_user)
    await db_session.execute(group_members.insert().values(user_id=user.id, group_id=group.id))
    await db_session.execute(group_members.insert().values(user_id=other_user.id, group_id=group.id))
    await db_session.commit()

    other_headers = {"Authorization": f"Bearer {create_access_token(other_user.id, other_user.auth_version)}"}
    create_response = await client.post(
        f"/groups/{group.id}/messages",
        json={"body": "Hands off."},
        headers=other_headers,
    )
    message_id = create_response.json()["id"]

    delete_response = await client.delete(
        f"/groups/{group.id}/messages/{message_id}",
        headers=headers,
    )
    assert delete_response.status_code == 403
