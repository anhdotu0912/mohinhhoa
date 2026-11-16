"""Retriever module for RAG: query food items and guidelines from Qdrant.

Supports:
  - Dense retrieval via sentence-transformer embeddings or Gemini Embedding
  - BM25 fallback for keyword matching
  - Hybrid fusion of both
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from app.core.config import settings
from app.rag.embeddings import embed_query_texts
from app.rag.qdrant import get_qdrant_client

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

_dense_memory_failed = False


def _keyword_mode() -> bool:
    return settings.RAG_RETRIEVAL_MODE == "keyword" or _dense_memory_failed


def _query_vectors(query: str) -> list[list[float]] | None:
    """Stop retrying a model that cannot fit in this process's memory budget."""
    global _dense_memory_failed
    try:
        return embed_query_texts([query])
    except (MemoryError, OSError) as exc:
        if not isinstance(exc, MemoryError) and not (
            getattr(exc, "winerror", None) == 1455
            or getattr(exc, "errno", None) in (12, 1455)
        ):
            raise
        _dense_memory_failed = True
        logger.warning("Embedding allocation failed; using BM25 for subsequent retrievals")
        return None

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


@dataclass
class RetrievedChunk:
    """A single retrieved chunk from the knowledge base."""
    chunk_id: str
    text: str
    source: str
    score: float = 0.0
    metadata: dict = field(default_factory=dict)


def _get_qdrant_client():
    return get_qdrant_client()


def _query_phrase_patterns(query: str):
    """Keep the leading subject (e.g. 'chất xơ') ahead of background disease terms."""
    import re
    import unicodedata

    text = unicodedata.normalize("NFC", query).lower().strip()
    phrases = [text, " ".join(text.split()[:2])]
    return [re.compile(rf"(?<!\w){re.escape(phrase)}(?!\w)") for phrase in phrases if phrase]


def retrieve_foods(
    query: str,
    top_k: int = 10,
    category_filter: str | None = None,
    exclude_tags: list[str] | None = None,
    client=None,
) -> list[RetrievedChunk]:
    """Retrieve food items relevant to a query.

    Args:
        query: Search query (e.g. "món ăn ít carb cho tiểu đường")
        top_k: Number of results to return
        category_filter: Filter by food category (e.g. "rau", "thit")
        exclude_tags: Exclude foods with these tags (e.g. ["allergen-shellfish"])
        client: Optional Qdrant client
    """
    if _keyword_mode():
        return _bm25_search(
            query, "food_items", top_k,
            category_filter=category_filter, exclude_tags=exclude_tags,
        )
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue
    except ImportError as exc:
        logger.warning("Qdrant food_items skipped: %s", exc)
        return []

    client = client or _get_qdrant_client()
    if client is None:
        return []
    query_vectors = _query_vectors(query)
    if query_vectors is None:
        return _bm25_search(
            query, "food_items", top_k,
            category_filter=category_filter, exclude_tags=exclude_tags,
        )
    if not query_vectors:
        return []

    qdrant_filter = None
    if category_filter:
        qdrant_filter = Filter(
            must=[FieldCondition(key="category", match=MatchValue(value=category_filter))]
        )

    try:
        res = client.query_points(
            collection_name="food_items",
            query=query_vectors[0],
            query_filter=qdrant_filter,
            limit=top_k * 2 if exclude_tags else top_k,
        )
    except Exception as exc:
        logger.warning("Qdrant food_items query failed (%s). Run indexer first.", exc)
        return []

    chunks = []
    for pt in res.points:
        payload = pt.payload or {}
        chunk_id = payload.get("doc_id", str(pt.id))
        doc_text = payload.get("text", "")
        score = pt.score
        source = payload.get("source", "food_db_vn")

        if exclude_tags:
            item_tags = payload.get("tags", "")
            if any(tag in item_tags for tag in exclude_tags):
                continue

        chunks.append(RetrievedChunk(
            chunk_id=chunk_id,
            text=doc_text,
            source=source,
            score=score,
            metadata=payload,
        ))
        if len(chunks) >= top_k:
            break

    return chunks


