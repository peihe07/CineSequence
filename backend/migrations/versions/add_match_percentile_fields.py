"""add percentile metadata to matches

Revision ID: add_match_percentile_fields
Revises: add_notifications_table
Create Date: 2026-03-26
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_match_percentile_fields"
down_revision = "add_ai_token_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("candidate_percentile", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("candidate_pool_size", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "candidate_pool_size")
    op.drop_column("matches", "candidate_percentile")
