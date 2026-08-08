from app.rag.indexer import index_food_items
from app.rag.retriever import retrieve_foods
import chromadb
from app.rag.embeddings import get_embedding_function
import traceback

client = chromadb.Client() # ephemeral
print("Indexing...")
index_food_items(client)
print("Collections:", client.list_collections())
try:
    retrieve_foods("cơm", client=client)
    print("Retrieve success!")
except Exception as e:
    print("Retrieve failed:")
    traceback.print_exc()

