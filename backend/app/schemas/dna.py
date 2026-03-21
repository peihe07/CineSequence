from pydantic import BaseModel


class ArchetypeInfo(BaseModel):
    id: str
    name: str
    name_en: str
    icon: str
    description: str


class QuadrantScores(BaseModel):
    mainstream_independent: float = 3.0
    rational_emotional: float = 3.0
    light_dark: float = 3.0


class DnaResultResponse(BaseModel):
    archetype: ArchetypeInfo
    tag_vector: list[float]
    tag_labels: dict[str, float] = {}
    genre_vector: dict[str, float] = {}
    quadrant_scores: QuadrantScores
    personality_reading: str | None = None
    hidden_traits: list[str] = []
    conversation_style: str | None = None
    ideal_movie_date: str | None = None
    ticket_style: str

    model_config = {"from_attributes": True}


class DnaBuildResponse(BaseModel):
    status: str = "building"
    message: str = "DNA analysis in progress"
