"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ApiError, type EscalationOut } from "@/lib/types";
import { EscalationThread } from "@/components/shared/EscalationThread";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";

export function EscalationThreadPanel({
  escalationId,
  onClose,
  onResolved,
}: {
  escalationId: string;
  onClose: () => void;
  onResolved?: () => void;
}) {
  const [thread, setThread] = useState<EscalationOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getDoctorEscalation(escalationId);
      setThread(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được cuộc trao đổi.");
    } finally {
      setLoading(false);
    }
  }, [escalationId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const handleSend = async (body: string) => {
    setSending(true);
    setError(null);
    try {
      const next = await api.replyDoctorEscalation(escalationId, body);
      setThread(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không gửi được phản hồi.");
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    setError(null);
    try {
      const next = await api.resolveDoctorEscalation(escalationId);
      setThread(next);
      onResolved?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không đóng được việc.");
    } finally {
      setResolving(false);
    }
  };

  const avatarSrc = resolveUserAvatar(thread?.patient_avatar);
  const name = thread?.patient_name || "Bệnh nhân";

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div
        role="button"
        tabIndex={0}
        aria-label="Đóng trao đổi"
        className="absolute inset-0 bg-slate-950/40 cursor-pointer"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
      />
      <aside className="relative z-10 h-full w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-11 h-11 shrink-0">
              <div className="w-11 h-11 rounded-full bg-emerald-50 text-[#006857] border border-emerald-200 flex items-center justify-center font-bold text-sm">
                {userInitials(name)}
              </div>
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt=""
                  className="absolute inset-0 w-11 h-11 rounded-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base text-slate-900 truncate">{name}</h2>
              <p className="text-xs text-slate-500 font-medium">
                {thread?.status === "resolved"
                  ? "Đã kết thúc"
                  : thread?.status === "waiting_patient"
                    ? "Đã trả lời · chờ bệnh nhân"
                    : "Cần phản hồi"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {thread && thread.status !== "resolved" ? (
              <button
                type="button"
                onClick={() => void handleResolve()}
                disabled={resolving || sending}
                title="Đánh dấu đã xử lý xong cuộc trao đổi này"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-emerald-50 hover:border-emerald-300 hover:text-[#006857] transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                <span
                  className={`material-symbols-outlined text-[16px] ${
                    resolving ? "animate-spin" : ""
                  }`}
                >
                  {resolving ? "progress_activity" : "task_alt"}
                </span>
                <span>{resolving ? "Đang đóng..." : "Đã xong"}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              title="Đóng"
              aria-label="Đóng trao đổi"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col bg-[#f8fafc]">
          {loading ? (
            <p className="text-sm text-slate-500 p-5">Đang tải cuộc trao đổi…</p>
          ) : thread ? (
            <EscalationThread
              thread={thread}
              viewer="doctor"
              counterpartName={name}
              counterpartAvatar={thread.patient_avatar}
              sending={sending}
              error={error}
              onSend={(body) => void handleSend(body)}
            />
          ) : (
            <p className="text-sm text-rose-700 p-5">{error || "Không tìm thấy yêu cầu."}</p>
          )}
        </div>
      </aside>
    </div>
  );
}
