"""Unit tests for Modular Primitive Skills and Utility Skills (P-014 Phase 2).

Verifies that all atomic skills execute independently, correctly and safely.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.agents.skills import (
    ask_clarification,
    check_allergy_match,
    check_drug_food_interaction,
    chit_chat_greeting,
    emergency_triage_check,
    get_doctor_notes,
    get_patient_meal_plan,
    get_weekly_adherence_summary,
    log_food_adherence,
    refuse_unsafe_medication,
)
from app.models.food_log import FoodLog
from app.models.notification import Notification


# ===========================================================================
# 1. Utility Skills Tests
# ===========================================================================
class TestUtilitySkills:
    def test_emergency_triage_hypoglycemia_acute(self):
        result = emergency_triage_check("Tôi thấy đói cồn cào, tay chân run lẩy bẩy, vã mồ hôi lạnh")
        assert result is not None
        assert result["is_emergency"] is True
        assert result["type"] == "hypoglycemia_acute"
        assert result["action"] == "rule_15_15"
        assert "QUY TẮC 15-15" in result["message"]
        assert "15g" in result["message"]

    def test_emergency_triage_insulin_overdose_symptoms(self):
        result = emergency_triage_check("Vừa tiêm insulin xong thấy hoa mắt chóng mặt muốn ngất xỉu")
        assert result is not None
        assert result["is_emergency"] is True
        assert result["action"] == "rule_15_15"

    def test_emergency_triage_critical_coma(self):
        result = emergency_triage_check("Người nhà tôi bị tiểu đường đang lơ mơ gọi không tỉnh")
        assert result is not None
        assert result["is_emergency"] is True
        assert result["severity"] == "critical"
        assert result["action"] == "call_115"
        assert "115" in result["message"]
        assert "TUYỆT ĐỐI KHÔNG" in result["message"]

    def test_emergency_triage_foot_ulcer(self):
        result = emergency_triage_check("Chân tôi bị một vết trầy sưng mủ đỏ tấy mấy hôm nay không lành")
        assert result is not None
        assert result["is_emergency"] is True
        assert result["type"] == "diabetic_foot_ulcer"
        assert "BÀN CHÂN ĐÁI THÁO ĐƯỜNG" in result["message"]

    def test_emergency_triage_normal_query_returns_none(self):
        assert emergency_triage_check("Hôm nay tôi nên ăn gì cho bữa trưa?") is None
        assert emergency_triage_check("Uống metformin có ăn bưởi được không?") is None

    def test_ask_clarification_bare_blood_glucose_number(self):
        resp = ask_clarification("Đường 180")
        assert "180 mg/dL" in resp
        assert "đói" in resp.lower()
        assert "sau ăn" in resp.lower()

    def test_ask_clarification_diabetes_distress_coping(self):
        resp = ask_clarification("Tôi mệt mỏi và chán nản vì phải kiêng khem nhiều quá")
        assert "thấu hiểu" in resp.lower() or "áp lực" in resp.lower()
        assert "thực đơn" in resp.lower()

    def test_chit_chat_greeting(self):
        intro = chit_chat_greeting("Xin chào bạn")
        assert "Trợ lý Dinh dưỡng AI" in intro

        thanks = chit_chat_greeting("Cảm ơn bạn nhiều nhé")
        assert "Rất vui được hỗ trợ" in thanks

        bye = chit_chat_greeting("Tạm biệt bot")
        assert "Tạm biệt" in bye

    def test_refuse_unsafe_medication(self):
        msg = refuse_unsafe_medication("Tăng liều thuốc metformin giúp tôi")
        assert "không có quyền" in msg.lower() or "bác sĩ" in msg.lower()


# ===========================================================================
# 2. Primitive Skills Tests
# ===========================================================================
class TestPrimitiveSkills:
    def test_check_allergy_match(self):
        warnings = check_allergy_match(["hải sản"], ["tôm", "rau muống"])
        assert len(warnings) == 1
        assert "hải sản" in warnings[0].lower()
        assert "tôm" in warnings[0].lower()

        no_warnings = check_allergy_match(["hải sản"], ["thịt gà", "cơm"])
        assert no_warnings == []

    def test_check_drug_food_interaction_known_pair(self):
        res = check_drug_food_interaction(
            message="Uống warfarin có ăn rau muống được không?",
            medications=["warfarin"],
            allergies=[],
        )
        assert res["interactions"] is not None
        assert len(res["interactions"].interactions) >= 1
        assert "rau muống" in res["answer"].lower()

    def test_check_drug_food_interaction_with_allergy_priority(self):
        res = check_drug_food_interaction(
            message="Tôi ăn tôm được không khi đang uống metformin?",
            medications=["metformin"],
            allergies=["hải sản"],
        )
        assert res["has_allergy_warning"] is True
        assert "CẢNH BÁO DỊ ỨNG" in res["answer"] or "dị ứng" in res["answer"].lower()

    def test_log_food_adherence_summary(self, db_session):
        user_id = "test_user_food_log_skill"
        db_session.add(
            FoodLog(
                user_id=user_id,
                slot="morning",
                type="as_planned",
                note="",
                logged_at=datetime.now(UTC),
            )
        )
        db_session.commit()

        answer, info = log_food_adherence(db_session, user_id)
        assert info is not None
        assert info["recent_count"] >= 1
        assert "Bữa sáng: Đã ăn theo kế hoạch" in answer

    def test_get_weekly_adherence_summary(self, db_session):
        user_id = "test_user_compliance_skill"
        answer, compliance = get_weekly_adherence_summary(db_session, user_id, days=7)
        assert compliance is not None
        assert len(compliance.daily_series) == 7

    def test_get_doctor_notes(self, db_session):
        user_id = "test_user_doctor_note_skill"
        db_session.add(
            Notification(
                user_id=user_id,
                type="manual_reminder",
                title="Nhắc nhở",
                body="Uống thuốc đúng giờ và hạn chế muối.",
                scheduled_at=datetime.now(UTC),
                status="sent",
                related_ids={},
                payload={"tags": ["Hạn chế muối"]},
            )
        )
        db_session.commit()

        answer, note = get_doctor_notes(db_session, user_id)
        assert note is not None
        assert "hạn chế muối" in note.note.lower()
        assert "hạn chế muối" in answer.lower()

    def test_get_patient_meal_plan_empty_db(self, db_session):
        preview, answer, citations, plan_id = get_patient_meal_plan(
            db_session, "non_existent_patient_id", "Hôm nay ăn gì?"
        )
        assert preview is None
        assert plan_id is None
        assert "chưa có" in answer.lower() or "thực đơn" in answer.lower()
