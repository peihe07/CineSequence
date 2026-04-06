import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Gender(enum.StrEnum):
    male = "male"
    female = "female"
    other = "other"
    prefer_not_to_say = "prefer_not_to_say"


class GenderPref(enum.StrEnum):
    male = "male"
    female = "female"
    other = "other"
    any = "any"


class SequencingStatus(enum.StrEnum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    bio: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    gender: Mapped[Gender] = mapped_column(Enum(Gender), nullable=False)
    birth_year: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str] = mapped_column(String(50), default="TW")

    # Matching preferences
    match_gender_pref: Mapped[GenderPref | None] = mapped_column(Enum(GenderPref))
    match_age_min: Mapped[int | None] = mapped_column(Integer)
    match_age_max: Mapped[int | None] = mapped_column(Integer)
    pure_taste_match: Mapped[bool] = mapped_column(Boolean, default=False)
    match_threshold: Mapped[float] = mapped_column(
        Float, default=0.85, server_default="0.85", nullable=False
    )
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    email_notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )

    # Sequencing state
    sequencing_status: Mapped[SequencingStatus] = mapped_column(
        Enum(SequencingStatus), default=SequencingStatus.not_started
    )
    seed_movie_tmdb_id: Mapped[int | None] = mapped_column(Integer)
    active_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sequencing_sessions.id", use_alter=True), nullable=True
    )
    free_retest_credits: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    paid_sequencing_credits: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    beta_entitlement_override: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    invite_unlocked: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )

    # Admin
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    # Consent
    agreed_to_terms_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Auth
    auth_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    magic_link_token: Mapped[str | None] = mapped_column(String(500))
    magic_link_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    picks: Mapped[list["Pick"]] = relationship(back_populates="user", lazy="selectin")
    dna_profiles: Mapped[list["DnaProfile"]] = relationship(
        back_populates="user", lazy="selectin"
    )
    sessions: Mapped[list["SequencingSession"]] = relationship(
        back_populates="user", lazy="selectin",
        foreign_keys="SequencingSession.user_id",
    )
    active_session: Mapped["SequencingSession | None"] = relationship(
        foreign_keys=[active_session_id], lazy="selectin", uselist=False,
    )
    favorite_movies: Mapped[list["UserFavoriteMovie"]] = relationship(
        back_populates="user", lazy="selectin",
        order_by="UserFavoriteMovie.display_order",
    )
    sequencing_entitlements: Mapped[list["SequencingEntitlement"]] = relationship(
        back_populates="user", lazy="selectin", order_by="SequencingEntitlement.created_at"
    )

    @property
    def dna_profile(self) -> "DnaProfile | None":
        """Get the currently active DNA profile."""
        for p in self.dna_profiles:
            if p.is_active:
                return p
        return None
