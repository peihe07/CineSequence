"""Lower group activation thresholds for early-stage theaters.

Revision ID: lower_group_activation_thresholds
Revises: add_theater_list_replies
Create Date: 2026-03-27
"""

from collections.abc import Sequence

from alembic import op

revision: str = "lower_group_activation_thresholds"
down_revision: str | None = "add_theater_list_replies"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE groups ALTER COLUMN min_members_to_activate SET DEFAULT 3")
    op.execute("UPDATE groups SET min_members_to_activate = 3 WHERE min_members_to_activate > 3")


def downgrade() -> None:
    op.execute("ALTER TABLE groups ALTER COLUMN min_members_to_activate SET DEFAULT 20")
