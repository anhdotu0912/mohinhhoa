"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { userInitials } from "@/lib/avatar";
import { ApiError, type EscalationListItem } from "@/lib/types";
import { EscalationThreadPanel } from "./EscalationThreadPanel";
import { messageTimeIso, parseMessageTime, vietnamMessageDateTime } from "@/lib/message-time";

export const DOCTOR_MESSAGES_UPDATED = "p014:doctor-messages-updated";
const MessengerContext = createContext<{ openConversation: (id: string) => void } | null>(null);

export function useDoctorMessenger() {
  const context = useContext(MessengerContext);
  if (!context) throw new Error("DoctorMessengerProvider is required");
  return context;
}

export function DoctorMessengerProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore((state) => state.userId);
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  return <MessengerState key={userId || "guest"} enabled={Boolean(userId && token && role === "doctor")}>{children}</MessengerState>;
}

function MessengerState({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const [threads, setThreads] = useState<EscalationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(0);
  const mountedRef = useRef(false);
  const fingerprintRef = useRef("");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const nextVersion = useCallback(() => ++versionRef.current, []);

  const refresh = useCallback(async () => {
    const version = nextVersion();
    try {
      const data = await api.listDoctorEscalations("open");
      if (!mountedRef.current || version !== versionRef.current) return;
      setThreads(data);
      setError(null);
      const fingerprint = data.map((thread) => `${thread.id}:${thread.updated_at}:${thread.status}`).sort().join("|");
      if (fingerprint !== fingerprintRef.current) {
        fingerprintRef.current = fingerprint;
        window.dispatchEvent(new Event(DOCTOR_MESSAGES_UPDATED));
      }
    } catch (err) {
      if (mountedRef.current && version === versionRef.current) setError(err instanceof ApiError ? err.message : "Chưa tải được tin nhắn bệnh nhân. Vui lòng thử lại.");
    } finally {
      if (mountedRef.current && version === versionRef.current) setLoading(false);
    }
  }, [nextVersion]);

  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;
    void refresh();
    const check = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(check, 10_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      mountedRef.current = false;
      nextVersion();
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, refresh, nextVersion]);

  const openConversation = useCallback((id: string) => {
    setSelectedId(id);
    setShowList(false);
    setExpanded(true);
  }, []);
  const context = useMemo(() => ({ openConversation }), [openConversation]);
  const minimize = useCallback(() => {
    setExpanded(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!expanded) return;
    panelRef.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented && panelRef.current?.contains(event.target as Node)) minimize(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [expanded, selectedId, showList, minimize]);

  const onUpdated = useCallback(() => {
    void refresh();
    window.dispatchEvent(new Event(DOCTOR_MESSAGES_UPDATED));
  }, [refresh]);
  const waitingCount = threads.filter((thread) => thread.status === "waiting_doctor").length;

  return <MessengerContext.Provider value={context}>
    {children}
    {enabled && <div className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] right-3 z-40 max-w-[calc(100vw-24px)] sm:bottom-5 sm:right-5">
      <button ref={launcherRef} type="button" hidden={expanded} aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(true)} className={`${expanded ? "hidden" : "flex"} items-center gap-2.5 rounded-full border border-teal-200 bg-[#006857] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2`}>
        <span className="material-symbols-outlined text-[23px]" aria-hidden>chat</span>
        Tin nhắn bệnh nhân
        {waitingCount > 0 && <span aria-label={`${waitingCount} cuộc trao đổi chờ trả lời`} className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-teal-800">{waitingCount}</span>}
        {error && <span title="Chưa tải được tin mới" aria-label="Chưa tải được tin mới">!</span>}
      </button>
      <div id={panelId} ref={panelRef} tabIndex={-1} hidden={!expanded} className={`${expanded ? "flex" : "hidden"} h-[min(500px,calc(100dvh-100px))] w-[380px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-[0_12px_40px_rgba(15,70,60,0.18)]`}>
        <div hidden={!showList} className={`${showList ? "flex" : "hidden"} min-h-0 flex-1 flex-col`}>
          <header className="flex items-center justify-between gap-2 border-b border-teal-100 bg-teal-50/60 px-4 py-3"><div><h2 className="text-base font-bold text-slate-900">Tin nhắn bệnh nhân</h2><p className="mt-0.5 text-xs text-slate-600">{waitingCount} cuộc trao đổi chờ trả lời</p></div><button type="button" onClick={minimize} aria-label="Thu gọn danh sách tin nhắn" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-teal-100"><span className="material-symbols-outlined text-xl">remove</span></button></header>
          {error && <div role="alert" className="bg-amber-50 px-4 py-2 text-xs text-amber-900">{error} <button type="button" onClick={() => void refresh()} className="font-semibold underline">Thử lại</button></div>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {loading ? <p className="p-4 text-sm text-slate-500">Đang tải tin nhắn…</p> : !threads.length && !error ? <p className="p-4 text-sm text-slate-600">Chưa có cuộc trao đổi đang mở. Câu hỏi bệnh nhân gửi sẽ xuất hiện tại đây.</p> : <ul className="space-y-1">{[...threads].sort((a, b) => Number(b.status === "waiting_doctor") - Number(a.status === "waiting_doctor") || (parseMessageTime(b.last_message_at || b.updated_at)?.getTime() ?? 0) - (parseMessageTime(a.last_message_at || a.updated_at)?.getTime() ?? 0)).map((thread) => <li key={thread.id}><button type="button" onClick={() => openConversation(thread.id)} className="flex w-full items-start gap-2.5 rounded-xl px-3 py-3 text-left hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-xs font-bold text-teal-800">{userInitials(thread.patient_name || "Bệnh nhân")}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{thread.patient_name || "Bệnh nhân"}</span><span className="mt-0.5 block line-clamp-2 text-sm text-slate-600">{thread.question_text || "Mở cuộc trao đổi"}</span><span className={`mt-1 block text-[11px] font-medium ${thread.status === "waiting_doctor" ? "text-amber-800" : "text-teal-700"}`}>{thread.status === "waiting_doctor" ? "Chờ bác sĩ trả lời" : "Đã phản hồi"}</span><time className="mt-1 block text-[11px] text-slate-500" dateTime={messageTimeIso(thread.last_message_at || thread.updated_at)} title={vietnamMessageDateTime(thread.last_message_at || thread.updated_at)}>{vietnamMessageDateTime(thread.last_message_at || thread.updated_at, true)}</time></span></button></li>)}</ul>}
          </div>
        </div>
        {selectedId && <div hidden={showList} className={`${showList ? "hidden" : "flex"} min-h-0 flex-1 flex-col`}><EscalationThreadPanel key={selectedId} escalationId={selectedId} expanded={expanded && !showList} onClose={minimize} onBack={() => setShowList(true)} onUpdated={onUpdated} /></div>}
      </div>
    </div>}
  </MessengerContext.Provider>;
}
