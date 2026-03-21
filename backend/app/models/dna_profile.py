import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

# 30 tags in tag_taxonomy.json
TAG_VECTOR_DIMENSIONS = 30


class DnaProfile(Base):
    __tablename__ = "dna_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sequencing_sessions.id", ondelete="CASCADE"),
        unique=True, index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Core DNA data
    archetype_id: Mapped[str] = mapped_column(String(50), nullable=False)
    tag_vector = mapped_column(Vector(TAG_VECTOR_DIMENSIONS), nullable=False)
    genre_vector: Mapped[dict] = mapped_column(JSON, default=dict)
    quadrant_scores: Mapped[dict] = mapped_column(JSON, default=dict)

    # AI-generated personality
    personality_reading: Mapped[str | None] = mapped_column(Text)
    hidden_traits: Mapped[list] = mapped_column(JSON, default=list)
    conversation_style: Mapped[str | None] = mapped_column(Text)
    ideal_movie_date: Mapped[str | None] = mapped_column(Text)

    # Visual
    ticket_style: Mapped[str] = mapped_column(String(20), nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="dna_profiles")
    session: Mapped["SequencingSession | None"] = relationship(back_populates="dna_profile")
