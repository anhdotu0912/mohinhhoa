"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/types";
import {
  firstFieldError,
  sanitizeBloodPressureInput,
  validateBloodPressure,
  validatePositiveNumber,
} from "@/lib/profile-validation";

interface RecordMetricsFormPanelProps {
  onBack: () => void;
  onClose: () => void;
  onSaved: () => void;
}

type FieldName = "weight" | "bloodPressure" | "bloodGlucose";
type FieldErrors = Partial<Record<FieldName, string>>;

function FieldHint({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[11px] text-rose-600 font-medium leading-snug">
      {message}
    </p>
  );
}

function inputClass(hasError: boolean) {
  return `w-full bg-slate-50 border rounded-xl p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white outline-none transition-all ${
    hasError
      ? "border-rose-400 focus:ring-4 focus:ring-rose-500/15 focus:border-rose-500"
      : "border-slate-200/90 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500"
  }`;
}

export function RecordMetricsFormPanel({
  onBack,
  onClose,
  onSaved,
}: RecordMetricsFormPanelProps) {
  const [weight, setWeight] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [bloodGlucose, setBloodGlucose] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const setFieldError = (name: FieldName, message: string | null) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  };

  const collectErrors = (): FieldErrors => {
    const next: FieldErrors = {};
    if (weight.trim()) {
      const weightErr = validatePositiveNumber(weight, 20, 300, "Cân nặng");
      if (weightErr) next.weight = weightErr;
    }
    const bpErr = validateBloodPressure(bloodPressure);
    if (bpErr) next.bloodPressure = bpErr;
    if (bloodGlucose.trim()) {
      const glucoseErr = validatePositiveNumber(
        bloodGlucose,
        2,
        33,
        "Đường huyết"
      );
      if (glucoseErr) next.bloodGlucose = glucoseErr;
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight.trim() && !bloodPressure.trim() && !bloodGlucose.trim()) {
      setFieldErrors({});
      setError("Vui lòng nhập ít nhất một chỉ số sức khỏe.");
      return;
    }

    const nextErrors = collectErrors();
    setFieldErrors(nextErrors);
    const first = firstFieldError(nextErrors);
    if (first) {
      setError(first);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.recordMetrics({
        weight: weight.trim() ? parseFloat(weight.replace(",", ".")) : undefined,
        blood_pressure: bloodPressure.trim() || undefined,
        blood_glucose: bloodGlucose.trim() || undefined,
      });
      onSaved();
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể lưu chỉ số.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-2xl overflow-hidden">
      {/* Fixed Header */}
      <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Quay lại"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div>
            <h2 className="font-bold text-lg text-slate-900">Ghi nhận chỉ số</h2>
            <p className="text-xs text-slate-500 font-medium">Nhập thông số lâm sàng mới</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Hôm nay đã ghi thì lần sau sẽ cập nhật bản ghi hiện có.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          title="Đóng (ESC)"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Form Content */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-between"
      >
        <div className="space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 animate-in fade-in duration-200">
              {error}
            </div>
          )}

          {/* Cân nặng */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-600">
                monitor_weight
              </span>
              Cân nặng (kg)
            </label>
            <input
              type="number"
              step="0.1"
              min={20}
              max={300}
              inputMode="decimal"
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value);
                setFieldError("weight", null);
              }}
              onBlur={(e) => {
                if (!e.target.value.trim()) {
                  setFieldError("weight", null);
                  return;
                }
                setFieldError(
                  "weight",
                  validatePositiveNumber(e.target.value, 20, 300, "Cân nặng")
                );
              }}
              placeholder="Ví dụ: 68.5"
              aria-invalid={Boolean(fieldErrors.weight)}
              aria-describedby={fieldErrors.weight ? "record-weight-error" : undefined}
              className={inputClass(Boolean(fieldErrors.weight))}
            />
            <FieldHint id="record-weight-error" message={fieldErrors.weight} />
          </div>

          {/* Huyết áp */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-rose-600">
                favorite
              </span>
              Huyết áp (mmHg)
            </label>
            <input
              type="text"
              value={bloodPressure}
              onChange={(e) => {
                setBloodPressure(sanitizeBloodPressureInput(e.target.value));
                setFieldError("bloodPressure", null);
              }}
              onBlur={(e) =>
                setFieldError("bloodPressure", validateBloodPressure(e.target.value))
              }
              maxLength={20}
              placeholder="Ví dụ: 120/80"
              aria-invalid={Boolean(fieldErrors.bloodPressure)}
              aria-describedby={
                fieldErrors.bloodPressure ? "record-bp-error" : undefined
              }
              className={inputClass(Boolean(fieldErrors.bloodPressure))}
            />
            <FieldHint id="record-bp-error" message={fieldErrors.bloodPressure} />
          </div>

          {/* Đường huyết */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">
                water_drop
              </span>
              Đường huyết (mmol/L)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={bloodGlucose}
              onChange={(e) => {
                setBloodGlucose(e.target.value.replace(/[^\d.,]/g, "").slice(0, 8));
                setFieldError("bloodGlucose", null);
              }}
              onBlur={(e) => {
                if (!e.target.value.trim()) {
                  setFieldError("bloodGlucose", null);
                  return;
                }
                setFieldError(
                  "bloodGlucose",
                  validatePositiveNumber(e.target.value, 2, 33, "Đường huyết")
                );
              }}
              maxLength={8}
              placeholder="Ví dụ: 5.6"
              aria-invalid={Boolean(fieldErrors.bloodGlucose)}
              aria-describedby={
                fieldErrors.bloodGlucose ? "record-glucose-error" : undefined
              }
              className={inputClass(Boolean(fieldErrors.bloodGlucose))}
            />
            <FieldHint id="record-glucose-error" message={fieldErrors.bloodGlucose} />
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-6 border-t border-slate-100 mt-6">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-[#006857] to-emerald-600 hover:from-[#005245] hover:to-emerald-700 text-white font-bold text-sm py-3 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-emerald-700/20"
          >
            <span className="material-symbols-outlined text-[18px]">
              {saving ? "progress_activity" : "save"}
            </span>
            <span>{saving ? "Đang lưu chỉ số..." : "Lưu chỉ số sức khỏe"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
