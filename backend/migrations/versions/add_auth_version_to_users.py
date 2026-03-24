"""Add auth_version to users.

Revision ID: add_auth_version_to_users
Revises: add_is_admin_to_users
Create Date: 2026-03-22
"""

import sqlalchemy as sa
from alembic import op

revision = "add_auth_version_to_users"
down_revision = "b4g2d3e5f6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("auth_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.alter_column("users", "auth_version", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "auth_version")
