"""Seed default groups from the bundled JSON fixture."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group

SEED_FILE = Path(__file__).resolve().parents[1] / "data" / "groups_seed.json"


async def seed_groups(session: AsyncSession) -> int:
    """Insert default groups that are not yet present."""
    groups_data = json.loads(SEED_FILE.read_text())
    created = 0

    for item in groups_data:
        existing = await session.execute(select(Group).where(Group.id == item["id"]))
        if existing.scalar_one_or_none():
            continue

        session.add(
            Group(
                id=item["id"],
                name=item["name"],
                subtitle=item["subtitle"],
                icon=item["icon"],
                primary_tags=item["primary_tags"],
                is_hidden=item["is_hidden"],
                min_members_to_activate=item["min_members_to_activate"],
            )
        )
        created += 1

    if created:
        await session.commit()

    return created
