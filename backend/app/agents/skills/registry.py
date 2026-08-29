"""Skill Registry — Central catalog and schema engineering for Agent Skills (P-014 Phase 3).

Standardizes all Primitive and Utility skills with the mandatory 3-part Description Engineering:
1. [MỤC ĐÍCH]: 1-sentence concise domain purpose.
2. [KHI NÀO DÙNG]: 2-3 typical trigger questions/scenarios.
3. [TUYỆT ĐỐI KHÔNG DÙNG]: Explicit Negative Constraints to prevent tool hallucinations/cross-calling.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class SkillCategory(str, Enum):
    """Categorization of agent skills."""
    PRIMITIVE = "primitive"  # Atomic domain business functions
    UTILITY = "utility"      # Triage, clarification, greeting, guardrail refusals


@dataclass(frozen=True)
class SkillDefinition:
    """Standardized metadata and prompt definition for an Agent Skill."""

    name: str
    category: SkillCategory
    intent_name: str
    purpose: str
    when_to_use: list[str]
    never_use: list[str]
    parameters_schema: dict[str, Any] = field(default_factory=dict)
    returns_schema: dict[str, Any] = field(default_factory=dict)

    def to_standard_description(self) -> str:
        """Format the skill definition into the standard 3-part markdown description."""
        when_bullets = "\n".join(f"  • \"{q}\"" for q in self.when_to_use)
        never_bullets = "\n".join(f"  • {r}" for r in self.never_use)

        return (
            f"[MỤC ĐÍCH]: {self.purpose}\n"
            f"[KHI NÀO DÙNG]:\n{when_bullets}\n"
            f"[TUYỆT ĐỐI KHÔNG DÙNG]:\n{never_bullets}"
        )

    def to_prompt_block(self) -> str:
        """Format for LLM intent classification or routing prompt."""
        when_str = " | ".join(f'"{q}"' for q in self.when_to_use)
        never_str = " | ".join(self.never_use)
        return (
            f"- {self.intent_name} (Skill: `{self.name}`):\n"
            f"  + Mục đích: {self.purpose}\n"
            f"  + Ví dụ kích hoạt: {when_str}\n"
            f"  + TUYỆT ĐỐI KHÔNG DÙNG: {never_str}"
        )

    def to_openai_tool_schema(self) -> dict[str, Any]:
        """Format definition into OpenAI Function/Tool Schema format."""
        description = (
            f"{self.purpose}\n\n"
            f"KHI NÀO DÙNG:\n" + "\n".join(f"- {q}" for q in self.when_to_use) + "\n\n"
            f"TUYỆT ĐỐI KHÔNG DÙNG (NEGATIVE CONSTRAINTS):\n" + "\n".join(f"- {r}" for r in self.never_use)
        )
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": description,
                "parameters": {
                    "type": "object",
                    "properties": self.parameters_schema.get("properties", {}),
                    "required": self.parameters_schema.get("required", []),
                },
            },
        }


# ===========================================================================
# Skill Catalog — All 11 Primitive & Utility Skills
# ===========================================================================

SKILL_REGISTRY: dict[str, SkillDefinition] = {
    # -----------------------------------------------------------------------
    # 1. get_patient_meal_plan (Primitive)
    # -----------------------------------------------------------------------
    "get_patient_meal_plan": SkillDefinition(
        name="get_patient_meal_plan",
        category=SkillCategory.PRIMITIVE,
        intent_name="meal_plan",
        purpose="Đọc và hiển thị thực đơn dinh dưỡng cá nhân hóa của bệnh nhân từ cơ sở dữ liệu theo bữa/ngày/tuần mà không tạo mới hay gọi RAG.",
        when_to_use=[
            "Hôm nay tôi nên ăn gì?",
            "Cho tôi xem thực đơn sáng nay",
            "Bác sĩ đã lên thực đơn tuần này cho tôi chưa?",
            "Trưa nay có món gì trong thực đơn?",
        ],
        never_use=[
            "Hỏi kiến thức dinh dưỡng tổng quát hoặc danh sách nhóm thực phẩm (ví dụ: 'người tiểu đường nên ăn gì?', 'các loại rau tốt').",
            "Hỏi kiểm tra an toàn hay tương tác của một món ăn cụ thể với thuốc đang uống (ví dụ: 'uống metformin có ăn bưởi được không?').",
            "Ghi nhận món bệnh nhân vừa ăn xong (dùng skill log_food_adherence).",
        ],
        parameters_schema={
            "properties": {
                "message": {"type": "string", "description": "Tin nhắn người dùng chứa slot bữa ăn (sáng, trưa, tối)."},
            },
            "required": [],
        },
        returns_schema={
            "properties": {
                "meal_preview": {"type": "object"},
                "answer": {"type": "string"},
                "citations": {"type": "array", "items": {"type": "string"}},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 2. check_drug_food_interaction (Primitive)
    # -----------------------------------------------------------------------
    "check_drug_food_interaction": SkillDefinition(
        name="check_drug_food_interaction",
        category=SkillCategory.PRIMITIVE,
        intent_name="interaction_check",
        purpose="Tra cứu an toàn và cảnh báo tương tác giữa thuốc đang điều trị với thực phẩm cụ thể hoặc kiểm tra dị ứng thực phẩm theo hồ sơ bệnh nhân.",
        when_to_use=[
            "Uống metformin có ăn bưởi được không?",
            "Tôi ăn tôm có sao không khi đang uống thuốc hạ đường huyết?",
            "Thuốc điều trị này có kỵ rượu hay kiêng gì không?",
            "Đang uống thuốc mỡ máu ăn bơ được không?",
        ],
        never_use=[
            "Hỏi xem thực đơn ăn uống trong ngày hoặc trong tuần (dùng skill get_patient_meal_plan).",
            "Hỏi danh sách nhóm thực phẩm kiến thức chung (ví dụ: 'các loại trái cây ít đường' — dùng skill search_medical_guidelines).",
            "Yêu cầu kê đơn thuốc mới hoặc tự ý thay đổi liều lượng thuốc (dùng skill refuse_unsafe_medication).",
        ],
        parameters_schema={
            "properties": {
                "message": {"type": "string", "description": "Câu hỏi của bệnh nhân về thực phẩm hoặc thuốc."},
                "medications": {"type": "array", "items": {"type": "string"}, "description": "Danh sách thuốc đang dùng."},
                "allergies": {"type": "array", "items": {"type": "string"}, "description": "Danh sách dị ứng."},
            },
            "required": ["message"],
        },
        returns_schema={
            "properties": {
                "answer": {"type": "string"},
                "interactions": {"type": "object"},
                "citations": {"type": "array", "items": {"type": "string"}},
                "has_allergy_warning": {"type": "boolean"},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 3. search_medical_guidelines (Primitive)
    # -----------------------------------------------------------------------
    "search_medical_guidelines": SkillDefinition(
        name="search_medical_guidelines",
        category=SkillCategory.PRIMITIVE,
        intent_name="rag_qa",
        purpose="Tra cứu hướng dẫn lâm sàng của Bộ Y Tế / ADA về kiến thức dinh dưỡng tổng quát, chỉ số GI, đếm carb, calo, và lối sống cho người đái tháo đường.",
        when_to_use=[
            "Những loại rau nào người tiểu đường không nên ăn?",
            "Chỉ số GI của gạo lứt là bao nhiêu?",
            "Lợi ích của cá hồi đối với kiểm soát đường huyết?",
            "Bị đái tháo đường type 2 cần kiêng những gì?",
        ],
        never_use=[
            "Bệnh nhân hỏi xem thực đơn cụ thể đã tạo trong ứng dụng (dùng skill get_patient_meal_plan).",
            "Hỏi về tương tác cụ thể của một thực phẩm với thuốc đang uống (dùng skill check_drug_food_interaction).",
            "Ghi nhận nhật ký bữa ăn vừa ăn (dùng skill log_food_adherence).",
            "Bệnh nhân đang có dấu hiệu cấp cứu hạ đường huyết cấp tính (dùng skill emergency_triage_check).",
        ],
        parameters_schema={
            "properties": {
                "query": {"type": "string", "description": "Câu hỏi y khoa / dinh dưỡng tổng quát."},
            },
            "required": ["query"],
        },
        returns_schema={
            "properties": {
                "rag_context": {"type": "array", "items": {"type": "object"}},
                "citations": {"type": "array", "items": {"type": "string"}},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 4. log_food_adherence (Primitive)
    # -----------------------------------------------------------------------
    "log_food_adherence": SkillDefinition(
        name="log_food_adherence",
        category=SkillCategory.PRIMITIVE,
        intent_name="food_log",
        purpose="Truy xuất và tổng hợp các bản ghi nhật ký bữa ăn gần đây của bệnh nhân từ cơ sở dữ liệu.",
        when_to_use=[
            "Sáng nay tôi đã ăn phở bò",
            "Tôi vừa ăn xong bữa trưa đúng theo thực đơn",
            "Xem lại nhật ký ăn uống gần đây của tôi",
            "Hôm nay tôi đã ghi nhận những bữa ăn nào?",
        ],
        never_use=[
            "Hỏi gợi ý thực đơn sắp tới (dùng skill get_patient_meal_plan).",
            "Hỏi tra cứu calo hay kiến thức món ăn (dùng skill search_medical_guidelines).",
            "Kiểm tra tương tác thuốc (dùng skill check_drug_food_interaction).",
        ],
        parameters_schema={
            "properties": {
                "limit": {"type": "integer", "default": 4, "description": "Số lượng bản ghi gần nhất cần lấy."},
            },
            "required": [],
        },
        returns_schema={
            "properties": {
                "answer": {"type": "string"},
                "food_log": {"type": "object"},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 5. get_weekly_adherence_summary (Primitive)
    # -----------------------------------------------------------------------
    "get_weekly_adherence_summary": SkillDefinition(
        name="get_weekly_adherence_summary",
        category=SkillCategory.PRIMITIVE,
        intent_name="weekly_compliance",
        purpose="Tính toán và báo cáo tỷ lệ (%) tuân thủ kế hoạch ăn uống cùng chuỗi dữ liệu theo dõi 7 ngày gần nhất.",
        when_to_use=[
            "Tuần này tôi tuân thủ thực đơn bao nhiêu phần trăm?",
            "Báo cáo tuân thủ tuần này của tôi thế nào?",
            "Tỷ lệ tuân thủ ăn uống gần đây của tôi?",
            "Xem tiến độ tuân thủ dinh dưỡng cả tuần",
        ],
        never_use=[
            "Hỏi chi tiết thực đơn hôm nay ăn món gì (dùng skill get_patient_meal_plan).",
            "Hỏi về xu hướng chỉ số cân nặng/đường huyết (dùng skill get_metrics_delta_advice).",
            "Hỏi tương tác thuốc (dùng skill check_drug_food_interaction).",
        ],
        parameters_schema={
            "properties": {
                "days": {"type": "integer", "default": 7, "description": "Số ngày tổng hợp tuân thủ."},
            },
            "required": [],
        },
        returns_schema={
            "properties": {
                "answer": {"type": "string"},
                "weekly_compliance": {"type": "object"},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 6. get_metrics_delta_advice (Primitive)
    # -----------------------------------------------------------------------
    "get_metrics_delta_advice": SkillDefinition(
        name="get_metrics_delta_advice",
        category=SkillCategory.PRIMITIVE,
        intent_name="metrics_delta_advice",
        purpose="So sánh xu hướng thay đổi giữa 2 lần ghi nhận chỉ số sức khỏe gần nhất (cân nặng, đường huyết, BMI) và đưa ra nhận xét quan sát an toàn (không chẩn đoán).",
        when_to_use=[
            "Dạo này cân nặng của tôi thế nào?",
            "Đường huyết của tôi có xu hướng tăng hay giảm?",
            "Chỉ số sức khỏe gần đây có ổn định không?",
            "Xu hướng BMI và huyết áp của tôi",
        ],
        never_use=[
            "Tự ý chẩn đoán bệnh mới, kết luận khỏi bệnh hay tiên lượng bệnh.",
            "Kê đơn thuốc hoặc thay đổi liều điều trị.",
            "Bệnh nhân đang có triệu chứng cấp tính nguy kịch (vã mồ hôi, đói cồn cào, run tay — dùng skill emergency_triage_check).",
        ],
        parameters_schema={},
        returns_schema={
            "properties": {
                "answer": {"type": "string"},
                "metrics_delta_advice": {"type": "object"},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 7. get_doctor_notes (Primitive)
    # -----------------------------------------------------------------------
    "get_doctor_notes": SkillDefinition(
        name="get_doctor_notes",
        category=SkillCategory.PRIMITIVE,
        intent_name="doctor_note",
        purpose="Truy xuất lời nhắc, lời dặn hoặc ghi chú điều chỉnh lâm sàng mới nhất từ bác sĩ điều trị cho bệnh nhân.",
        when_to_use=[
            "Bác sĩ có dặn dò gì mới không?",
            "Xem lời nhắc từ bác sĩ điều trị",
            "Bác sĩ ghi chú gì về chế độ ăn của tôi?",
            "Lời khuyên của bác sĩ trong lần khám gần nhất",
        ],
        never_use=[
            "Hỏi kiến thức y khoa chung ngoài ghi chú hồ sơ (dùng skill search_medical_guidelines).",
            "Hỏi thực đơn dinh dưỡng chi tiết (dùng skill get_patient_meal_plan).",
            "Hỏi kiểm tra tương tác thuốc (dùng skill check_drug_food_interaction).",
        ],
        parameters_schema={},
        returns_schema={
            "properties": {
                "answer": {"type": "string"},
                "doctor_note": {"type": "object"},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 8. emergency_triage_check (Utility)
    # -----------------------------------------------------------------------
    "emergency_triage_check": SkillDefinition(
        name="emergency_triage_check",
        category=SkillCategory.UTILITY,
        intent_name="unknown",  # Triggered during unknown/pre-triage check
        purpose="Nhận diện và phản hồi tức thời các tình trạng cấp cứu y tế hoặc dấu hiệu đe dọa tính mạng (hạ đường huyết cấp quy tắc 15-15, hôn mê gọi 115, toan ceton, loét bàn chân).",
        when_to_use=[
            "Tôi thấy đói cồn cào, tay chân run lẩy bẩy, vã mồ hôi lạnh",
            "Người nhà tôi bị tiểu đường đang lơ mơ gọi không tỉnh",
            "Vừa tiêm insulin xong thấy hoa mắt chóng mặt muốn ngất xỉu",
            "Chân tôi bị một vết trầy sưng mủ đỏ tấy mấy hôm nay không lành",
        ],
        never_use=[
            "Câu hỏi sức khỏe thông thường không có dấu hiệu nguy kịch (ví dụ: 'ăn gì tốt cho đường huyết').",
            "Tra cứu thực đơn hoặc kiểm tra tương tác thuốc thông thường.",
            "Câu chào hỏi xã giao.",
        ],
        parameters_schema={
            "properties": {
                "message": {"type": "string", "description": "Nội dung phản ánh triệu chứng của bệnh nhân."},
            },
            "required": ["message"],
        },
        returns_schema={
            "properties": {
                "is_emergency": {"type": "boolean"},
                "type": {"type": "string"},
                "action": {"type": "string"},
                "message": {"type": "string"},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 9. ask_clarification (Utility)
    # -----------------------------------------------------------------------
    "ask_clarification": SkillDefinition(
        name="ask_clarification",
        category=SkillCategory.UTILITY,
        intent_name="unknown",
        purpose="Đặt câu hỏi ngắn nhằm làm rõ thông tin khi bệnh nhân cung cấp dữ liệu quá mơ hồ, thiếu bối cảnh lâm sàng (chỉ gõ một con số đo đường huyết), hoặc than phiền tâm lý kiệt sức.",
        when_to_use=[
            "Đường 180",
            "150",
            "Tôi mệt mỏi và chán nản vì phải kiêng khem nhiều quá",
            "Ăn được không?",
        ],
        never_use=[
            "Khi câu hỏi của bệnh nhân đã có đầy đủ thông tin để định tuyến vào một skill cụ thể (thực đơn, thuốc, RAG).",
            "Khi bệnh nhân đang có dấu hiệu cấp cứu hạ đường huyết (dùng skill emergency_triage_check).",
        ],
        parameters_schema={
            "properties": {
                "message": {"type": "string", "description": "Tin nhắn ngắn gọn thiếu thông tin."},
            },
            "required": ["message"],
        },
        returns_schema={
            "properties": {
                "clarification_question": {"type": "string"},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 10. chit_chat_greeting (Utility)
    # -----------------------------------------------------------------------
    "chit_chat_greeting": SkillDefinition(
        name="chit_chat_greeting",
        category=SkillCategory.UTILITY,
        intent_name="greeting",
        purpose="Phản hồi nhanh các câu chào hỏi, giới thiệu vai trò và chức năng của trợ lý, lời cảm ơn hoặc tạm biệt mà không kích hoạt truy vấn cơ sở dữ liệu hay RAG.",
        when_to_use=[
            "Xin chào bạn",
            "Bạn là ai và có thể làm được những gì?",
            "Cảm ơn bạn nhiều nhé",
            "Tạm biệt bot",
        ],
        never_use=[
            "Tin nhắn có chứa câu hỏi nghiệp vụ dinh dưỡng hay thực phẩm (ví dụ: 'Chào bạn, hôm nay tôi ăn gì?').",
            "Tin nhắn phản ánh triệu chứng bệnh hoặc thắc mắc về thuốc.",
        ],
        parameters_schema={
            "properties": {
                "message": {"type": "string", "description": "Tin nhắn chào hỏi hoặc xã giao."},
            },
            "required": ["message"],
        },
        returns_schema={
            "properties": {
                "greeting_response": {"type": "string"},
            }
        },
    ),

    # -----------------------------------------------------------------------
    # 11. refuse_unsafe_medication (Utility)
    # -----------------------------------------------------------------------
    "refuse_unsafe_medication": SkillDefinition(
        name="refuse_unsafe_medication",
        category=SkillCategory.UTILITY,
        intent_name="refuse",
        purpose="Từ chối một cách an toàn và đúng quy chuẩn đạo đức y tế khi người dùng yêu cầu chỉnh liều thuốc, kê đơn thuốc mới hoặc chẩn đoán thay bác sĩ.",
        when_to_use=[
            "Tăng liều thuốc metformin giúp tôi",
            "Kê cho tôi đơn thuốc hạ đường huyết",
            "Tôi bị đau ngực phải uống thuốc gì?",
            "Bác sĩ kê thuốc này sai rồi, đổi thuốc khác cho tôi",
        ],
        never_use=[
            "Câu hỏi tra cứu an toàn tương tác giữa thuốc đang dùng với món ăn (ví dụ: 'Uống metformin có ăn bưởi được không?' — dùng skill check_drug_food_interaction).",
            "Câu hỏi về kiến thức tác dụng của nhóm thuốc (dùng skill search_medical_guidelines).",
        ],
        parameters_schema={
            "properties": {
                "message": {"type": "string", "description": "Yêu cầu thuốc nằm ngoài phạm vi trợ lý."},
            },
            "required": ["message"],
        },
        returns_schema={
            "properties": {
                "refusal_message": {"type": "string"},
            }
        },
    ),
}


# ===========================================================================
# Public Registry Query Helpers
# ===========================================================================

def get_skill_definition(name: str) -> SkillDefinition | None:
    """Retrieve a SkillDefinition by name."""
    return SKILL_REGISTRY.get(name)


def get_all_skill_definitions() -> list[SkillDefinition]:
    """Retrieve list of all registered skill definitions."""
    return list(SKILL_REGISTRY.values())


def get_skills_by_category(category: SkillCategory) -> list[SkillDefinition]:
    """Filter registered skills by category (PRIMITIVE vs UTILITY)."""
    return [skill for skill in SKILL_REGISTRY.values() if skill.category == category]


def get_all_skill_descriptions() -> dict[str, str]:
    """Retrieve formatted 3-part descriptions for all registered skills."""
    return {name: skill.to_standard_description() for name, skill in SKILL_REGISTRY.items()}


def format_intent_classification_prompt_snippet() -> str:
    """Generate the standardized skill intent blocks with Negative Constraints for LLM prompt."""
    blocks: list[str] = []
    # Group by unique intent names
    seen_intents: set[str] = set()
    for skill in SKILL_REGISTRY.values():
        if skill.intent_name in seen_intents and skill.intent_name == "unknown":
            continue
        seen_intents.add(skill.intent_name)
        blocks.append(skill.to_prompt_block())

    return "\n\n".join(blocks)


def get_openai_tools_schema() -> list[dict[str, Any]]:
    """Export all registered skills as an OpenAI Tools Schema list."""
    return [skill.to_openai_tool_schema() for skill in SKILL_REGISTRY.values()]


# ===========================================================================
# Zero-Bloat Context & Dynamic Tool Binding Helpers (Phase 4)
# ===========================================================================

def get_bound_tool_schema_for_intent(intent: str) -> dict[str, Any] | None:
    """Return single bound tool schema for a specific intent (Dynamic Tool Binding).

    Eliminates cross-tool bloat by exposing only the single target tool schema to the LLM.
    """
    for skill in SKILL_REGISTRY.values():
        if skill.intent_name == intent:
            return skill.to_openai_tool_schema()
    return None


def get_lean_state_for_intent(state: dict[str, Any], intent: str) -> dict[str, Any]:
    """Prune AgentState down to the minimum necessary fields for the target intent (Zero-Bloat Context).

    Prevents leaking unneeded profile fields, large historical payloads, or irrelevant database references.
    """
    message = state.get("message", "")
    user_id = state.get("user_id")
    db = state.get("db")
    profile = state.get("profile", {})
    if hasattr(profile, "model_dump"):
        profile_dict = profile.model_dump()
    elif isinstance(profile, dict):
        profile_dict = profile
    else:
        profile_dict = {}

    if intent == "meal_plan":
        return {
            "user_id": user_id,
            "message": message,
            "db": db,
        }

    if intent == "interaction_check":
        return {
            "user_id": user_id,
            "message": message,
            "medications": profile_dict.get("medications", []),
            "allergies": profile_dict.get("allergies", []),
            "db": db,
        }

    if intent == "rag_qa":
        lean_profile = {
            "disease": profile_dict.get("disease", []),
            "medications": profile_dict.get("medications", []),
            "allergies": profile_dict.get("allergies", []),
        }
        return {
            "message": message,
            "profile": lean_profile,
        }

    if intent == "food_log":
        return {
            "user_id": user_id,
            "db": db,
        }

    if intent in ("weekly_compliance", "metrics_delta_advice", "doctor_note"):
        return {
            "user_id": user_id,
            "db": db,
        }

    if intent in ("greeting", "refuse"):
        return {
            "message": message,
        }

    if intent == "unknown":
        lean_profile = {
            "disease": profile_dict.get("disease", []),
            "medications": profile_dict.get("medications", []),
        }
        return {
            "message": message,
            "profile": lean_profile,
        }

    return state

