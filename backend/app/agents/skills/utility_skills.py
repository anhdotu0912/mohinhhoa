"""Utility Skills — Supporting, exception handling, and edge-case skills for Agent.

Handles emergency triage, clarification, chit-chat greetings, and medical guardrail refusals.
Follows Modular Skills Architecture & Description Engineering (P-014 Phase 3).
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.guardrails.rules import get_refuse_message

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. emergency_triage_check
# ---------------------------------------------------------------------------
_HYPOGLYCEMIA_PATTERNS = [
    r"đói\s*cồn\s*cào",
    r"run\s*(?:tay|chân|lẩy\s*bẩy|người)",
    r"vã\s*mồ\s*hôi(?:\s*lạnh)?",
    r"muốn\s*ngất(?:\s*xỉu)?",
    r"tiêm\s*insulin.*(?:hoa\s*mắt|chóng\s*mặt|muốn\s*ngất)",
    r"đường\s*huyết.*dưới\s*3\.[0-9]",
    r"đường\s*huyết.*<\s*3\.[0-9]",
    r"tụt\s*đường\s*huyết\s*cấp",
    r"hạ\s*đường\s*huyết\s*quá",
]

_COMA_CRITICAL_PATTERNS = [
    r"lơ\s*mơ.*(?:không\s*tỉnh|gọi\s*không)",
    r"mất\s*ý\s*thức",
    r"hôn\s*mê",
    r"bất\s*tỉnh",
    r"ngất\s*lịm",
]

_SICK_DAY_PATTERNS = [
    r"nôn\s*mửa\s*liên\s*tục",
    r"sốt\s*cao.*không\s*ăn\s*uống",
    r"toan\s*ceton",
]

_FOOT_ULCER_PATTERNS = [
    r"(?:chân|bàn\s*chân|ngón\s*chân).*(?:trầy|loét|sưng\s*mủ|đỏ\s*tấy|không\s*lành)",
    r"(?:trầy|loét|sưng\s*mủ|đỏ\s*tấy).*(?:chân|bàn\s*chân|ngón\s*chân)",
]


def emergency_triage_check(message: str) -> dict[str, Any] | None:
    """[MỤC ĐÍCH]: Nhận diện và phản hồi tức thời các tình trạng cấp cứu y tế hoặc dấu hiệu đe dọa tính mạng (hạ đường huyết cấp quy tắc 15-15, hôn mê gọi 115, toan ceton, loét bàn chân).

    [KHI NÀO DÙNG]:
    • "Tôi thấy đói cồn cào, tay chân run lẩy bẩy, vã mồ hôi lạnh"
    • "Người nhà tôi bị tiểu đường đang lơ mơ gọi không tỉnh"
    • "Vừa tiêm insulin xong thấy hoa mắt chóng mặt muốn ngất xỉu"
    • "Chân tôi bị một vết trầy sưng mủ đỏ tấy mấy hôm nay không lành"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Câu hỏi sức khỏe thông thường không có dấu hiệu nguy kịch (ví dụ: 'ăn gì tốt cho đường huyết').
    • Tra cứu thực đơn hoặc kiểm tra tương tác thuốc thông thường.
    • Câu chào hỏi xã giao.

    Returns:
        Dict with triage metadata and immediate guidance, or None if no emergency pattern matches.
    """
    if not message:
        return None

    msg_lower = message.lower()

    # Priority 1: Life-threatening coma / loss of consciousness -> Call 115
    for pat in _COMA_CRITICAL_PATTERNS:
        if re.search(pat, msg_lower):
            return {
                "is_emergency": True,
                "type": "coma_critical",
                "severity": "critical",
                "action": "call_115",
                "message": (
                    "🚨 **TÌNH TRẠNG CẤP CỨU Y TẾ KHẨN CẤP**\n\n"
                    "Người bệnh đang có dấu hiệu nguy kịch (nguy cơ hôn mê đái tháo đường / toan ceton). "
                    "**HÃY HÀNH ĐỘNG NGAY:**\n\n"
                    "1. 📞 **GỌI CẤP CỨU 115** hoặc đưa bệnh nhân đến phòng cấp cứu bệnh viện gần nhất ngay lập tức.\n"
                    "2. 🚫 **TUYỆT ĐỐI KHÔNG** ép bệnh nhân uống nước đường, sữa hay ăn bất kỳ thứ gì khi đang lơ mơ/mất ý thức để tránh sặc vào phổi.\n"
                    "3. 🛌 Đặt bệnh nhân nằm nghiêng an toàn (tư thế hồi sức), nới lỏng quần áo và theo dõi nhịp thở."
                ),
            }

    # Priority 2: Acute hypoglycemia -> Rule 15-15 immediately
    for pat in _HYPOGLYCEMIA_PATTERNS:
        if re.search(pat, msg_lower):
            return {
                "is_emergency": True,
                "type": "hypoglycemia_acute",
                "severity": "high",
                "action": "rule_15_15",
                "message": (
                    "🚨 **CẢNH BÁO DẤU HIỆU HẠ ĐƯỜNG HUYẾT CẤP TÍNH**\n\n"
                    "Bạn đang có dấu hiệu hạ đường huyết. Hãy áp dụng ngay **QUY TẮC 15-15** của Bộ Y Tế & ADA:\n\n"
                    "1. 🍬 **Nạp ngay 15g carbohydrate tác dụng nhanh:**\n"
                    "   • Uống 1/2 cốc nước đường (pha 3 thìa cà phê đường) HOẶC\n"
                    "   • 1/2 cốc nước ép trái cây / nước ngọt thường (không dùng loại ăn kiêng) HOẶC\n"
                    "   • 3–4 viên kẹo ngọt / 1 thìa mật ong.\n"
                    "2. ⏱️ **Nghỉ ngơi 15 phút** tại chỗ an toàn (ngồi hoặc nằm nghỉ, không lái xe hay đi lại).\n"
                    "3. 🩸 **Đo lại đường huyết** sau 15 phút. Nếu đường huyết vẫn dưới 3.9 mmol/L (70 mg/dL), tiếp tục nạp thêm 15g đường.\n"
                    "4. 📞 Nếu sau 2 lần xử trí mà triệu chứng không giảm hoặc thấy lơ mơ, hãy nhờ người nhà gọi hỗ trợ y tế ngay."
                ),
            }

    # Priority 3: Sick-day management & acute vomiting
    for pat in _SICK_DAY_PATTERNS:
        if re.search(pat, msg_lower):
            return {
                "is_emergency": True,
                "type": "sick_day_ketosis",
                "severity": "high",
                "action": "hospital_urgently",
                "message": (
                    "⚠️ **CẢNH BÁO NGUY CƠ NHIỄM TOAN CETON / MẤT NƯỚC CẤP**\n\n"
                    "Sốt cao kèm nôn mửa liên tục ở người đái tháo đường là tình trạng nguy hiểm cần theo dõi sát:\n\n"
                    "1. 🏥 Bạn cần **đến cơ sở y tế hoặc bệnh viện khám ngay** để được bù nước và điện giải kịp thời.\n"
                    "2. 💧 Uống từng ngụm nhỏ nước lọc hoặc oresol nếu còn uống được.\n"
                    "3. 🚫 Tuyệt đối không tự ý ngưng insulin hoặc thuốc hạ đường khi chưa có chỉ định của bác sĩ."
                ),
            }

    # Priority 4: Diabetic foot infection
    for pat in _FOOT_ULCER_PATTERNS:
        if re.search(pat, msg_lower):
            return {
                "is_emergency": True,
                "type": "diabetic_foot_ulcer",
                "severity": "medium_high",
                "action": "see_doctor_urgently",
                "message": (
                    "⚠️ **CẢNH BÁO BIẾN CHỨNG BÀN CHÂN ĐÁI THÁO ĐƯỜNG**\n\n"
                    "Vết thương trầy xước sưng mủ ở người đái tháo đường có nguy cơ nhiễm trùng lan rộng rất nhanh:\n\n"
                    "1. 🏥 Hãy **đến khám chuyên khoa nội tiết / ngoại khoa ngay** trong hôm nay để được xử trí vết thương chuyên nghiệp.\n"
                    "2. 🚫 Tuyệt đối không tự ý đắp lá, rắc thuốc bột hay ngâm chân nước nóng.\n"
                    "3. 🩹 Rửa nhẹ bằng nước muối sinh lý 0.9%, che phủ bằng gạc vô trùng sạch và giữ chân khô ráo."
                ),
            }

    return None


# ---------------------------------------------------------------------------
# 2. ask_clarification
# ---------------------------------------------------------------------------
def ask_clarification(message: str, missing_aspect: str = "") -> str:
    """[MỤC ĐÍCH]: Đặt câu hỏi ngắn nhằm làm rõ thông tin khi bệnh nhân cung cấp dữ liệu quá mơ hồ, thiếu bối cảnh lâm sàng (chỉ gõ một con số đo đường huyết), hoặc than phiền tâm lý kiệt sức.

    [KHI NÀO DÙNG]:
    • "Đường 180"
    • "150"
    • "Tôi mệt mỏi và chán nản vì phải kiêng khem nhiều quá"
    • "Ăn được không?"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Khi câu hỏi của bệnh nhân đã có đầy đủ thông tin để định tuyến vào một skill cụ thể (thực đơn, thuốc, RAG).
    • Khi bệnh nhân đang có dấu hiệu cấp cứu hạ đường huyết (dùng skill emergency_triage_check).
    """
    msg_clean = message.strip()

    # Specific check for bare numbers like "Đường 180", "150"
    num_match = re.search(r"(?:đường\s*)?(\d{2,3})", msg_clean, re.IGNORECASE)
    if num_match and len(msg_clean) <= 15:
        val = num_match.group(1)
        return (
            f"Bạn vừa đề cập đến chỉ số đường huyết **{val} mg/dL**. "
            "Để tôi có thể tư vấn thực đơn và lời khuyên chính xác nhất, bạn vui lòng cho biết thêm:\n\n"
            "1. ⏱️ Chỉ số này bạn đo lúc **đói (buổi sáng trước khi ăn)** hay **sau ăn 2 giờ**?\n"
            "2. 💊 Bạn đã uống thuốc hoặc tiêm insulin theo đơn chưa?"
        )

    if any(w in msg_clean.lower() for w in ["chán nản", "mệt mỏi", "kiêng khem nhiều quá", "stress"]):
        return (
            "Tôi rất thấu hiểu cảm giác mệt mỏi và áp lực khi phải duy trì chế độ ăn kiêng khem nghiêm ngặt mỗi ngày. "
            "Quản lý đái tháo đường là một hành trình dài hạn, và việc có những lúc cảm thấy kiệt sức là hoàn toàn bình thường.\n\n"
            "💡 **Gợi ý từ trợ lý:** Thay vì kiêng khem quá mức dẫn đến thiếu chất, chúng ta có thể điều chỉnh thực đơn với các món ăn phong phú, "
            "đổi vị lành mạnh nhưng vẫn kiểm soát tốt đường huyết. Bạn muốn tôi gợi ý một thực đơn mới đổi bữa hôm nay không?"
        )

    return (
        "Câu hỏi của bạn hiện chưa đủ thông tin chi tiết để tôi hỗ trợ chính xác. "
        "Bạn có thể cho tôi biết rõ hơn bạn muốn: xem thực đơn bữa nào, kiểm tra tương tác của thuốc gì, hay ghi nhận bữa ăn?"
    )


# ---------------------------------------------------------------------------
# 3. chit_chat_greeting
# ---------------------------------------------------------------------------
def chit_chat_greeting(message: str) -> str:
    """[MỤC ĐÍCH]: Phản hồi nhanh các câu chào hỏi, giới thiệu vai trò và chức năng của trợ lý, lời cảm ơn hoặc tạm biệt mà không kích hoạt truy vấn cơ sở dữ liệu hay RAG.

    [KHI NÀO DÙNG]:
    • "Xin chào bạn"
    • "Bạn là ai và có thể làm được những gì?"
    • "Cảm ơn bạn nhiều nhé"
    • "Tạm biệt bot"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Tin nhắn có chứa câu hỏi nghiệp vụ dinh dưỡng hay thực phẩm (ví dụ: 'Chào bạn, hôm nay tôi ăn gì?').
    • Tin nhắn phản ánh triệu chứng bệnh hoặc thắc mắc về thuốc.
    """
    msg_lower = (message or "").strip().lower()

    if any(w in msg_lower for w in ["cảm ơn", "cám ơn", "thank", "tks"]):
        return (
            "Rất vui được hỗ trợ bạn! Chúc bạn luôn dồi dào sức khỏe và kiểm soát đường huyết ổn định. "
            "Nếu bạn cần thêm thực đơn hay tra cứu dinh dưỡng, đừng ngần ngại nhắn tôi nhé!"
        )

    if any(w in msg_lower for w in ["tạm biệt", "bye", "goodbye"]):
        return (
            "Tạm biệt bạn! Chúc bạn một ngày tốt lành và luôn duy trì lối sống lành mạnh."
        )

    return (
        "Xin chào! Tôi là Trợ lý Dinh dưỡng AI chuyên hỗ trợ bệnh nhân đái tháo đường type 2. "
        "Tôi có thể hỗ trợ bạn:\n\n"
        "1. 📋 **Xem & tra cứu thực đơn dinh dưỡng** phù hợp mức đường huyết\n"
        "2. ⚠️ **Kiểm tra tương tác thuốc - thực phẩm** (ví dụ: Metformin, Sulfonylurea, Statin kiêng gì)\n"
        "3. 🥗 **Giải đáp kiến thức dinh dưỡng & lối sống** (tinh bột, hoa quả, đếm carb, xử trí hạ đường huyết)\n"
        "4. 📊 **Theo dõi tuân thủ bữa ăn & xu hướng chỉ số sức khỏe**\n\n"
        "Hôm nay tôi có thể giúp gì cho bạn?"
    )


# ---------------------------------------------------------------------------
# 4. refuse_unsafe_medication
# ---------------------------------------------------------------------------
def refuse_unsafe_medication(message: str) -> str:
    """[MỤC ĐÍCH]: Từ chối một cách an toàn và đúng quy chuẩn đạo đức y tế khi người dùng yêu cầu chỉnh liều thuốc, kê đơn thuốc mới hoặc chẩn đoán thay bác sĩ.

    [KHI NÀO DÙNG]:
    • "Tăng liều thuốc metformin giúp tôi"
    • "Kê cho tôi đơn thuốc hạ đường huyết"
    • "Tôi bị đau ngực phải uống thuốc gì?"
    • "Bác sĩ kê thuốc này sai rồi, đổi thuốc khác cho tôi"

    [TUYỆT ĐỐI KHÔNG DÙNG]:
    • Câu hỏi tra cứu an toàn tương tác giữa thuốc đang dùng với món ăn (ví dụ: 'Uống metformin có ăn bưởi được không?' — dùng skill check_drug_food_interaction).
    • Câu hỏi về kiến thức tác dụng của nhóm thuốc (dùng skill search_medical_guidelines).
    """
    return get_refuse_message()
