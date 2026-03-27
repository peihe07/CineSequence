"""Add theater notification enum values.

Revision ID: add_notification_enum_values
Revises: add_theater_list_item_metadata
Create Date: 2026-03-28
"""

from alembic import op

revision = "add_notification_enum_values"
down_revision = "add_theater_list_item_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TYPE notificationtype
        ADD VALUE IF NOT EXISTS 'theater_assigned'
        """
    )
    op.execute(
        """
        ALTER TYPE notificationtype
        ADD VALUE IF NOT EXISTS 'theater_activity'
        """
    )


def downgrade() -> None:
    # PostgreSQL enums cannot easily drop individual values in-place.
    pass
