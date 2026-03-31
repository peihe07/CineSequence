"""Add seen_one_side to pick_decision_type enum.

Revision ID: add_seen_one_side_decision_type
Revises: add_match_threshold_users
Create Date: 2026-03-31
"""

from alembic import op

revision = "add_seen_one_side_decision_type"
down_revision = "add_match_threshold_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE pickdecisiontype ADD VALUE IF NOT EXISTS 'seen_one_side'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; downgrade is a no-op.
    pass
