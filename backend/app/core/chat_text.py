"""Shared normalization for Vietnamese conversational queries, never for stored transcripts."""

import re
import unicodedata


def normalize_chat_text(message: str) -> str:
    text = unicodedata.normalize("NFC", message).lower().strip()
    text = re.sub(r"\b(?:đc|dc)\b", "được", text)
    text = re.sub(r"\b(?:ko|khong)\b", "không", text)
    text = re.sub(r"\b(?:tui|mình|mk)\b", "tôi", text)
    text = re.sub(r"\b(?:bn|bnh)\b", "bao nhiêu", text)
    text = re.sub(r"\b(?:cx|cug)\b", "cũng", text)
    text = re.sub(r"\b(?:vs)\b", "với", text)
    text = re.sub(r"\b(?:j|gi)\s+(?=đây|nữa|cho|nhỉ|ngon)", "gì ", text)
    text = re.sub(r"\b(ăn|uống|món)\s+(?:j|gi)\b", r"\1 gì", text)
    return re.sub(r"\s+", " ", text)


def trim_meal_context(food: str) -> str:
    return re.split(
        r"\s+(?:(?:vào|ở|trong|cho|làm)\s+)?(?:bữa\s+(?:phụ|sáng|trưa|tối)|buổi\s+(?:sáng|trưa|tối))\b",
        food, maxsplit=1,
    )[0].strip()
