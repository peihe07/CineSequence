# ---- Base ----
FROM node:20-alpine AS base

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .

# ---- Development ----
FROM base AS dev

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ---- Production ----
FROM base AS prod

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
