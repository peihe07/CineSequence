from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import insert, select, text

from app.models.dna_profile import TAG_VECTOR_DIMENSIONS, DnaProfile
from app.models.group import Group, group_members
from app.models.group_message import GroupMessage
from app.models.notification import Notification
from app.models.theater_list import TheaterList, TheaterListReply
from app.models.user import SequencingStatus, User
from app.services.auth_utils import create_access_token
from app.services.group_engine import _recent_activity, _recent_messages


@pytest_asyncio.fixture(autouse=True)
async def stub_tmdb_item_enrichment(monkeypatch):
    async def fake_get_movie(tmdb_id: int):
        return type(
            "FakeMovie",
            (),
            {
                "tmdb_id": tmdb_id,
                "title_en": "Arrival" if tmdb_id == 11 else f"Movie {tmdb_id}",
                "title_zh": "異星入境" if tmdb_id == 11 else None,
                "poster_url": "https://image.tmdb.org/t/p/w500/arrival.jpg",
                "genres": ["Science Fiction"],
                "runtime_minutes": 116,
            },
        )()

    async def fake_search_movies(query: str, limit: int = 5):
        return [await fake_get_movie(11)]

    async def fake_get_movies(tmdb_ids: list[int]):
        return {
            tmdb_id: await fake_get_movie(tmdb_id)
            for tmdb_id in tmdb_ids
        }

    monkeypatch.setattr("app.services.theater_list_items.get_movie", fake_get_movie)
    monkeypatch.setattr("app.services.theater_list_items.search_movies", fake_search_movies)
    monkeypatch.setattr("app.services.group_engine.get_movies", fake_get_movies)


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
    await db_session.execute(group_members.insert().values(user_id=user.id, group_id=group.id))
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
    db_session.add(
        Group(
            id="mobius_loop",
            name="Mobius Loop",
            subtitle="Mind-benders only",
            icon="ri-tornado-line",
            primary_tags=["mindfuck"],
            is_hidden=False,
            min_members_to_activate=1,
            member_count=0,
            is_active=False,
        )
    )
    await db_session.commit()

    response = await client.post(
        "/groups/mobius_loop/messages",
        json={"body": "Let me in."},
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_groups_list_returns_lightweight_overview_payload(client, auth_user, db_session):
    user, headers = auth_user
    profile = DnaProfile(
        user_id=user.id,
        archetype_id="time_traveler",
        tag_vector=[0.8] * TAG_VECTOR_DIMENSIONS,
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
    await db_session.execute(group_members.insert().values(user_id=user.id, group_id=group.id))
    await db_session.commit()

    await client.post(
        "/groups/mobius_loop/messages",
        json={"body": "Primer belongs on the watchlist."},
        headers=headers,
    )

    response = await client.get("/groups", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["recent_messages"] == []
    assert payload[0]["recent_activity"] == []


@pytest.mark.asyncio
async def test_recent_messages_returns_latest_window_in_chronological_order(db_session):
    user = User(
        email="messages@test.com",
        name="Message User",
        gender="other",
        region="TW",
        sequencing_status=SequencingStatus.completed,
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
    db_session.add_all([user, group])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.execute(insert(group_members).values(user_id=user.id, group_id=group.id))

    base = datetime(2026, 1, 1, tzinfo=UTC)
    for idx in range(5):
        db_session.add(GroupMessage(
            group_id=group.id,
            user_id=user.id,
            body=f"message-{idx}",
            created_at=base + timedelta(minutes=idx),
        ))
    await db_session.commit()

    payload = await _recent_messages(db_session, group.id, viewer_id=user.id, limit=3)

    assert [item["body"] for item in payload] == ["message-2", "message-3", "message-4"]
    assert [item["can_delete"] for item in payload] == [True, True, True]


@pytest.mark.asyncio
async def test_recent_activity_returns_newest_items_first_without_python_sorting(db_session):
    user = User(
        email="activity@test.com",
        name="Activity User",
        gender="other",
        region="TW",
        sequencing_status=SequencingStatus.completed,
    )
    group = Group(
        id="cafe_screening",
        name="Cafe Screening",
        subtitle="Talk first, credits later",
        icon="ri-cup-line",
        primary_tags=["dialogue"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=1,
        is_active=True,
    )
    db_session.add_all([user, group])
    await db_session.commit()
    await db_session.refresh(user)

    base = datetime(2026, 1, 2, tzinfo=UTC)
    older_list = TheaterList(
        group_id=group.id,
        creator_id=user.id,
        title="Older List",
        description="older",
        visibility="group",
        created_at=base,
    )
    newer_list = TheaterList(
        group_id=group.id,
        creator_id=user.id,
        title="Newer List",
        description="newer",
        visibility="group",
        created_at=base + timedelta(minutes=2),
    )
    db_session.add_all([older_list, newer_list])
    await db_session.flush()
    db_session.add_all([
        TheaterListReply(
            list_id=older_list.id,
            user_id=user.id,
            body="reply-middle",
            created_at=base + timedelta(minutes=1),
        ),
        TheaterListReply(
            list_id=newer_list.id,
            user_id=user.id,
            body="reply-latest",
            created_at=base + timedelta(minutes=3),
        ),
    ])
    await db_session.commit()

    payload = await _recent_activity(db_session, group.id, limit=3)

    assert [item["id"].split("-")[0] for item in payload] == ["reply", "list", "reply"]
    assert [item["created_at"] for item in payload] == [
        (base + timedelta(minutes=3)).isoformat(),
        (base + timedelta(minutes=2)).isoformat(),
        (base + timedelta(minutes=1)).isoformat(),
    ]


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
    await db_session.execute(
        group_members.insert().values(user_id=other_user.id, group_id=group.id)
    )
    await db_session.commit()

    other_headers = {
        "Authorization": f"Bearer {create_access_token(other_user.id, other_user.auth_version)}",
    }
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


@pytest.mark.asyncio
async def test_member_can_create_theater_list(client, auth_user, db_session):
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

    response = await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [
                {
                    "tmdb_id": 11,
                    "title_en": "Arrival",
                    "match_tags": ["mindfuck", "twist"],
                    "note": "Start here.",
                }
            ],
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["title"] == "Late-Night Brain Melt"
    assert payload["group_id"] == "mobius_loop"
    assert payload["creator"]["name"] == "Group User"
    assert len(payload["items"]) == 1
    assert payload["items"][0]["title_en"] == "Arrival"
    assert payload["items"][0]["position"] == 0


@pytest.mark.asyncio
async def test_manual_theater_list_items_are_enriched_and_deduped(
    client,
    auth_user,
    db_session,
    monkeypatch,
):
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

    from app.routers import groups as groups_router

    async def fake_prepare_items(_db, items, _existing_items=None):
        return [
            groups_router.TheaterListItemCreate(
                tmdb_id=11,
                title_en="Arrival",
                title_zh="異星入境",
                poster_url="https://image.tmdb.org/t/p/w500/arrival.jpg",
                genres=["Science Fiction"],
                runtime_minutes=116,
                match_tags=[],
                note="Seeded from quick-create flow.",
            )
        ]

    monkeypatch.setattr(groups_router, "_prepare_theater_list_items", fake_prepare_items)

    response = await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [
                {"tmdb_id": 0, "title_en": "Arrival"},
                {"tmdb_id": 0, "title_en": "Arrival"},
            ],
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 1
    assert payload["items"][0]["tmdb_id"] == 11
    assert payload["items"][0]["poster_url"] == "https://image.tmdb.org/t/p/w500/arrival.jpg"
    assert payload["items"][0]["title_zh"] == "異星入境"
    assert payload["items"][0]["genres"] == ["Science Fiction"]
    assert payload["items"][0]["runtime_minutes"] == 116


@pytest.mark.asyncio
async def test_group_message_schema_rejects_body_over_500_chars(client, auth_user, db_session):
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

    response = await client.post(
        f"/groups/{group.id}/messages",
        json={"body": "x" * 501},
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_theater_list_schema_rejects_more_than_50_items(client, auth_user, db_session):
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

    response = await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "Too Many Movies",
            "items": [
                {
                    "tmdb_id": index,
                    "title_en": f"Movie {index}",
                    "match_tags": [],
                }
                for index in range(51)
            ],
        },
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_theater_list_schema_rejects_title_over_120_chars(client, auth_user, db_session):
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

    response = await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "x" * 121,
            "description": "Built for spiral conversations after midnight.",
        },
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_member_can_list_theater_lists(client, auth_user, db_session):
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

    await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "Shared First Watch",
            "description": "A first pass watchlist for this room.",
            "items": [
                {
                    "tmdb_id": 12,
                    "title_en": "Decision to Leave",
                    "match_tags": ["twist"],
                }
            ],
        },
        headers=headers,
    )

    response = await client.get(f"/groups/{group.id}/lists", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["title"] == "Shared First Watch"
    assert payload[0]["items"][0]["title_en"] == "Decision to Leave"


@pytest.mark.asyncio
async def test_member_can_update_theater_list_metadata(client, auth_user, db_session):
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
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [],
        },
        headers=headers,
    )
    list_id = create_response.json()["id"]

    response = await client.patch(
        f"/groups/{group.id}/lists/{list_id}",
        json={
            "title": "Midnight Rotation",
            "description": "For after the room goes quiet.",
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["title"] == "Midnight Rotation"
    assert payload["description"] == "For after the room goes quiet."


@pytest.mark.asyncio
async def test_member_can_delete_theater_list(client, auth_user, db_session):
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
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [],
        },
        headers=headers,
    )
    list_id = create_response.json()["id"]

    response = await client.delete(
        f"/groups/{group.id}/lists/{list_id}",
        headers=headers,
    )

    assert response.status_code == 204

    list_response = await client.get(f"/groups/{group.id}/lists", headers=headers)
    payload = list_response.json()
    assert payload == []


@pytest.mark.asyncio
async def test_non_member_cannot_create_theater_list(client, auth_user, db_session):
    _, headers = auth_user
    group = Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck", "twist"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=0,
        is_active=False,
    )
    db_session.add(group)
    await db_session.commit()

    response = await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "Should Fail",
            "description": "Not a member.",
            "items": [],
        },
        headers=headers,
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_member_can_append_theater_list_item(client, auth_user, db_session):
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
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [],
        },
        headers=headers,
    )
    list_id = create_response.json()["id"]

    response = await client.post(
        f"/groups/{group.id}/lists/{list_id}/items",
        json={"tmdb_id": 18, "title_en": "The Master", "match_tags": ["slowburn"]},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 1
    assert payload["items"][0]["title_en"] == "The Master"


@pytest.mark.asyncio
async def test_member_cannot_append_duplicate_theater_list_item(
    client,
    auth_user,
    db_session,
    monkeypatch,
):
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
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [{"tmdb_id": 11, "title_en": "Arrival", "match_tags": ["mindfuck"]}],
        },
        headers=headers,
    )
    list_id = create_response.json()["id"]

    from app.routers import groups as groups_router

    async def fake_prepare_items(_db, items, _existing_items=None):
        return [
            groups_router.TheaterListItemCreate(
                tmdb_id=11,
                title_en="Arrival",
                title_zh="異星入境",
                poster_url="https://image.tmdb.org/t/p/w500/arrival.jpg",
                genres=["Science Fiction"],
                runtime_minutes=116,
                match_tags=[],
                note=None,
            )
        ]

    monkeypatch.setattr(groups_router, "_prepare_theater_list_items", fake_prepare_items)

    response = await client.post(
        f"/groups/{group.id}/lists/{list_id}/items",
        json={"tmdb_id": 0, "title_en": "Arrival"},
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Movie already exists in this list"


@pytest.mark.asyncio
async def test_member_can_delete_theater_list_item(client, auth_user, db_session):
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
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [{"tmdb_id": 11, "title_en": "Arrival", "match_tags": ["mindfuck"]}],
        },
        headers=headers,
    )
    payload = create_response.json()
    list_id = payload["id"]
    item_id = payload["items"][0]["id"]

    response = await client.delete(
        f"/groups/{group.id}/lists/{list_id}/items/{item_id}",
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == []


@pytest.mark.asyncio
async def test_member_cannot_delete_other_members_list_item(client, auth_user, db_session):
    user, headers = auth_user
    other_user = User(
        email="other-item-owner@test.com",
        name="Other Item Owner",
        gender="other",
        region="TW",
        sequencing_status=SequencingStatus.completed,
    )
    group = Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck", "twist"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=2,
        is_active=True,
    )
    db_session.add_all([other_user, group])
    await db_session.commit()
    await db_session.refresh(other_user)
    await db_session.execute(group_members.insert().values(user_id=user.id, group_id=group.id))
    await db_session.execute(
        group_members.insert().values(user_id=other_user.id, group_id=group.id)
    )
    await db_session.commit()

    other_headers = {
        "Authorization": f"Bearer {create_access_token(other_user.id, other_user.auth_version)}",
    }
    create_response = await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [{"tmdb_id": 11, "title_en": "Arrival", "match_tags": ["mindfuck"]}],
        },
        headers=other_headers,
    )
    payload = create_response.json()
    list_id = payload["id"]
    item_id = payload["items"][0]["id"]

    response = await client.delete(
        f"/groups/{group.id}/lists/{list_id}/items/{item_id}",
        headers=headers,
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_member_can_reorder_theater_list_items(client, auth_user, db_session):
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
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [
                {"tmdb_id": 11, "title_en": "Arrival", "match_tags": ["mindfuck"]},
                {"tmdb_id": 12, "title_en": "Burning", "match_tags": ["twist"]},
            ],
        },
        headers=headers,
    )
    payload = create_response.json()
    list_id = payload["id"]
    first_item_id = payload["items"][0]["id"]
    second_item_id = payload["items"][1]["id"]

    response = await client.patch(
        f"/groups/{group.id}/lists/{list_id}/items/reorder",
        json={"item_ids": [second_item_id, first_item_id]},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["title_en"] == "Burning"
    assert payload["items"][0]["position"] == 0
    assert payload["items"][1]["title_en"] == "Arrival"
    assert payload["items"][1]["position"] == 1


@pytest.mark.asyncio
async def test_member_can_update_theater_list_item_note(client, auth_user, db_session):
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
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [{"tmdb_id": 11, "title_en": "Arrival", "match_tags": ["mindfuck"]}],
        },
        headers=headers,
    )
    payload = create_response.json()
    list_id = payload["id"]
    item_id = payload["items"][0]["id"]

    response = await client.patch(
        f"/groups/{group.id}/lists/{list_id}/items/{item_id}",
        json={"note": "Use this as the entry point."},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["note"] == "Use this as the entry point."


@pytest.mark.asyncio
async def test_theater_list_visibility_is_group_only(client, auth_user, db_session):
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

    response = await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "Should Fail",
            "description": "Visibility is not configurable yet.",
            "visibility": "private",
            "items": [],
        },
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_member_can_reply_to_theater_list(client, auth_user, db_session):
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
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [],
        },
        headers=headers,
    )
    list_id = create_response.json()["id"]

    response = await client.post(
        f"/groups/{group.id}/lists/{list_id}/replies",
        json={"body": "Burning should sit next to Arrival."},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["replies"]) == 1
    assert payload["replies"][0]["body"] == "Burning should sit next to Arrival."
    assert payload["replies"][0]["user"]["name"] == "Group User"
    assert payload["replies"][0]["can_delete"] is True


