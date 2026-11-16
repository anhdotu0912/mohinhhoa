"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { EscalationThread } from "@/components/shared/EscalationThread";
import { api } from "@/lib/api";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import { ApiError, type AssignedDoctor, type EscalationOut } from "@/lib/types";
import { usePatientPanel } from "./PatientPanelProvider";

export function DoctorMiniChat({
  escalationId,
  doctor,
  initialThread,
}: {
  escalationId: string;
  doctor: AssignedDoctor | null;
  initialThread?: EscalationOut | null;
}) {
  const { openEscalationThread, refreshNotificationsBadge } = usePatientPanel();
  const [thread, setThread] = useState<EscalationOut | null>(initialThread ?? null);
  const [expanded, setExpanded] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const mountedRef = useRef(false);
  const requestVersionRef = useRef(0);
  const lastDoctorMessageRef = useRef(initialThread?.messages.filter((m) => m.sender === "doctor").at(-1)?.id);
  const contentId = useId();
  const doctorName = doctor?.full_name?.trim() || "Bác sĩ phụ trách";
  const avatar = resolveUserAvatar(doctor?.avatar);
  const nextRequestVersion = useCallback(() => ++requestVersionRef.current, []);

  const loadThread = useCallback(async () => {
    if (sendingRef.current) return;
    const version = nextRequestVersion();
    try {
      const data = await api.getChatEscalation(escalationId);
      if (!mountedRef.current || version !== requestVersionRef.current) return;
      const lastDoctorMessage = data.messages.filter((m) => m.sender === "doctor").at(-1)?.id;
      if (lastDoctorMessage && lastDoctorMessage !== lastDoctorMessageRef.current) {
        void refreshNotificationsBadge();
      }
      lastDoctorMessageRef.current = lastDoctorMessage;
      setThread(data);
      setLoadError(null);
    } catch (err) {
      if (!mountedRef.current || version !== requestVersionRef.current) return;
      setLoadError(err instanceof ApiError ? err.message : "Chưa tải được tin mới. Bạn có thể thử lại.");
    }
  }, [escalationId, refreshNotificationsBadge, nextRequestVersion]);

  useEffect(() => {
    mountedRef.current = true;
    void loadThread();
    const refresh = () => {
      if (document.visibilityState === "visible") void loadThread();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, expanded ? 5_000 : 20_000);
    return () => {
      mountedRef.current = false;
      nextRequestVersion();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [expanded, loadThread, nextRequestVersion]);

  const handleSend = async (body: string) => {
    if (!thread || sendingRef.current || thread.status === "resolved") {
      throw new Error("Cuộc trao đổi chưa sẵn sàng.");
    }
    sendingRef.current = true;
    nextRequestVersion();
    setSending(true);
    setSendError(null);
    try {
      const updated = await api.replyChatEscalation(escalationId, body);
      if (mountedRef.current) {
        setThread(updated);
        setLoadError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setSendError(err instanceof ApiError ? err.message : "Không gửi được tin nhắn. Nội dung vẫn được giữ để bạn thử lại.");
      }
      throw err;
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setSending(false);
      // Refresh status as the doctor may have closed or replied during the send.
      if (mountedRef.current) void loadThread();
    }
  };

  const resolved = thread?.status === "resolved";
  const replied = thread?.status === "waiting_patient";
  const statusText = !thread ? "Đang tải cuộc trao đổi…" : resolved ? "Trao đổi đã kết thúc" : replied ? "Bác sĩ đã phản hồi" : "Đang chờ bác sĩ phản hồi";

  return (
    <section
      aria-label={`Nhắn tin với ${doctorName}`}
      className="mt-1 w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-[0_8px_24px_rgba(25,28,28,0.06)]"
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-3 sm:px-4">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          aria-label={`${expanded ? "Thu gọn" : "Mở"} chat với bác sĩ`}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-200 bg-emerald-50 text-xs font-bold text-[#006857]" translate="no">
            {userInitials(doctorName)}
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={avatar} className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-900">{doctorName}</span>
            <span className="block text-[10px] text-slate-500">Nhắn tin với bác sĩ điều trị</span>
            <span role="status" className={`mt-0.5 block text-[11px] font-medium ${replied ? "text-[#006857]" : "text-slate-500"}`}>{statusText}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => openEscalationThread(escalationId)}
          title="Mở cuộc trao đổi đầy đủ"
          aria-label="Mở cuộc trao đổi đầy đủ"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-[#006857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_full</span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          title={expanded ? "Thu gọn chat" : "Mở chat"}
          aria-label={expanded ? "Thu gọn chat" : "Mở chat"}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <span className="material-symbols-outlined text-[20px]">{expanded ? "remove" : "expand_more"}</span>
        </button>
      </header>
      <div id={contentId} hidden={!expanded}>
        {loadError ? (
          <div role="alert" className="flex items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-[11px] text-amber-900">
            <span>{loadError}</span>
            <button type="button" className="shrink-0 font-bold underline" onClick={() => void loadThread()}>Thử lại</button>
          </div>
        ) : null}
        <div className="flex h-[340px] max-h-[65dvh] flex-col sm:h-[370px]">
          {thread ? (
            <EscalationThread
              compact
              thread={thread}
              viewer="patient"
              counterpartName={doctorName}
              counterpartAvatar={doctor?.avatar}
              sending={sending}
              error={sendError}
              onSend={handleSend}
            />
          ) : (
            <p className="flex flex-1 items-center justify-center bg-slate-50 px-4 text-sm text-slate-500">{loadError ? "Chưa tải được cuộc trao đổi." : "Đang tải tin nhắn…"}</p>
          )}
        </div>
      </div>
    </section>
  );
}
