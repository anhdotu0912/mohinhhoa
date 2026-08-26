"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { asRouteId } from "@/lib/route-params";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";

type ConstraintForm = {
  salt: number;
  sugar: number;
  targetKcal: number;
};

function defaultsFrom(patient: DoctorPatientSummary): ConstraintForm {
  return {
    salt: patient.salt_daily_g ?? 5,
    sugar: patient.sugar_daily_g ?? 25,
    targetKcal: patient.target_kcal ?? 1800,
  };
}

export default function PatientConstraintsTabPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = asRouteId(params?.patientId);
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<DoctorPatientSummary | null>(null);
  const [form, setForm] = useState<ConstraintForm>({ salt: 5, sugar: 25, targetKcal: 1800 });
  const [saving, setSaving] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    if (!token || role !== "doctor" || !patientId) return;
    setLoading(true);
    setError(null);
    try {
      const row = await api.getDoctorPatient(patientId);
      setPatient(row);
      setForm(defaultsFrom(row));
    } catch (err) {
      setPatient(null);
      setError(err instanceof ApiError ? err.message : "Không tải được ràng buộc.");
    } finally {
      setLoading(false);
    }
  }, [token, role, patientId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  const handleSave = async () => {
    if (!patientId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateDoctorConstraints(patientId, {
        target_kcal: form.targetKcal,
        salt_daily_g: form.salt,
        sugar_daily_g: form.sugar,
      });
      setPatient(updated);
      setForm(defaultsFrom(updated));
      showToast("Đã lưu ràng buộc lâm sàng.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được ràng buộc.");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!patientId || approveBusy) return;
    setApproveBusy(true);
    try {
      await api.approveDoctorConstraints(patientId);
      showToast("Đã xác nhận ràng buộc lâm sàng.");
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không xác nhận được ràng buộc.");
    } finally {
      setApproveBusy(false);
    }
  };

  if (!hydrated || !token || role !== "doctor") return null;

  if (loading) {
    return (
      <main className="p-6 md:p-8 text-sm text-on-surface-variant max-w-3xl mx-auto">
        Đang tải ràng buộc lâm sàng…
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="p-6 md:p-8 max-w-3xl mx-auto text-sm text-error">
        {error || "Không tìm thấy bệnh nhân."}
      </main>
    );
  }

  const pending = patient.constraints_status === "pending_doctor_review";

  return (
    <main className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl border border-emerald-600 flex items-center gap-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-on-surface font-black text-2xl tracking-tight">
            Ràng buộc Dinh dưỡng Lâm sàng
          </h2>
          <p className="text-on-surface-variant mt-1 text-xs font-medium">
            Thiết lập ngưỡng dinh dưỡng bắt buộc cho các chu kỳ thực đơn AI kế tiếp
          </p>
        </div>
        {pending && (
          <button
            type="button"
            disabled={approveBusy}
            onClick={() => void handleApprove()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-60 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>{approveBusy ? "Đang xác nhận…" : "Xác nhận ràng buộc"}</span>
          </button>
        )}
      </div>

      {pending && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-amber-700">warning</span>
          <span>Ràng buộc đang chờ bác sĩ xác nhận trước khi đưa vào sinh thực đơn AI.</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 font-semibold">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Calo Card */}
        <div className="p-5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">local_fire_department</span>
              <span>Mục tiêu năng lượng (Calo)</span>
            </label>
            <span className="font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-md tabular-nums">
              {form.targetKcal} kcal/ngày
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant font-medium">Khuyến nghị điều trị: 1500–2000 kcal/ngày tùy thể trạng và mức độ hoạt động</p>
          <input
            type="range"
            min="800"
            max="2500"
            step="50"
            value={form.targetKcal}
            disabled={saving}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, targetKcal: parseInt(e.target.value, 10) || 1800 }))
            }
            className="w-full h-2.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Salt / Natri Card */}
        <div className="p-5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">grain</span>
              <span>Giới hạn Natri (Muối ăn)</span>
            </label>
            <span className="font-mono text-xs font-bold bg-amber-500/10 text-amber-900 border border-amber-500/20 px-3 py-1 rounded-md tabular-nums">
              {form.salt} g/ngày
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant font-medium">Khuyến nghị tim mạch/huyết áp: ≤ 5.0g muối/ngày (Chế độ DASH nghiêm ngặt ≤ 3.0g)</p>
          <input
            type="range"
            min="0"
            max="15"
            step="0.5"
            value={form.salt}
            disabled={saving}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, salt: parseFloat(e.target.value) || 0 }))
            }
            className="w-full h-2.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Sugar Card */}
        <div className="p-5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sky-600 text-[18px]">nutrition</span>
              <span>Giới hạn đường tự do</span>
            </label>
            <span className="font-mono text-xs font-bold bg-sky-500/10 text-sky-900 border border-sky-500/20 px-3 py-1 rounded-md tabular-nums">
              {form.sugar} g/ngày
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant font-medium">Khuyến nghị đái tháo đường: ≤ 25g/ngày để kiểm soát đường huyết sau ăn</p>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={form.sugar}
            disabled={saving}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, sugar: parseFloat(e.target.value) || 0 }))
            }
            className="w-full h-2.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[16px]">
            {saving ? "progress_activity" : "save"}
          </span>
          <span>{saving ? "Đang lưu…" : "Lưu thay đổi ràng buộc"}</span>
        </button>
      </div>
    </main>
  );
}
