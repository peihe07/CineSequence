import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class MatchStatus(enum.StrEnum):
    discovered = "discovered"
    invited = "invited"
    accepted = "accepted"
    declined = "declined"


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_match_pair"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    candidate_percentile: Mapped[int | None] = mapped_column(Integer)
    candidate_pool_size: Mapped[int | None] = mapped_column(Integer)

    # Match details
    shared_tags: Mapped[list] = mapped_column(JSON, default=list)
    shared_movies: Mapped[list] = mapped_column(JSON, default=list)
    ice_breakers: Mapped[list] = mapped_column(JSON, default=list)

    # Status flow: discovered -> invited -> accepted/declined
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus), default=MatchStatus.discovered
    )
    ticket_image_url: Mapped[str | None] = mapped_column(String(500))

    # 使用者各自的星標（最愛釘選）
    starred_by_a: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    starred_by_b: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Timestamps
    invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    invite_reminder_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_invite_reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user_a: Mapped["User"] = relationship(foreign_keys=[user_a_id], lazy="selectin")
    user_b: Mapped["User"] = relationship(foreign_keys=[user_b_id], lazy="selectin")
