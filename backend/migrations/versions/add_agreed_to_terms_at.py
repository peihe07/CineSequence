"""Add agreed_to_terms_at column to users table.

Revision ID: a3f1c2d4e5b6
Revises: ed7b2fe54c0a
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = "a3f1c2d4e5b6"
down_revision = "ed7b2fe54c0a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("agreed_to_terms_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "agreed_to_terms_at")
