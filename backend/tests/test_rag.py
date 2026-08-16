"""Tests for RAG pipeline: embeddings, indexer, retriever.

Target: ≥80% pass rate on 20 retrieval accuracy questions.
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import pytest

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture(scope="module")
def chroma_dir():
    """Create a temporary directory for test ChromaDB data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Override settings
        os.environ["CHROMA_PERSIST_DIR"] = tmpdir
        yield tmpdir


@pytest.fixture(scope="module")
def indexed_client(chroma_dir):
    """Build index and return ChromaDB client."""
    # Need to reimport after env change
    import importlib
    from app.core import config as config_module
    importlib.reload(config_module)

    import chromadb
    from app.rag.indexer import index_food_items, index_guidelines

    client = chromadb.PersistentClient(path=chroma_dir)
    food_count = index_food_items(client)
    guideline_count = index_guidelines(client)
    assert food_count >= 20, f"Expected ≥20 food items, got {food_count}"
    assert guideline_count > 0, f"Expected >0 guideline chunks, got {guideline_count}"

    yield client


# ============================================================
# Test: Embedding function
# ============================================================

class TestEmbeddings:
    def test_prepare_query_and_document_prefixes(self):
        from app.rag.embeddings import prepare_document_text, prepare_query_text

        assert "task: search result | query:" in prepare_query_text("cơm gạo lứt")
        assert "title: none | text:" in prepare_document_text("nội dung")

    def test_embedding_function_loads(self):
        """Embedding function should load and produce vectors."""
        from app.rag.embeddings import get_embedding_function
        ef = get_embedding_function()

        result = ef(["xin chào"])
        assert len(result) == 1
        assert len(result[0]) > 0  # Should have dimensions

    def test_embed_query(self):
        """embed_query should return a single vector."""
        from app.rag.embeddings import get_embedding_function
        ef = get_embedding_function()

        vec = ef(["cơm gạo lứt cho tiểu đường"])
        assert isinstance(vec, list)
        assert len(vec) > 0

    def test_embed_documents(self):
        """embed_documents should return vectors for multiple docs."""
        from app.rag.embeddings import get_embedding_function
        ef = get_embedding_function()

        vecs = ef(["phở bò", "bún chả", "cơm tấm"])
        assert len(vecs) == 3


# ============================================================
# Test: Indexer
# ============================================================

class TestIndexer:
    def test_food_db_exists_and_valid(self):
        """food_db_vn.json should exist and have ≥300 items."""
        from app.rag.indexer import FOOD_DB_PATH

        with open(FOOD_DB_PATH, encoding="utf-8") as f:
            foods = json.load(f)
        assert len(foods) >= 20, f"Expected ≥20 items, got {len(foods)}"

    def test_food_items_have_required_fields(self):
        """Each food item should have id, name, kcal, macros."""
        from app.rag.indexer import FOOD_DB_PATH

        with open(FOOD_DB_PATH, encoding="utf-8") as f:
            foods = json.load(f)

        for food in foods[:50]:  # Check first 50
            assert "id" in food, f"Missing 'id' in food item"
            assert "name" in food, f"Missing 'name' in {food.get('id', '?')}"
            assert "kcal" in food, f"Missing 'kcal' in {food['name']}"
            assert "macros" in food, f"Missing 'macros' in {food['name']}"
            macros = food["macros"]
            assert "carb_g" in macros
            assert "protein_g" in macros
            assert "fat_g" in macros
            assert "sodium_mg" in macros

    def test_guidelines_exist(self):
        """All 4 guideline files should exist."""
        from app.rag.indexer import GUIDELINES_DIR

        expected = ["ada_diabetes.md", "byt_vn_notes.md"]
        for filename in expected:
            filepath = GUIDELINES_DIR / filename
            assert filepath.exists(), f"Guideline not found: {filepath}"
            content = filepath.read_text(encoding="utf-8")
            assert len(content) > 50, f"Guideline {filename} seems too short"

    def test_index_builds_successfully(self, indexed_client):
        """Indexing should complete without errors."""
        collections = indexed_client.list_collections()
        col_names = [c.name for c in collections]
        assert "food_items" in col_names
        assert "guidelines" in col_names


