"""Tests for notification system."""

import uuid

import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType
from app.models.user import Gender, User
from app.services.notification_service import (
    create_notification,
    get_notifications,
    get_unread_count,
    mark_all_as_read,
    mark_as_read,
    notify_dna_ready,
    notify_invite_received,
    notify_match_accepted,
    notify_match_found,
)


@pytest_asyncio.fixture
async def user_id(db_session: AsyncSession) -> uuid.UUID:
    """Create a test user and return their ID."""
    user = User(
        email="test@example.com",
        name="Test User",
        gender=Gender.other,
        region="TW",
    )
    db_session.add(user)
    await db_session.commit()
    return user.id


@pytest_asyncio.fixture
async def other_user_id(db_session: AsyncSession) -> uuid.UUID:
    """Create a second test user and return their ID."""
    user = User(
        email="other@example.com",
        name="Other User",
        gender=Gender.other,
        region="TW",
    )
    db_session.add(user)
    await db_session.commit()
    return user.id


class TestCreateNotification:
    async def test_creates_notification_with_all_fields(self, db_session: AsyncSession, user_id):
        n = await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.system,
            title_zh="測試標題",
            title_en="Test title",
            body_zh="測試內容",
            body_en="Test body",
            link="/test",
            ref_id="ref-123",
        )

        assert n.id is not None
        assert n.user_id == user_id
        assert n.type == NotificationType.system
        assert n.title_zh == "測試標題"
        assert n.title_en == "Test title"
        assert n.body_zh == "測試內容"
        assert n.body_en == "Test body"
        assert n.link == "/test"
        assert n.ref_id == "ref-123"
        assert n.is_read is False
        assert n.created_at is not None

    async def test_creates_notification_without_optional_fields(
        self, db_session: AsyncSession, user_id
    ):
        n = await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.dna_ready,
            title_zh="DNA 完成",
            title_en="DNA ready",
        )

        assert n.body_zh is None
        assert n.body_en is None
        assert n.link is None
        assert n.ref_id is None


class TestGetNotifications:
    async def test_returns_newest_first(self, db_session: AsyncSession, user_id):
        for i in range(3):
            await create_notification(
                db_session,
                user_id=user_id,
                type=NotificationType.system,
                title_zh=f"通知 {i}",
                title_en=f"Notification {i}",
            )

        result = await get_notifications(db_session, user_id)
        assert len(result) == 3
        assert result[0].title_en == "Notification 2"
        assert result[2].title_en == "Notification 0"

    async def test_respects_limit(self, db_session: AsyncSession, user_id):
        for i in range(5):
            await create_notification(
                db_session,
                user_id=user_id,
                type=NotificationType.system,
                title_zh=f"通知 {i}",
                title_en=f"Notification {i}",
            )

        result = await get_notifications(db_session, user_id, limit=2)
        assert len(result) == 2

    async def test_unread_only(self, db_session: AsyncSession, user_id):
        n1 = await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.system,
            title_zh="已讀",
            title_en="Read",
        )
        await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.system,
            title_zh="未讀",
            title_en="Unread",
        )
        await mark_as_read(db_session, n1.id, user_id)

        result = await get_notifications(db_session, user_id, unread_only=True)
        assert len(result) == 1
        assert result[0].title_en == "Unread"

    async def test_only_returns_own_notifications(
        self, db_session: AsyncSession, user_id, other_user_id
    ):
        await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.system,
            title_zh="我的",
            title_en="Mine",
        )
        await create_notification(
            db_session,
            user_id=other_user_id,
            type=NotificationType.system,
            title_zh="別人的",
            title_en="Others",
        )

        result = await get_notifications(db_session, user_id)
        assert len(result) == 1
        assert result[0].title_en == "Mine"


