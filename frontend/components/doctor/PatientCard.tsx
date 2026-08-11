"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import { Patient } from "@/lib/mock-data";

export interface PatientCardProps {
  patient: Patient;
  onSelect?: (patientId: string) => void;
  isSelected?: boolean;
  actionText?: string;
  badgeColorClass?: string;
}

/**
  Tự động phân loại màu sắc Tag bệnh lý theo nhóm / mức độ y khoa:
  - Cảnh báo nặng / cấp tính (Gout, Suy thận): Đỏ nhạt (bg-red-50 text-red-700)
  - Bệnh đi kèm (Tăng huyết áp, Lipid): Cam nhạt (bg-orange-50 text-orange-700)
  - Mãn tính chính (Tiểu đường, Đường huyết): Vàng nhạt (bg-amber-50 text-amber-700)
  - Mặc định: Emerald / Teal nhạt (bg-emerald-50 text-emerald-800)
 */
function getConditionTagStyle(conditionName: string): string {
  const name = conditionName.toLowerCase();
  if (name.includes("suy thận") || name.includes("gout") || name.includes("cấp")) {
    return "bg-red-50 text-red-700 border-red-200/60";
  }
  if (
    name.includes("huyết áp") ||
    name.includes("lipid") ||
    name.includes("mỡ máu") ||
    name.includes("tim mạch")
  ) {
    return "bg-orange-50 text-orange-700 border-orange-200/60";
  }
  if (
    name.includes("tiểu đường") ||
    name.includes("đường huyết") ||
    name.includes("đái tháo đường")
  ) {
    return "bg-amber-50 text-amber-700 border-amber-200/60";
  }
  return "bg-emerald-50 text-emerald-800 border-emerald-200/60";
}

export function PatientCard({
  patient,
  onSelect,
  isSelected = false,
  actionText = "Tạo thực đơn",
  badgeColorClass,
}: PatientCardProps) {
  const handleCardClick = () => {
    if (onSelect) {
      onSelect(patient.id);
    }
  };

  // Split multiple conditions if separated by comma for clean pill badges
  const conditions = patient.condition
    ? patient.condition.split(",").map((c) => c.trim())
    : [];

  return (
    <div
      onClick={handleCardClick}
      className={`p-4 bg-white rounded-xl transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 group cursor-pointer ${
        isSelected
          ? "border-2 border-emerald-500 bg-emerald-50/40 shadow-xs"
          : "border border-gray-100 hover:border-gray-200 hover:bg-gray-50/80 shadow-2xs"
      }`}
    >
      {/* 1. Left Section: Avatar & Patient Details */}
      <div className="flex items-center gap-3 shrink-0">
        <img
          src={patient.avatar}
          alt={patient.name}
          className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm border border-gray-100"
        />
        <div className="flex flex-col justify-center">
          {/* Name & ID line */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <h4 className="text-base font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
              {patient.name}
            </h4>
            <span className="bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 text-xs font-normal border border-gray-200/40 shrink-0">
              {patient.id}
            </span>
          </div>

          {/* Demographics (Age • Gender • BMI) */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1 whitespace-nowrap">
            <span>{patient.age} tuổi</span>
            <span className="text-gray-300 font-bold">•</span>
            <span>{patient.gender}</span>
            {patient.bmi && (
              <>
                <span className="text-gray-300 font-bold">•</span>
                <span>BMI: {patient.bmi}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Middle Section: Pathology Badges (Flex-wrap to avoid line clipping) */}
      <div className="flex items-center gap-1.5 flex-wrap max-w-full sm:max-w-[280px]">
        {conditions.map((cond, idx) => (
          <span
            key={idx}
            className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap shadow-2xs ${
              badgeColorClass || getConditionTagStyle(cond)
            }`}
          >
            {cond}
          </span>
        ))}
      </div>

      {/* 3. Right Section: Action Button */}
      <div className="flex items-center justify-end shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
          className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95 shadow-xs whitespace-nowrap"
        >
          <span>{actionText}</span>
          <span className="material-symbols-outlined text-[18px] leading-none group-hover:translate-x-0.5 transition-transform duration-200">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
