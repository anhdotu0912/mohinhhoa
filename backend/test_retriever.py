"""Manual debug script: index + retrieve against an in-memory Qdrant client.

Usage: python test_retriever.py (run from backend/)
"""

import traceback

import qdrant_client
from app.rag.indexer import index_food_items
from app.rag.retriever import retrieve_foods

client = qdrant_client.QdrantClient(":memory:")  # ephemeral
print("Indexing...")
index_food_items(client)
print("Collections:", client.get_collections().collections)
try:
    retrieve_foods("cơm", client=client)
    print("Retrieve success!")
except Exception:
    print("Retrieve failed:")
    traceback.print_exc()
