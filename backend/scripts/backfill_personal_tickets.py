"""One-time script: generate personal tickets for existing users with completed DNA profiles.

Usage:
    cd backend
    source .venv/bin/activate
    python scripts/backfill_personal_tickets.py
    python scripts/backfill_personal_tickets.py --force

Set DATABASE_URL env var to target production DB, or it uses local .env defaults.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add backend to path so app imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def main(force: bool = False):
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.config import settings
    from app.services.personal_ticket_backfill import backfill_personal_tickets

    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await backfill_personal_tickets(db, force=force)
        if result.processed == 0:
            if force:
                logger.info("No completed active profiles found to regenerate. All done!")
            else:
                logger.info("No profiles need backfilling. All done!")
        else:
            logger.info(
                "Done! %d succeeded, %d failed out of %d total",
                result.success,
                result.failed,
                result.processed,
            )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(force="--force" in sys.argv[1:]))
