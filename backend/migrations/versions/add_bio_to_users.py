"""add bio to users

Revision ID: add_bio_to_users
Revises: add_pending_pair
Create Date: 2026-03-24
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_bio_to_users"
down_revision = "add_pending_pair"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "bio")
