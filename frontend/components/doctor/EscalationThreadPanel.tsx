"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ApiError, type EscalationOut } from "@/lib/types";
import { EscalationThread } from "@/components/shared/EscalationThread";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";

/** Conversation contents inside the doctor's floating messenger. */
export function EscalationThreadPanel({ escalationId, expanded, onClose, onBack, onUpdated }: {
  escalationId: string;
  expanded: boolean;
  onClose: () => void;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const [thread, setThread] = useState<EscalationOut | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const versionRef = useRef(0);
  const nextVersion = useCallback(() => ++versionRef.current, []);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    const version = nextVersion();
    try {
      const data = await api.getDoctorEscalation(escalationId);
      if (!mountedRef.current || version !== versionRef.current) return;
      setThread(data);
      setLoadError(null);
    } catch (err) {
      if (mountedRef.current && version === versionRef.current) {
        setLoadError(err instanceof ApiError ? err.message : "Không tải được tin mới. Vui lòng thử lại.");
      }
    }
  }, [escalationId, nextVersion]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refresh, expanded ? 5_000 : 20_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mountedRef.current = false;
      nextVersion();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, expanded, nextVersion]);

  const handleSend = async (body: string) => {
    if (busyRef.current || !thread || thread.status === "resolved") throw new Error("Cuộc trao đổi chưa sẵn sàng.");
    busyRef.current = true;
    nextVersion();
    setSending(true);
    setError(null);
    try {
      const next = await api.replyDoctorEscalation(escalationId, body);
      if (!mountedRef.current) return;
      setThread(next);
      setLoadError(null);
      onUpdated();
    } catch (err) {
      if (mountedRef.current) setError(err instanceof ApiError ? err.message : "Không gửi được phản hồi. Nội dung vẫn được giữ để thử lại.");
      throw err;
    } finally {
      busyRef.current = false;
      if (mountedRef.current) { setSending(false); void load(); }
    }
  };

  const handleResolve = async () => {
    if (busyRef.current || !thread || thread.status === "resolved") return;
    busyRef.current = true;
    nextVersion();
    setResolving(true);
    setError(null);
    try {
      const next = await api.resolveDoctorEscalation(escalationId);
      if (!mountedRef.current) return;
      setThread(next);
      onUpdated();
    } catch (err) {
      if (mountedRef.current) setError(err instanceof ApiError ? err.message : "Không kết thúc được cuộc trao đổi.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) { setResolving(false); void load(); }
    }
  };

  const avatar = resolveUserAvatar(thread?.patient_avatar);
  const name = thread?.patient_name || "Bệnh nhân";
  const status = !thread ? "Đang tải tin nhắn…" : thread.status === "resolved" ? "Trao đổi đã kết thúc" : thread.status === "waiting_patient" ? "Đã trả lời · chờ bệnh nhân" : "Bệnh nhân đang chờ phản hồi";

  return (
    <section aria-label={`Nhắn tin với ${name}`} className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-teal-100 bg-teal-50/60 px-3 py-3">
        <button type="button" onClick={onBack} aria-label="Danh sách tin nhắn bệnh nhân" title="Danh sách tin nhắn" className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-teal-800 hover:bg-teal-100"><span className="material-symbols-outlined text-xl">arrow_back</span></button>
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-200 bg-white text-xs font-bold text-teal-800">
          {userInitials(name)}
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
        </span>
        <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold text-slate-900">{name}</h2><p role="status" className="mt-0.5 text-[11px] text-slate-600">{status}</p></div>
        {thread && thread.status !== "resolved" && <button type="button" onClick={() => void handleResolve()} disabled={resolving || sending} title="Đánh dấu đã xử lý xong" aria-label="Kết thúc cuộc trao đổi" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-teal-700 hover:bg-teal-100 disabled:opacity-50"><span className={`material-symbols-outlined text-xl ${resolving ? "animate-spin" : ""}`}>{resolving ? "progress_activity" : "task_alt"}</span></button>}
        <button type="button" onClick={onClose} title="Thu gọn chat" aria-label="Thu gọn chat bệnh nhân" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><span className="material-symbols-outlined text-xl">remove</span></button>
      </header>
      {loadError && <div role="alert" className="flex items-center justify-between gap-2 bg-amber-50 px-3 py-2 text-xs text-amber-900"><span>{loadError}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline">Thử lại</button></div>}
      {thread ? <EscalationThread compact active={expanded} thread={thread} viewer="doctor" counterpartName={name} counterpartAvatar={thread.patient_avatar} sending={sending} composerDisabled={resolving} error={error} onSend={handleSend} /> : <p className="flex flex-1 items-center justify-center p-4 text-sm text-slate-500">{loadError ? "Chưa tải được cuộc trao đổi." : "Đang tải cuộc trao đổi…"}</p>}
    </section>
  );
}
