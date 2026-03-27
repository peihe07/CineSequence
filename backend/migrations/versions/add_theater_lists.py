"""Add theater lists and list items.

Revision ID: add_theater_lists
Revises: b30_upgrade_rounds
Create Date: 2026-03-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "add_theater_lists"
down_revision: str | None = "b30_upgrade_rounds"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "theater_lists",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.String(length=50), nullable=False),
        sa.Column("creator_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("visibility", sa.String(length=20), nullable=False, server_default="group"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_theater_lists_creator_id"), "theater_lists", ["creator_id"], unique=False)
    op.create_index(op.f("ix_theater_lists_group_id"), "theater_lists", ["group_id"], unique=False)

    op.create_table(
        "theater_list_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("list_id", sa.UUID(), nullable=False),
        sa.Column("tmdb_id", sa.Integer(), nullable=False),
        sa.Column("title_en", sa.String(length=255), nullable=False),
        sa.Column("match_tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("added_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["added_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["list_id"], ["theater_lists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_theater_list_items_list_id"), "theater_list_items", ["list_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_theater_list_items_list_id"), table_name="theater_list_items")
    op.drop_table("theater_list_items")
    op.drop_index(op.f("ix_theater_lists_group_id"), table_name="theater_lists")
    op.drop_index(op.f("ix_theater_lists_creator_id"), table_name="theater_lists")
    op.drop_table("theater_lists")
