"""Semantic Q&A Response Caching service (P-014 Tier 4 Cost Optimization).

Caches verified clinical Q&A answers using vector embedding cosine similarity.
If a query matches an existing cached question with cosine similarity >= 0.95,
it returns the verified answer with citations in < 50ms at $0.00 LLM cost.
"""

from __future__ import annotations

import logging
import math
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class SemanticQACache:
    """In-memory vector similarity cache for RAG Q&A responses."""

    def __init__(
        self,
        similarity_threshold: float = 0.95,
        default_ttl_seconds: int = 604800,  # 7 days
        max_entries: int = 500,
    ) -> None:
        self.similarity_threshold = similarity_threshold
        self.default_ttl = default_ttl_seconds
        self.max_entries = max_entries
        self._entries: list[dict[str, Any]] = []
        self._lock = threading.Lock()

    def get(self, query: str, disease: list[str] | None = None) -> tuple[str, list[str]] | None:
        """Search for a semantically matching cached Q&A response."""
        clean_query = query.strip().lower()
        if len(clean_query) < 5:
            return None

        from app.rag.embeddings import embed_query_texts

        try:
            vectors = embed_query_texts([clean_query])
            query_embedding = vectors[0] if vectors else None
        except Exception as e:
            logger.debug("Failed to generate embedding for semantic cache: %s", e)
            return None

        if not query_embedding:
            return None

        current_time = time.time()
        disease_set = set(d.lower() for d in (disease or ["diabetes_t2"]))

        with self._lock:
            # Purge expired entries
            self._entries = [e for e in self._entries if e["expiry"] > current_time]

            best_match = None
            best_score = -1.0

            for entry in self._entries:
                # Check disease context overlap
                cached_diseases = entry.get("diseases", set())
                if disease_set and cached_diseases and not (disease_set & cached_diseases):
                    continue

                sim = _cosine_similarity(query_embedding, entry["embedding"])
                if sim > best_score:
                    best_score = sim
                    best_match = entry

            if best_score >= self.similarity_threshold and best_match:
                logger.info(
                    "Semantic Cache HIT (Score: %.4f) for query: '%s' (matched: '%s')",
                    best_score,
                    query[:40],
                    best_match["query"][:40],
                )
                return best_match["answer"], list(best_match.get("citations", []))

        return None

    def put(
        self,
        query: str,
        answer: str,
        citations: list[str] | None = None,
        disease: list[str] | None = None,
        ttl: int | None = None,
    ) -> None:
        """Store a verified Q&A response into semantic cache."""
        clean_query = query.strip().lower()
        if len(clean_query) < 5 or not answer or len(answer) < 30:
            return

        from app.rag.embeddings import embed_query_texts

        try:
            vectors = embed_query_texts([clean_query])
            query_embedding = vectors[0] if vectors else None
        except Exception as e:
            logger.debug("Failed to generate embedding for semantic cache put: %s", e)
            return

        if not query_embedding:
            return

        expiry = time.time() + (ttl or self.default_ttl)
        disease_set = set(d.lower() for d in (disease or ["diabetes_t2"]))

        with self._lock:
            if len(self._entries) >= self.max_entries:
                # Evict oldest
                self._entries.pop(0)

            self._entries.append({
                "query": clean_query,
                "embedding": query_embedding,
                "answer": answer,
                "citations": list(citations or []),
                "diseases": disease_set,
                "expiry": expiry,
            })
            logger.debug("Stored in Semantic Cache: '%s'", clean_query[:40])

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._entries.clear()

    def size(self) -> int:
        """Return number of active entries."""
        with self._lock:
            return len(self._entries)


# Global singleton instance
semantic_qa_cache = SemanticQACache(similarity_threshold=0.95)
