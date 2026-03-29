import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class EntitlementKind(enum.StrEnum):
    free_retest = "free_retest"
    paid_credit = "paid_credit"


class EntitlementSource(enum.StrEnum):
    launch_grant = "launch_grant"
    purchase = "purchase"
    admin = "admin"
    migration = "migration"


class SequencingEntitlement(Base):
    __tablename__ = "sequencing_entitlements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[EntitlementKind] = mapped_column(Enum(EntitlementKind), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    used_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source: Mapped[EntitlementSource] = mapped_column(
        Enum(EntitlementSource), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="sequencing_entitlements", lazy="selectin")
