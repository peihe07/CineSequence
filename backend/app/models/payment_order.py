import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class ProductType(enum.StrEnum):
    extension = "extension"
    retest = "retest"
    bundle = "bundle"
    invite_unlock = "invite_unlock"
    share_card = "share_card"


class OrderStatus(enum.StrEnum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    order_no: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=False
    )
    product_type: Mapped[ProductType] = mapped_column(
        Enum(ProductType), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.pending, nullable=False
    )
    refund_amount: Mapped[int | None] = mapped_column(Integer)
    ecpay_trade_no: Mapped[str | None] = mapped_column(String(20))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(lazy="selectin")
    entitlements: Mapped[list["UserEntitlement"]] = relationship(
        back_populates="order", lazy="selectin"
    )
