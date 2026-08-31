import type { ChatMessage } from "@/lib/patient-chat-history-store";
import type { EscalationReason } from "@/lib/types";

export const ESCALATION_REASON_LABEL: Record<EscalationReason, string> = {
  missing_citations: "AI không tìm được nguồn tham khảo",
  unknown: "Ngoài phạm vi trợ lý AI",
  refuse: "Ngoài phạm vi y khoa của trợ lý",
  unmatched_kb: "Chưa có dữ liệu tương tác thuốc–thực phẩm",
};

function isEmergencyCopy(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (
    t.includes("cấp cứu") ||
    (t.includes("gọi") && t.includes("115")) ||
    t.includes("quy tắc 15-15") ||
    t.includes("hạ đường huyết cấp")
  );
}

export function getEscalationReason(msg: ChatMessage): EscalationReason | null {
  if (msg.sender !== "ai" || msg.isStreaming) return null;
  const intent = msg.intent || "";
  if (intent === "refuse") return "refuse";
  if (intent === "unknown") {
    if (isEmergencyCopy(msg.text)) return null;
    return "unknown";
  }
  if ((msg.unmatchedPairs || []).length > 0) return "unmatched_kb";
  if (
    msg.correctionReason === "missing_citations" ||
    (intent === "rag_qa" && msg.guardrailTriggered && !(msg.citations && msg.citations.length))
  ) {
    return "missing_citations";
  }
  if (intent === "rag_qa" && !(msg.citations && msg.citations.length)) {
    return "missing_citations";
  }
  return null;
}
