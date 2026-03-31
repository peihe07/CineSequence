"""Add match_threshold column to users table.

Default 0.85 (85%). User-adjustable range: 0.75–0.95.

Revision ID: add_match_threshold_users
Revises: add_cinephile_tag_dimensions
Create Date: 2026-03-31
"""

from alembic import op
import sqlalchemy as sa

revision = "add_match_threshold_users"
down_revision = "add_cinephile_tag_dimensions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS match_threshold FLOAT NOT NULL DEFAULT 0.85
        """
    )


def downgrade() -> None:
    op.drop_column("users", "match_threshold")
