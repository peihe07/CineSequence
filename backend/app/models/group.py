import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

# Association table for many-to-many user <-> group
group_members = Table(
    "group_members",
    Base.metadata,
    Column(
        "user_id", UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True,
    ),
    Column(
        "group_id", String(50),
        ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True,
    ),
    Column("joined_at", DateTime(timezone=True), server_default=func.now()),
)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(200), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False)
    primary_tags: Mapped[list] = mapped_column(JSON, default=list)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    min_members_to_activate: Mapped[int] = mapped_column(Integer, default=20)
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    members: Mapped[list["User"]] = relationship(secondary=group_members, lazy="selectin")
