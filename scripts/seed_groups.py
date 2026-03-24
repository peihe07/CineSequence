"""Seed the groups table from groups_seed.json."""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.group import Group

SEED_FILE = Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "groups_seed.json"


async def seed_groups(session: AsyncSession) -> None:
    with open(SEED_FILE) as f:
        groups_data = json.load(f)

    for item in groups_data:
        # Skip if already exists
        existing = await session.execute(select(Group).where(Group.id == item["id"]))
        if existing.scalar_one_or_none():
            print(f"  Skip (exists): {item['id']}")
            continue

        group = Group(
            id=item["id"],
            name=item["name"],
            subtitle=item["subtitle"],
            icon=item["icon"],
            primary_tags=item["primary_tags"],
            is_hidden=item["is_hidden"],
            min_members_to_activate=item["min_members_to_activate"],
        )
        session.add(group)
        print(f"  Added: {item['id']} ({item['name']})")

    await session.commit()


async def main() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("Seeding groups...")
    async with async_session() as session:
        await seed_groups(session)
    print("Done.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