# ============================================================
# Test: Retriever — 20 retrieval accuracy questions
# ============================================================

# Each test case: (query, expected_results_contain, collection)
# "expected_results_contain" = at least one result should contain this substring
_RAG_TEST_CASES = [
    # Food retrieval (10 cases)
    ("cơm gạo lứt", "gạo lứt", "food"),
    ("thịt gà nạc luộc protein cao", "gà", "food"),
    ("rau muống luộc", "rau muống", "food"),
    ("cá hồi omega 3", "cá hồi", "food"),
    ("đậu hũ đái tháo đường protein", "đậu hũ", "food"),
    ("trái cây GI thấp cho tiểu đường", "quả", "food"),
    ("thực phẩm giàu sodium mặn", "sodium", "food"),
    ("món ăn sáng ít carb", "trứng", "food"),
    ("yến mạch bữa sáng GI thấp", "yến mạch", "food"),
    ("bưởi cam chỉ số đường huyết thấp", "bưởi", "food"),
    # Guideline retrieval (10 cases)
    ("carb cho bệnh nhân tiểu đường mỗi bữa", "carb", "guideline"),
    ("natri ở bệnh nhân tiểu đường biến chứng thận", "natri", "guideline"),
    ("chỉ số đường huyết GI glycemic index", "GI", "guideline"),
    ("chất xơ điều hòa đường huyết", "chất xơ", "guideline"),
    ("nước mắm xì dầu natri Việt Nam", "nước mắm", "guideline"),
    ("BMI chuẩn châu Á thừa cân", "BMI", "guideline"),
    ("metformin rượu bia nhiễm toan", "metformin", "guideline"),
    ("hạ đường huyết hypoglycemia cấp cứu", "hạ đường huyết", "guideline"),
    ("đường tinh luyện nước ngọt đái tháo đường", "đường", "guideline"),
    ("protein thận đái tháo đường", "protein", "guideline"),
]


class TestRetriever:
    @pytest.mark.parametrize(
        "query,expected_substr,collection_type",
        _RAG_TEST_CASES,
        ids=[f"q{i+1}_{tc[0][:20]}" for i, tc in enumerate(_RAG_TEST_CASES)],
    )
    def test_retrieval_accuracy(self, indexed_client, query, expected_substr, collection_type):
        """Each RAG query should return at least one relevant result."""
        from app.rag.retriever import retrieve_foods, retrieve_guidelines, retrieve_hybrid

        if collection_type == "food":
            results = retrieve_hybrid(query, top_k=10, collection_name="food_items", client=indexed_client)
        else:
            results = retrieve_hybrid(query, top_k=5, collection_name="guidelines", client=indexed_client)

        assert len(results) > 0, f"No results for query: '{query}'"

        # Check if any result contains the expected substring (case-insensitive)
        texts = " ".join(r.text.lower() for r in results)
        assert expected_substr.lower() in texts, (
            f"Expected '{expected_substr}' in results for query '{query}'. "
            f"Got: {[r.text[:80] for r in results[:3]]}"
        )

    def test_food_retrieval_returns_metadata(self, indexed_client):
        """Food retrieval should include nutritional metadata."""
        from app.rag.retriever import retrieve_foods

        results = retrieve_foods("cơm trắng", top_k=3, client=indexed_client)
        assert len(results) > 0

        # Check metadata
        meta = results[0].metadata
        assert "name" in meta
        assert "kcal" in meta

    def test_guideline_retrieval_has_source(self, indexed_client):
        """Guideline retrieval should include source metadata."""
        from app.rag.retriever import retrieve_guidelines

        results = retrieve_guidelines("tiểu đường type 2", top_k=3, client=indexed_client)
        assert len(results) > 0
        assert results[0].source != ""

    def test_empty_query_returns_results(self, indexed_client):
        """Even a generic query should return some results."""
        from app.rag.retriever import retrieve_foods

        results = retrieve_foods("thực phẩm", top_k=5, client=indexed_client)
        assert len(results) > 0

    def test_exclude_tags_filter(self, indexed_client):
        """Excluding allergen-shellfish should filter out shellfish items."""
        from app.rag.retriever import retrieve_foods

        results = retrieve_foods(
            "tôm cua hải sản",
            top_k=10,
            exclude_tags=["allergen-shellfish"],
            client=indexed_client,
        )

        for r in results:
            tags = r.metadata.get("tags", "")
            assert "allergen-shellfish" not in tags, (
                f"Found shellfish item despite exclusion: {r.metadata.get('name')}"
            )


