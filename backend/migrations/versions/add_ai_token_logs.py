"""Add ai_token_logs table for tracking Gemini API token usage.

Revision ID: add_ai_token_logs
Revises: add_invite_reminder_fields
Create Date: 2026-03-25
"""

import sqlalchemy as sa
from alembic import op

revision = "add_ai_token_logs"
down_revision = "add_invite_reminder_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_token_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("call_type", sa.String(32), nullable=False, index=True),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("prompt_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("ai_token_logs")
