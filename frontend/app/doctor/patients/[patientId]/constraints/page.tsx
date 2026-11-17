"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  CLINICAL_LIMITS,
  clampClinical,
  validateConstraintValues,
  validateTreatmentGoals,
} from "@/lib/clinical-constraints";
import { displaySaltG, sodiumDailyFromSaltG } from "@/lib/nutrient-display";
import { TREATMENT_GOAL_OPTIONS } from "@/lib/profile-mappers";
import { asRouteId } from "@/lib/route-params";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";
import { ConstraintRangeInput } from "@/components/shared/ConstraintRangeInput";
import { validateFreeTextLabel } from "@/lib/profile-validation";

type ConstraintForm = {
  salt: number;
  sugar: number;
  targetKcal: number;
  carbPerMeal: number;
  selectedGoals: string[];
};

function defaultsFrom(patient: DoctorPatientSummary): ConstraintForm {
  const salt = clampClinical(
    "salt_daily_g",
    displaySaltG(patient.salt_daily_g, patient.sodium_daily)
  );
  return {
    salt,
    sugar: clampClinical("sugar_daily_g", patient.sugar_daily_g),
    targetKcal: clampClinical("target_kcal", patient.target_kcal),
    carbPerMeal: clampClinical("carb_per_meal", patient.carb_per_meal),
    selectedGoals: [...(patient.treatment_goals ?? [])],
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
  const [form, setForm] = useState<ConstraintForm>({
    salt: CLINICAL_LIMITS.salt_daily_g.default,
    sugar: CLINICAL_LIMITS.sugar_daily_g.default,
    targetKcal: CLINICAL_LIMITS.target_kcal.default,
    carbPerMeal: CLINICAL_LIMITS.carb_per_meal.default,
    selectedGoals: [],
  });
  const [customGoalInput, setCustomGoalInput] = useState("");
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
      setCustomGoalInput("");
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

  const toggleGoal = (goal: string) => {
    setForm((prev) => ({
      ...prev,
      selectedGoals: prev.selectedGoals.includes(goal)
        ? prev.selectedGoals.filter((g) => g !== goal)
        : [...prev.selectedGoals, goal],
    }));
  };

  const handleAddCustomGoal = () => {
    const err = validateFreeTextLabel(customGoalInput, {
      required: true,
      min: 3,
      max: 80,
      label: "Mục tiêu",
    });
    if (err) {
      setError(err);
      return;
    }
    const g = customGoalInput.trim();
    const nextGoals = form.selectedGoals.includes(g)
      ? form.selectedGoals
      : [...form.selectedGoals, g];
    const goalsErr = validateTreatmentGoals(nextGoals);
    if (goalsErr) {
      setError(goalsErr);
      return;
    }
    setForm((prev) =>
      prev.selectedGoals.includes(g)
        ? prev
        : { ...prev, selectedGoals: [...prev.selectedGoals, g] }
    );
    setCustomGoalInput("");
    setError(null);
  };

  const handleSave = async () => {
    if (!patientId || saving) return;
    const validationError = validateConstraintValues({
      target_kcal: form.targetKcal,
      carb_per_meal: form.carbPerMeal,
      sodium_daily: sodiumDailyFromSaltG(form.salt),
      salt_daily_g: form.salt,
      sugar_daily_g: form.sugar,
      treatment_goals: form.selectedGoals,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateDoctorConstraints(patientId, {
        target_kcal: form.targetKcal,
        salt_daily_g: form.salt,
        sugar_daily_g: form.sugar,
        carb_per_meal: form.carbPerMeal,
        sodium_daily: sodiumDailyFromSaltG(form.salt),
        treatment_goals: form.selectedGoals,
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
      showToast("Đã áp dụng đề xuất ràng buộc của bệnh nhân.");
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Không xác nhận được ràng buộc.");
    } finally {
      setApproveBusy(false);
    }
  };

  const handleKeepCurrent = async () => {
    if (!patientId || saving || !patient) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateDoctorConstraints(patientId, {
        target_kcal: patient.target_kcal,
      });
      setPatient(updated);
      setForm(defaultsFrom(updated));
      showToast("Đã giữ ràng buộc hiện hành, hủy đề xuất của bệnh nhân.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không hủy được đề xuất.");
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated || !token || role !== "doctor") return null;

  if (loading) {
    return (
      <main className="px-4 py-4 sm:px-6 text-sm text-on-surface-variant w-full max-w-[1240px] mx-auto flex-1">
        Đang tải ràng buộc lâm sàng…
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="px-4 py-4 sm:px-6 w-full max-w-[1240px] mx-auto text-sm text-error flex-1">
        {error || "Không tìm thấy bệnh nhân."}
      </main>
    );
  }

  const pending = patient.constraints_status === "pending_doctor_review";
  const currentSaltG = displaySaltG(patient.salt_daily_g, patient.sodium_daily);
  const proposedSaltG = displaySaltG(
    patient.proposed_salt_daily_g,
    patient.proposed_sodium_daily
  );

  return (
    <main className="px-4 py-4 sm:px-6 w-full max-w-[1240px] mx-auto space-y-4 flex-1">
      {toast && (
        <div className="fixed top-[calc(var(--doctor-nav-height,64px)+1rem)] right-6 z-50 bg-emerald-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl border border-emerald-600 flex items-center gap-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-slate-900 text-[26px] font-bold tracking-tight">
            Ràng buộc dinh dưỡng lâm sàng
          </h2>
          <p className="text-on-surface-variant mt-1 text-xs font-medium">
            {pending
              ? "Đối chiếu đề xuất của bệnh nhân với giá trị đang dùng cho sinh thực đơn, rồi duyệt hoặc ghi đè."
              : "Thiết lập ngưỡng dinh dưỡng bắt buộc cho các chu kỳ thực đơn AI kế tiếp"}
          </p>
        </div>
      </div>

      {pending && (
        <section
          aria-label="Duyệt đề xuất ràng buộc"
          className="rounded-xl border border-amber-300 bg-amber-50/80 overflow-hidden shadow-2xs"
        >
          <div className="px-4 py-3 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-700 text-[20px]">
                clinical_notes
              </span>
              <h3 className="text-sm font-bold text-amber-950">
                Đề xuất đang chờ duyệt
              </h3>
            </div>
            <p className="text-[11px] font-semibold text-amber-800">
              Thực đơn AI vẫn dùng cột “Hiện hành” cho tới khi bạn xác nhận.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-amber-100/70 text-amber-900 uppercase tracking-wider text-[10px] font-bold">
                  <th className="px-4 py-2.5">Chỉ số</th>
                  <th className="px-4 py-2.5">Hiện hành (đang dùng)</th>
                  <th className="px-4 py-2.5">Bệnh nhân đề xuất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200/70 text-amber-950">
                <tr>
                  <td className="px-4 py-2.5 font-semibold">Năng lượng</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">{patient.target_kcal} kcal</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums font-bold">
                    {patient.proposed_target_kcal != null
                      ? `${patient.proposed_target_kcal} kcal`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold">Carb / bữa</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">
                    {patient.carb_per_meal != null ? `${patient.carb_per_meal} g` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums font-bold">
                    {patient.proposed_carb_per_meal != null
                      ? `${patient.proposed_carb_per_meal} g`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold">Muối / ngày</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">
                    {currentSaltG != null ? `${currentSaltG} g` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums font-bold">
                    {proposedSaltG != null ? `${proposedSaltG} g` : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold">Đường / ngày</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">
                    {patient.sugar_daily_g != null ? `${patient.sugar_daily_g} g` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums font-bold">
                    {patient.proposed_sugar_daily_g != null
                      ? `${patient.proposed_sugar_daily_g} g`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold align-top">Mục tiêu điều trị</td>
                  <td className="px-4 py-2.5 text-[11px]">
                    {(patient.treatment_goals || []).join("; ") || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] font-bold">
                    {patient.proposed_treatment_goals &&
                    patient.proposed_treatment_goals.length > 0
                      ? patient.proposed_treatment_goals.join("; ")
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-amber-100/40 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleKeepCurrent()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-300 bg-white text-amber-950 text-xs font-bold hover:bg-amber-50 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span>{saving ? "Đang hủy…" : "Giữ giá trị hiện hành"}</span>
            </button>
            <button
              type="button"
              disabled={approveBusy}
              onClick={() => void handleApprove()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>{approveBusy ? "Đang xác nhận…" : "Xác nhận đề xuất"}</span>
            </button>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 font-semibold">
          {error}
        </div>
      )}

      {pending && (
        <p className="text-xs font-semibold text-on-surface-variant">
          Bên dưới là ghi đè của bác sĩ. Lưu sẽ hủy đề xuất và áp dụng ngay cho lần sinh thực đơn kế tiếp.
        </p>
      )}

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-w-0 flex-col justify-between space-y-3 rounded-xl border border-teal-200/70 bg-teal-50/50 p-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                <span className="material-symbols-outlined text-primary text-[18px]">local_fire_department</span>
                <span>Năng lượng (Calo)</span>
              </label>
              <span className="font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-md tabular-nums">
                {form.targetKcal} kcal
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
              Hợp lệ {CLINICAL_LIMITS.target_kcal.min}–{CLINICAL_LIMITS.target_kcal.max} kcal. Khuyến nghị điều trị: 1500–2000 kcal/ngày.
            </p>
          </div>
          <ConstraintRangeInput
            limitKey="target_kcal"
            value={form.targetKcal}
            disabled={saving}
            onChange={(value) => setForm((prev) => ({ ...prev, targetKcal: value }))}
          />
        </div>

        <div className="flex min-w-0 flex-col justify-between space-y-3 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                <span className="material-symbols-outlined text-lime-700 text-[18px]">nutrition</span>
                <span>Carb / bữa</span>
              </label>
              <span className="font-mono text-xs font-bold bg-lime-500/10 text-lime-900 border border-lime-500/20 px-2.5 py-0.5 rounded-md tabular-nums">
                {form.carbPerMeal} g
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
              Hợp lệ {CLINICAL_LIMITS.carb_per_meal.min}–{CLINICAL_LIMITS.carb_per_meal.max} g/bữa.
            </p>
          </div>
          <ConstraintRangeInput
            limitKey="carb_per_meal"
            value={form.carbPerMeal}
            disabled={saving}
            onChange={(value) => setForm((prev) => ({ ...prev, carbPerMeal: value }))}
          />
        </div>

        <div className="flex min-w-0 flex-col justify-between space-y-3 rounded-xl border border-amber-200/70 bg-amber-50/50 p-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">science</span>
                <span>Muối / ngày</span>
              </label>
              <span className="font-mono text-xs font-bold bg-amber-500/10 text-amber-900 border border-amber-500/20 px-2.5 py-0.5 rounded-md tabular-nums">
                {form.salt} g
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
              Hợp lệ {CLINICAL_LIMITS.salt_daily_g.min}–{CLINICAL_LIMITS.salt_daily_g.max} g. Khuyến nghị tim mạch: ≤ 5.0g/ngày.
            </p>
          </div>
          <ConstraintRangeInput
            limitKey="salt_daily_g"
            value={form.salt}
            disabled={saving}
            onChange={(value) => setForm((prev) => ({ ...prev, salt: value }))}
          />
        </div>

        <div className="flex min-w-0 flex-col justify-between space-y-3 rounded-xl border border-sky-200/70 bg-sky-50/50 p-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                <span className="material-symbols-outlined text-sky-600 text-[18px]">icecream</span>
                <span>Đường / ngày</span>
              </label>
              <span className="font-mono text-xs font-bold bg-sky-500/10 text-sky-900 border border-sky-500/20 px-2.5 py-0.5 rounded-md tabular-nums">
                {form.sugar} g
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
              Hợp lệ {CLINICAL_LIMITS.sugar_daily_g.min}–{CLINICAL_LIMITS.sugar_daily_g.max} g. Khuyến nghị ĐTĐ: ≤ 25g/ngày.
            </p>
          </div>
          <ConstraintRangeInput
            limitKey="sugar_daily_g"
            value={form.sugar}
            disabled={saving}
            onChange={(value) => setForm((prev) => ({ ...prev, sugar: value }))}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-teal-100 bg-white p-4 shadow-xs">
        <div>
          <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
            <span className="material-symbols-outlined text-teal-700 text-[18px]">flag</span>
            <span>Mục tiêu điều trị</span>
          </label>
          <p className="text-[11px] text-on-surface-variant font-medium mt-1">
            Áp dụng ngay khi lưu. Bệnh nhân chỉ được đề xuất từ hồ sơ của họ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TREATMENT_GOAL_OPTIONS.map((goal) => {
            const isSelected = form.selectedGoals.includes(goal);
            return (
              <button
                key={goal}
                type="button"
                disabled={saving}
                onClick={() => toggleGoal(goal)}
                className={`w-fit max-w-full px-2.5 py-1.5 rounded-md text-left text-xs font-semibold border transition-all cursor-pointer disabled:opacity-60 ${
                  isSelected
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-surface-container-low border-outline-variant text-on-surface-variant hover:border-primary/50"
                }`}
              >
                {isSelected ? "✓ " : ""}
                {goal}
              </button>
            );
          })}
          {form.selectedGoals
            .filter((g) => !TREATMENT_GOAL_OPTIONS.includes(g))
            .map((goal) => (
              <button
                key={goal}
                type="button"
                disabled={saving}
                onClick={() => toggleGoal(goal)}
                className="w-fit max-w-full px-2.5 py-1.5 rounded-md text-left text-xs font-semibold border bg-primary/10 border-primary text-primary cursor-pointer disabled:opacity-60"
              >
                ✓ {goal}
              </button>
            ))}
        </div>
        <div className="flex max-w-lg gap-2">
          <input
            type="text"
            value={customGoalInput}
            disabled={saving}
            maxLength={80}
            onChange={(e) => setCustomGoalInput(e.target.value.slice(0, 80))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomGoal();
              }
            }}
            placeholder="Thêm mục tiêu khác..."
            className="min-w-0 flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={saving}
            onClick={handleAddCustomGoal}
            className="px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-60"
          >
            + Thêm
          </button>
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
