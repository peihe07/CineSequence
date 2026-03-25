"""Add invite reminder tracking fields to matches.

Revision ID: add_invite_reminder_fields
Revises: add_notifications
Create Date: 2026-03-25
"""

import sqlalchemy as sa
from alembic import op


revision = "add_invite_reminder_fields"
down_revision = "add_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("invite_reminder_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "matches",
        sa.Column("last_invite_reminder_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.alter_column("matches", "invite_reminder_count", server_default=None)


def downgrade() -> None:
    op.drop_column("matches", "last_invite_reminder_at")
    op.drop_column("matches", "invite_reminder_count")
