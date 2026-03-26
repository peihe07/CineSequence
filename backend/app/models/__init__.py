from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic can detect them
from app.models.ai_token_log import AiTokenLog  # noqa: E402, F401
from app.models.dna_profile import DnaProfile  # noqa: E402, F401
from app.models.group import Group  # noqa: E402, F401
from app.models.group_message import GroupMessage  # noqa: E402, F401
from app.models.match import Match  # noqa: E402, F401
from app.models.notification import Notification  # noqa: E402, F401
from app.models.pick import Pick  # noqa: E402, F401
from app.models.sequencing_session import SequencingSession  # noqa: E402, F401
from app.models.user import User  # noqa: E402, F401
from app.models.user_favorite_movie import UserFavoriteMovie  # noqa: E402, F401
