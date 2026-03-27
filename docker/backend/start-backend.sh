#!/bin/sh
set -eu

alembic upgrade head
python scripts/seed_groups.py

exec "$@"