class TestUnreadCount:
    async def test_counts_unread(self, db_session: AsyncSession, user_id):
        for _ in range(3):
            await create_notification(
                db_session,
                user_id=user_id,
                type=NotificationType.system,
                title_zh="未讀",
                title_en="Unread",
            )

        count = await get_unread_count(db_session, user_id)
        assert count == 3

    async def test_excludes_read(self, db_session: AsyncSession, user_id):
        n = await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.system,
            title_zh="已讀",
            title_en="Read",
        )
        await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.system,
            title_zh="未讀",
            title_en="Unread",
        )
        await mark_as_read(db_session, n.id, user_id)

        count = await get_unread_count(db_session, user_id)
        assert count == 1


class TestMarkAsRead:
    async def test_marks_single_as_read(self, db_session: AsyncSession, user_id):
        n = await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.system,
            title_zh="未讀",
            title_en="Unread",
        )

        updated = await mark_as_read(db_session, n.id, user_id)
        assert updated is True

        result = await db_session.execute(select(Notification).where(Notification.id == n.id))
        refreshed = result.scalar_one()
        assert refreshed.is_read is True

    async def test_returns_false_for_wrong_user(
        self, db_session: AsyncSession, user_id, other_user_id
    ):
        n = await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.system,
            title_zh="未讀",
            title_en="Unread",
        )

        updated = await mark_as_read(db_session, n.id, other_user_id)
        assert updated is False

    async def test_returns_false_for_nonexistent(self, db_session: AsyncSession, user_id):
        updated = await mark_as_read(db_session, uuid.uuid4(), user_id)
        assert updated is False


class TestMarkAllAsRead:
    async def test_marks_all_unread(self, db_session: AsyncSession, user_id):
        for _ in range(3):
            await create_notification(
                db_session,
                user_id=user_id,
                type=NotificationType.system,
                title_zh="未讀",
                title_en="Unread",
            )

        count = await mark_all_as_read(db_session, user_id)
        assert count == 3
        assert await get_unread_count(db_session, user_id) == 0

    async def test_does_not_affect_other_users(
        self, db_session: AsyncSession, user_id, other_user_id
    ):
        await create_notification(
            db_session,
            user_id=user_id,
            type=NotificationType.system,
            title_zh="我的",
            title_en="Mine",
        )
        await create_notification(
            db_session,
            user_id=other_user_id,
            type=NotificationType.system,
            title_zh="別人的",
            title_en="Others",
        )

        await mark_all_as_read(db_session, user_id)
        assert await get_unread_count(db_session, other_user_id) == 1


class TestConvenienceCreators:
    async def test_notify_dna_ready(self, db_session: AsyncSession, user_id):
        await notify_dna_ready(db_session, user_id, "explorer")
        notifications = await get_notifications(db_session, user_id)
        assert len(notifications) == 1
        assert notifications[0].type == NotificationType.dna_ready
        assert notifications[0].link == "/dna"
        assert notifications[0].ref_id == "explorer"

    async def test_notify_match_found(self, db_session: AsyncSession, user_id):
        match_id = uuid.uuid4()
        await notify_match_found(db_session, user_id, "Alice", match_id)
        notifications = await get_notifications(db_session, user_id)
        assert len(notifications) == 1
        assert notifications[0].type == NotificationType.match_found
        assert "Alice" in notifications[0].body_en
        assert "Alice" in notifications[0].body_zh

    async def test_notify_invite_received(self, db_session: AsyncSession, user_id):
        match_id = uuid.uuid4()
        await notify_invite_received(db_session, user_id, "Bob", match_id)
        notifications = await get_notifications(db_session, user_id)
        assert len(notifications) == 1
        assert notifications[0].type == NotificationType.invite_received
        assert "Bob" in notifications[0].body_en

    async def test_notify_match_accepted(self, db_session: AsyncSession, user_id):
        match_id = uuid.uuid4()
        await notify_match_accepted(db_session, user_id, "Carol", match_id)
        notifications = await get_notifications(db_session, user_id)
        assert len(notifications) == 1
        assert notifications[0].type == NotificationType.match_accepted
        assert f"/ticket?inviteId={match_id}" in notifications[0].link
