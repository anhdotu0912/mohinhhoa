"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/types";

interface RecordMetricsFormPanelProps {
  onBack: () => void;
  onClose: () => void;
  onSaved: () => void;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight.trim() && !bloodPressure.trim() && !bloodGlucose.trim()) {
      setError("Vui lòng nhập ít nhất một chỉ số sức khỏe.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.recordMetrics({
        weight: weight.trim() ? parseFloat(weight) : undefined,
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
      <form onSubmit={handleSubmit} className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-between">
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
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Ví dụ: 68.5"
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all"
            />
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
              onChange={(e) => setBloodPressure(e.target.value)}
              placeholder="Ví dụ: 120/80"
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all"
            />
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
              type="number"
              step="0.1"
              value={bloodGlucose}
              onChange={(e) => setBloodGlucose(e.target.value)}
              placeholder="Ví dụ: 5.6"
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 outline-none transition-all"
            />
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
