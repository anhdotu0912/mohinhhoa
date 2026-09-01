"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ApiError, type DoctorColleague, type DoctorPatientSummary } from "@/lib/types";

export function TransferDoctorControl({
  patient,
  onTransferred,
}: {
  patient: DoctorPatientSummary;
  onTransferred?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [colleagues, setColleagues] = useState<DoctorColleague[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingName = patient.pending_transfer?.to_doctor_name;

  const loadColleagues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.listDoctorColleagues();
      setColleagues(rows);
      setSelected((current) => current || rows[0]?.id || "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được danh sách bác sĩ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadColleagues();
  }, [open, loadColleagues]);

  const submit = async () => {
    if (!selected || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.transferPatient(patient.id, selected);
      setOpen(false);
      onTransferred?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không gửi được đề xuất chuyển.");
    } finally {
      setSending(false);
    }
  };

  if (pendingName) {
    return (
      <p className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-low border border-outline-variant/50 px-3 py-1.5 rounded-lg">
        Đã gửi đề xuất tới {pendingName}
      </p>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest text-on-surface text-xs font-bold hover:border-primary/40 hover:text-primary transition-all shadow-2xs active:scale-95 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
        <span className="hidden sm:inline">Chuyển bác sĩ</span>
        <span className="sm:hidden">Chuyển</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-[0_8px_24px_rgba(18,28,42,0.12)] p-3 space-y-3">
          <p className="text-xs font-bold text-on-surface">Chọn bác sĩ nhận hồ sơ</p>
          {loading ? (
            <p className="text-xs text-on-surface-variant">Đang tải danh sách…</p>
          ) : colleagues.length === 0 ? (
            <p className="text-xs text-on-surface-variant">
              Chưa có bác sĩ khác trong hệ thống.
            </p>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-outline-variant/60 bg-surface-container-low text-xs font-semibold text-on-surface"
            >
              {colleagues.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.full_name?.trim() || doc.email}
                </option>
              ))}
            </select>
          )}
          {error && <p className="text-[11px] font-medium text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 px-3 rounded-lg text-[11px] font-bold text-on-surface-variant hover:bg-surface-container-low cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!selected || sending || colleagues.length === 0}
              className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {sending ? "Đang gửi…" : "Gửi đề xuất"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
