"""R2 (S3-compatible) storage utility for uploading and retrieving files."""

import logging
from io import BytesIO

import boto3
from botocore.config import Config

from app.config import settings

logger = logging.getLogger(__name__)


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
    public_url = f"{settings.s3_public_url}/{key}"
    logger.info("Uploaded %s to R2: %s", key, public_url)
    return public_url


def get_public_url(key: str) -> str:
    """Get the public URL for an object in R2."""
    return f"{settings.s3_public_url}/{key}"
