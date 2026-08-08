"""Index food database and guidelines into ChromaDB collections.

Collections:
  - food_items: each food item as a document
  - guidelines: chunked guideline sections
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path

import chromadb

from app.core.config import settings
from app.rag.embeddings import get_embedding_function

logger = logging.getLogger(__name__)

# Resolve data directory relative to backend/
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = _BACKEND_DIR / "data"
GUIDELINES_DIR = DATA_DIR / "guidelines"
FOOD_DB_PATH = DATA_DIR / "food_db_vn.json"


def _get_chroma_client() -> chromadb.ClientAPI:
    """Return a persistent ChromaDB client."""
    persist_dir = os.path.join(_BACKEND_DIR, settings.CHROMA_PERSIST_DIR)
    return chromadb.PersistentClient(path=persist_dir)


def _chunk_markdown(text: str, source: str, max_chunk_size: int = 800) -> list[dict]:
    """Split markdown into section-based chunks.

    Each chunk keeps its heading hierarchy for context.
    """
    chunks = []
    # Split by headings (## or ###)
    sections = re.split(r'\n(?=##\s)', text)

    current_chunk = ""
    chunk_idx = 0

    for section in sections:
        section = section.strip()
        if not section:
            continue

        if len(current_chunk) + len(section) > max_chunk_size and current_chunk:
            chunks.append({
                "id": f"{source}_chunk_{chunk_idx}",
                "text": current_chunk.strip(),
                "source": source,
            })
            chunk_idx += 1
            current_chunk = section
        else:
            current_chunk = current_chunk + "\n\n" + section if current_chunk else section

    if current_chunk.strip():
        chunks.append({
            "id": f"{source}_chunk_{chunk_idx}",
            "text": current_chunk.strip(),
            "source": source,
        })

    return chunks


def index_food_items(client: chromadb.ClientAPI | None = None) -> int:
    """Index food_db_vn.json into ChromaDB 'food_items' collection.

    Returns number of items indexed.
    """
    client = client or _get_chroma_client()
    ef = get_embedding_function()

    # Delete existing collection if present
    try:
        client.delete_collection("food_items")
    except Exception:
        pass

    collection = client.create_collection(
        name="food_items",
        embedding_function=ef,
        metadata={"description": "Vietnamese food items with nutrition data"},
    )

    if not FOOD_DB_PATH.exists():
        logger.warning("Food DB not found at %s", FOOD_DB_PATH)
        return 0

    with open(FOOD_DB_PATH, encoding="utf-8") as f:
        foods = json.load(f)

    ids = []
    documents = []
    metadatas = []

    for food in foods:
        food_id = food["id"]
        # Build a searchable document string
        aliases_str = ", ".join(food.get("aliases", []))
        tags_str = ", ".join(food.get("tags", []))
        macros = food.get("macros", {})
        doc = (
            f"{food['name']} ({aliases_str}). "
            f"Phân loại: {food.get('category', '')}. "
            f"Khẩu phần: {food.get('portion', '')}. "
            f"Năng lượng: {food.get('kcal', 0)} kcal. "
            f"Carb: {macros.get('carb_g', 0)}g, Protein: {macros.get('protein_g', 0)}g, "
            f"Fat: {macros.get('fat_g', 0)}g, Sodium: {macros.get('sodium_mg', 0)}mg. "
            f"Tags: {tags_str}."
        )

        ids.append(food_id)
        documents.append(doc)
        metadatas.append({
            "name": food["name"],
            "category": food.get("category", ""),
            "kcal": food.get("kcal", 0),
            "carb_g": macros.get("carb_g", 0),
            "protein_g": macros.get("protein_g", 0),
            "fat_g": macros.get("fat_g", 0),
            "sodium_mg": macros.get("sodium_mg", 0),
            "portion": food.get("portion", ""),
            "tags": tags_str,
            "source": "food_db_vn",
        })

    # ChromaDB has a max batch size; chunk if needed
    batch_size = 100
    for i in range(0, len(ids), batch_size):
        collection.add(
            ids=ids[i:i + batch_size],
            documents=documents[i:i + batch_size],
            metadatas=metadatas[i:i + batch_size],
        )

    logger.info("Indexed %d food items into ChromaDB", len(ids))
    return len(ids)


def index_guidelines(client: chromadb.ClientAPI | None = None) -> int:
    """Index guideline markdown files into ChromaDB 'guidelines' collection.

    Returns number of chunks indexed.
    """
    client = client or _get_chroma_client()
    ef = get_embedding_function()

    try:
        client.delete_collection("guidelines")
    except Exception:
        pass

    collection = client.create_collection(
        name="guidelines",
        embedding_function=ef,
        metadata={"description": "Medical nutrition guidelines"},
    )

    if not GUIDELINES_DIR.exists():
        logger.warning("Guidelines dir not found at %s", GUIDELINES_DIR)
        return 0

    all_chunks = []
    for md_file in sorted(GUIDELINES_DIR.glob("*.md")):
        source = md_file.stem  # e.g. "ada_diabetes"
        text = md_file.read_text(encoding="utf-8")
        chunks = _chunk_markdown(text, source)
        all_chunks.extend(chunks)

    if not all_chunks:
        return 0

    ids = [c["id"] for c in all_chunks]
    documents = [c["text"] for c in all_chunks]
    metadatas = [{"source": c["source"]} for c in all_chunks]

    batch_size = 100
    for i in range(0, len(ids), batch_size):
        collection.add(
            ids=ids[i:i + batch_size],
            documents=documents[i:i + batch_size],
            metadatas=metadatas[i:i + batch_size],
        )

    logger.info("Indexed %d guideline chunks into ChromaDB", len(ids))
    return len(ids)


def build_index() -> dict[str, int]:
    """Build all indexes. Returns counts per collection."""
    client = _get_chroma_client()
    food_count = index_food_items(client)
    guideline_count = index_guidelines(client)
    return {"food_items": food_count, "guidelines": guideline_count}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = build_index()
    print(f"Indexing complete: {result}")
