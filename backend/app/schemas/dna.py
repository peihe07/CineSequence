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


class SignalDetail(BaseModel):
    tag: str
    score: float | None = None
    confidence: float | None = None
    consistency: float | None = None


class ComparisonEvidence(BaseModel):
    round: int | None = None
    chosen_title: str
    rejected_title: str
    dimension: str | None = None
    focus_tags: list[str] = []
    chosen_tags: list[str] = []
    rejected_tags: list[str] = []


class InteractionDiagnostics(BaseModel):
    skip_count: int = 0
    dislike_both_count: int = 0
    explicit_pick_count: int = 0


class DnaResultResponse(BaseModel):
    archetype: ArchetypeInfo
    tag_vector: list[float]
    tag_labels: dict[str, float] = {}
    top_tags: list[str] = []
    supporting_signals: list[SignalDetail] = []
    avoided_signals: list[SignalDetail] = []
    mixed_signals: list[SignalDetail] = []
    comparison_evidence: list[ComparisonEvidence] = []
    interaction_diagnostics: InteractionDiagnostics
    genre_vector: dict[str, float] = {}
    quadrant_scores: QuadrantScores
    personality_reading: str | None = None
    hidden_traits: list[str] = []
    conversation_style: str | None = None
    ideal_movie_date: str | None = None
    ticket_style: str
    version: int = 1
    can_extend: bool = False

    model_config = {"from_attributes": True}


class DnaBuildResponse(BaseModel):
    status: str = "building"
    message: str = "DNA analysis in progress"


class CharacterMatchResponse(BaseModel):
    id: str
    name: str
    movie: str
    tmdb_id: int
    score: float
    psych_labels: list[str]
    psych_framework: str
    one_liner: str
    mirror_reading: str | None = None


class DnaHistorySummary(BaseModel):
    version: int
    archetype: ArchetypeInfo
    ticket_style: str
    created_at: str

    model_config = {"from_attributes": True}
