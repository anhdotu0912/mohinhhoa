"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import { Patient } from "@/lib/mock-data";

export interface PatientCardProps {
  patient: Patient;
  onSelect?: (patientId: string) => void;
  isSelected?: boolean;
  actionText?: string;
  badgeColorClass?: string;
}

/** Rút gọn UUID / mã dài — khớp danh sách bệnh nhân bác sĩ. */
export function truncatePatientId(id: string): string {
  if (!id) return "—";
  return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
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

const MAX_CONDITION_TAGS = 2;

export function PatientCard({
  patient,
  onSelect,
  isSelected = false,
  actionText = "Tạo thực đơn",
  badgeColorClass,
}: PatientCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(patient.id);
    }
  };

  const conditions = patient.condition
    ? patient.condition.split(",").map((c) => c.trim()).filter(Boolean)
    : [];
  const visibleConditions = conditions.slice(0, MAX_CONDITION_TAGS);
  const hiddenConditionCount = Math.max(0, conditions.length - MAX_CONDITION_TAGS);

  const initial =
    patient.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      onClick={handleCardClick}
      className={`p-3.5 bg-white rounded-xl transition-all duration-150 flex items-center gap-3 group cursor-pointer overflow-hidden min-w-0 w-full ${
        isSelected
          ? "border-2 border-emerald-500 bg-emerald-50/40 shadow-xs"
          : "border border-gray-100 hover:border-gray-200 hover:bg-gray-50/80 shadow-2xs"
      }`}
    >
      {/* 1. Avatar (+ fallback chữ cái đầu) */}
      {avatarFailed || !patient.avatar ? (
        <div
          className="w-10 h-10 rounded-full shrink-0 ring-2 ring-white shadow-sm border border-gray-100 bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold"
          aria-hidden
        >
          {initial}
        </div>
      ) : (
        <img
          src={patient.avatar}
          alt={patient.name}
          onError={() => setAvatarFailed(true)}
          className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm border border-gray-100"
        />
      )}

      {/* 2. Info */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors truncate">
            {patient.name}
          </h4>
          <span
            className="bg-gray-100 text-gray-400 rounded-full px-2 py-0.5 text-[10px] font-mono border border-gray-200/40 shrink-0"
            title={patient.id}
          >
            {truncatePatientId(patient.id)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 min-w-0 text-xs text-gray-400">
          <span className="shrink-0">{patient.age} tuổi</span>
          {patient.gender && (
            <>
              <span className="text-gray-300 text-[10px] shrink-0">•</span>
              <span className="shrink-0">{patient.gender}</span>
            </>
          )}
          {patient.bmi != null && (
            <>
              <span className="text-gray-300 text-[10px] shrink-0">•</span>
              <span className="shrink-0">BMI: {patient.bmi}</span>
            </>
          )}
        </div>

        {/* Tag bệnh lý: tối đa 2 dòng trực quan (2 tag + +N) */}
        {conditions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 min-w-0 max-h-[2.75rem] overflow-hidden">
            {visibleConditions.map((cond, idx) => (
              <span
                key={`${cond}-${idx}`}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border truncate max-w-full ${
                  badgeColorClass || getConditionTagStyle(cond)
                }`}
              >
                {cond}
              </span>
            ))}
            {hiddenConditionCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-gray-100 text-gray-600 border-gray-200 shrink-0">
                +{hiddenConditionCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Action Button — luôn hiện, không bị cắt bởi overflow-x */}
      <div className="flex items-center shrink-0 self-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 shadow-xs whitespace-nowrap"
        >
          <span>{actionText}</span>
          <span className="material-symbols-outlined text-[15px] leading-none group-hover:translate-x-0.5 transition-transform duration-200">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
