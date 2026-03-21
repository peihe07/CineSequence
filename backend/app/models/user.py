import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"
    prefer_not_to_say = "prefer_not_to_say"


class GenderPref(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"
    any = "any"


class SequencingStatus(str, enum.Enum):
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
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    gender: Mapped[Gender] = mapped_column(Enum(Gender), nullable=False)
    birth_year: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str] = mapped_column(String(50), default="TW")

    # Matching preferences
    match_gender_pref: Mapped[GenderPref | None] = mapped_column(Enum(GenderPref))
    match_age_min: Mapped[int | None] = mapped_column(Integer)
    match_age_max: Mapped[int | None] = mapped_column(Integer)
    pure_taste_match: Mapped[bool] = mapped_column(Boolean, default=False)

    # Sequencing state
    sequencing_status: Mapped[SequencingStatus] = mapped_column(
        Enum(SequencingStatus), default=SequencingStatus.not_started
    )
    seed_movie_tmdb_id: Mapped[int | None] = mapped_column(Integer)

    # Auth
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
    dna_profile: Mapped["DnaProfile | None"] = relationship(
        back_populates="user", lazy="selectin", uselist=False
    )
