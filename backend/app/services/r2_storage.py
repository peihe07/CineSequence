"""R2 (S3-compatible) storage utility for uploading and retrieving files."""

import logging
from io import BytesIO
from urllib.parse import urlsplit, urlunsplit

import boto3
from botocore.config import Config

from app.config import settings

logger = logging.getLogger(__name__)


def _normalize_public_base_url(base_url: str | None = None) -> str:
    """Return a public base URL compatible with both bucket and account-level R2 domains."""
    base = (base_url or settings.s3_public_url).rstrip("/")
    if not base:
        return base

    parsed = urlsplit(base)
    path = parsed.path.rstrip("/")
    bucket_suffix = f"/{settings.s3_bucket}"

    # Account-level public domains need the bucket name in the path.
    if parsed.netloc.endswith(".r2.dev") and path != bucket_suffix:
        path = f"{path}{bucket_suffix}" if path else bucket_suffix

    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def _iter_known_public_base_urls() -> list[str]:
    bases = [settings.s3_public_url]
    bases.extend(
        value.strip()
        for value in settings.s3_legacy_public_urls.split(",")
        if value.strip()
    )

    seen: set[str] = set()
    normalized_bases: list[str] = []
    for base in bases:
        normalized = _normalize_public_base_url(base)
        if normalized and normalized not in seen:
            seen.add(normalized)
            normalized_bases.append(normalized)
    return normalized_bases


def _extract_object_key(url: str) -> str | None:
    parsed = urlsplit(url)
    path = parsed.path.lstrip("/")
    bucket_prefix = f"{settings.s3_bucket}/"

    if parsed.netloc.endswith(".r2.dev") and path.startswith(bucket_prefix):
        return path[len(bucket_prefix):]

    for base in _iter_known_public_base_urls():
        base_parsed = urlsplit(base)
        if (parsed.scheme, parsed.netloc) != (base_parsed.scheme, base_parsed.netloc):
            continue

        base_path = base_parsed.path.rstrip("/")
        if parsed.path == base_path:
            return None
        if base_path and not parsed.path.startswith(f"{base_path}/"):
            continue

        object_path = parsed.path[len(base_path):] if base_path else parsed.path
        object_key = object_path.lstrip("/")
        if object_key:
            return object_key

    return None


def get_public_url(key: str) -> str:
    """Get the public URL for an object in R2."""
    base = _normalize_public_base_url()
    normalized_key = key.lstrip("/")
    return f"{base}/{normalized_key}"


def normalize_public_object_url(url: str | None) -> str | None:
    """Rewrite known legacy public object URLs to the current configured public base."""
    if not url:
        return url

    object_key = _extract_object_key(url)
    if object_key:
        rewritten = urlsplit(get_public_url(object_key))
        original = urlsplit(url)
        return urlunsplit(
            (
                rewritten.scheme,
                rewritten.netloc,
                rewritten.path,
                original.query,
                original.fragment,
            )
        )

    return url


def _get_client():
    """Create S3 client configured for Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


async def upload_bytes(
    data: bytes,
    key: str,
    content_type: str = "image/png",
) -> str:
    """Upload bytes to R2 and return the public URL.

    Args:
        data: File content as bytes.
        key: Object key (path) in the bucket.
        content_type: MIME type for the object.

    Returns:
        Public URL for the uploaded object.
    """
    client = _get_client()
    client.upload_fileobj(
        BytesIO(data),
        settings.s3_bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    public_url = get_public_url(key)
    logger.info("Uploaded %s to R2: %s", key, public_url)
    return public_url
