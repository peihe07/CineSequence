"""Inspect theater list and item records in the current database."""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings


async def main() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    try:
        async with engine.connect() as conn:
            queries = [
                ("lists", "select count(*) from theater_lists"),
                ("items", "select count(*) from theater_list_items"),
                (
                    "items_missing_poster",
                    "select count(*) from theater_list_items where poster_url is null",
                ),
                (
                    "items_manual_tmdb0",
                    "select count(*) from theater_list_items where tmdb_id = 0",
                ),
                (
                    "duplicate_titles",
                    "select list_id, lower(title_en), count(*) "
                    "from theater_list_items "
                    "group by list_id, lower(title_en) "
                    "having count(*) > 1 "
                    "order by count(*) desc "
                    "limit 20",
                ),
                (
                    "recent_lists",
                    "select id, title, group_id, created_at "
                    "from theater_lists "
                    "order by created_at desc "
                    "limit 10",
                ),
                (
                    "recent_items",
                    "select list_id, title_en, tmdb_id, poster_url, created_at "
                    "from theater_list_items "
                    "order by created_at desc "
                    "limit 20",
                ),
            ]

            for label, sql in queries:
                print(f"\n-- {label} --")
                result = await conn.execute(text(sql))
                rows = result.fetchall()
                if not rows:
                    print("(none)")
                    continue
                for row in rows:
                    print(row)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
