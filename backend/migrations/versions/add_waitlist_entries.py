"""Add waitlist entries table.

Revision ID: add_waitlist_entries
Revises: add_notification_enum_values
Create Date: 2026-03-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "add_waitlist_entries"
down_revision: str | None = "add_notification_enum_values"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "waitlist_entries",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="landing"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_waitlist_entries_email"), "waitlist_entries", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_waitlist_entries_email"), table_name="waitlist_entries")
    op.drop_table("waitlist_entries")
