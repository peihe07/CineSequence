"""add starred columns to matches

Revision ID: 42fa56b03c40
Revises: add_match_messages
Create Date: 2026-04-09 12:31:02.561757

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42fa56b03c40'
down_revision: Union[str, None] = 'add_match_messages'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('matches', sa.Column('starred_by_a', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('matches', sa.Column('starred_by_b', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('matches', 'starred_by_b')
    op.drop_column('matches', 'starred_by_a')
