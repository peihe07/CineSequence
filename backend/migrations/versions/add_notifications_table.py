"""Add notifications table.

Revision ID: add_notifications
Revises: add_bio_to_users
Create Date: 2026-03-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "add_notifications"
down_revision = "add_bio_to_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "type",
            sa.Enum("dna_ready", "match_found", "invite_received", "match_accepted", "system", name="notificationtype"),
            nullable=False,
        ),
        sa.Column("title_zh", sa.String(200), nullable=False),
        sa.Column("title_en", sa.String(200), nullable=False),
        sa.Column("body_zh", sa.Text, nullable=True),
        sa.Column("body_en", sa.Text, nullable=True),
        sa.Column("link", sa.String(500), nullable=True),
        sa.Column("ref_id", sa.String(100), nullable=True),
        sa.Column("is_read", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.execute("DROP TYPE IF EXISTS notificationtype")
