from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://dev:dev@localhost:5432/movie_dna"
    redis_url: str = "redis://localhost:6379/0"

    # External APIs
    tmdb_api_key: str = ""
    anthropic_api_key: str = ""
    resend_api_key: str = ""

    # Auth
    jwt_secret: str = "change-me"
    magic_link_secret: str = "change-me"
    magic_link_expiry_minutes: int = 15

    # Storage (R2)
    s3_bucket: str = "movie-dna-assets"
    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_public_url: str = ""

    # App
    frontend_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    environment: str = "development"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # TMDB cache TTL (seconds)
    tmdb_cache_ttl: int = 86400  # 24 hours

    # Matching
    match_threshold: float = 0.8  # 80% minimum similarity

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
