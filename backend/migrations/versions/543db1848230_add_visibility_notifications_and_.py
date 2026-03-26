"""add visibility notifications and favorite movies

Revision ID: 543db1848230
Revises: aed2214955d4
Create Date: 2026-03-26 15:13:37.590099

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '543db1848230'
down_revision: Union[str, None] = 'aed2214955d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # User preference columns
    op.add_column('users', sa.Column('is_visible', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('users', sa.Column('email_notifications_enabled', sa.Boolean(), server_default='true', nullable=False))

    # Favorite movies table
    op.create_table('user_favorite_movies',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tmdb_id', sa.Integer(), nullable=False),
        sa.Column('title_zh', sa.String(length=255), nullable=True),
        sa.Column('title_en', sa.String(length=255), nullable=True),
        sa.Column('poster_url', sa.String(length=500), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'display_order', name='uq_user_favorite_order'),
        sa.UniqueConstraint('user_id', 'tmdb_id', name='uq_user_favorite_tmdb'),
    )


def downgrade() -> None:
    op.drop_table('user_favorite_movies')
    op.drop_column('users', 'email_notifications_enabled')
    op.drop_column('users', 'is_visible')
