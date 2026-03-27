"""Add theater list replies.

Revision ID: add_theater_list_replies
Revises: add_theater_lists
Create Date: 2026-03-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "add_theater_list_replies"
down_revision: str | None = "add_theater_lists"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "theater_list_replies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("list_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["list_id"], ["theater_lists.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_theater_list_replies_list_id"), "theater_list_replies", ["list_id"], unique=False)
    op.create_index(op.f("ix_theater_list_replies_user_id"), "theater_list_replies", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_theater_list_replies_user_id"), table_name="theater_list_replies")
    op.drop_index(op.f("ix_theater_list_replies_list_id"), table_name="theater_list_replies")
    op.drop_table("theater_list_replies")
