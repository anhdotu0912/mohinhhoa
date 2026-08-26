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
    "w-24 text-center px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60";

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-subtle overflow-hidden">
      {/* Header: title + updatedAt + actions */}
      <div className="px-5 py-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface-container-low/30">
        <h4 className="font-body-bold text-body-bold text-on-surface flex items-center gap-2 font-bold text-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">
            monitor_weight
          </span>
          Chỉ số cơ thể
        </h4>

        {isEditing ? (
          <div className="flex items-center gap-2">
            {error ? (
              <span className="text-xs text-error font-medium max-w-[220px] truncate">
                {error}
              </span>
            ) : (
              <span className="font-caption text-caption text-outline text-xs">
                Sửa trực tiếp trên thẻ
              </span>
            )}
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="px-3 py-1.5 border border-outline-variant text-on-surface-variant rounded-xl text-xs font-body-bold hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-primary text-on-primary px-3 py-1.5 rounded-xl text-xs font-body-bold hover:bg-primary/90 transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 font-semibold disabled:opacity-60"
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
          <div className="flex items-center gap-3">
            <span className="font-caption text-caption text-outline text-xs">
              Cập nhật: {metrics.updated_at}
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="text-primary hover:text-primary/80 transition-colors text-xs font-body-bold flex items-center gap-1 cursor-pointer font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">
                edit_note
              </span>
              Cập nhật
            </button>
          </div>
        )}
      </div>

      {/* Body: 4 ô chỉ số — cùng p-5 với header, ô đều nhau */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-outline-variant/40">
        {/* Cân nặng */}
        <div className="px-5 py-5 min-h-[7.5rem] flex flex-col items-center justify-center text-center">
          <p className="font-label text-label text-on-surface-variant mb-2 uppercase tracking-wider text-[11px] font-semibold">
            Cân nặng
          </p>
          {isEditing ? (
            <div className="flex items-center justify-center gap-1">
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
              <span className="font-body text-body text-on-surface-variant text-sm">
                kg
              </span>
            </div>
          ) : (
            <p className="font-h1 text-h1 text-on-surface text-2xl font-bold tabular-nums">
              {metrics.weight ?? "—"}{" "}
              <span className="font-body text-body text-on-surface-variant text-sm font-normal">
                kg
              </span>
            </p>
          )}
        </div>

        {/* Chiều cao */}
        <div className="px-5 py-5 min-h-[7.5rem] flex flex-col items-center justify-center text-center">
          <p className="font-label text-label text-on-surface-variant mb-2 uppercase tracking-wider text-[11px] font-semibold">
            Chiều cao
          </p>
          {isEditing ? (
            <div className="flex items-center justify-center gap-1">
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
              <span className="font-body text-body text-on-surface-variant text-sm">
                cm
              </span>
            </div>
          ) : (
            <p className="font-h1 text-h1 text-on-surface text-2xl font-bold tabular-nums">
              {metrics.height ?? "—"}{" "}
              <span className="font-body text-body text-on-surface-variant text-sm font-normal">
                cm
              </span>
            </p>
          )}
        </div>

        {/* BMI */}
        <div className="px-5 py-5 min-h-[7.5rem] flex flex-col items-center justify-center text-center">
          <p className="font-label text-label text-on-surface-variant mb-2 uppercase tracking-wider text-[11px] font-semibold">
            BMI
          </p>
          <p className="font-h1 text-h1 text-primary text-2xl font-bold tabular-nums">
            {metrics.bmi ?? "—"}
          </p>
          <p className="font-caption text-caption text-primary/90 mt-1 text-xs font-semibold">
            {metrics.bmi_category}
          </p>
          {isEditing && (
            <p className="font-caption text-caption text-outline mt-1 text-[11px]">
              tự tính lại từ backend
            </p>
          )}
        </div>

        {/* Huyết áp / Đường huyết */}
        <div className="px-5 py-5 min-h-[7.5rem] flex flex-col items-center justify-center text-center">
          <p className="font-label text-label text-on-surface-variant mb-2 uppercase tracking-wider text-[11px] font-semibold">
            Huyết áp / Đường huyết
          </p>
          <p className="font-body-bold text-on-surface font-bold text-sm tabular-nums">
            {bloodPressure}
          </p>
          <p className="font-caption text-caption text-on-surface-variant text-xs mt-1 tabular-nums">
            {bloodGlucose}
          </p>
        </div>
      </div>
    </div>
  );
}
