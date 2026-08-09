"use client";

import { useState } from "react";

interface MealState {
  type: "as_planned" | "custom";
  note: string;
}

export default function PatientMealLogPage() {
  const [morning, setMorning] = useState<MealState>({ type: "as_planned", note: "" });
  const [noon, setNoon] = useState<MealState>({ type: "as_planned", note: "" });
  const [evening, setEvening] = useState<MealState>({ type: "as_planned", note: "" });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 4000);
  };

  return (
    <main className="flex-1 w-full p-lg">
      <div className="max-w-[800px] mx-auto flex flex-col gap-section-gap">
        {/* Title Header */}
        <div className="mb-md">
          <h2 className="font-h1 text-h1 text-on-surface mb-xs font-bold text-2xl">
            Hôm nay, {new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "long" })}
          </h2>
          <p className="font-body text-body text-on-surface-variant">
            Hãy ghi lại các bữa ăn để theo dõi dinh dưỡng của bạn.
          </p>
        </div>

        {/* Saved Toast Banner */}
        {savedSuccess && (
          <div className="bg-[#E5F4EC] border border-[#2F8F7A] text-[#006857] p-card-padding rounded-xl flex items-center justify-between shadow-subtle animate-fadeIn">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined">check_circle</span>
              <span className="font-body-bold">Đã lưu thông tin ghi nhận bữa ăn thành công!</span>
            </div>
            <button onClick={() => setSavedSuccess(false)} className="text-[#006857] hover:opacity-75">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        {/* Morning Meal */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-sm">
          <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-sm">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-2xl">sunny</span>
              <h3 className="font-h2 text-h2 text-on-surface font-semibold">Bữa sáng</h3>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-md mt-md">
            <button
              onClick={() => setMorning({ ...morning, type: "as_planned" })}
              className={`flex-1 font-body-bold text-body-bold py-sm px-md rounded-lg flex items-center justify-center gap-sm transition-colors h-10 ${
                morning.type === "as_planned"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Đã ăn theo kế hoạch
            </button>
            <button
              onClick={() => setMorning({ ...morning, type: "custom" })}
              className={`flex-1 font-body-bold text-body-bold py-sm px-md rounded-lg flex items-center justify-center gap-sm transition-colors h-10 ${
                morning.type === "custom"
                  ? "bg-surface-container border border-primary text-primary font-bold"
                  : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Ăn khác
            </button>
          </div>
          {morning.type === "custom" && (
            <div className="mt-md w-full animate-fadeIn">
              <label className="block font-label text-label text-on-surface mb-xs font-semibold">
                Chi tiết món ăn khác
              </label>
              <input
                type="text"
                value={morning.note}
                onChange={(e) => setMorning({ ...morning, note: e.target.value })}
                className="w-full h-10 px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest font-body text-body text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary-fixed focus:outline-none transition-all"
                placeholder="Ghi chú món đã ăn..."
              />
            </div>
          )}
        </div>

        {/* Noon Meal */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-sm">
          <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-sm">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-2xl">light_mode</span>
              <h3 className="font-h2 text-h2 text-on-surface font-semibold">Bữa trưa</h3>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-md mt-md">
            <button
              onClick={() => setNoon({ ...noon, type: "as_planned" })}
              className={`flex-1 font-body-bold text-body-bold py-sm px-md rounded-lg flex items-center justify-center gap-sm transition-colors h-10 ${
                noon.type === "as_planned"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Đã ăn theo kế hoạch
            </button>
            <button
              onClick={() => setNoon({ ...noon, type: "custom" })}
              className={`flex-1 font-body-bold text-body-bold py-sm px-md rounded-lg flex items-center justify-center gap-sm transition-colors h-10 ${
                noon.type === "custom"
                  ? "bg-surface-container border border-primary text-primary font-bold"
                  : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Ăn khác
            </button>
          </div>
          {noon.type === "custom" && (
            <div className="mt-md w-full animate-fadeIn">
              <label className="block font-label text-label text-on-surface mb-xs font-semibold">
                Chi tiết món ăn khác
              </label>
              <input
                type="text"
                value={noon.note}
                onChange={(e) => setNoon({ ...noon, note: e.target.value })}
                className="w-full h-10 px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest font-body text-body text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary-fixed focus:outline-none transition-all"
                placeholder="Ghi chú món đã ăn..."
              />
            </div>
          )}
        </div>

        {/* Evening Meal */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-sm">
          <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-sm">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-2xl">dark_mode</span>
              <h3 className="font-h2 text-h2 text-on-surface font-semibold">Bữa tối</h3>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-md mt-md">
            <button
              onClick={() => setEvening({ ...evening, type: "as_planned" })}
              className={`flex-1 font-body-bold text-body-bold py-sm px-md rounded-lg flex items-center justify-center gap-sm transition-colors h-10 ${
                evening.type === "as_planned"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Đã ăn theo kế hoạch
            </button>
            <button
              onClick={() => setEvening({ ...evening, type: "custom" })}
              className={`flex-1 font-body-bold text-body-bold py-sm px-md rounded-lg flex items-center justify-center gap-sm transition-colors h-10 ${
                evening.type === "custom"
                  ? "bg-surface-container border border-primary text-primary font-bold"
                  : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Ăn khác
            </button>
          </div>
          {evening.type === "custom" && (
            <div className="mt-md w-full animate-fadeIn">
              <label className="block font-label text-label text-on-surface mb-xs font-semibold">
                Chi tiết món ăn khác
              </label>
              <input
                type="text"
                value={evening.note}
                onChange={(e) => setEvening({ ...evening, note: e.target.value })}
                className="w-full h-10 px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest font-body text-body text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary-fixed focus:outline-none transition-all"
                placeholder="Ghi chú món đã ăn..."
              />
            </div>
          )}
        </div>

        {/* Save Action Button */}
        <div className="mt-lg flex justify-end">
          <button
            onClick={handleSave}
            className="bg-primary text-on-primary font-body-bold text-body-bold py-sm px-lg rounded-lg transition-colors hover:bg-primary-container h-10 shadow-sm flex items-center gap-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            Lưu ghi nhận
          </button>
        </div>
      </div>
    </main>
  );
}
