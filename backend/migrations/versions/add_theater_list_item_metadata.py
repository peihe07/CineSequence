"""Add metadata fields to theater list items.

Revision ID: add_theater_list_item_metadata
Revises: lower_group_activation
Create Date: 2026-03-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "add_theater_list_item_metadata"
down_revision: str | None = "lower_group_activation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("theater_list_items", sa.Column("title_zh", sa.String(length=255), nullable=True))
    op.add_column("theater_list_items", sa.Column("poster_url", sa.String(length=500), nullable=True))
    op.add_column(
        "theater_list_items",
        sa.Column("genres", postgresql.JSON(astext_type=sa.Text()), server_default="[]", nullable=False),
    )
    op.add_column("theater_list_items", sa.Column("runtime_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("theater_list_items", "runtime_minutes")
    op.drop_column("theater_list_items", "genres")
    op.drop_column("theater_list_items", "poster_url")
    op.drop_column("theater_list_items", "title_zh")
