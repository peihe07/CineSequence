from pydantic import BaseModel, EmailStr, Field

from app.models.user import Gender


class DevSessionRequest(BaseModel):
    email: EmailStr
    name: str = Field("E2E User", min_length=1, max_length=100)
    gender: Gender = Gender.other
    region: str = Field("TW", min_length=1, max_length=10)
    birth_year: int | None = Field(None, ge=1900, le=2026)


class DevMagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkResponse(BaseModel):
    token: str
