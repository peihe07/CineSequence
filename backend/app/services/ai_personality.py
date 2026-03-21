"""AI personality service: Gemini API generates personality reading from DNA data."""

import json
import logging
from pathlib import Path

from google import genai

from app.config import settings

logger = logging.getLogger(__name__)

PROMPT_FILE = Path(__file__).resolve().parent.parent / "data" / "prompts" / "personality.txt"
SYSTEM_PROMPT = PROMPT_FILE.read_text(encoding="utf-8")


def _build_context(
    picks: list[dict],
    tag_labels: dict[str, float],
    excluded_tags: list[str],
    genre_vector: dict[str, float],
    quadrant_scores: dict,
    archetype_id: str,
) -> str:
    """Build user context for the personality prompt."""
    chosen = []
    skipped = []

    for pick in picks:
        entry = {
            "tmdb_id": pick.get("chosen_tmdb_id") or pick.get("movie_a_tmdb_id"),
            "round": pick.get("round_number"),
            "pick_mode": pick.get("pick_mode"),
        }
        if pick.get("chosen_tmdb_id"):
            chosen.append(entry)
        else:
            skipped.append(entry)

    return json.dumps({
        "picks": chosen,
        "skips": skipped,
        "tag_vector": tag_labels,
        "excluded_tags": excluded_tags[:10],
        "genre_vector": genre_vector,
        "quadrant_vector": quadrant_scores,
        "archetype_id": archetype_id,
    }, ensure_ascii=False)


async def generate_personality(
    picks: list[dict],
    tag_labels: dict[str, float],
    excluded_tags: list[str],
    genre_vector: dict[str, float],
    quadrant_scores: dict,
    archetype_id: str,
) -> dict | None:
    """Call Gemini API to generate personality reading.

    Returns dict with: personality_reading, hidden_traits,
    conversation_style, ideal_movie_date.
    """
    context = _build_context(
        picks, tag_labels, excluded_tags,
        genre_vector, quadrant_scores, archetype_id,
    )

    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"{SYSTEM_PROMPT}\n\n---\n\n{context}",
            config={
                "response_mime_type": "application/json",
                "temperature": 0.9,
                "max_output_tokens": 800,
            },
        )
    except Exception:
        logger.exception("Gemini API error for personality generation")
        return None

    response_text = response.text.strip()

    # Extract JSON from potential markdown code block
    if "```" in response_text:
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        response_text = response_text[start:end]

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        logger.error("Failed to parse personality response: %s", response_text[:200])
        return None

    return {
        "personality_reading": result.get("personality_reading", ""),
        "hidden_traits": result.get("hidden_traits", []),
        "conversation_style": result.get("conversation_style", ""),
        "ideal_movie_date": result.get("ideal_movie_date", ""),
    }
