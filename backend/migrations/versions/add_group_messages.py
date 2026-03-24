"""Add group messages table

Revision ID: add_group_messages
Revises: ed7b2fe54c0a
Create Date: 2026-03-23 23:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_group_messages"
down_revision: str | None = "ed7b2fe54c0a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "group_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_group_messages_group_id"), "group_messages", ["group_id"], unique=False)
    op.create_index(op.f("ix_group_messages_user_id"), "group_messages", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_group_messages_user_id"), table_name="group_messages")
    op.drop_index(op.f("ix_group_messages_group_id"), table_name="group_messages")
    op.drop_table("group_messages")
