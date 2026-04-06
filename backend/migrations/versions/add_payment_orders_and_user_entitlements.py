"""Add payment_orders and user_entitlements tables, and invite_unlocked to users.

Revision ID: add_payments_entitlements
Revises: add_seen_one_side_decision_type
Create Date: 2026-04-06
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "add_payments_entitlements"
down_revision: str | None = "add_seen_one_side_decision_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create enum types
    product_type_enum = sa.Enum(
        "extension", "retest", "bundle", "invite_unlock", "share_card",
        name="producttype",
    )
    order_status_enum = sa.Enum(
        "pending", "paid", "failed", "refunded",
        name="orderstatus",
    )
    entitlement_type_enum = sa.Enum(
        "extension", "retest", "invite",
        name="entitlementtype",
    )
    entitlement_status_enum = sa.Enum(
        "available", "consumed", "revoked",
        name="entitlementstatus",
    )

    op.create_table(
        "payment_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("order_no", sa.String(20), unique=True, index=True, nullable=False),
        sa.Column("product_type", product_type_enum, nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("status", order_status_enum, nullable=False, server_default="pending"),
        sa.Column("refund_amount", sa.Integer, nullable=True),
        sa.Column("ecpay_trade_no", sa.String(20), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "user_entitlements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("payment_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type", entitlement_type_enum, nullable=False),
        sa.Column("status", entitlement_status_enum, nullable=False, server_default="available"),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.add_column(
        "users",
        sa.Column("invite_unlocked", sa.Boolean, nullable=False, server_default="false"),
    )

    # Change free_retest_credits default from 1 to 0
    op.alter_column(
        "users", "free_retest_credits",
        server_default="0",
    )


def downgrade() -> None:
    op.alter_column(
        "users", "free_retest_credits",
        server_default="1",
    )
    op.drop_column("users", "invite_unlocked")
    op.drop_table("user_entitlements")
    op.drop_table("payment_orders")

    op.execute("DROP TYPE IF EXISTS entitlementstatus")
    op.execute("DROP TYPE IF EXISTS entitlementtype")
    op.execute("DROP TYPE IF EXISTS orderstatus")
    op.execute("DROP TYPE IF EXISTS producttype")
