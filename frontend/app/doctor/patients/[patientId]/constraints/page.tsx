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
    <main className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="font-h1 text-xl font-bold text-on-surface">Ràng buộc lâm sàng</h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Áp dụng cho lần tạo thực đơn AI kế tiếp — thực đơn đã tạo không tự tính lại.
          </p>
        </div>
        {pending && (
          <button
            type="button"
            disabled={approveBusy}
            onClick={() => void handleApprove()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-60"
          >
            {approveBusy ? "Đang xác nhận…" : "Xác nhận"}
          </button>
        )}
      </div>

      {pending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Ràng buộc đang chờ bác sĩ xác nhận trước khi dùng cho thực đơn AI.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="p-5 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-on-surface">Mục tiêu calo</label>
            <span className="font-mono text-xs font-bold bg-violet-50 text-violet-900 border border-violet-200 px-2.5 py-1 rounded-full">
              {form.targetKcal} kcal/ngày
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Khuyến nghị 1500–2000 kcal/ngày tùy BMI</p>
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
            className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary"
          />
        </div>

        <div className="p-5 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-on-surface">Giới hạn muối (Natri)</label>
            <span className="font-mono text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-full">
              {form.salt} g/ngày
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Khuyến nghị ≤ 5.0g/ngày (DASH ≤ 3.0g)</p>
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
            className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary"
          />
        </div>

        <div className="p-5 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-on-surface">Giới hạn đường tự do</label>
            <span className="font-mono text-xs font-bold bg-sky-50 text-sky-900 border border-sky-200 px-2.5 py-1 rounded-full">
              {form.sugar} g/ngày
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant">Khuyến nghị ≤ 25g/ngày cho kiểm soát đường huyết</p>
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
            className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[16px]">
            {saving ? "progress_activity" : "check"}
          </span>
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </div>
    </main>
  );
}
