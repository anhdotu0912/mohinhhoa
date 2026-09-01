"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ApiError, type AssignedDoctor, type EscalationOut } from "@/lib/types";
import { ESCALATION_REASON_LABEL, getEscalationReason } from "@/lib/escalation";
import { usePatientPanel } from "@/components/patient-chat/PatientPanelProvider";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import type { ChatMessage } from "@/lib/patient-chat-history-store";

function lastDoctorReply(thread: EscalationOut): string | null {
  const replies = thread.messages.filter((m) => m.sender === "doctor");
  const last = replies[replies.length - 1];
  return last?.body?.trim() || null;
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 1) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function DoctorStatusCard({
  thread,
  doctor,
  onOpen,
}: {
  thread: EscalationOut;
  doctor: AssignedDoctor | null;
  onOpen: () => void;
}) {
  const doctorName = doctor?.full_name?.trim() || "Bác sĩ phụ trách";
  const avatarSrc = resolveUserAvatar(doctor?.avatar);
  const initials = userInitials(doctorName);
  const replyPreview = lastDoctorReply(thread);
  const status = thread.status;
  const resolved = status === "resolved";
  const awaitingPatient = status === "waiting_patient";

  const subtitle = resolved
    ? "Trao đổi đã kết thúc"
    : awaitingPatient
      ? "Bác sĩ đã phản hồi"
      : "Đã gửi · đang chờ bác sĩ";
  const cta = resolved ? "Xem lại trao đổi" : awaitingPatient ? "Xem trao đổi" : "Xem câu hỏi đã gửi";
  const icon = resolved ? "task_alt" : awaitingPatient ? "mark_chat_read" : "mark_email_unread";

  return (
    <div
      className={`w-full max-w-lg bg-white border rounded-xl p-3.5 sm:p-4 shadow-[0_8px_24px_rgba(25,28,28,0.06)] flex flex-col gap-3 mt-0.5 selection:bg-emerald-100 ${
        awaitingPatient
          ? "border-emerald-200/90"
          : "border-slate-200/90"
      }`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-emerald-50 border border-emerald-200/80 shrink-0">
          <div
            translate="no"
            className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#006857]"
          >
            {initials}
          </div>
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="relative z-10 w-full h-full object-cover"
              src={avatarSrc}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-sm text-slate-900 truncate">{doctorName}</p>
            <span className="text-[11px] text-slate-500 shrink-0 font-medium">
              {formatRelativeTime(thread.updated_at)}
            </span>
          </div>
          <p
            className={`text-[12px] font-semibold mt-0.5 inline-flex items-center gap-1 ${
              awaitingPatient ? "text-[#006857]" : resolved ? "text-slate-500" : "text-slate-600"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">{icon}</span>
            {subtitle}
          </p>
        </div>
      </div>

      {replyPreview ? (
        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap bg-emerald-50/60 border border-emerald-100 rounded-lg px-3.5 py-3">
          {replyPreview}
        </p>
      ) : (
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          {resolved
            ? "Bạn có thể xem lại toàn bộ trao đổi với bác sĩ."
            : awaitingPatient
              ? "Mở trao đổi để đọc phản hồi của bác sĩ."
              : "Bác sĩ sẽ trả lời tại đây. Nhấn để xem nội dung đã gửi."}
        </p>
      )}

      <button
        type="button"
        onClick={onOpen}
        className={`inline-flex items-center justify-center gap-1.5 w-fit h-9 px-3.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
          awaitingPatient
            ? "bg-[#006857] text-white hover:bg-[#005445]"
            : "bg-white text-[#006857] border border-emerald-200 hover:bg-emerald-50"
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">forum</span>
        {cta}
      </button>
    </div>
  );
}

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
  const { openEscalationThread, refreshNotificationsBadge } = usePatientPanel();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<EscalationOut | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const reason = getEscalationReason(message) ?? "unknown";
  const hasAssignedDoctor = Boolean(assignedDoctor);
  const escalationId = message.escalationId ?? null;

  const loadThread = useCallback(async () => {
    if (!escalationId) return;
    try {
      const data = await api.getChatEscalation(escalationId);
      if (
        prevStatusRef.current !== "waiting_patient" &&
        data.status === "waiting_patient"
      ) {
        void refreshNotificationsBadge();
      }
      prevStatusRef.current = data.status;
      setThread(data);
    } catch {
      /* keep last known status */
    }
  }, [escalationId, refreshNotificationsBadge]);

  useEffect(() => {
    if (!escalationId) return;
    void loadThread();
    const onFocus = () => void loadThread();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void loadThread(), 20_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [escalationId, loadThread]);

  if (escalationId) {
    const fallbackThread: EscalationOut | null = thread ?? {
      id: escalationId,
      patient_id: "",
      doctor_id: "",
      question_text: "",
      answer_text: "",
      reason: "unknown",
      patient_note: "",
      status: "waiting_doctor",
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return (
      <DoctorStatusCard
        thread={fallbackThread}
        doctor={assignedDoctor}
        onOpen={() => openEscalationThread(escalationId)}
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
