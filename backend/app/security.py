from urllib.parse import urlsplit, urlunsplit

from fastapi import HTTPException, Request, status

from app.config import settings


def build_allowed_origins(frontend_url: str) -> list[str]:
    """Accept both localhost and 127.0.0.1 for local dev credentials flows."""
    origins = {frontend_url}
    parsed = urlsplit(frontend_url)

    if parsed.hostname == "localhost":
        origins.add(
            urlunsplit((parsed.scheme, f"127.0.0.1:{parsed.port}", parsed.path, "", ""))
        )
    elif parsed.hostname == "127.0.0.1":
        origins.add(
            urlunsplit((parsed.scheme, f"localhost:{parsed.port}", parsed.path, "", ""))
        )

    return sorted(origins)


def validate_csrf_origin(request: Request) -> None:
    """Reject unsafe browser-originated requests from unexpected origins."""
    origin = request.headers.get("origin")
    if origin is None:
        referer = request.headers.get("referer")
        if referer:
            parsed = urlsplit(referer)
            origin = urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))

    if origin not in build_allowed_origins(settings.frontend_url):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid request origin",
        )
