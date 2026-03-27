"""Backfill missing theater list item metadata and remove duplicates."""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.models.theater_list import TheaterList
from app.services.theater_list_items import (
    TheaterListItemData,
    item_fingerprint,
    prepare_theater_list_items,
)


async def main() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    updated = 0
    deleted = 0

    async with session_factory() as session:
        result = await session.execute(
            select(TheaterList)
            .options(selectinload(TheaterList.items))
            .order_by(TheaterList.created_at.asc())
        )
        lists = result.scalars().all()

        for theater_list in lists:
            seen: set[tuple[str, str | int]] = set()
            position = 0

            for item in list(theater_list.items):
                prepared_items = await prepare_theater_list_items(
                    [
                        TheaterListItemData(
                            tmdb_id=item.tmdb_id,
                            title_en=item.title_en,
                            title_zh=item.title_zh,
                            poster_url=item.poster_url,
                            genres=item.genres or [],
                            runtime_minutes=item.runtime_minutes,
                            match_tags=item.match_tags or [],
                            note=item.note,
                        )
                    ],
                    existing_fingerprints=seen,
                )
                if not prepared_items:
                    await session.delete(item)
                    deleted += 1
                    continue

                prepared_item = prepared_items[0]
                normalized_key = item_fingerprint(
                    prepared_item.tmdb_id,
                    prepared_item.title_en,
                    prepared_item.title_zh,
                )
                if normalized_key in seen:
                    await session.delete(item)
                    deleted += 1
                    continue

                seen.add(normalized_key)
                changed = False
                for field in (
                    "tmdb_id",
                    "title_en",
                    "title_zh",
                    "poster_url",
                    "genres",
                    "runtime_minutes",
                ):
                    new_value = getattr(prepared_item, field)
                    if getattr(item, field) != new_value:
                        setattr(item, field, new_value)
                        changed = True
                if item.position != position:
                    item.position = position
                    changed = True
                if changed:
                    updated += 1
                position += 1

        await session.commit()

    await engine.dispose()
    print(f"Done. Updated {updated} items, removed {deleted} duplicates.")


if __name__ == "__main__":
    asyncio.run(main())
