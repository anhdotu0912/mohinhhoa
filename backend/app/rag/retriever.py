"""Retriever module for RAG: query food items and guidelines from ChromaDB.

Supports:
  - Dense retrieval via sentence-transformer embeddings
  - BM25 fallback for keyword matching
  - Hybrid fusion of both
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

import chromadb

from app.core.config import settings
from app.rag.embeddings import get_embedding_function

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


def _get_chroma_client() -> chromadb.ClientAPI:
    persist_dir = os.path.join(_BACKEND_DIR, settings.CHROMA_PERSIST_DIR)
    return chromadb.PersistentClient(path=persist_dir)


def retrieve_foods(
    query: str,
    top_k: int = 10,
    category_filter: str | None = None,
    exclude_tags: list[str] | None = None,
    client: chromadb.ClientAPI | None = None,
) -> list[RetrievedChunk]:
    """Retrieve food items relevant to a query.

    Args:
        query: Search query (e.g. "món ăn ít carb cho tiểu đường")
        top_k: Number of results to return
        category_filter: Filter by food category (e.g. "rau", "thit")
        exclude_tags: Exclude foods with these tags (e.g. ["allergen-shellfish"])
        client: Optional ChromaDB client
    """
    client = client or _get_chroma_client()
    ef = get_embedding_function()

    try:
        collection = client.get_collection("food_items", embedding_function=ef)
    except Exception:
        logger.warning("food_items collection not found. Run indexer first.")
        return []

    where_filter = None
    if category_filter:
        where_filter = {"category": {"$eq": category_filter}}

    results = collection.query(
        query_texts=[query],
        n_results=top_k,
        where=where_filter,
    )

    chunks = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            doc_text = results["documents"][0][i] if results["documents"] else ""
            distance = results["distances"][0][i] if results["distances"] else 1.0

            # ChromaDB returns distance (lower=better); convert to score
            score = max(0, 1 - distance)

            # Apply tag exclusion post-query
            if exclude_tags:
                item_tags = meta.get("tags", "")
                if any(tag in item_tags for tag in exclude_tags):
                    continue

            chunks.append(RetrievedChunk(
                chunk_id=doc_id,
                text=doc_text,
                source=meta.get("source", "food_db_vn"),
                score=score,
                metadata=meta,
            ))

    return chunks


def retrieve_guidelines(
    query: str,
    top_k: int = 5,
    source_filter: str | None = None,
    client: chromadb.ClientAPI | None = None,
) -> list[RetrievedChunk]:
    """Retrieve guideline chunks relevant to a query.

    Args:
        query: Search query (e.g. "chế độ ăn cho bệnh nhân tiểu đường type 2")
        top_k: Number of results
        source_filter: Filter by guideline source (e.g. "ada_diabetes")
        client: Optional ChromaDB client
    """
    client = client or _get_chroma_client()
    ef = get_embedding_function()

    try:
        collection = client.get_collection("guidelines", embedding_function=ef)
    except Exception:
        logger.warning("guidelines collection not found. Run indexer first.")
        return []

    where_filter = None
    if source_filter:
        where_filter = {"source": {"$eq": source_filter}}

    results = collection.query(
        query_texts=[query],
        n_results=top_k,
        where=where_filter,
    )

    chunks = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            doc_text = results["documents"][0][i] if results["documents"] else ""
            distance = results["distances"][0][i] if results["distances"] else 1.0
            score = max(0, 1 - distance)

            chunks.append(RetrievedChunk(
                chunk_id=doc_id,
                text=doc_text,
                source=meta.get("source", ""),
                score=score,
                metadata=meta,
            ))

    return chunks


def retrieve_hybrid(
    query: str,
    top_k: int = 10,
    collection_name: str = "food_items",
    client: chromadb.ClientAPI | None = None,
) -> list[RetrievedChunk]:
    """Hybrid retrieval combining dense (ChromaDB) + BM25 keyword matching.

    Uses reciprocal rank fusion (RRF) to merge results.
    """
    # Dense retrieval
    if collection_name == "food_items":
        dense_results = retrieve_foods(query, top_k=top_k * 2, client=client)
    else:
        dense_results = retrieve_guidelines(query, top_k=top_k * 2, client=client)

    # BM25 keyword retrieval
    bm25_results = _bm25_search(query, collection_name, top_k=top_k * 2)

    # Reciprocal Rank Fusion
    fused = _reciprocal_rank_fusion(dense_results, bm25_results, k=60)

    return fused[:top_k]


def _bm25_search(
    query: str,
    collection_name: str,
    top_k: int = 20,
) -> list[RetrievedChunk]:
    """Simple BM25 keyword search over the raw data files."""
    try:
        from rank_bm25 import BM25Okapi
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
            aliases_str = ", ".join(food.get("aliases", []))
            doc_text = f"{food['name']} {aliases_str} {food.get('category', '')} {' '.join(food.get('tags', []))}"
            documents.append({
                "id": food["id"],
                "text": doc_text,
                "source": "food_db_vn",
            })
    else:
        guidelines_dir = _BACKEND_DIR / "data" / "guidelines"
        if not guidelines_dir.exists():
            return []
        for md_file in sorted(guidelines_dir.glob("*.md")):
            text = md_file.read_text(encoding="utf-8")
            documents.append({
                "id": md_file.stem,
                "text": text[:2000],  # truncate for BM25
                "source": md_file.stem,
            })

    if not documents:
        return []

    # Tokenize
    def tokenize(text: str) -> list[str]:
        normalized = unidecode(text.lower())
        return normalized.split()

    corpus = [tokenize(doc["text"]) for doc in documents]
    bm25 = BM25Okapi(corpus)

    query_tokens = tokenize(query)
    scores = bm25.get_scores(query_tokens)

    # Sort by score
    scored_docs = sorted(
        zip(documents, scores),
        key=lambda x: x[1],
        reverse=True,
    )

    results = []
    for doc, score in scored_docs[:top_k]:
        if score > 0:
            results.append(RetrievedChunk(
                chunk_id=doc["id"],
                text=doc["text"][:500],
                source=doc["source"],
                score=float(score),
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
