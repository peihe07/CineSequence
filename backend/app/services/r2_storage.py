"""R2 (S3-compatible) storage utility for uploading and retrieving files."""

import logging
from io import BytesIO
from urllib.parse import urlsplit, urlunsplit

import boto3
from botocore.config import Config

from app.config import settings

logger = logging.getLogger(__name__)


def _normalize_public_base_url() -> str:
    """Return a public base URL compatible with both bucket and account-level R2 domains."""
    base = settings.s3_public_url.rstrip("/")
    if not base:
        return base

    parsed = urlsplit(base)
    path = parsed.path.rstrip("/")
    bucket_suffix = f"/{settings.s3_bucket}"

    # Account-level public domains need the bucket name in the path.
    if parsed.netloc.endswith(".r2.dev") and path != bucket_suffix:
        path = f"{path}{bucket_suffix}" if path else bucket_suffix

    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def get_public_url(key: str) -> str:
    """Get the public URL for an object in R2."""
    base = _normalize_public_base_url()
    normalized_key = key.lstrip("/")
    return f"{base}/{normalized_key}"


def normalize_public_object_url(url: str | None) -> str | None:
    """Rewrite legacy public bucket URLs to the currently configured public base.

    This keeps old DB rows usable after switching from the default `r2.dev`
    public URL to a custom domain.
    """
    if not url:
        return url

    parsed = urlsplit(url)
    path = parsed.path.lstrip("/")
    bucket_prefix = f"{settings.s3_bucket}/"

    if parsed.netloc.endswith(".r2.dev") and path.startswith(bucket_prefix):
        object_key = path[len(bucket_prefix):]
        return get_public_url(object_key)

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
