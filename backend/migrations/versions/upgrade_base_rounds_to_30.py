"""Upgrade existing sessions from 20 to 30 base rounds.

All sessions with base_rounds=20 get 10 extra rounds:
- in_progress: bump base_rounds and total_rounds, keep going
- completed: bump rounds, set back to in_progress
- finalized: bump rounds, set to completed (user can continue or re-finalize)
- extending: bump base_rounds, add 10 to total_rounds, keep extending

Revision ID: b30_upgrade_rounds
Revises: 543db1848230
Create Date: 2026-03-27
"""
from collections.abc import Sequence

from alembic import op

revision: str = "b30_upgrade_rounds"
down_revision: str | None = "543db1848230"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Capture only legacy 20-round sessions so follow-up status updates
    # do not affect sessions that were already created with 30 rounds.
    op.execute(
        """
        CREATE TEMP TABLE upgraded_sessions AS
        SELECT id, user_id
        FROM sequencing_sessions
        WHERE base_rounds = 20
        """
    )

    # All legacy sessions: bump base_rounds and total_rounds by 10.
    op.execute(
        """
        UPDATE sequencing_sessions
        SET base_rounds = base_rounds + 10,
            total_rounds = total_rounds + 10,
            max_extension_batches = 2
        WHERE id IN (SELECT id FROM upgraded_sessions)
        """
    )

    # completed → in_progress (so user can continue the extra 10 rounds)
    op.execute(
        """
        UPDATE sequencing_sessions
        SET status = 'in_progress'
        WHERE status = 'completed'
          AND id IN (SELECT id FROM upgraded_sessions)
        """
    )

    # finalized → completed (give them the option to continue or finalize again)
    op.execute(
        """
        UPDATE sequencing_sessions
        SET status = 'completed'
        WHERE status = 'finalized'
          AND id IN (SELECT id FROM upgraded_sessions)
        """
    )

    # Also reset user sequencing_status for affected users
    op.execute(
        """
        UPDATE users
        SET sequencing_status = 'in_progress'
        WHERE id IN (
            SELECT user_id FROM upgraded_sessions
        )
        AND sequencing_status IN ('completed')
        """
    )


def downgrade() -> None:
    raise NotImplementedError(
        "Irreversible migration: cannot safely distinguish upgraded legacy 20-round "
        "sessions from sessions originally created with 30 rounds."
    )
