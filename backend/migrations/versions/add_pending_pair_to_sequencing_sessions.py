"""Add pending pair persistence to sequencing sessions.

Revision ID: add_pending_pair
Revises: mrg_seq_repair_0323
Create Date: 2026-03-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "add_pending_pair"
down_revision = "mrg_seq_repair_0323"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sequencing_sessions",
        sa.Column("pending_pair_round_number", sa.Integer(), nullable=True),
    )
    op.add_column(
        "sequencing_sessions",
        sa.Column(
            "pending_pair_payload",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("sequencing_sessions", "pending_pair_payload")
    op.drop_column("sequencing_sessions", "pending_pair_round_number")
