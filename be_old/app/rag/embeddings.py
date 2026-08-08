"""Embedding utilities using sentence-transformers for multilingual support.

Uses paraphrase-multilingual-MiniLM-L12-v2 by default — runs locally, free,
and supports Vietnamese well.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from chromadb.utils import embedding_functions

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_embedding_function():
    """Return a singleton embedding function instance using chromadb utils."""
    logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=settings.EMBEDDING_MODEL
    )