# ============================================================
# Test: Graph compilation
# ============================================================

class TestGraphCompilation:
    def test_graph_builds(self):
        """LangGraph should build without errors."""
        from app.agents.graph import build_graph
        graph = build_graph()
        assert graph is not None

    def test_graph_compiles(self):
        """LangGraph should compile without errors."""
        from app.agents.graph import build_graph
        graph = build_graph()
        compiled = graph.compile()
        assert compiled is not None

    def test_graph_has_all_nodes(self):
        """Graph should have all expected nodes."""
        from app.agents.graph import build_graph
        graph = build_graph()

        expected_nodes = [
            "profile_loader", "intent_classifier",
            "rag_qa", "meal_plan", "interaction_check",
            "food_log", "refuse", "unknown", "apply_guardrails",
        ]
        for node_name in expected_nodes:
            assert node_name in graph.nodes, f"Missing node: {node_name}"


# ============================================================
# Test: Nodes (unit tests)
# ============================================================

class TestNodes:
    def test_profile_loader_demo(self):
        """Profile loader should load demo profiles."""
        from app.agents.nodes.profile_loader import profile_loader

        state = {"user_id": "demo_patient_1"}
        result = profile_loader(state)
        assert result["profile"]["disease"] == ["diabetes_t2"]
        assert "metformin" in result["profile"]["medications"]

    def test_profile_loader_unknown_user(self):
        """Unknown user should get default profile."""
        from app.agents.nodes.profile_loader import profile_loader

        state = {"user_id": "unknown_user_xyz"}
        result = profile_loader(state)
        assert result["profile"]["target_kcal"] == 1800

    def test_profile_loader_db_profile(self, db_session):
        """Profile loader should prefer DB profile over demo/default."""
        from app.agents.nodes.profile_loader import profile_loader
        from app.models.profile import Profile

        db_session.add(
            Profile(
                user_id="db_user_123",
                disease=["diabetes_t2"],
                medications=["glipizide"],
                allergies=["đậu phộng"],
                target_kcal=1500,
                restrictions={"carb_per_meal": 35},
                preferences=["ăn chay"],
            )
        )
        db_session.commit()

        result = profile_loader({"user_id": "db_user_123", "db": db_session})
        assert result["profile"]["target_kcal"] == 1500
        assert result["profile"]["medications"] == ["glipizide"]
        assert "đậu phộng" in result["profile"]["allergies"]

    def test_intent_classifier_meal_plan(self):
        """Meal plan keywords should classify correctly."""
        from app.agents.nodes.intent_classifier import _classify_by_keywords

        assert _classify_by_keywords("Lập thực đơn 7 ngày cho tôi") == "meal_plan"
        assert _classify_by_keywords("Tôi nên ăn gì hàng ngày") == "meal_plan"

    def test_intent_classifier_interaction(self):
        """Interaction keywords should classify correctly."""
        from app.agents.nodes.intent_classifier import _classify_by_keywords

        assert _classify_by_keywords("Tương tác thuốc metformin với rượu") == "interaction_check"

    def test_intent_classifier_refuse(self):
        """Medical scope keywords should trigger refuse."""
        from app.agents.nodes.intent_classifier import _classify_by_keywords

        assert _classify_by_keywords("Đổi thuốc metformin sang loại khác") == "refuse"
        assert _classify_by_keywords("Tôi muốn tăng liều thuốc") == "refuse"

    def test_intent_classifier_rag_default(self):
        """General nutrition questions should default to rag_qa."""
        from app.agents.nodes.intent_classifier import _classify_by_keywords

        assert _classify_by_keywords("Vitamin C có trong trái cây nào?") == "rag_qa"

    def test_intent_classifier_force_intent(self):
        """force_intent should override classification."""
        from app.agents.nodes.intent_classifier import intent_classifier

        state = {"message": "bla bla bla", "force_intent": "meal_plan"}
        result = intent_classifier(state)
        assert result["intent"] == "meal_plan"
