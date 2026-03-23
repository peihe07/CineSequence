import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import Gender

MIN_AGE = 18


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    gender: Gender
    region: str = Field("TW", min_length=1, max_length=10)
    birth_year: int = Field(..., ge=1900)
    agreed_to_terms: bool = Field(..., description="User must agree to privacy policy")

    @field_validator("birth_year")
    @classmethod
    def must_be_at_least_18(cls, v: int) -> int:
        max_year = datetime.now().year - MIN_AGE
        if v > max_year:
            raise ValueError(f"You must be at least {MIN_AGE} years old")
        return v

    @field_validator("agreed_to_terms")
    @classmethod
    def must_agree(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must agree to the privacy policy")
        return v


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
