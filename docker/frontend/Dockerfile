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

ARG NEXT_PUBLIC_API_URL=/api
ARG API_PROXY_TARGET=http://127.0.0.1:8000
ARG ENVIRONMENT=production
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV API_PROXY_TARGET=$API_PROXY_TARGET
ENV ENVIRONMENT=$ENVIRONMENT

RUN npm run build

EXPOSE ${PORT:-3000}

CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
