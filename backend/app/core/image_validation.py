"""Image file validation via magic bytes (not Content-Type alone)."""

from __future__ import annotations

_IMAGE_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    (b"GIF87a", "image/gif", ".gif"),
    (b"GIF89a", "image/gif", ".gif"),
)


def detect_image_type(content: bytes) -> tuple[str, str] | None:
    """Return (mime_type, extension) if content is a supported image, else None."""
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return ("image/webp", ".webp")
    for signature, mime_type, ext in _IMAGE_SIGNATURES:
        if content.startswith(signature):
            return (mime_type, ext)
    return None
