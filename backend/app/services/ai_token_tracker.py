"""Shared helper to extract and persist Gemini token usage."""

import logging

from google.genai.types import GenerateContentResponse

from app.models.ai_token_log import AiTokenLog

logger = logging.getLogger(__name__)

# Gemini 2.5 Flash pricing (per 1M tokens, as of 2025-03)
# Input: $0.15 / 1M tokens, Output: $0.60 / 1M tokens
INPUT_PRICE_PER_M = 0.15
OUTPUT_PRICE_PER_M = 0.60


async def log_token_usage(
    response: GenerateContentResponse,
    *,
    call_type: str,
    model: str = "gemini-2.5-flash",
) -> None:
    """Extract usage_metadata from Gemini response and persist to DB."""
    usage = response.usage_metadata
    if usage is None:
        return

    prompt_tokens = usage.prompt_token_count or 0
    completion_tokens = usage.candidates_token_count or 0
    total_tokens = usage.total_token_count or 0

    logger.info(
        "Gemini %s: prompt=%d completion=%d total=%d",
        call_type, prompt_tokens, completion_tokens, total_tokens,
    )

    try:
        from app.deps import async_session

        async with async_session() as session:
            session.add(AiTokenLog(
                call_type=call_type,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
            ))
            await session.commit()
    except Exception:
        logger.exception("Failed to log token usage for %s", call_type)


def estimate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate USD cost based on Gemini 2.5 Flash pricing."""
    return (
        (prompt_tokens / 1_000_000) * INPUT_PRICE_PER_M
        + (completion_tokens / 1_000_000) * OUTPUT_PRICE_PER_M
    )
