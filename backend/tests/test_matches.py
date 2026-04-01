"""Integration tests for match flow and visibility rules."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dna_profile import TAG_VECTOR_DIMENSIONS, DnaProfile
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
    candidate_percentile: int | None = 91,
    candidate_pool_size: int | None = 37,
) -> Match:
    match = Match(
        user_a_id=user_a.id,
        user_b_id=user_b.id,
        similarity_score=0.91,
        candidate_percentile=candidate_percentile,
        candidate_pool_size=candidate_pool_size,
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
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        await create_match(
            db_session, user_a=inviter, user_b=recipient,
            status=MatchStatus.discovered,
        )

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
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        match = await create_match(
            db_session, user_a=inviter, user_b=recipient,
            status=MatchStatus.discovered,
        )

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
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        match = await create_match(
            db_session, user_a=inviter, user_b=recipient,
            status=MatchStatus.invited,
        )

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
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        match = await create_match(
            db_session, user_a=inviter, user_b=recipient,
            status=MatchStatus.invited,
        )

        inviter.dna_profile.personal_ticket_url = "https://ticket.test/inviter.png"
        await db_session.commit()

        with (
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
        assert data["ticket_image_url"] == "https://ticket.test/inviter.png"
        assert data["partner_email"] == "inviter@test.com"
        assert data["candidate_percentile"] == 91
        assert data["candidate_pool_size"] == 37

    async def test_matches_response_falls_back_to_legacy_ticket_url_without_personal_ticket(
        self, client: AsyncClient, db_session: AsyncSession, monkeypatch
    ):
        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        match = await create_match(
            db_session, user_a=inviter, user_b=recipient,
            status=MatchStatus.accepted,
        )
        match.ticket_image_url = (
            "https://pub-e41ee8d058234933a2c34e1300b7e2be.r2.dev/"
            "cinesequence/tickets/fallback.png"
        )
        await db_session.commit()

        monkeypatch.setattr(
            "app.config.settings.s3_public_url",
            "https://assets.cinesequence.xyz",
        )

        response = await client.get(f"/matches/{match.id}", headers=auth_headers(inviter))

        assert response.status_code == 200
        data = response.json()
        assert data["ticket_image_url"] == "https://assets.cinesequence.xyz/tickets/fallback.png"

    async def test_matches_response_rewrites_legacy_ticket_url(
        self, client: AsyncClient, db_session: AsyncSession, monkeypatch
    ):
        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        match = await create_match(
            db_session, user_a=inviter, user_b=recipient,
            status=MatchStatus.accepted,
        )
        match.ticket_image_url = (
            "https://pub-e41ee8d058234933a2c34e1300b7e2be.r2.dev/"
            "cinesequence/tickets/legacy.png"
        )
        await db_session.commit()

        monkeypatch.setattr(
            "app.config.settings.s3_public_url",
            "https://assets.cinesequence.xyz",
        )

        response = await client.get("/matches", headers=auth_headers(inviter))

        assert response.status_code == 200
        data = response.json()
        assert data[0]["ticket_image_url"] == "https://assets.cinesequence.xyz/tickets/legacy.png"

    async def test_matches_response_lazily_generates_missing_personal_ticket(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        match = await create_match(
            db_session, user_a=inviter, user_b=recipient,
            status=MatchStatus.accepted,
        )

        recipient.dna_profile.personal_ticket_url = None
        await db_session.commit()

        with patch(
            "app.routers.profile._generate_personal_ticket_url",
            new=AsyncMock(return_value="https://ticket.test/generated.png"),
        ):
            response = await client.get(f"/matches/{match.id}", headers=auth_headers(inviter))

        assert response.status_code == 200
        data = response.json()
        assert data["ticket_image_url"] == "https://ticket.test/generated.png"
        assert data["partner_email"] == "recipient@test.com"

        await db_session.refresh(recipient.dna_profile)
        assert recipient.dna_profile.personal_ticket_url == "https://ticket.test/generated.png"

    async def test_invite_sets_reminder_tracking_fields(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        match = await create_match(
            db_session, user_a=inviter, user_b=recipient,
            status=MatchStatus.discovered,
        )

        with patch("app.services.matcher.send_invite_email", new=AsyncMock()):
            response = await client.post(
                "/matches/invite",
                json={"match_id": str(match.id)},
                headers=auth_headers(inviter),
            )

        assert response.status_code == 200

        refreshed = await db_session.get(Match, match.id)
        assert refreshed is not None
        assert refreshed.status == MatchStatus.invited
        assert refreshed.invited_at is not None
        assert refreshed.invite_reminder_count == 0
        assert refreshed.last_invite_reminder_at is None


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


@pytest.mark.asyncio
class TestInviteReminders:
    async def test_get_pending_invite_reminders_returns_only_due_matches(
        self, db_session: AsyncSession
    ):
        from app.services.matcher import get_pending_invite_reminders

        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        other = await create_user_with_dna(
            db_session, email="other@test.com", name="Other",
            gender=Gender.other, birth_year=1990
        )

        now = datetime.now(UTC)
        due_once = await create_match(
            db_session, user_a=inviter, user_b=recipient, status=MatchStatus.invited
        )
        due_once.invited_at = now - timedelta(days=7, hours=1)
        due_once.invite_reminder_count = 0

        too_early = await create_match(
            db_session, user_a=inviter, user_b=other, status=MatchStatus.invited
        )
        too_early.invited_at = now - timedelta(days=3, hours=1)
        too_early.invite_reminder_count = 0

        maxed_out = await create_match(
            db_session, user_a=other, user_b=inviter, status=MatchStatus.invited
        )
        maxed_out.invited_at = now - timedelta(days=9)
        maxed_out.invite_reminder_count = 2
        maxed_out.last_invite_reminder_at = now - timedelta(days=2)

        responded = await create_match(
            db_session, user_a=other, user_b=recipient, status=MatchStatus.accepted
        )
        responded.invited_at = now - timedelta(days=8)
        responded.responded_at = now - timedelta(days=7)
        responded.invite_reminder_count = 0

        await db_session.commit()

        due_matches = await get_pending_invite_reminders(db_session, now=now)
        due_ids = {match.id for match in due_matches}

        assert due_ids == {due_once.id}

    async def test_mark_invite_reminder_sent_updates_tracking(
        self, db_session: AsyncSession
    ):
        from app.services.matcher import mark_invite_reminder_sent

        inviter = await create_user_with_dna(
            db_session, email="inviter@test.com", name="Inviter",
            gender=Gender.female, birth_year=1994
        )
        recipient = await create_user_with_dna(
            db_session, email="recipient@test.com", name="Recipient",
            gender=Gender.male, birth_year=1992
        )
        match = await create_match(
            db_session, user_a=inviter, user_b=recipient, status=MatchStatus.invited
        )

        now = datetime.now(UTC)
        updated = await mark_invite_reminder_sent(db_session, match, sent_at=now)

        assert updated.invite_reminder_count == 1
        assert updated.last_invite_reminder_at == now
