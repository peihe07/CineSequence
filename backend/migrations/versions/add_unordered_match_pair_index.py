"""Add unordered unique index for match pairs.

Revision ID: add_unordered_match_pair_index
Revises: add_auth_version_to_users
Create Date: 2026-03-23
"""

from alembic import op


revision = "add_unordered_match_pair_index"
down_revision = "add_auth_version_to_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_unordered_pair
        ON matches (
            LEAST(user_a_id, user_b_id),
            GREATEST(user_a_id, user_b_id)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_matches_unordered_pair")
