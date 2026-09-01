"use client";

import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/types";

export type FoodLogSlot = "morning" | "noon" | "evening" | "snack";

export type FoodLogModalContext = {
  slot: FoodLogSlot;
  slotLabel: string;
  dayLabel: string;
  mealPlanId: string;
  dayIndex: number;
};

type FoodLogModalProps = {
  open: boolean;
  onClose: () => void;
  context: FoodLogModalContext | null;
  onSaved?: () => void;
};

export function FoodLogModal({ open, onClose, context, onSaved }: FoodLogModalProps) {
  const dialogTitleId = useId();
  const [type, setType] = useState<"as_planned" | "custom">("as_planned");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && context) {
      setType("as_planned");
      setNote("");
      setError(null);
      setSaving(false);
    }
  }, [open, context?.slot, context?.dayIndex, context?.mealPlanId]);

  if (!open || !context) return null;

  const handleSave = async () => {
    if (type === "custom" && !note.trim()) {
      setError("Vui lòng ghi chú món ăn cho bữa «Ăn khác».");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createFoodLog({
        meal_plan_id: context.mealPlanId,
        day_index: context.dayIndex,
        slot: context.slot,
        type,
        note: type === "custom" ? note.trim() : "",
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Không lưu được ghi nhận. Kiểm tra backend."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h3 id={dialogTitleId} className="text-base font-bold text-slate-900">
              Ghi nhận bữa ăn
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {context.dayLabel} · {context.slotLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setType("as_planned")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                type === "as_planned"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Đã ăn theo kế hoạch
            </button>
            <button
              type="button"
              onClick={() => setType("custom")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                type === "custom"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Ăn khác
            </button>
          </div>

          {type === "custom" && (
            <div className="animate-fadeIn">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chi tiết món ăn khác
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
                placeholder="Ghi chú món đã ăn..."
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">
              {saving ? "progress_activity" : "save"}
            </span>
            {saving ? "Đang lưu..." : "Lưu ghi nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