@pytest.mark.asyncio
async def test_member_can_delete_own_theater_list_reply(client, auth_user, db_session):
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
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [],
        },
        headers=headers,
    )
    payload = create_response.json()
    list_id = payload["id"]

    reply_response = await client.post(
        f"/groups/{group.id}/lists/{list_id}/replies",
        json={"body": "Start with Burning."},
        headers=headers,
    )
    reply_id = reply_response.json()["replies"][0]["id"]

    response = await client.delete(
        f"/groups/{group.id}/lists/{list_id}/replies/{reply_id}",
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["replies"] == []


@pytest.mark.asyncio
async def test_auto_assign_creates_theater_assignment_notification(client, auth_user, db_session):
    user, headers = auth_user
    profile = DnaProfile(
        user_id=user.id,
        archetype_id="time_traveler",
        tag_vector=[0.8] * TAG_VECTOR_DIMENSIONS,
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
        member_count=0,
        is_active=False,
    )
    db_session.add_all([profile, group])
    await db_session.commit()

    response = await client.post("/groups/auto-assign", headers=headers)

    assert response.status_code == 200
    notification_result = await db_session.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifications = list(notification_result.scalars().all())
    assert len(notifications) == 1
    assert notifications[0].type.value == "theater_assigned"
    assert notifications[0].link == "/theaters/detail?id=mobius_loop"


@pytest.mark.asyncio
async def test_auto_assign_preserves_existing_memberships(client, auth_user, db_session):
    user, headers = auth_user
    profile = DnaProfile(
        user_id=user.id,
        archetype_id="time_traveler",
        tag_vector=[0.8] * TAG_VECTOR_DIMENSIONS,
        genre_vector={},
        quadrant_scores={},
        ticket_style="classic",
        version=1,
        is_active=True,
    )
    existing_group = Group(
        id="afterhours",
        name="Afterhours",
        subtitle="Nocturnal melancholia",
        icon="ri-moon-clear-line",
        primary_tags=["slowburn"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=1,
        is_active=True,
    )
    matched_group = Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck", "twist"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=0,
        is_active=False,
    )
    db_session.add_all([profile, existing_group, matched_group])
    await db_session.commit()
    await db_session.execute(
        group_members.insert().values(user_id=user.id, group_id=existing_group.id)
    )
    await db_session.commit()

    response = await client.post("/groups/auto-assign", headers=headers)

    assert response.status_code == 200
    membership_result = await db_session.execute(
        select(group_members.c.group_id).where(group_members.c.user_id == user.id)
    )
    group_ids = {group_id for (group_id,) in membership_result.all()}
    assert "afterhours" in group_ids
    assert "mobius_loop" in group_ids


@pytest.mark.asyncio
async def test_auto_assign_recovers_from_notification_db_failure(
    client, auth_user, db_session, monkeypatch
):
    user, headers = auth_user
    profile = DnaProfile(
        user_id=user.id,
        archetype_id="time_traveler",
        tag_vector=[0.8] * TAG_VECTOR_DIMENSIONS,
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
        member_count=0,
        is_active=False,
    )
    db_session.add_all([profile, group])
    await db_session.commit()

    async def failing_notifier(db, user_id, *, theater_name, theater_id):
        await db.execute(text("SELECT * FROM notifications_table_that_does_not_exist"))

    monkeypatch.setattr("app.routers.groups.notify_theater_assigned", failing_notifier)

    response = await client.post("/groups/auto-assign", headers=headers)

    assert response.status_code == 200
    membership_result = await db_session.execute(
        select(group_members.c.group_id).where(group_members.c.user_id == user.id)
    )
    group_ids = {group_id for (group_id,) in membership_result.all()}
    assert "mobius_loop" in group_ids


@pytest.mark.asyncio
async def test_creating_theater_list_notifies_other_group_members(client, auth_user, db_session):
    user, headers = auth_user
    other_user = User(
        email="other-member@test.com",
        name="Other Member",
        gender="other",
        region="TW",
        sequencing_status=SequencingStatus.completed,
    )
    group = Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck", "twist"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=2,
        is_active=True,
    )
    db_session.add_all([other_user, group])
    await db_session.commit()
    await db_session.refresh(other_user)
    await db_session.execute(group_members.insert().values(user_id=user.id, group_id=group.id))
    await db_session.execute(
        group_members.insert().values(user_id=other_user.id, group_id=group.id)
    )
    await db_session.commit()

    response = await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [],
        },
        headers=headers,
    )

    assert response.status_code == 200
    notification_result = await db_session.execute(
        select(Notification).where(Notification.user_id == other_user.id)
    )
    notifications = list(notification_result.scalars().all())
    assert len(notifications) == 1
    assert notifications[0].type.value == "theater_activity"
    assert "Late-Night Brain Melt" in (notifications[0].body_en or "")


