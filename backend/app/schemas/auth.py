import uuid

from pydantic import BaseModel, EmailStr

from app.models.user import Gender


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    gender: Gender
    region: str = "TW"
    birth_year: int | None = None


class LoginRequest(BaseModel):
    email: EmailStr


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
