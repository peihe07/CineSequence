"""Merge heads and repair sequencing_sessions schema.

Revision ID: mrg_seq_repair_0323
Revises: add_group_messages, add_unordered_match_pair_index
Create Date: 2026-03-23
"""

from alembic import op

revision = "mrg_seq_repair_0323"
down_revision = ("add_group_messages", "add_unordered_match_pair_index")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE sequencing_sessions
        ADD COLUMN IF NOT EXISTS reroll_excluded_tmdb_ids JSON
        NOT NULL DEFAULT '[]'::json
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE sequencing_sessions
        DROP COLUMN IF EXISTS reroll_excluded_tmdb_ids
        """
    )
