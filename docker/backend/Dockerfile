# ---- Base ----
FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium

COPY backend/ .
COPY docker/backend/start-backend.sh /usr/local/bin/start-backend.sh
RUN chmod +x /usr/local/bin/start-backend.sh

# ---- Development ----
FROM base AS dev

RUN pip install --no-cache-dir watchfiles

EXPOSE ${PORT:-8000}

CMD ["sh", "-c", "start-backend.sh uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --reload"]

# ---- Production ----
FROM base AS prod

RUN pip install --no-cache-dir gunicorn

EXPOSE ${PORT:-8000}

CMD ["sh", "-c", "start-backend.sh gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}"]
