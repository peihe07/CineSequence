import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class PickMode(str, enum.Enum):
    watched = "watched"
    attracted = "attracted"


class Pick(Base):
    __tablename__ = "picks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sequencing_sessions.id", ondelete="CASCADE"), index=True
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    phase: Mapped[int] = mapped_column(Integer, nullable=False)

    # Pair info
    pair_id: Mapped[str | None] = mapped_column(String(20))
    movie_a_tmdb_id: Mapped[int] = mapped_column(Integer, nullable=False)
    movie_b_tmdb_id: Mapped[int] = mapped_column(Integer, nullable=False)
    chosen_tmdb_id: Mapped[int | None] = mapped_column(Integer)
    pick_mode: Mapped[PickMode | None] = mapped_column(Enum(PickMode))

    # AI context (Phase 2-3)
    test_dimension: Mapped[str | None] = mapped_column(String(100))
    response_time_ms: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="picks")
    session: Mapped["SequencingSession | None"] = relationship(back_populates="picks")
