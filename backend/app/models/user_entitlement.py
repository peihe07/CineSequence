import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class EntitlementType(enum.StrEnum):
    extension = "extension"
    retest = "retest"
    invite = "invite"


class EntitlementStatus(enum.StrEnum):
    available = "available"
    consumed = "consumed"
    revoked = "revoked"


class UserEntitlement(Base):
    __tablename__ = "user_entitlements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payment_orders.id", ondelete="SET NULL"),
    )
    type: Mapped[EntitlementType] = mapped_column(
        Enum(EntitlementType), nullable=False
    )
    status: Mapped[EntitlementStatus] = mapped_column(
        Enum(EntitlementStatus), default=EntitlementStatus.available, nullable=False
    )
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    order: Mapped["PaymentOrder | None"] = relationship(
        back_populates="entitlements", lazy="selectin"
    )
