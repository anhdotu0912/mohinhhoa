"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ApiError, type MetricsDeltaAdviceOut, type MetricsHistoryPoint } from "@/lib/types";
import { calcBmi, parseBpPair, parseGlucoseMmol } from "@/lib/metrics-series";
import {
  firstFieldError,
  validatePositiveInt,
  validatePositiveNumber,
} from "@/lib/profile-validation";

interface RecordMetricsFormPanelProps {
  onBack: () => void;
  onClose: () => void;
  onSaved: (advice?: MetricsDeltaAdviceOut | null, entry?: MetricsHistoryPoint) => void;
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

interface BaselineValues {
  weight: number | null;
  waist: number | null;
  systolic: number | null;
  diastolic: number | null;
  glucoseFasting: number | null;
  glucosePost: number | null;
  hba1c: number | null;
}

function MetricStepperField({
  label,
  value,
  onChange,
  prevValue,
  unit,
  step,
  min,
  max,
  precision = 1,
  hint,
  error,
  id,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  prevValue: number | null;
  unit: string;
  step: number;
  min?: number;
  max?: number;
  precision?: number;
  hint?: string;
  error?: string;
  id: string;
}) {
  const numVal = parseFloat(value.replace(",", "."));
  const hasValidNum = Number.isFinite(numVal);

  const delta = useMemo(() => {
    if (!hasValidNum || prevValue == null) return null;
    const diff = numVal - prevValue;
    const rounded = Math.round(diff * 10) / 10;
    return Math.abs(rounded) < 0.001 ? 0 : rounded;
  }, [hasValidNum, numVal, prevValue]);

  const handleStep = (direction: 1 | -1) => {
    const current = hasValidNum ? numVal : prevValue ?? (min ?? 0);
    let next = current + direction * step;
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;
    const factor = Math.pow(10, precision);
    const fixed = Math.round(next * factor) / factor;
    onChange(precision === 0 ? String(fixed) : fixed.toFixed(precision));
  };

  return (
    <div className="space-y-1.5 p-3 sm:p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/90 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
          {label}
        </label>
        {prevValue != null && (
          <span className="text-[11px] text-slate-500 font-medium shrink-0">
            Lần trước: <strong className="text-slate-700">{prevValue} {unit}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Decrement Button */}
        <button
          type="button"
          onClick={() => handleStep(-1)}
          className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors active:scale-95 shadow-2xs cursor-pointer shrink-0"
          title={`Giảm ${step} ${unit}`}
          aria-label={`Giảm ${label}`}
        >
          <span className="material-symbols-outlined text-[20px]">remove</span>
        </button>

        {/* Value Input */}
        <div className="relative flex-1">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={prevValue != null ? String(prevValue) : "—"}
            className={`w-full bg-white border rounded-xl py-2 px-3 text-center text-base sm:text-lg font-extrabold text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all tabular-nums ${
              error
                ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20"
                : "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            }`}
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
              {unit}
            </span>
          )}
        </div>

        {/* Increment Button */}
        <button
          type="button"
          onClick={() => handleStep(1)}
          className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors active:scale-95 shadow-2xs cursor-pointer shrink-0"
          title={`Tăng ${step} ${unit}`}
          aria-label={`Tăng ${label}`}
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </div>

      {/* Real-time Delta Feedback & Hints */}
      <div className="flex items-center justify-between text-[11px] min-h-[18px]">
        {error ? (
          <p role="alert" className="text-rose-600 font-medium">
            {error}
          </p>
        ) : (
          <p className="text-slate-500 truncate">{hint || ""}</p>
        )}

        {delta !== null && (
          <div className="shrink-0 ml-auto pl-2">
            {delta === 0 ? (
              <span className="text-[10.5px] font-semibold text-slate-400">
                Không đổi
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold border shadow-2xs ${
                  delta > 0
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                {delta > 0 ? `+${delta}` : `${delta}`} {unit}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
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

  const [baselines, setBaselines] = useState<BaselineValues>({
    weight: null,
    waist: null,
    systolic: null,
    diastolic: null,
    glucoseFasting: null,
    glucosePost: null,
    hba1c: null,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let cancelled = false;
    async function fetchInitial() {
      try {
        const [profile, history] = await Promise.all([
          api.getProfile().catch(() => null),
          api.getMetricsHistory(90).catch(() => []),
        ]);

        if (cancelled) return;

        if (profile?.height) {
          setHeightCm(profile.height);
        }

        const sorted = [...(history as MetricsHistoryPoint[])].sort(
          (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );

        const lastWeight = [...sorted].reverse().find((p) => p.weight != null)?.weight ?? profile?.weight ?? null;
        const lastWaist = [...sorted].reverse().find((p) => p.waist_cm != null)?.waist_cm ?? null;

        let lastSys: number | null = null;
        let lastDia: number | null = null;
        const bpPt = [...sorted].reverse().find((p) => p.systolic != null || Boolean(p.blood_pressure));
        if (bpPt) {
          if (bpPt.systolic != null && bpPt.diastolic != null) {
            lastSys = bpPt.systolic;
            lastDia = bpPt.diastolic;
          } else if (bpPt.blood_pressure) {
            const pair = parseBpPair(bpPt.blood_pressure);
            lastSys = pair.sys;
            lastDia = pair.dia;
          }
        } else if (profile?.blood_pressure) {
          const pair = parseBpPair(profile.blood_pressure);
          lastSys = pair.sys;
          lastDia = pair.dia;
        }

        const gfPt = [...sorted].reverse().find((p) => p.glucose_fasting != null || Boolean(p.blood_glucose));
        const lastGf = gfPt ? gfPt.glucose_fasting ?? parseGlucoseMmol(gfPt.blood_glucose) : (profile?.blood_glucose ? parseGlucoseMmol(profile.blood_glucose) : null);

        const gpPt = [...sorted].reverse().find((p) => p.glucose_postprandial != null);
        const lastGp = gpPt?.glucose_postprandial ?? null;

        const hba1cPt = [...sorted].reverse().find((p) => p.hba1c != null);
        const lastHba1c = hba1cPt?.hba1c ?? null;

        setBaselines({
          weight: lastWeight,
          waist: lastWaist,
          systolic: lastSys,
          diastolic: lastDia,
          glucoseFasting: lastGf,
          glucosePost: lastGp,
          hba1c: lastHba1c,
        });

        // Initialize fields with previous values so users can immediately hit +/-
        if (lastWeight != null) setWeight(String(lastWeight));
        if (lastWaist != null) setWaist(String(lastWaist));
        if (lastSys != null) setSystolic(String(lastSys));
        if (lastDia != null) setDiastolic(String(lastDia));
        if (lastGf != null) setGlucoseFasting(String(lastGf));
        if (lastGp != null) setGlucosePost(String(lastGp));
        if (lastHba1c != null) setHba1c(String(lastHba1c));
      } catch {
        /* fallback */
      }
    }

    void fetchInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const bmiPreview = useMemo(() => {
    const w = parseFloat(weight.replace(",", "."));
    if (!Number.isFinite(w) || !heightCm || heightCm <= 0) return null;
    return calcBmi(w, heightCm);
  }, [weight, heightCm]);

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
      onSaved(result.delta_advice ?? null, result);
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể lưu chỉ số.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
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
              Bấm nút [+] hoặc [-] để điều chỉnh nhanh so với lần ghi trước.
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
        <div className="space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 animate-in fade-in">
              {error}
            </div>
          )}

          {/* 1. Cân nặng & BMI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <MetricStepperField
              id="field-weight"
              label="Cân nặng"
              value={weight}
              onChange={(val) => {
                setWeight(val);
                setFieldErrors((p) => ({ ...p, weight: undefined }));
              }}
              prevValue={baselines.weight}
              unit="kg"
              step={0.5}
              min={20}
              max={300}
              precision={1}
              hint="Mục tiêu giảm 0.5kg/tuần"
              error={fieldErrors.weight}
            />

            <div className="space-y-1.5 p-3 sm:p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Chỉ số BMI
              </label>
              <div className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-center text-base sm:text-lg font-extrabold text-slate-900 tabular-nums shadow-2xs">
                {bmiPreview != null ? bmiPreview : "—"}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                {heightCm
                  ? `Tự tính theo chiều cao ${heightCm}cm.`
                  : (
                    <>
                      Cần chiều cao trong{" "}
                      <Link href="/patient/profile" className="text-[#006857] font-semibold underline-offset-2 hover:underline">
                        hồ sơ
                      </Link>{" "}
                      để tính BMI.
                    </>
                  )}
              </p>
            </div>
          </div>

          {/* 2. Vòng eo */}
          <MetricStepperField
            id="field-waist"
            label="Vòng eo"
            value={waist}
            onChange={(val) => {
              setWaist(val);
              setFieldErrors((p) => ({ ...p, waist: undefined }));
            }}
            prevValue={baselines.waist}
            unit="cm"
            step={1.0}
            min={50}
            max={200}
            precision={1}
            hint="Đo ngang rốn khi thở ra nhẹ nhàng"
            error={fieldErrors.waist}
          />

          {/* 3. Huyết áp Tâm thu & Tâm trương */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <MetricStepperField
              id="field-systolic"
              label="Huyết áp tâm thu"
              value={systolic}
              onChange={(val) => {
                setSystolic(val);
                setFieldErrors((p) => ({ ...p, systolic: undefined }));
              }}
              prevValue={baselines.systolic}
              unit="mmHg"
              step={1}
              min={70}
              max={250}
              precision={0}
              hint="Chuẩn an toàn: < 130 mmHg"
              error={fieldErrors.systolic}
            />

            <MetricStepperField
              id="field-diastolic"
              label="Huyết áp tâm trương"
              value={diastolic}
              onChange={(val) => {
                setDiastolic(val);
                setFieldErrors((p) => ({ ...p, diastolic: undefined }));
              }}
              prevValue={baselines.diastolic}
              unit="mmHg"
              step={1}
              min={40}
              max={150}
              precision={0}
              hint="Chuẩn an toàn: < 80 mmHg"
              error={fieldErrors.diastolic}
            />
          </div>

          {/* 4. Đường huyết lúc đói & sau ăn */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <MetricStepperField
              id="field-gf"
              label="Đường huyết lúc đói"
              value={glucoseFasting}
              onChange={(val) => {
                setGlucoseFasting(val);
                setFieldErrors((p) => ({ ...p, glucoseFasting: undefined }));
              }}
              prevValue={baselines.glucoseFasting}
              unit="mmol/L"
              step={0.1}
              min={2}
              max={33}
              precision={1}
              hint="Mục tiêu ADA: 4.4 – 7.2 mmol/L"
              error={fieldErrors.glucoseFasting}
            />

            <MetricStepperField
              id="field-gp"
              label="Đường sau ăn 2h"
              value={glucosePost}
              onChange={(val) => {
                setGlucosePost(val);
                setFieldErrors((p) => ({ ...p, glucosePost: undefined }));
              }}
              prevValue={baselines.glucosePost}
              unit="mmol/L"
              step={0.1}
              min={2}
              max={33}
              precision={1}
              hint="Mục tiêu ADA: < 10.0 mmol/L"
              error={fieldErrors.glucosePost}
            />
          </div>

          {/* 5. HbA1c */}
          <MetricStepperField
            id="field-hba1c"
            label="HbA1c (Đo mỗi 3 tháng)"
            value={hba1c}
            onChange={(val) => {
              setHba1c(val);
              setFieldErrors((p) => ({ ...p, hba1c: undefined }));
            }}
            prevValue={baselines.hba1c}
            unit="%"
            step={0.1}
            min={4}
            max={15}
            precision={1}
            hint="Mục tiêu chung: < 7.0%"
            error={fieldErrors.hba1c}
          />
        </div>

        {/* Submit Action */}
        <div className="pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#006857] hover:bg-[#005245] text-white font-bold text-sm py-3.5 rounded-xl shadow-[0_8px_18px_rgba(0,104,87,0.22)] transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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
