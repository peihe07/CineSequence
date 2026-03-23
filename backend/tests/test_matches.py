"""Integration tests for match flow and visibility rules."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dna_profile import DnaProfile, TAG_VECTOR_DIMENSIONS
from app.models.match import Match, MatchStatus
from app.models.user import Gender, GenderPref, SequencingStatus, User
from app.services.auth_utils import create_access_token
from app.services.matcher import find_matches


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.auth_version)
    return {"Authorization": f"Bearer {token}"}


async def create_user_with_dna(
    db: AsyncSession,
    *,
    email: str,
    name: str,
    gender: Gender,
    birth_year: int | None,
    match_gender_pref: GenderPref | None = None,
    match_age_min: int | None = None,
    match_age_max: int | None = None,
    pure_taste_match: bool = False,
    vector_value: float = 0.9,
) -> User:
    user = User(
        email=email,
        name=name,
        gender=gender,
        birth_year=birth_year,
        region="TW",
        sequencing_status=SequencingStatus.completed,
        match_gender_pref=match_gender_pref,
        match_age_min=match_age_min,
        match_age_max=match_age_max,
        pure_taste_match=pure_taste_match,
    )
    profile = DnaProfile(
        user=user,
        archetype_id="time-traveler",
        tag_vector=[vector_value] * TAG_VECTOR_DIMENSIONS,
        genre_vector={"drama": 0.8},
        quadrant_scores={},
        ticket_style="classic",
        is_active=True,
    )
    db.add_all([user, profile])
    await db.commit()

    result = await db.execute(
        select(User)
        .options(selectinload(User.dna_profiles))
        .where(User.id == user.id)
    )
    return result.scalar_one()


async def create_match(
    db: AsyncSession,
    *,
    user_a: User,
    user_b: User,
    status: MatchStatus = MatchStatus.discovered,
) -> Match:
    match = Match(
        user_a_id=user_a.id,
        user_b_id=user_b.id,
        similarity_score=0.91,
        shared_tags=["noir"],
        shared_movies=[],
        ice_breakers=["Talk about endings"],
        status=status,
    )
    db.add(match)
    await db.commit()
    await db.refresh(match)
    return match


@pytest.mark.asyncio
class TestMatchVisibility:
    async def test_discovered_match_hidden_from_recipient(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter", gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient", gender=Gender.male, birth_year=1992
        )
        await create_match(db_session, user_a=inviter, user_b=recipient, status=MatchStatus.discovered)

        inviter_response = await client.get("/matches", headers=auth_headers(inviter))
        recipient_response = await client.get("/matches", headers=auth_headers(recipient))

        assert inviter_response.status_code == 200
        assert len(inviter_response.json()) == 1
        assert recipient_response.status_code == 200
        assert recipient_response.json() == []


@pytest.mark.asyncio
class TestInviteRespondPermissions:
    async def test_only_initiator_can_send_invite(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter", gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient", gender=Gender.male, birth_year=1992
        )
        match = await create_match(db_session, user_a=inviter, user_b=recipient, status=MatchStatus.discovered)

        response = await client.post(
            "/matches/invite",
            json={"match_id": str(match.id)},
            headers=auth_headers(recipient),
        )

        assert response.status_code == 403
        assert "Only the match initiator can send the invite" in response.json()["detail"]

    async def test_only_recipient_can_respond_to_invite(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter", gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient", gender=Gender.male, birth_year=1992
        )
        match = await create_match(db_session, user_a=inviter, user_b=recipient, status=MatchStatus.invited)

        response = await client.post(
            "/matches/respond",
            json={"match_id": str(match.id), "accept": True},
            headers=auth_headers(inviter),
        )

        assert response.status_code == 403
        assert "Only the invited recipient can respond" in response.json()["detail"]

    async def test_recipient_can_accept_invite(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter", gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient", gender=Gender.male, birth_year=1992
        )
        match = await create_match(db_session, user_a=inviter, user_b=recipient, status=MatchStatus.invited)

        with (
            patch("app.services.matcher.generate_and_upload_ticket", new=AsyncMock(return_value="https://ticket.test/1.png")),
            patch("app.services.matcher.send_match_accepted_email", new=AsyncMock()),
        ):
            response = await client.post(
                "/matches/respond",
                json={"match_id": str(match.id), "accept": True},
                headers=auth_headers(recipient),
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "accepted"
        assert data["ticket_image_url"] == "https://ticket.test/1.png"


@pytest.mark.asyncio
class TestReciprocalPreferences:
    async def test_find_matches_respects_candidate_preferences(self, db_session: AsyncSession):
        seeker = await create_user_with_dna(
            db_session,
            email="seeker@test.com",
            name="Seeker",
            gender=Gender.male,
            birth_year=1995,
        )
        await create_user_with_dna(
            db_session,
            email="candidate@test.com",
            name="Candidate",
            gender=Gender.female,
            birth_year=1994,
            match_gender_pref=GenderPref.female,
        )

        matches = await find_matches(db_session, seeker)

        assert matches == []
