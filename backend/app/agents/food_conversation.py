"""Grounded food conversations from local catalogs, including when no LLM is configured."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from unidecode import unidecode

from app.core.chat_text import normalize_chat_text

_ROOT = Path(__file__).resolve().parents[3]
_ALIASES = {"gạo trắng": "Gạo tẻ máy", "dưa leo": "Dưa chuột", "đậu hũ": "Đậu phụ", "đậu hủ": "Đậu phụ"}
_GENERIC_COOKING = {
    "luộc": "Sơ chế và rửa nguyên liệu, cho vào nước đang sôi rồi nấu đến khi chín phù hợp với nguyên liệu; để ráo trước khi dùng.",
    "hấp": "Sơ chế nguyên liệu, đặt vào dụng cụ hấp và hấp đến khi chín phù hợp với từng nguyên liệu.",
    "nấu canh": "Sơ chế nguyên liệu; nấu phần cần lâu chín trước, thêm rau sau và nêm theo khẩu vị.",
    "xào ít dầu": "Sơ chế nguyên liệu, làm nóng chảo với lượng dầu phù hợp rồi xào đến khi chín; tránh để nguyên liệu cháy.",
}


@lru_cache(maxsize=1)
def food_catalog() -> list[dict]:
    path = _ROOT / "data/clean/foods.sample.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


@lru_cache(maxsize=1)
def recipe_catalog() -> list[dict]:
    path = _ROOT / "data/clean/recipes.sample.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


@lru_cache(maxsize=1)
def _foods_by_id() -> dict[str, dict]:
    return {food["_id"]: food for food in food_catalog()}


def _contains(text: str, phrase: str) -> bool:
    return bool(re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", text))


@lru_cache(maxsize=1)
def _food_aliases() -> list[tuple[str, dict]]:
    entries: list[tuple[str, dict]] = []
    by_name = {row["name"]["vi"].lower(): row for row in food_catalog()}
    for row in food_catalog():
        for alias in [row["name"]["vi"], *row["name"].get("aliases", [])]:
            if isinstance(alias, str) and len(alias.strip()) >= 2:
                entries.append((alias.lower().strip(), row))
    for alias, name in _ALIASES.items():
        if name.lower() in by_name:
            entries.append((alias, by_name[name.lower()]))
    return sorted(entries, key=lambda item: len(item[0]), reverse=True)


def mentioned_foods(message: str) -> list[dict]:
    """Match longest food names first; preserve accents before allowing unaccented input."""
    text = normalize_chat_text(message)
    hits: list[tuple[int, int, dict]] = []
    for folded in (False, True):
        search = unidecode(text) if folded else text
        for alias, row in _food_aliases():
            term = unidecode(alias) if folded else alias
            if folded and len(term) < 4:
                continue
            for match in re.finditer(rf"(?<!\w){re.escape(term)}(?!\w)", search):
                original = text[match.start():match.end()]
                if folded and original != unidecode(original) and original != alias:
                    continue
                if any(match.start() < end and match.end() > start for start, end, _ in hits):
                    continue
                hits.append((match.start(), match.end(), row))
    found: dict[str, dict] = {}
    for _, _, row in sorted(hits, key=lambda item: item[0]):
        found.setdefault(row["_id"], row)
    return list(found.values())[:4]


def food_topic(message: str) -> str | None:
    text = normalize_chat_text(message)
    if re.search(r"bảo quản|để.*(?:mấy|bao nhiêu).*ngày|tủ lạnh|cấp đông|rã đông|hết hạn", text):
        return "storage"
    if re.search(r"không thích|không ăn|ăn chay|dị ứng|kiêng", text) and not re.search(r"được không|có sao không|thuốc", text) and (
        mentioned_foods(text) or re.search(r"gợi ý|công thức|thay món|ăn chay|thịt bò|hải sản", text)
    ):
        return "preference"
    if re.search(r"thay (?:bằng|món|nguyên liệu)|đổi món|thay thế|thay .* bằng", text):
        return "substitution"
    if re.search(r"so sánh|so với|khác nhau|(?:hay|với|và).*(?:tốt hơn|ít hơn|nhiều hơn|ít.*hơn)|cái nào", text):
        return "comparison"
    if re.search(r"cách (?:nấu|làm|chế biến|luộc|hấp|xào|kho|nướng)|(?:nấu|luộc|hấp|xào|kho|nướng).*(?:sao|nào|gì)|làm.*món|chế biến|công thức|gợi ý món|món.*(?:dễ|rẻ)|(?:chỉ có|có sẵn).*?(?:ăn|nấu|món)|nguyên liệu", text):
        return "recipe"
    if re.search(r"calo|kcal|dinh dưỡng|bao nhiêu.*(?:đạm|carb)|ăn bao nhiêu|khẩu phần|chất xơ|protein|carb|chất béo", text):
        return "nutrition"
    if mentioned_foods(text) and re.search(r"là gì|có gì|chứa gì|nhiều đạm|ít đạm|nhiều đường|ít đường|có tốt|có bổ|béo không", text):
        return "nutrition"
    if re.search(r"(?:nó|món đó|loại đó|cái đó|thứ đó|món này)", text):
        return "followup"
    return None


def resolve_food_followup(message: str, history: list[dict[str, str]]) -> str:
    text = normalize_chat_text(message)
    if mentioned_foods(text) or not re.search(r"\bnó\b|món đó|loại đó|cái đó|thứ đó|món này|^thế |^vậy |nấu sao|bao nhiêu calo|ăn bn", text):
        return message
    for turn in reversed(history):
        if turn.get("role") != "user" or normalize_chat_text(turn.get("content", "")) == text:
            continue
        foods = mentioned_foods(turn.get("content", ""))
        if len(foods) == 1 and not re.search(r"\b(?:và|hay|hoặc)\b", normalize_chat_text(turn.get("content", ""))):
            name = foods[0]["name"]["vi"]
            rewritten = re.sub(r"\bnó\b|món đó|loại đó|cái đó|thứ đó|món này", name, message, flags=re.IGNORECASE)
            if re.search(r"được không", normalize_chat_text(rewritten)) and not re.search(r"\b(?:ăn|uống)\b", normalize_chat_text(rewritten)):
                rewritten = "Ăn " + rewritten
            return rewritten if rewritten != message else f"{message}\nĐồ ăn đang được hỏi: {name}."
        if len(foods) > 1:
            break
    return message


def _result(answer: str, chunks: list[dict] | None = None, *, clarify: bool = False) -> dict:
    chunks = chunks or []
    return {"answer": answer, "rag_context": chunks, "citations": [c["source"] for c in chunks], "clarify": clarify}


def _food_chunk(row: dict) -> dict:
    basis = row.get("measurement", {}).get("basis_g")
    source = f"food_catalog_vn#{row['_id']}"
    facts = {key: value for key, value in row.get("nutrition_per_100g_edible", {}).items() if value is not None}
    return {"chunk_id": row["_id"], "source": source, "score": 1.0, "text": (
        f"{row['name']['vi']}; cơ sở: {basis}g phần ăn được; trạng thái: {row.get('classification', {}).get('ingredient_state')}; "
        f"dữ liệu: {json.dumps(facts, ensure_ascii=False)}; nguồn: {row.get('source', {}).get('name', 'catalog thực phẩm')}"
    )}


def _avoidances(profile: dict, history: list[dict], message: str) -> list[str]:
    terms = list(profile.get("allergies", [])) + list(profile.get("preferences", []))
    for text in [message, *profile.get("preferences", []), *(turn.get("content", "") for turn in history if turn.get("role") == "user")]:
        for pattern in (r"(?:không thích|không ăn|dị ứng|không dùng)\s+([^,.!?;\n]+)",):
            match = re.search(pattern, normalize_chat_text(text))
            if match:
                terms.extend(re.split(r"\s+và\s+", match.group(1)))
    return terms


def _safe_recipe(recipe: dict, profile: dict, avoided: list[str], vegetarian: bool, db=None) -> bool:
    from app.agents.skills.primitive_skills import check_allergy_match

    ingredients = [item["name_vi"] for item in recipe.get("ingredients", [])]
    if check_allergy_match(profile.get("allergies", []), ingredients):
        return False
    description = " ".join([recipe["name_vi"], *ingredients]).lower()
    for term in avoided:
        for food in mentioned_foods(term):
            if _contains(description, food["name"]["vi"].lower()):
                return False
        if _contains(description, term.lower()):
            return False
    if vegetarian:
        if re.search(r"\b(?:thịt|cá|tôm|cua|mực|gà|bò|lợn|heo|vịt|trứng|sữa|mỡ|bơ)\b", description):
            return False
        for item in recipe.get("ingredients", []):
            group = _foods_by_id().get(item.get("food_id"), {}).get("classification", {}).get("food_group", "")
            if group.startswith(("Thịt", "Thủy sản", "Trứng", "Sữa")):
                return False
    if profile.get("medications"):
        from app.agents.interaction_checker_agent import interaction_checker_agent
        from app.schemas.meal_plan import InteractionCheckInput

        checked = interaction_checker_agent(InteractionCheckInput(medications=profile["medications"], foods=ingredients), db=db)
        if any(item.severity in {"Nguy hiểm", "Cần chú ý"} for item in checked.interactions):
            return False
    return True


def answer_food_conversation(message: str, profile: dict, history: list[dict] | None = None, db=None) -> dict | None:
    """Return catalog-backed answers or a factual-claim-free clarification; no LLM required."""
    topic = food_topic(message)
    foods = mentioned_foods(message)
    if topic is None:
        if foods and not re.search(r"thuốc|metformin|insulin|warfarin|tương tác", normalize_chat_text(message)):
            names = ", ".join(food["name"]["vi"] for food in foods)
            return _result(f"Tôi chưa có dữ liệu phù hợp để kết luận câu hỏi này về {names}. Bạn có muốn xem thành phần dinh dưỡng, so sánh với món khác hoặc tìm cách chế biến không?", clarify=True)
        return None
    history = history or []
    text = normalize_chat_text(message)
    if any(food["name"]["vi"] == "Bơ" for food in foods) and not re.search(r"bơ (?:lạt|mặn|động vật)|butter", text):
        return _result("Bạn muốn hỏi quả bơ hay bơ dùng để nấu ăn/làm bánh? Hai loại có dữ liệu khác nhau; hãy cho tôi biết loại bạn muốn dùng.", clarify=True)
    # General dietary guidance still belongs to medical RAG, not the food catalog.
    if topic == "nutrition" and not foods and re.search(r"dinh dưỡng|tiểu đường|đái tháo đường|carbohydrate|protein|chất xơ|chất béo|\bđạm\b", text) and not re.search(r"\bnó\b|món đó|calo|kcal", text):
        return None
    if not foods and re.search(r"\bnó\b|món đó|loại đó|cái đó|thứ đó|món này|nấu sao|nấu như thế nào", text):
        return _result("Bạn đang nói đến món hoặc nguyên liệu nào? Cho tôi tên món để tôi hướng dẫn đúng nội dung.", clarify=True)
    if topic == "storage":
        names = ", ".join(food["name"]["vi"] for food in foods)
        return _result((f"Bạn muốn bảo quản {names}" if names else "Bạn muốn bảo quản món hoặc nguyên liệu nào")
                       + ", còn sống hay đã nấu chín? Kho dữ liệu hiện chưa đủ hướng dẫn thời hạn bảo quản riêng; tôi sẽ không đoán số ngày.", clarify=True)
    if topic == "followup" or (topic in {"comparison", "nutrition"} and not foods):
        return _result("Bạn đang nói đến món hoặc nguyên liệu nào? Hãy cho tôi tên món để tôi trả lời đúng chủ đề.", clarify=True)
    if topic == "comparison" and len(foods) < 2:
        return _result("Bạn muốn so sánh hai món hoặc nguyên liệu nào? Cho tôi đủ hai tên và tiêu chí bạn quan tâm, như năng lượng, đạm hoặc cách chế biến.", clarify=True)
    if topic in {"nutrition", "comparison"} or (topic == "substitution" and len(foods) >= 2):
        chosen = foods[:2] if topic in {"comparison", "substitution"} else foods[:1]
        lines = ["Dữ liệu dưới đây dùng cùng cơ sở **100g phần ăn được**; đây không phải khẩu phần khuyến nghị cho bạn."]
        for row in chosen:
            values = row.get("nutrition_per_100g_edible", {})
            facts = []
            for key, label, unit in (("energy_kcal", "năng lượng", "kcal"), ("protein_g", "đạm", "g"),
                                     ("carbohydrate_g", "carbohydrate", "g"), ("fat_g", "chất béo", "g"), ("fiber_g", "chất xơ", "g")):
                if values.get(key) is not None:
                    facts.append(f"{label} {values[key]:g}{unit}")
            state = row.get("classification", {}).get("ingredient_state")
            state_label = "nguyên liệu sống" if state == "raw" else "trạng thái theo catalog"
            lines.append(f"• **{row['name']['vi']}** ({state_label}): " + "; ".join(facts) + ".")
        lines.append("Số liệu của nguyên liệu sống không thay cho số liệu món đã nấu; dầu, đường và cách chế biến có thể làm kết quả khác đi.")
        if topic == "substitution":
            lines.append("Hai nguyên liệu không mặc nhiên thay được theo cùng khối lượng. Nếu bạn muốn đổi món trong thực đơn điều trị, hãy đối chiếu khẩu phần và nhờ bác sĩ duyệt thay đổi.")
        return _result("\n\n".join(lines), [_food_chunk(row) for row in chosen])

    # Recipes/swap/preferences: read modeled templates and disclose that status.
    avoided = _avoidances(profile, history, message)
    vegetarian = any("ăn chay" in re.sub(r"không ăn chay", "", normalize_chat_text(t)) for t in [message, *avoided, *(h.get("content", "") for h in history if h.get("role") == "user")])
    terms = [food["name"]["vi"].lower() for food in foods]
    if topic in {"preference", "substitution"}:
        avoided.extend(terms)
        terms = []
    if not terms:
        terms = [term for term in ("trứng", "đậu", "rau", "cà chua", "thịt gà") if _contains(text, term)] if topic not in {"preference", "substitution"} else []
    elif topic == "recipe":
        terms = list(dict.fromkeys([*terms, *(term for term in ("trứng", "đậu", "rau", "thịt gà") if _contains(text, term))]))
    candidates = []
    methods = re.findall(r"\b(?:luộc|hấp|xào|kho|nướng|hầm|nấu canh)\b", text) if topic == "recipe" else []
    for recipe in recipe_catalog():
        if methods and not any(method in recipe.get("cooking_method", "") for method in methods):
            continue
        description = " ".join([recipe["name_vi"], *(i["name_vi"] for i in recipe.get("ingredients", []))]).lower()
        score = sum(_contains(description, term) for term in terms)
        if terms and not score:
            continue
        candidates.append((score, recipe))
    candidates.sort(key=lambda item: item[0], reverse=True)
    selected: list[dict] = []
    for _, recipe in candidates[:30]:
        if topic == "substitution" and any(_contains(recipe["name_vi"].lower(), term) for term in terms):
            continue
        if _safe_recipe(recipe, profile, avoided, vegetarian, db=db):
            selected.append(recipe)
        if len(selected) == 3:
            break
    if not selected:
        return _result("Tôi chưa tìm được công thức phù hợp với nguyên liệu và điều cần tránh bạn đã nêu. Bạn có thể dùng thêm nguyên liệu nào, hoặc muốn món luộc, hấp hay xào?", clarify=True)
    lines = ["Tôi tìm được các **công thức mẫu** sau để bạn tham khảo; chúng không tự thay đổi thực đơn đã được bác sĩ duyệt:"]
    chunks = []
    has_partial_match = False
    for recipe in selected:
        ingredients = ", ".join(item["name_vi"] for item in recipe.get("ingredients", []))
        method = recipe.get("cooking_method", "chưa có thông tin")
        partial = bool(terms) and not all(_contains(f"{recipe['name_vi']} {ingredients}".lower(), term) for term in terms)
        has_partial_match = has_partial_match or partial
        note = " Chỉ khớp một phần nguyên liệu bạn nêu." if partial else ""
        lines.append(f"• **{recipe['name_vi']}** — nguyên liệu chính: {ingredients}; cách chế biến trong catalog: {method}.{note}")
        chunks.append({"chunk_id": recipe["_id"], "source": f"recipe_catalog_vn#{recipe['_id']}", "score": 1.0,
                       "text": f"{recipe['name_vi']}; nguyên liệu: {ingredients}; cách chế biến: {method}; trạng thái: công thức mẫu; chưa thay thế thực đơn cá nhân hóa đã duyệt."})
    first_method = selected[0].get("cooking_method")
    if topic == "recipe" and first_method in _GENERIC_COOKING:
        lines.append("**Thao tác bếp cơ bản cho món đầu tiên:** " + _GENERIC_COOKING[first_method]
                     + " Công thức hiện chưa có thời gian và nhiệt độ chi tiết cho từng món.")
    if has_partial_match:
        lines.append("Những món được ghi chú chỉ khớp một phần không dùng hết các nguyên liệu bạn nêu và có thể cần thêm nguyên liệu khác. Bạn muốn chọn món nào để xem tiếp?")
    elif topic == "preference":
        lines.append("Tôi sẽ lưu ý điều bạn muốn tránh trong cuộc trò chuyện này. Bạn muốn xem cách làm món nào?")
    else:
        lines.append("Bạn muốn chọn món nào, hay cần lọc thêm theo nguyên liệu đang có?")
    return _result("\n\n".join(lines), chunks)