def retrieve_guidelines(
    query: str,
    top_k: int = 5,
    source_filter: str | None = None,
    client=None,
) -> list[RetrievedChunk]:
    """Retrieve guideline chunks relevant to a query.

    Args:
        query: Search query (e.g. "chế độ ăn cho bệnh nhân tiểu đường type 2")
        top_k: Number of results
        source_filter: Filter by guideline source (e.g. "ada_diabetes")
        client: Optional Qdrant client
    """
    if _keyword_mode():
        return _bm25_search(query, "guidelines", top_k, source_filter=source_filter)
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue
    except ImportError as exc:
        logger.warning("Qdrant guidelines skipped: %s", exc)
        return []

    client = client or _get_qdrant_client()
    if client is None:
        return []
    query_vectors = _query_vectors(query)
    if query_vectors is None:
        return _bm25_search(query, "guidelines", top_k, source_filter=source_filter)
    if not query_vectors:
        return []

    qdrant_filter = None
    if source_filter:
        qdrant_filter = Filter(
            must=[FieldCondition(key="source", match=MatchValue(value=source_filter))]
        )

    try:
        res = client.query_points(
            collection_name="guidelines",
            query=query_vectors[0],
            query_filter=qdrant_filter,
            limit=top_k,
        )
    except Exception as exc:
        logger.warning("Qdrant guidelines query failed (%s). Run indexer first.", exc)
        return []

    chunks = []
    for pt in res.points:
        payload = pt.payload or {}
        chunk_id = payload.get("chunk_id", str(pt.id))
        doc_text = payload.get("text", "")
        source = payload.get("source", "")
        score = pt.score

        chunks.append(RetrievedChunk(
            chunk_id=chunk_id,
            text=doc_text,
            source=source,
            score=score,
            metadata=payload,
        ))

    return chunks


@lru_cache(maxsize=256)
def _retrieve_hybrid_cached(
    query: str,
    top_k: int = 10,
    collection_name: str = "food_items",
) -> list[RetrievedChunk]:
    """Cached internal helper for hybrid retrieval."""
    return _retrieve_hybrid_uncached(query, top_k, collection_name)


def _retrieve_hybrid_uncached(
    query: str,
    top_k: int = 10,
    collection_name: str = "food_items",
    client=None,
) -> list[RetrievedChunk]:
    if _keyword_mode():
        return _bm25_search(query, collection_name, top_k)
    # Dense retrieval
    if collection_name == "food_items":
        dense_results = retrieve_foods(query, top_k=top_k * 2, client=client)
    else:
        dense_results = retrieve_guidelines(query, top_k=top_k * 2, client=client)

    # BM25 keyword retrieval
    bm25_results = _bm25_search(query, collection_name, top_k=top_k * 2)

    # Reciprocal Rank Fusion
    fused = _reciprocal_rank_fusion(dense_results, bm25_results, k=60)
    patterns = _query_phrase_patterns(query)
    fused.sort(key=lambda chunk: tuple(bool(p.search(chunk.text.lower())) for p in patterns), reverse=True)
    return fused[:top_k]


def retrieve_hybrid(
    query: str,
    top_k: int = 10,
    collection_name: str = "food_items",
    client=None,
) -> list[RetrievedChunk]:
    """Hybrid retrieval combining dense (Qdrant) + BM25 keyword matching with RRF.

    Uses caching when client is None to improve performance.
    """
    if client is None:
        return _retrieve_hybrid_cached(query, top_k, collection_name)
    return _retrieve_hybrid_uncached(query, top_k, collection_name, client=client)


