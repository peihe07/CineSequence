"""Add sequencing entitlements and user credit fields.

Revision ID: add_sequencing_entitlements
Revises: add_waitlist_entries
Create Date: 2026-03-29
"""

import uuid

import sqlalchemy as sa
from alembic import op

revision = "add_sequencing_entitlements"
down_revision = "add_waitlist_entries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    entitlement_kind = sa.Enum("free_retest", "paid_credit", name="entitlementkind")
    entitlement_source = sa.Enum(
        "launch_grant",
        "purchase",
        "admin",
        "migration",
        name="entitlementsource",
    )
    entitlement_kind.create(op.get_bind(), checkfirst=True)
    entitlement_source.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "users",
        sa.Column("free_retest_credits", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "users",
        sa.Column("paid_sequencing_credits", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column(
            "beta_entitlement_override",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )

    op.create_table(
        "sequencing_entitlements",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("kind", entitlement_kind, nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("used_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", entitlement_source, nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_sequencing_entitlements_user_id"),
        "sequencing_entitlements",
        ["user_id"],
        unique=False,
    )
    bind = op.get_bind()
    users = sa.table("users", sa.column("id", sa.UUID()))
    entitlements = sa.table(
        "sequencing_entitlements",
        sa.column("id", sa.UUID()),
        sa.column("user_id", sa.UUID()),
        sa.column("kind", entitlement_kind),
        sa.column("quantity", sa.Integer()),
        sa.column("used_quantity", sa.Integer()),
        sa.column("source", entitlement_source),
        sa.column("notes", sa.Text()),
    )
    existing_user_ids = [row.id for row in bind.execute(sa.select(users.c.id))]
    if existing_user_ids:
        bind.execute(
            entitlements.insert(),
            [
                {
                    "id": uuid.uuid4(),
                    "user_id": user_id,
                    "kind": "free_retest",
                    "quantity": 1,
                    "used_quantity": 0,
                    "source": "migration",
                    "notes": "Launch free retest backfill",
                }
                for user_id in existing_user_ids
            ],
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_sequencing_entitlements_user_id"), table_name="sequencing_entitlements")
    op.drop_table("sequencing_entitlements")
    op.drop_column("users", "beta_entitlement_override")
    op.drop_column("users", "paid_sequencing_credits")
    op.drop_column("users", "free_retest_credits")
    sa.Enum(name="entitlementsource").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="entitlementkind").drop(op.get_bind(), checkfirst=True)
