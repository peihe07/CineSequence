"""Add pick decision type for skip/dislike-both separation.

Revision ID: add_pick_decision_type
Revises: add_sequencing_entitlements
Create Date: 2026-03-30
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "add_pick_decision_type"
down_revision = "add_sequencing_entitlements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    decision_type = postgresql.ENUM(
        "pick",
        "skip",
        "dislike_both",
        name="pickdecisiontype",
    )
    decision_type.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "picks",
        sa.Column(
            "decision_type",
            decision_type,
            nullable=False,
            server_default="pick",
        ),
    )


def downgrade() -> None:
    op.drop_column("picks", "decision_type")
    sa.Enum(name="pickdecisiontype").drop(op.get_bind(), checkfirst=True)