@pytest.mark.asyncio
async def test_replying_to_theater_list_notifies_other_group_members(client, auth_user, db_session):
    user, headers = auth_user
    other_user = User(
        email="other-reply@test.com",
        name="Other Reply",
        gender="other",
        region="TW",
        sequencing_status=SequencingStatus.completed,
    )
    group = Group(
        id="mobius_loop",
        name="Mobius Loop",
        subtitle="Mind-benders only",
        icon="ri-tornado-line",
        primary_tags=["mindfuck", "twist"],
        is_hidden=False,
        min_members_to_activate=1,
        member_count=2,
        is_active=True,
    )
    db_session.add_all([other_user, group])
    await db_session.commit()
    await db_session.refresh(other_user)
    await db_session.execute(group_members.insert().values(user_id=user.id, group_id=group.id))
    await db_session.execute(
        group_members.insert().values(user_id=other_user.id, group_id=group.id)
    )
    await db_session.commit()

    create_response = await client.post(
        f"/groups/{group.id}/lists",
        json={
            "title": "Late-Night Brain Melt",
            "description": "Built for spiral conversations after midnight.",
            "items": [],
        },
        headers=headers,
    )
    list_id = create_response.json()["id"]

    notification_result = await db_session.execute(
        select(Notification).where(Notification.user_id == other_user.id)
    )
    initial_notifications = list(notification_result.scalars().all())
    assert len(initial_notifications) == 1

    response = await client.post(
        f"/groups/{group.id}/lists/{list_id}/replies",
        json={"body": "Burning should follow Arrival."},
        headers=headers,
    )

    assert response.status_code == 200
    notification_result = await db_session.execute(
        select(Notification)
        .where(Notification.user_id == other_user.id)
        .order_by(Notification.created_at.asc())
    )
    notifications = list(notification_result.scalars().all())
    assert len(notifications) == 2
    assert notifications[-1].type.value == "theater_activity"
    assert "Burning" not in (notifications[-1].body_en or "")
    assert "Late-Night Brain Melt" in (notifications[-1].body_en or "")
