from pathlib import Path
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILES = (
    _BACKEND_DIR / ".env",
    _PROJECT_ROOT / ".env",
)


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://dev:dev@localhost:5432/cinesequence"
    redis_url: str = "redis://localhost:6379/0"

    # External APIs
    tmdb_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_fallback_models: str = ""
    resend_api_key: str = ""

    # Auth
    jwt_secret: str = "change-me"
    magic_link_secret: str = "change-me"
    magic_link_expiry_minutes: int = 15

    # Storage (R2)
    s3_bucket: str = "cinesequence"
    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_public_url: str = ""
    s3_legacy_public_urls: str = ""

    # App
    frontend_url: str = "http://127.0.0.1:3000"
    api_url: str = "http://127.0.0.1:8000"
    environment: str = "development"
    admin_emails: str = ""
    auth_cookie_name: str = "cine_sequence_session"
    auth_cookie_domain: str | None = None
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_cookie_secure: bool | None = None

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # TMDB cache TTL (seconds)
    tmdb_cache_ttl: int = 86400  # 24 hours

    # Matching
    match_threshold: float = 0.8  # 80% minimum similarity

    @field_validator("database_url")
    @classmethod
    def ensure_asyncpg_driver(cls, v: str) -> str:
        """Railway/Heroku provide postgresql://, we need postgresql+asyncpg://."""
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def resolved_auth_cookie_secure(self) -> bool:
        if self.auth_cookie_secure is not None:
            return self.auth_cookie_secure
        return self.environment not in {"development", "test"}

    @property
    def admin_email_set(self) -> set[str]:
        return {
            email.strip().lower()
            for email in self.admin_emails.split(",")
            if email.strip()
        }

    @property
    def gemini_model_candidates(self) -> list[str]:
        candidates = [self.gemini_model]
        candidates.extend(
            model.strip()
            for model in self.gemini_fallback_models.split(",")
            if model.strip()
        )

        deduped: list[str] = []
        for model in candidates:
            if model not in deduped:
                deduped.append(model)
        return deduped

    @model_validator(mode="after")
    def validate_cookie_settings(self):
        if self.environment == "production":
            for field_name in ("jwt_secret", "magic_link_secret"):
                if "change-me" in getattr(self, field_name):
                    raise ValueError(
                        f"{field_name.upper()} must be set to a non-default value in production"
                    )
        if self.auth_cookie_samesite == "none" and not self.resolved_auth_cookie_secure:
            raise ValueError("AUTH_COOKIE_SAMESITE=none requires AUTH_COOKIE_SECURE=true")
        return self

    model_config = {"env_file": _ENV_FILES, "extra": "ignore"}


settings = Settings()
