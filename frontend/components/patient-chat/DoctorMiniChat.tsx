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
  const { openEscalationThread, refreshNotificationsBadge, doctorChatExpanded: expanded, setDoctorChatExpanded: setExpanded, activePanel } = usePatientPanel();
  const [thread, setThread] = useState<EscalationOut | null>(initialThread ?? null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const mountedRef = useRef(false);
  const requestVersionRef = useRef(0);
  const lastDoctorMessageRef = useRef(initialThread?.messages.filter((m) => m.sender === "doctor").at(-1)?.id);
  const contentId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const doctorName = doctor?.full_name?.trim() || "Bác sĩ phụ trách";
  const avatar = resolveUserAvatar(doctor?.avatar);
  const nextRequestVersion = useCallback(() => ++requestVersionRef.current, []);

  const minimize = useCallback(() => {
    setExpanded(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, [setExpanded]);

  useEffect(() => {
    if (!expanded || activePanel !== null) return;
    sectionRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) minimize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, activePanel, minimize]);

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
    <div className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] right-3 z-40 max-w-[calc(100vw-24px)] sm:bottom-5 sm:right-5">
      <button
        ref={launcherRef}
        hidden={expanded}
        type="button"
        onClick={() => setExpanded(true)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className={`${expanded ? "hidden" : "flex"} max-w-full items-center gap-2.5 rounded-full border border-teal-200 bg-[#006857] py-3 pl-4 pr-5 text-left text-white shadow-lg transition-colors hover:bg-[#005445] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2`}
      >
        <span className="material-symbols-outlined text-[23px]" aria-hidden>chat</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">Nhắn {doctorName}</span>
          {replied && <span className="block text-[11px] text-teal-100">Bác sĩ đã phản hồi</span>}
        </span>
      </button>
    <section
      ref={sectionRef}
      tabIndex={-1}
      hidden={!expanded}
      role="region"
      aria-label={`Nhắn tin với ${doctorName}`}
      className={`${expanded ? "flex" : "hidden"} h-[min(480px,calc(100dvh-100px))] w-[360px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-[0_12px_40px_rgba(15,70,60,0.18)]`}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-teal-100 bg-teal-50/60 px-3 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
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
        </div>
        <button
          type="button"
          onClick={() => { setExpanded(false); openEscalationThread(escalationId); }}
          title="Mở cuộc trao đổi đầy đủ"
          aria-label="Mở cuộc trao đổi đầy đủ"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-[#006857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_full</span>
        </button>
        <button
          type="button"
          onClick={minimize}
          title="Thu gọn chat"
          aria-label="Thu gọn chat"
          aria-expanded={expanded}
          aria-controls={contentId}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <span className="material-symbols-outlined text-[20px]">remove</span>
        </button>
      </header>
      <div id={contentId} className="flex min-h-0 flex-1 flex-col">
        {loadError ? (
          <div role="alert" className="flex items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-[11px] text-amber-900">
            <span>{loadError}</span>
            <button type="button" className="shrink-0 font-bold underline" onClick={() => void loadThread()}>Thử lại</button>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col">
          {thread ? (
            <EscalationThread
              compact
              active={expanded && activePanel === null}
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
    </div>
  );
}
