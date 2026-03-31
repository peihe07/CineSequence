"""Character mirror service: maps user DNA to resonant movie characters."""

import json
import logging
import math
from dataclasses import dataclass
from pathlib import Path

from google import genai

from app.config import settings
from app.models.dna_profile import DnaProfile
from app.services.ai_token_tracker import log_token_usage

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_PROFILES_FILE = _DATA_DIR / "character_profiles.json"
_PROMPT_FILE = _DATA_DIR / "prompts" / "character_mirror.txt"

_SYSTEM_PROMPT = _PROMPT_FILE.read_text(encoding="utf-8")

# Scoring weights
_TAG_WEIGHT = 0.5
_QUADRANT_WEIGHT = 0.3
_ARCHETYPE_WEIGHT = 0.2

# Archetype → preferred psych frameworks (primary, secondary)
_ARCHETYPE_FRAMEWORK_AFFINITY: dict[str, list[str]] = {
    "time_traveler":       ["existential_crisis", "cognitive_style"],
    "dark_poet":           ["shadow_self", "existential_crisis"],
    "emotional_sponge":    ["attachment_style", "individuation"],
    "chaos_theorist":      ["shadow_self", "existential_crisis"],
    "quiet_observer":      ["defense_mechanism", "cognitive_style"],
    "adrenaline_junkie":   ["shadow_self", "cognitive_style"],
    "reality_hunter":      ["cognitive_style", "existential_crisis"],
    "world_wanderer":      ["individuation", "attachment_style"],
    "master_planner":      ["cognitive_style", "persona_mask"],
    "dystopia_architect":  ["shadow_self", "existential_crisis"],
    "dream_weaver":        ["individuation", "existential_crisis"],
    "lone_wolf":           ["defense_mechanism", "shadow_self"],
}

_MIRROR_CACHE: dict[str, tuple[float, list[dict]]] = {}
_MIRROR_CACHE_TTL = 3600


@dataclass
class CharacterMatch:
    id: str
    name: str
    movie: str
    tmdb_id: int
    score: float
    psych_labels: list[str]
    psych_framework: str
    one_liner: str
    mirror_reading: str | None = None


def _load_characters() -> list[dict]:
    data = json.loads(_PROFILES_FILE.read_text(encoding="utf-8"))
    return data["characters"]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _quadrant_proximity(
    user_quadrant: dict[str, float],
    character_quadrant: dict[str, float],
) -> float:
    """Normalized proximity score across 3 quadrant axes (1–5 scale)."""
    axes = ["mainstream_independent", "rational_emotional", "light_dark"]
    max_dist = math.sqrt(len(axes) * (4.0 ** 2))  # max distance per axis = 4
    sq_sum = sum(
        (user_quadrant.get(ax, 3.0) - character_quadrant.get(ax, 3.0)) ** 2
        for ax in axes
    )
    return 1.0 - (math.sqrt(sq_sum) / max_dist)


def _archetype_affinity(archetype_id: str, psych_framework: str) -> float:
    preferred = _ARCHETYPE_FRAMEWORK_AFFINITY.get(archetype_id, [])
    if not preferred:
        return 0.5
    if preferred[0] == psych_framework:
        return 1.0
    if len(preferred) > 1 and preferred[1] == psych_framework:
        return 0.7
    return 0.3


def find_resonant_characters(profile: DnaProfile) -> list[CharacterMatch]:
    """Return top 3 resonant characters for a DNA profile.

    Diversity constraints:
    - At least 2 different psych_framework values in top 3
    - No two characters from the same movie
    """
    characters = _load_characters()
    user_vector = list(profile.tag_vector)
    user_quadrant = profile.quadrant_scores or {}
    archetype_id = profile.archetype_id or ""

    scored: list[tuple[float, dict]] = []
    for char in characters:
        tag_sim = _cosine_similarity(user_vector, char["tag_vector"])
        quad_sim = _quadrant_proximity(user_quadrant, char["quadrant_profile"])
        arch_aff = _archetype_affinity(archetype_id, char["psych_framework"])
        combined = (
            _TAG_WEIGHT * tag_sim
            + _QUADRANT_WEIGHT * quad_sim
            + _ARCHETYPE_WEIGHT * arch_aff
        )
        scored.append((combined, char))

    scored.sort(key=lambda x: x[0], reverse=True)

    selected: list[CharacterMatch] = []
    seen_frameworks: list[str] = []
    seen_movies: set[int] = set()

    for score, char in scored:
        if len(selected) == 3:
            break
        if char["tmdb_id"] in seen_movies:
            continue
        framework = char["psych_framework"]
        # Ensure at least 2 different frameworks across top 3
        if (
            len(selected) == 2
            and len(set(seen_frameworks)) == 1
            and framework == seen_frameworks[0]
        ):
            continue
        selected.append(
            CharacterMatch(
                id=char["id"],
                name=char["name"],
                movie=char["movie"],
                tmdb_id=char["tmdb_id"],
                score=round(score, 4),
                psych_labels=char["psych_labels"],
                psych_framework=char["psych_framework"],
                one_liner=char["one_liner"],
            )
        )
        seen_frameworks.append(framework)
        seen_movies.add(char["tmdb_id"])

    return selected


def _build_mirror_prompt(
    top_tags: list[str],
    quadrant: dict[str, float],
    archetype_id: str,
    character: CharacterMatch,
) -> str:
    payload = {
        "user_top_tags": top_tags[:3],
        "user_quadrant": {k: round(v, 2) for k, v in quadrant.items()},
        "user_archetype": archetype_id,
        "character_name": character.name,
        "character_movie": character.movie,
        "character_psych_labels": character.psych_labels,
        "character_psych_framework": character.psych_framework,
        "character_one_liner": character.one_liner,
    }
    return json.dumps(payload, ensure_ascii=False)


async def generate_mirror_readings(
    profile: DnaProfile,
    characters: list[CharacterMatch],
    top_tags: list[str],
) -> list[CharacterMatch]:
    """Generate Gemini mirror readings for each character in-place.

    Returns the same list with mirror_reading populated.
    Failures are logged and left as None rather than raising.
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    for character in characters:
        user_prompt = _build_mirror_prompt(
            top_tags=top_tags,
            quadrant=profile.quadrant_scores or {},
            archetype_id=profile.archetype_id or "",
            character=character,
        )
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=user_prompt,
                config={
                    "system_instruction": _SYSTEM_PROMPT,
                    "response_mime_type": "application/json",
                    "temperature": 0.6,
                    "max_output_tokens": 200,
                },
            )
            log_token_usage(
                "character_mirror",
                response.usage_metadata.prompt_token_count,
                response.usage_metadata.candidates_token_count,
            )
            result = json.loads(response.text)
            character.mirror_reading = result.get("mirror_reading", "")
        except Exception:
            logger.exception(
                "Failed to generate mirror reading for character %s", character.id
            )

    return characters
