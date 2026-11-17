"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ApiError, type PatientMetrics } from "@/lib/types";

type PatientMetricsCardProps = {
  patientId: string;
  initialMetrics: PatientMetrics;
  bloodPressure?: string;
  bloodGlucose?: string;
};

export function PatientMetricsCard({
  patientId,
  initialMetrics,
  bloodPressure = "—",
  bloodGlucose = "—",
}: PatientMetricsCardProps) {
  const [metrics, setMetrics] = useState<PatientMetrics>(initialMetrics);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");

  // Đồng bộ khi dữ liệu cha thay đổi (sau khi load / lưu hồ sơ)
  useEffect(() => {
    if (!isEditing) setMetrics(initialMetrics);
  }, [initialMetrics, isEditing]);

  const startEdit = () => {
    setWeightInput(metrics.weight != null ? String(metrics.weight) : "");
    setHeightInput(metrics.height != null ? String(metrics.height) : "");
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const weight = parseFloat(weightInput);
    const height = parseFloat(heightInput);
    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Cân nặng phải là số lớn hơn 0 (kg).");
      return;
    }
    if (!Number.isFinite(height) || height <= 0) {
      setError("Chiều cao phải là số lớn hơn 0 (cm).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // BMI mới nhất do backend tính lại — dùng dữ liệu trả về để cập nhật state
      const updated = await api.updatePatientMetrics(patientId, { weight, height });
      setMetrics(updated);
      setIsEditing(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Không lưu được chỉ số. Kiểm tra backend."
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-24 text-center px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/80 rounded-lg text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60";

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-xs overflow-hidden">
      {/* Header: title + updatedAt + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100/70 bg-teal-50/40 px-4 py-3">
        <h4 className="text-on-surface flex items-center gap-2 font-bold text-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">
            monitor_weight
          </span>
          <span>Chỉ số thể trạng &amp; Sinh hiệu cơ bản</span>
        </h4>

        {isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            {error ? (
              <span className="text-xs text-rose-600 font-medium max-w-[220px] truncate">
                {error}
              </span>
            ) : (
              <span className="text-on-surface-variant text-xs font-medium">
                Sửa trực tiếp
              </span>
            )}
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="px-3 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  saving ? "animate-spin" : ""
                }`}
              >
                {saving ? "progress_activity" : "save"}
              </span>
              {saving ? "Đang lưu..." : "Lưu lại"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-on-surface-variant text-xs font-medium">
              Cập nhật: {metrics.updated_at || "—"}
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="flex w-fit items-center gap-1 rounded-md border border-teal-200/70 bg-white px-2 py-1 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                edit_note
              </span>
              Cập nhật
            </button>
          </div>
        )}
      </div>

      {/* Body: 4 clinical metric cells */}
      <div className="grid grid-cols-2 gap-2.5 p-3 lg:grid-cols-4">
        {/* Cân nặng */}
        <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-3 text-center">
          <p className="text-on-surface-variant mb-1.5 uppercase tracking-wider text-[10px] font-bold">
            Cân nặng
          </p>
          {isEditing ? (
            <div className="flex items-center justify-center gap-1.5 my-1">
              <input
                type="number"
                step="0.1"
                min="1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                disabled={saving}
                className={inputClass}
                aria-label="Cân nặng (kg)"
              />
              <span className="text-on-surface-variant text-xs font-semibold">kg</span>
            </div>
          ) : (
            <p className="text-on-surface text-2xl font-black tabular-nums tracking-tight">
              {metrics.weight ?? "—"}{" "}
              <span className="text-on-surface-variant text-xs font-semibold">kg</span>
            </p>
          )}
          <span className="text-[10px] text-on-surface-variant mt-1 font-medium">Khối lượng hiện tại</span>
        </div>

        {/* Chiều cao */}
        <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-3 text-center">
          <p className="text-on-surface-variant mb-1.5 uppercase tracking-wider text-[10px] font-bold">
            Chiều cao
          </p>
          {isEditing ? (
            <div className="flex items-center justify-center gap-1.5 my-1">
              <input
                type="number"
                step="0.5"
                min="1"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                disabled={saving}
                className={inputClass}
                aria-label="Chiều cao (cm)"
              />
              <span className="text-on-surface-variant text-xs font-semibold">cm</span>
            </div>
          ) : (
            <p className="text-on-surface text-2xl font-black tabular-nums tracking-tight">
              {metrics.height ?? "—"}{" "}
              <span className="text-on-surface-variant text-xs font-semibold">cm</span>
            </p>
          )}
          <span className="text-[10px] text-on-surface-variant mt-1 font-medium">Chiều cao đo đứng</span>
        </div>

        {/* BMI */}
        <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-3 text-center">
          <p className="text-on-surface-variant mb-1.5 uppercase tracking-wider text-[10px] font-bold">
            Chỉ số BMI
          </p>
          <p className="text-primary text-2xl font-black tabular-nums tracking-tight">
            {metrics.bmi ?? "—"}
          </p>
          {metrics.bmi_category ? (
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
              {metrics.bmi_category}
            </span>
          ) : (
            <span className="text-[10px] text-on-surface-variant mt-1">Chưa phân loại</span>
          )}
        </div>

        {/* Huyết áp / Đường huyết */}
        <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-3 text-center">
          <p className="text-on-surface-variant mb-1.5 uppercase tracking-wider text-[10px] font-bold">
            Huyết áp &amp; Đường huyết
          </p>
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-rose-600">cardiology</span>
              <span className="text-on-surface font-bold text-sm tabular-nums">
                {bloodPressure || "—"}
              </span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-amber-600">bloodtype</span>
              <span className="text-on-surface-variant text-xs font-semibold tabular-nums">
                {bloodGlucose || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
