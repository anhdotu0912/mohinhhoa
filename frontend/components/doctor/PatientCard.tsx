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
      className={`p-4 bg-surface-container-lowest rounded-2xl transition-all duration-200 flex items-center gap-3.5 group cursor-pointer overflow-hidden min-w-0 w-full ${
        isSelected
          ? "border-2 border-primary bg-primary/5 shadow-xs"
          : "border border-outline-variant/60 hover:border-primary/50 hover:bg-surface-container-low/50 hover:shadow-subtle"
      }`}
    >
      {/* 1. Avatar (+ fallback chữ cái đầu) */}
      {avatarFailed || !patient.avatar ? (
        <div
          className="w-11 h-11 rounded-full shrink-0 ring-2 ring-primary/20 bg-primary/10 text-primary flex items-center justify-center text-sm font-bold tracking-tight"
          aria-hidden
        >
          {initial}
        </div>
      ) : (
        <img
          src={patient.avatar}
          alt={patient.name}
          onError={() => setAvatarFailed(true)}
          className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-outline-variant/40 shadow-xs"
        />
      )}

      {/* 2. Info */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate">
            {patient.name}
          </h4>
          <span
            className="bg-surface-container-low text-on-surface-variant/80 rounded-full px-2 py-0.5 text-[10px] font-mono border border-outline-variant/40 shrink-0"
            title={patient.id}
          >
            {truncatePatientId(patient.id)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 min-w-0 text-xs text-on-surface-variant">
          <span className="shrink-0 font-medium">{patient.age} tuổi</span>
          {patient.gender && (
            <>
              <span className="text-outline-variant text-[10px] shrink-0">•</span>
              <span className="shrink-0">{patient.gender}</span>
            </>
          )}
          {patient.bmi != null && (
            <>
              <span className="text-outline-variant text-[10px] shrink-0">•</span>
              <span className="shrink-0 tabular-nums">BMI: {patient.bmi}</span>
            </>
          )}
        </div>

        {/* Tag bệnh lý: tối đa 2 dòng trực quan (2 tag + +N) */}
        {conditions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 min-w-0 max-h-[2.75rem] overflow-hidden mt-0.5">
            {visibleConditions.map((cond, idx) => (
              <span
                key={`${cond}-${idx}`}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border truncate max-w-full ${
                  badgeColorClass || getConditionTagStyle(cond)
                }`}
              >
                {cond}
              </span>
            ))}
            {hiddenConditionCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-surface-container text-on-surface-variant border-outline-variant/60 shrink-0">
                +{hiddenConditionCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Action Button */}
      <div className="flex items-center shrink-0 self-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
          className="bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap"
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
