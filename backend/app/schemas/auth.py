import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.user import Gender


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    gender: Gender
    region: str = Field("TW", min_length=1, max_length=10)
    birth_year: int | None = Field(None, ge=1900, le=2026)
    agreed_to_terms: bool = Field(..., description="User must agree to privacy policy")


class LoginRequest(BaseModel):
    email: EmailStr


class RegisterResponse(BaseModel):
    message: str


class VerifyRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    gender: Gender
    region: str
    avatar_url: str | None
    sequencing_status: str

    model_config = {"from_attributes": True}
