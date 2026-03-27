"""Seed the groups table from the bundled fixture."""

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.services.group_seed import seed_groups


async def main() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("Seeding groups...")
    async with session_factory() as session:
        created = await seed_groups(session)
    print(f"Done. Added {created} groups.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
