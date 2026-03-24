"""Initial schema: users, picks, dna_profiles, matches, groups

Revision ID: 001
Revises:
Create Date: 2026-03-21
"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column(
            "gender",
            sa.Enum("male", "female", "other", "prefer_not_to_say", name="gender"),
            nullable=False,
        ),
        sa.Column("birth_year", sa.Integer),
        sa.Column("region", sa.String(50), server_default="TW"),
        sa.Column(
            "match_gender_pref",
            sa.Enum("male", "female", "other", "any", name="genderpref"),
        ),
        sa.Column("match_age_min", sa.Integer),
        sa.Column("match_age_max", sa.Integer),
        sa.Column("pure_taste_match", sa.Boolean, server_default=sa.text("false")),
        sa.Column(
            "sequencing_status",
            sa.Enum("not_started", "in_progress", "completed", name="sequencingstatus"),
            server_default="not_started",
        ),
        sa.Column("seed_movie_tmdb_id", sa.Integer),
        sa.Column("magic_link_token", sa.String(500)),
        sa.Column("magic_link_expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Picks
    op.create_table(
        "picks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False,
        ),
        sa.Column("round_number", sa.Integer, nullable=False),
        sa.Column("phase", sa.Integer, nullable=False),
        sa.Column("pair_id", sa.String(20)),
        sa.Column("movie_a_tmdb_id", sa.Integer, nullable=False),
        sa.Column("movie_b_tmdb_id", sa.Integer, nullable=False),
        sa.Column("chosen_tmdb_id", sa.Integer),
        sa.Column("pick_mode", sa.Enum("watched", "attracted", name="pickmode")),
        sa.Column("test_dimension", sa.String(100)),
        sa.Column("response_time_ms", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # DNA Profiles
    op.create_table(
        "dna_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False,
        ),
        sa.Column("archetype_id", sa.String(50), nullable=False),
        sa.Column("tag_vector", Vector(30), nullable=False),
        sa.Column("genre_vector", postgresql.JSON, server_default="{}"),
        sa.Column("quadrant_scores", postgresql.JSON, server_default="{}"),
        sa.Column("personality_reading", sa.Text),
        sa.Column("hidden_traits", postgresql.JSON, server_default="[]"),
        sa.Column("conversation_style", sa.Text),
        sa.Column("ideal_movie_date", sa.Text),
        sa.Column("ticket_style", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # HNSW index for cosine similarity matching
    op.execute(
        "CREATE INDEX ix_dna_profiles_tag_vector ON dna_profiles "
        "USING hnsw (tag_vector vector_cosine_ops)"
    )

    # Matches
    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_a_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False,
        ),
        sa.Column(
            "user_b_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False,
        ),
        sa.Column("similarity_score", sa.Float, nullable=False),
        sa.Column("shared_tags", postgresql.JSON, server_default="[]"),
        sa.Column("shared_movies", postgresql.JSON, server_default="[]"),
        sa.Column("ice_breakers", postgresql.JSON, server_default="[]"),
        sa.Column(
            "status",
            sa.Enum("discovered", "invited", "accepted", "declined", name="matchstatus"),
            server_default="discovered",
        ),
        sa.Column("ticket_image_url", sa.String(500)),
        sa.Column("invited_at", sa.DateTime(timezone=True)),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_a_id", "user_b_id", name="uq_match_pair"),
    )

    # Groups
    op.create_table(
        "groups",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("subtitle", sa.String(200), nullable=False),
        sa.Column("icon", sa.String(50), nullable=False),
        sa.Column("primary_tags", postgresql.JSON, server_default="[]"),
        sa.Column("is_hidden", sa.Boolean, server_default=sa.text("false")),
        sa.Column("min_members_to_activate", sa.Integer, server_default="20"),
        sa.Column("member_count", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Group members (association table)
    op.create_table(
        "group_members",
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column(
            "group_id", sa.String(50),
            sa.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("group_members")
    op.drop_table("groups")
    op.drop_table("matches")
    op.execute("DROP INDEX IF EXISTS ix_dna_profiles_tag_vector")
    op.drop_table("dna_profiles")
    op.drop_table("picks")
    op.drop_table("users")

    # Drop enums
    sa.Enum(name="gender").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="genderpref").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="sequencingstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="pickmode").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="matchstatus").drop(op.get_bind(), checkfirst=True)

    op.execute("DROP EXTENSION IF EXISTS vector")
