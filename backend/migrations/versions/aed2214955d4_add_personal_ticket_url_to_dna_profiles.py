"""add personal_ticket_url to dna_profiles.

Revision ID: aed2214955d4
Revises: add_match_percentile_fields
Create Date: 2026-03-26 13:01:22.346875

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "aed2214955d4"
down_revision: str | None = "add_match_percentile_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "dna_profiles",
        sa.Column("personal_ticket_url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("dna_profiles", "personal_ticket_url")
