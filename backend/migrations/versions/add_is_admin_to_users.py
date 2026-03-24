"""Add is_admin column to users table.

Revision ID: b4g2d3e5f6c7
Revises: a3f1c2d4e5b6
Create Date: 2026-03-22
"""
import sqlalchemy as sa
from alembic import op

revision = "b4g2d3e5f6c7"
down_revision = "a3f1c2d4e5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("users", "is_admin")
