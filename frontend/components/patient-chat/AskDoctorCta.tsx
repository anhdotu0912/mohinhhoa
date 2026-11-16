"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ApiError, type AssignedDoctor, type EscalationOut } from "@/lib/types";
import { ESCALATION_REASON_LABEL, getEscalationReason } from "@/lib/escalation";
import { usePatientPanel } from "@/components/patient-chat/PatientPanelProvider";
import { DoctorMiniChat } from "./DoctorMiniChat";
import type { ChatMessage } from "@/lib/patient-chat-history-store";

export function AskDoctorCta({
  message,
  previousUserText,
  sessionId,
  assignedDoctor,
  onEscalated,
}: {
  message: ChatMessage;
  previousUserText: string;
  sessionId: string | null;
  assignedDoctor: AssignedDoctor | null;
  onEscalated: (messageId: string, escalationId: string) => void;
}) {
  const { refreshNotificationsBadge } = usePatientPanel();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<EscalationOut | null>(null);
  const reason = getEscalationReason(message) ?? "unknown";
  const hasAssignedDoctor = Boolean(assignedDoctor);
  const escalationId = message.escalationId ?? null;

  if (escalationId) {
    return (
      <DoctorMiniChat
        key={escalationId}
        escalationId={escalationId}
        doctor={assignedDoctor}
        initialThread={thread}
      />
    );
  }

  if (!hasAssignedDoctor) {
    return (
      <p className="inline-flex items-center gap-1.5 w-fit text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
        <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
        Khi bác sĩ nhận hồ sơ, bạn có thể chuyển câu hỏi này
      </p>
    );
  }

  const handleSend = async () => {
    if (!sessionId || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await api.createChatEscalation({
        session_id: sessionId,
        ai_message_id: message.id,
        note: note.trim(),
        question_text: previousUserText,
        answer_text: message.text,
        intent: message.intent ?? null,
        citations: message.citations ?? [],
        correction_reason: message.correctionReason ?? null,
        unmatched_pairs: message.unmatchedPairs ?? [],
        guardrail_triggered: message.guardrailTriggered ?? false,
      });
      setThread(created);
      onEscalated(message.id, created.id);
      void refreshNotificationsBadge();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không gửi được cho bác sĩ. Thử lại.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 max-w-lg">
      <p className="text-xs text-slate-500 font-medium">
        {ESCALATION_REASON_LABEL[reason]}. Bạn có thể chuyển câu hỏi này cho bác sĩ phụ trách.
      </p>
      <label className="sr-only" htmlFor={`ask-doctor-note-${message.id}`}>
        Ghi chú gửi bác sĩ
      </label>
      <input
        id={`ask-doctor-note-${message.id}`}
        type="text"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú thêm cho bác sĩ (không bắt buộc)"
        disabled={sending}
        className="w-full text-sm text-slate-800 placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#006857] focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={sending || !sessionId}
        className="inline-flex items-center justify-center gap-1.5 w-fit h-9 px-3.5 rounded-lg bg-[#006857] text-white text-xs font-bold hover:bg-[#005445] transition-colors cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
      >
        <span className={`material-symbols-outlined text-[16px] ${sending ? "animate-spin" : ""}`}>
          {sending ? "progress_activity" : "stethoscope"}
        </span>
        {sending ? "Đang gửi..." : "Hỏi bác sĩ điều trị"}
      </button>
      {error ? <p className="text-xs text-rose-700 font-medium">{error}</p> : null}
    </div>
  );
}
