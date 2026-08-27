"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ApiError, type MetricsDeltaAdviceOut } from "@/lib/types";
import { calcBmi } from "@/lib/metrics-series";
import {
  firstFieldError,
  validatePositiveInt,
  validatePositiveNumber,
} from "@/lib/profile-validation";

interface RecordMetricsFormPanelProps {
  onBack: () => void;
  onClose: () => void;
  onSaved: (advice?: MetricsDeltaAdviceOut | null) => void;
}

type FieldName =
  | "weight"
  | "waist"
  | "systolic"
  | "diastolic"
  | "glucoseFasting"
  | "glucosePost"
  | "hba1c";
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
  const [waist, setWaist] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [glucoseFasting, setGlucoseFasting] = useState("");
  const [glucosePost, setGlucosePost] = useState("");
  const [hba1c, setHba1c] = useState("");
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let cancelled = false;
    api
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        setHeightCm(profile.height ?? null);
      })
      .catch(() => {
        if (!cancelled) setHeightCm(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bmiPreview = useMemo(() => {
    const w = parseFloat(weight.replace(",", "."));
    if (!Number.isFinite(w) || !heightCm || heightCm <= 0) return null;
    return calcBmi(w, heightCm);
  }, [weight, heightCm]);

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
      const err = validatePositiveNumber(weight, 20, 300, "Cân nặng");
      if (err) next.weight = err;
    }
    if (waist.trim()) {
      const err = validatePositiveNumber(waist, 50, 200, "Vòng eo");
      if (err) next.waist = err;
    }
    if (systolic.trim()) {
      const err = validatePositiveInt(systolic, 70, 250, "Huyết áp tâm thu");
      if (err) next.systolic = err;
    }
    if (diastolic.trim()) {
      const err = validatePositiveInt(diastolic, 40, 150, "Huyết áp tâm trương");
      if (err) next.diastolic = err;
    }
    if (systolic.trim() && !diastolic.trim()) {
      next.diastolic = "Nhập cả tâm trương.";
    }
    if (diastolic.trim() && !systolic.trim()) {
      next.systolic = "Nhập cả tâm thu.";
    }
    if (systolic.trim() && diastolic.trim() && !next.systolic && !next.diastolic) {
      if (Number(systolic) <= Number(diastolic)) {
        next.systolic = "Tâm thu phải lớn hơn tâm trương.";
      }
    }
    if (glucoseFasting.trim()) {
      const err = validatePositiveNumber(glucoseFasting, 2, 33, "Đường huyết lúc đói");
      if (err) next.glucoseFasting = err;
    }
    if (glucosePost.trim()) {
      const err = validatePositiveNumber(glucosePost, 2, 33, "Đường huyết sau ăn");
      if (err) next.glucosePost = err;
    }
    if (hba1c.trim()) {
      const err = validatePositiveNumber(hba1c, 4, 15, "HbA1c");
      if (err) next.hba1c = err;
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasAny =
      weight.trim() ||
      waist.trim() ||
      systolic.trim() ||
      diastolic.trim() ||
      glucoseFasting.trim() ||
      glucosePost.trim() ||
      hba1c.trim();
    if (!hasAny) {
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
      const result = await api.recordMetrics({
        weight: weight.trim() ? parseFloat(weight.replace(",", ".")) : undefined,
        waist_cm: waist.trim() ? parseFloat(waist.replace(",", ".")) : undefined,
        systolic: systolic.trim() ? parseInt(systolic, 10) : undefined,
        diastolic: diastolic.trim() ? parseInt(diastolic, 10) : undefined,
        glucose_fasting: glucoseFasting.trim()
          ? parseFloat(glucoseFasting.replace(",", "."))
          : undefined,
        glucose_postprandial: glucosePost.trim()
          ? parseFloat(glucosePost.replace(",", "."))
          : undefined,
        hba1c: hba1c.trim() ? parseFloat(hba1c.replace(",", ".")) : undefined,
      });
      onSaved(result.delta_advice ?? null);
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể lưu chỉ số.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="px-4 sm:px-6 md:px-8 py-3.5 sm:py-5 min-h-[64px] border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer shrink-0"
            title="Quay lại"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">arrow_back</span>
          </button>
          <div className="min-w-0">
            <h2 className="font-bold text-base sm:text-lg text-slate-900 truncate">Ghi nhận chỉ số</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
              Không bắt buộc đủ bộ — hôm nay đã ghi thì sẽ cập nhật.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          title="Đóng (ESC)"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="p-3.5 sm:p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-between gap-6"
      >
        <div className="space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                placeholder="68.5"
                aria-invalid={Boolean(fieldErrors.weight)}
                aria-describedby={fieldErrors.weight ? "record-weight-error" : undefined}
                className={inputClass(Boolean(fieldErrors.weight))}
              />
              <FieldHint id="record-weight-error" message={fieldErrors.weight} />
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                BMI
              </label>
              <div className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-sm text-slate-900 tabular-nums">
                {bmiPreview != null ? bmiPreview : "—"}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                {heightCm
                  ? "Tự tính từ cân nặng và chiều cao hồ sơ."
                  : (
                    <>
                      Cần chiều cao trong{" "}
                      <Link href="/patient/profile" className="text-[#006857] font-semibold underline-offset-2 hover:underline">
                        hồ sơ
                      </Link>{" "}
                      để có BMI.
                    </>
                  )}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Vòng eo (cm)
            </label>
            <input
              type="number"
              step="0.1"
              min={50}
              max={200}
              inputMode="decimal"
              value={waist}
              onChange={(e) => {
                setWaist(e.target.value);
                setFieldError("waist", null);
              }}
              placeholder="92"
              aria-invalid={Boolean(fieldErrors.waist)}
              className={inputClass(Boolean(fieldErrors.waist))}
            />
            <FieldHint id="record-waist-error" message={fieldErrors.waist} />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tâm thu
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={70}
                max={250}
                value={systolic}
                onChange={(e) => {
                  setSystolic(e.target.value);
                  setFieldError("systolic", null);
                }}
                placeholder="128"
                aria-invalid={Boolean(fieldErrors.systolic)}
                className={inputClass(Boolean(fieldErrors.systolic))}
              />
              <FieldHint id="record-sys-error" message={fieldErrors.systolic} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tâm trương
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={40}
                max={150}
                value={diastolic}
                onChange={(e) => {
                  setDiastolic(e.target.value);
                  setFieldError("diastolic", null);
                }}
                placeholder="78"
                aria-invalid={Boolean(fieldErrors.diastolic)}
                className={inputClass(Boolean(fieldErrors.diastolic))}
              />
              <FieldHint id="record-dia-error" message={fieldErrors.diastolic} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Đường lúc đói
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={glucoseFasting}
                onChange={(e) => {
                  setGlucoseFasting(e.target.value.replace(/[^\d.,]/g, "").slice(0, 8));
                  setFieldError("glucoseFasting", null);
                }}
                placeholder="5.6"
                aria-invalid={Boolean(fieldErrors.glucoseFasting)}
                className={inputClass(Boolean(fieldErrors.glucoseFasting))}
              />
              <p className="text-[11px] text-slate-500">mmol/L · 4.4–7.2</p>
              <FieldHint id="record-gf-error" message={fieldErrors.glucoseFasting} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Đường sau ăn
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={glucosePost}
                onChange={(e) => {
                  setGlucosePost(e.target.value.replace(/[^\d.,]/g, "").slice(0, 8));
                  setFieldError("glucosePost", null);
                }}
                placeholder="8.4"
                aria-invalid={Boolean(fieldErrors.glucosePost)}
                className={inputClass(Boolean(fieldErrors.glucosePost))}
              />
              <p className="text-[11px] text-slate-500">mmol/L · dưới 10</p>
              <FieldHint id="record-gp-error" message={fieldErrors.glucosePost} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              HbA1c (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={hba1c}
              onChange={(e) => {
                setHba1c(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6));
                setFieldError("hba1c", null);
              }}
              placeholder="6.8"
              aria-invalid={Boolean(fieldErrors.hba1c)}
              className={inputClass(Boolean(fieldErrors.hba1c))}
            />
            <p className="text-[11px] text-slate-500">Thường đo mỗi 3 tháng · mục tiêu dưới 7%</p>
            <FieldHint id="record-hba1c-error" message={fieldErrors.hba1c} />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 mt-6">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#006857] hover:bg-[#005245] text-white font-bold text-sm py-3 rounded-xl shadow-[0_8px_18px_rgba(0,104,87,0.22)] transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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
