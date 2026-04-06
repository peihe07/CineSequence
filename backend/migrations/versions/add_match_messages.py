"""Add match_messages table for async message board.

Revision ID: add_match_messages
Revises: add_payments_entitlements
Create Date: 2026-04-06
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "add_match_messages"
down_revision: str | None = "add_payments_entitlements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "match_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("match_id", UUID(as_uuid=True), sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_match_messages_match_created",
        "match_messages",
        ["match_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_match_messages_match_created", table_name="match_messages")
    op.drop_table("match_messages")