def _bm25_search(
    query: str,
    collection_name: str,
    top_k: int = 20,
    *,
    category_filter: str | None = None,
    exclude_tags: list[str] | None = None,
    source_filter: str | None = None,
) -> list[RetrievedChunk]:
    """Simple BM25 keyword search over the raw data files."""
    try:
        from rank_bm25 import BM25L
        from unidecode import unidecode
    except ImportError:
        logger.debug("rank_bm25 or unidecode not installed, skipping BM25")
        return []

    # Load documents based on collection
    documents = []
    if collection_name == "food_items":
        food_db_path = _BACKEND_DIR / "data" / "food_db_vn.json"
        if not food_db_path.exists():
            return []
        with open(food_db_path, encoding="utf-8") as f:
            foods = json.load(f)
        for food in foods:
            if category_filter and food.get("category") != category_filter:
                continue
            if exclude_tags and any(tag in food.get("tags", []) for tag in exclude_tags):
                continue
            aliases_str = ", ".join(food.get("aliases", []))
            macros = food.get("macros", {})
            doc_text = (
                f"{food['name']} {aliases_str}. Phân loại: {food.get('category', '')}. "
                f"Khẩu phần: {food.get('portion', '')}. Năng lượng: {food.get('kcal', 0)} kcal. "
                f"Carb: {macros.get('carb_g', 0)}g, Protein: {macros.get('protein_g', 0)}g, "
                f"Fat: {macros.get('fat_g', 0)}g, Sodium: {macros.get('sodium_mg', 0)}mg. "
                f"Tags: {', '.join(food.get('tags', []))}."
            )
            documents.append({
                "id": food["id"],
                "text": doc_text,
                "source": "food_db_vn",
                "metadata": food,
            })
    else:
        from app.rag.indexer import _chunk_markdown
        guidelines_dir = _BACKEND_DIR / "data" / "guidelines"
        if not guidelines_dir.exists():
            return []
        for md_file in sorted(guidelines_dir.glob("*.md")):
            if source_filter and source_filter not in (md_file.stem, md_file.name):
                continue
            text = md_file.read_text(encoding="utf-8")
            chunks = _chunk_markdown(text, md_file.stem)
            for c in chunks:
                documents.append({
                    "id": c["id"],
                    "text": c["text"],
                    "source": c["source"],
                })

    if not documents:
        return []

    # Tokenize
    def tokenize(text: str) -> list[str]:
        normalized = unidecode(text.lower())
        return normalized.split()

    corpus = [tokenize(doc["text"]) for doc in documents]
    # Positive IDF also works when a source/category filter leaves one document.
    bm25 = BM25L(corpus)

    query_tokens = tokenize(query)
    scores = bm25.get_scores(query_tokens)

    # Accent folding makes "cà" match "cá". Prefer the actual queried phrase
    # before BM25 scores; otherwise prenatal/fish documents can outrank tomatoes.
    patterns = _query_phrase_patterns(query)
    scored_docs = sorted(
        zip(documents, scores),
        key=lambda x: (*[bool(p.search(x[0]["text"].lower())) for p in patterns], x[1]),
        reverse=True,
    )

    results = []
    for doc, score in scored_docs[:top_k]:
        if score > 0:
            text = doc["text"]
            match = next((match for pattern in patterns if (match := pattern.search(text.lower()))), None)
            if match and match.end() > 450:
                start = max(0, match.start() - 150)
                text = text[start:start + max(500, len(query) + 250)]
            results.append(RetrievedChunk(
                chunk_id=doc["id"],
                text=text[:max(500, len(query) + 250)],
                source=doc["source"],
                score=float(score),
                metadata=doc.get("metadata", {}),
            ))

    return results


def _reciprocal_rank_fusion(
    *result_lists: list[RetrievedChunk],
    k: int = 60,
) -> list[RetrievedChunk]:
    """Merge multiple ranked lists using Reciprocal Rank Fusion (RRF).

    RRF score = sum(1 / (k + rank_i)) for each list where the doc appears.
    """
    doc_scores: dict[str, float] = {}
    doc_map: dict[str, RetrievedChunk] = {}

    for result_list in result_lists:
        for rank, chunk in enumerate(result_list):
            rrf_score = 1.0 / (k + rank + 1)
            doc_scores[chunk.chunk_id] = doc_scores.get(chunk.chunk_id, 0) + rrf_score
            if chunk.chunk_id not in doc_map:
                doc_map[chunk.chunk_id] = chunk

    sorted_ids = sorted(doc_scores, key=lambda x: doc_scores[x], reverse=True)

    results = []
    for doc_id in sorted_ids:
        chunk = doc_map[doc_id]
        chunk.score = doc_scores[doc_id]
        results.append(chunk)

    return results
