"""Expand DNA tag vector dimensions for cinephile taxonomy signals.

Revision ID: add_cinephile_tag_dimensions
Revises: add_pick_decision_type
Create Date: 2026-03-30
"""

from alembic import op

revision = "add_cinephile_tag_dimensions"
down_revision = "add_pick_decision_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_dna_profiles_tag_vector")
    op.execute(
        """
        ALTER TABLE dna_profiles
        ALTER COLUMN tag_vector TYPE vector(35)
        USING (
          CASE
            WHEN tag_vector IS NULL THEN NULL
            ELSE (left(tag_vector::text, -1) || ',0,0,0,0,0]')::vector(35)
          END
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_dna_profiles_tag_vector ON dna_profiles "
        "USING hnsw (tag_vector vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_dna_profiles_tag_vector")
    op.execute(
        r"""
        ALTER TABLE dna_profiles
        ALTER COLUMN tag_vector TYPE vector(30)
        USING (
          CASE
            WHEN tag_vector IS NULL THEN NULL
            ELSE regexp_replace(
              tag_vector::text,
              '^\[((?:[^,]+,){29}[^,]+).*$',
              '[\1]'
            )::vector(30)
          END
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_dna_profiles_tag_vector ON dna_profiles "
        "USING hnsw (tag_vector vector_cosine_ops)"
    )
