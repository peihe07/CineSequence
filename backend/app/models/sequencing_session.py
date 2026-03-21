"""SequencingSession model: wraps each sequencing attempt (initial + retests)."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

BASE_ROUNDS = 20
EXTENSION_BATCH_SIZE = 5
MAX_EXTENSION_BATCHES = 3


class SessionType(str, enum.Enum):
    initial = "initial"
    retest = "retest"


class SessionStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"      # base rounds done, can extend or finalize
    extending = "extending"      # extension batch in progress
    finalized = "finalized"      # no more extensions allowed


class SequencingSession(Base):
    __tablename__ = "sequencing_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    session_type: Mapped[SessionType] = mapped_column(
        Enum(SessionType), default=SessionType.initial
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), default=SessionStatus.in_progress
    )

    # Round tracking
    base_rounds: Mapped[int] = mapped_column(Integer, default=BASE_ROUNDS)
    extension_batches: Mapped[int] = mapped_column(Integer, default=0)
    max_extension_batches: Mapped[int] = mapped_column(Integer, default=MAX_EXTENSION_BATCHES)
    total_rounds: Mapped[int] = mapped_column(Integer, default=BASE_ROUNDS)

    # Seed movie (moved from User)
    seed_movie_tmdb_id: Mapped[int | None] = mapped_column(Integer)

    # Optional label for UI display
    season_label: Mapped[str | None] = mapped_column(String(50))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="sessions", foreign_keys=[user_id])
    picks: Mapped[list["Pick"]] = relationship(back_populates="session", lazy="selectin")
    dna_profile: Mapped["DnaProfile | None"] = relationship(
        back_populates="session", lazy="selectin", uselist=False
    )
