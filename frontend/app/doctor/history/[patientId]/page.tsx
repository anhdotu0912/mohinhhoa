"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";
import { useMealLogsStore, MealLogItem, MealType } from "@/lib/meal-logs-store";
import { usePlansStore, MealPlanItem } from "@/lib/plans-store";

// Helper functions for date math
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateShort(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatDateFull(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Reference mock date (12 Oct 2023)
const MOCK_REFERENCE_DATE = new Date(2023, 9, 12);

export default function DoctorPatientHistoryClinicalPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = (params?.patientId as string) || "BN-10293";

  const patient =
    MOCK_PATIENTS.find((p) => p.id === patientId) || MOCK_PATIENTS[0];

  // State: Monday of active week being viewed
  const [currentMonday, setCurrentMonday] = useState<Date>(() =>
    getMonday(MOCK_REFERENCE_DATE)
  );

  // Variant selector modal state for column header click
  const [selectedDayPlans, setSelectedDayPlans] = useState<{
    dateStr: string;
    plans: MealPlanItem[];
  } | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const { logs } = useMealLogsStore();
  const { getPlansByPatientId } = usePlansStore();

  const allPatientLogs = logs.filter((l) => l.patientId === patient.id);
  const allPatientPlans = getPlansByPatientId(patient.id);

  // Navigate week
  const handlePrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(prev.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(next.getDate() + 7);
    setCurrentMonday(next);
  };

  const handleResetCurrentWeek = () => {
    setCurrentMonday(getMonday(MOCK_REFERENCE_DATE));
  };

  // Compute 7 days of current week (Monday to Sunday)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + i);
    const isoDate = formatDateIso(d);
    const dayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    const fullDayNames = [
      "Thứ 2",
      "Thứ 3",
      "Thứ 4",
      "Thứ 5",
      "Thứ 6",
      "Thứ 7",
      "Chủ nhật",
    ];

    return {
      dayIndex: i,
      dayShort: dayNames[i],
      fullDayName: fullDayNames[i],
      dateObj: d,
      isoDate,
      shortDate: formatDateShort(d),
      fullDate: formatDateFull(d),
    };
  });

  const sundayDate = new Date(currentMonday);
  sundayDate.setDate(currentMonday.getDate() + 6);
  const weekRangeLabel = `${formatDateShort(currentMonday)} – ${formatDateFull(sundayDate)}`;

  const todayIso = formatDateIso(MOCK_REFERENCE_DATE);

  // Define rows for meal types
  const mealRows: { type: MealType; label: string; icon: string }[] = [
    { type: "breakfast", label: "Sáng", icon: "wb_twilight" },
    { type: "lunch", label: "Trưa", icon: "wb_sunny" },
    { type: "dinner", label: "Tối", icon: "bedtime" },
  ];

  // Helper: Find plans for a specific date
  const getPlansForDate = (isoDate: string): MealPlanItem[] => {
    return allPatientPlans.filter((p) => {
      const createdDateParts = p.createdAt.split(" ")[0]?.split("/");
      if (createdDateParts && createdDateParts.length === 3) {
        const pIso = `${createdDateParts[2]}-${createdDateParts[1].padStart(2, "0")}-${createdDateParts[0].padStart(2, "0")}`;
        return pIso === isoDate;
      }
      return false;
    });
  };

  // Determine header status color class for a date
  const getHeaderStatusStyle = (dayPlans: MealPlanItem[]): {
    headerClass: string;
    badgeLabel?: string;
    badgeClass?: string;
  } => {
    if (dayPlans.length === 0) {
      return {
        headerClass: "bg-surface-container-low border-outline-variant text-on-surface-variant",
      };
    }

    const hasApproved = dayPlans.some((p) => p.status === "approved");
    if (hasApproved) {
      return {
        headerClass: "bg-emerald-100/90 border-emerald-300 text-emerald-900 shadow-2xs",
        badgeLabel: "Đã duyệt",
        badgeClass: "bg-emerald-600 text-white",
      };
    }

    const hasPending = dayPlans.some((p) => p.status === "pending");
    if (hasPending) {
      return {
        headerClass: "bg-amber-100/90 border-amber-300 text-amber-900 shadow-2xs",
        badgeLabel: "Chờ duyệt",
        badgeClass: "bg-amber-600 text-white",
      };
    }

    const hasRejected = dayPlans.some((p) => p.status === "rejected");
    if (hasRejected) {
      return {
        headerClass: "bg-red-100/90 border-red-300 text-red-900 shadow-2xs",
        badgeLabel: "Từ chối",
        badgeClass: "bg-red-600 text-white",
      };
    }

    return {
      headerClass: "bg-surface-container-low border-outline-variant text-on-surface-variant",
    };
  };

  // Handle click on column header (Day Header)
  const handleHeaderClick = (isoDate: string, dayPlans: MealPlanItem[]) => {
    if (dayPlans.length === 0) {
      if (allPatientPlans.length > 0) {
        setSelectedDayPlans({ dateStr: isoDate, plans: allPatientPlans });
      } else {
        showToast(`Ngày ${isoDate} chưa có thực đơn AI nào.`);
      }
      return;
    }

    if (dayPlans.length === 1) {
      router.push(`/doctor/reviews/${patient.id}/${dayPlans[0].id}`);
    } else {
      setSelectedDayPlans({ dateStr: isoDate, plans: dayPlans });
    }
  };

  // Calculate clinical weekly stats for doctor summary
  const weeklyLogs = allPatientLogs.filter(
    (l) => l.date >= formatDateIso(currentMonday) && l.date <= formatDateIso(sundayDate)
  );

  const matchedLogsCount = weeklyLogs.filter(
    (l) => l.complianceType === "as_planned" || l.sourceBadgeText === "Ăn đúng"
  ).length;

  const weeklyComplianceRate =
    weeklyLogs.length > 0 ? Math.round((matchedLogsCount / weeklyLogs.length) * 100) : 85;

  return (
    <>
      <TopBar title={`Hồ sơ Lịch sử Dinh dưỡng Lâm sàng - ${patient.name}`} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs text-sm animate-bounce">
          <span className="material-symbols-outlined text-[20px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-lg max-w-[1440px]">
        {/* Navigation back link */}
        <div className="mb-md flex items-center justify-between">
          <Link
            href="/doctor/history"
            className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại danh sách bệnh nhân
          </Link>

          <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">medical_services</span>
            Chế độ xem Bác sĩ Lâm sàng
          </span>
        </div>

        {/* Patient Profile Header Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg mb-md flex flex-col md:flex-row md:items-center justify-between gap-md shadow-xs">
          <div className="flex items-center gap-md">
            <img
              src={patient.avatar}
              alt={patient.name}
              className="w-14 h-14 rounded-full object-cover border border-outline-variant shrink-0"
            />
            <div>
              <div className="flex items-center gap-sm">
                <h2 className="font-h1 text-h1 text-on-surface font-bold text-xl">
                  {patient.name}
                </h2>
                <span className="font-mono bg-surface-container-high px-2 py-0.5 rounded-md text-xs font-semibold text-on-surface-variant">
                  {patient.id}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-caption text-xs font-semibold ${patient.statusColor}`}>
                  {patient.status}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                {patient.age} tuổi • {patient.gender} • Chẩn đoán:{" "}
                <strong className="text-on-surface font-semibold">
                  {patient.condition}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-sm flex-wrap">
            <Link
              href="/doctor/patients/constraints"
              className="bg-surface-container-lowest border border-outline-variant hover:border-primary text-on-surface font-body-bold px-md py-2 rounded-lg text-xs font-semibold flex items-center gap-xs shadow-2xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">gavel</span>
              <span>Thiết lập ràng buộc</span>
            </Link>
            <Link
              href={`/doctor/patients/${patient.id}/generate`}
              className="bg-primary hover:bg-primary-container text-on-primary font-body-bold px-md py-2 rounded-lg text-xs font-semibold flex items-center gap-xs shadow-2xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Tạo thực đơn AI mới</span>
            </Link>
          </div>
        </div>

        {/* --- CLINICAL NUTRITION SUMMARY BAR (DOCTOR SPECIFIC STATS) --- */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md mb-section-gap shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/60">
          {/* Stat 1: Tỷ lệ tuân thủ tuần */}
          <div className="px-sm py-xs flex items-center gap-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
            <div>
              <span className="text-xs font-medium text-on-surface-variant block">Tuân thủ thực đơn tuần</span>
              <div className="flex items-baseline gap-xs">
                <span className="font-h1 text-xl font-bold text-emerald-900">{weeklyComplianceRate}%</span>
                <span className="text-[11px] text-emerald-700 font-semibold">({matchedLogsCount}/{weeklyLogs.length || 7} bữa)</span>
              </div>
            </div>
          </div>

          {/* Stat 2: Lượng muối Natri trung bình */}
          <div className="px-sm py-xs flex items-center gap-md pt-sm sm:pt-0">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-[20px]">grain</span>
            </div>
            <div>
              <span className="text-xs font-medium text-on-surface-variant block">Natri TB / ngày</span>
              <div className="flex items-baseline gap-xs">
                <span className="font-h1 text-xl font-bold text-on-surface">1.6g</span>
                <span className="text-[11px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">An toàn &lt;2.0g</span>
              </div>
            </div>
          </div>

          {/* Stat 3: Năng lượng Kcal trung bình */}
          <div className="px-sm py-xs flex items-center gap-md pt-sm lg:pt-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-[20px]">local_fire_department</span>
            </div>
            <div>
              <span className="text-xs font-medium text-on-surface-variant block">Năng lượng Kcal TB</span>
              <div className="flex items-baseline gap-xs">
                <span className="font-h1 text-xl font-bold text-on-surface">1,750 kcal</span>
                <span className="text-[11px] text-on-surface-variant">/ 1,800 mục tiêu</span>
              </div>
            </div>
          </div>

          {/* Stat 4: Sự kiện tuân thủ lâm sàng */}
          <div className="px-sm py-xs flex items-center gap-md pt-sm lg:pt-0">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold shrink-0">
              <span className="material-symbols-outlined text-[20px]">clinical_notes</span>
            </div>
            <div>
              <span className="text-xs font-medium text-on-surface-variant block">Ghi nhận tuân thủ</span>
              <div className="flex items-baseline gap-xs">
                <span className="font-h1 text-xl font-bold text-on-surface">{weeklyLogs.length}</span>
                <span className="text-[11px] text-purple-700 font-semibold">bữa đã đối chiếu</span>
              </div>
            </div>
          </div>
        </div>

        {/* --- WEEKLY TIMETABLE CONTROL BAR & LEGEND --- */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md mb-lg shadow-xs flex flex-col md:flex-row items-center justify-between gap-md">
          {/* Left: Week Navigation Controls */}
          <div className="flex items-center gap-sm flex-wrap">
            <button
              onClick={handlePrevWeek}
              className="px-md py-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-body-bold font-semibold text-on-surface flex items-center gap-xs transition-colors cursor-pointer active:scale-95 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              <span>Tuần trước</span>
            </button>

            <div className="flex items-center gap-xs px-md py-2 bg-emerald-50/60 border border-emerald-200 rounded-xl text-emerald-900 font-bold text-xs shadow-2xs">
              <span className="material-symbols-outlined text-emerald-700 text-[18px]">
                calendar_month
              </span>
              <span>Tuần: {weekRangeLabel}</span>
            </div>

            <button
              onClick={handleNextWeek}
              className="px-md py-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-body-bold font-semibold text-on-surface flex items-center gap-xs transition-colors cursor-pointer active:scale-95 shadow-2xs"
            >
              <span>Tuần sau</span>
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>

            <button
              onClick={handleResetCurrentWeek}
              className="px-sm py-2 text-xs font-semibold text-primary hover:underline transition-all cursor-pointer ml-1"
            >
              Về tuần hiện tại
            </button>
          </div>

          {/* Right: Legend (Doctor Status Badges) */}
          <div className="flex items-center gap-md text-xs text-on-surface-variant font-medium flex-wrap border-t md:border-t-0 pt-xs md:pt-0 border-outline-variant/60 w-full md:w-auto justify-end">
            <span className="text-xs font-bold text-on-surface mr-1">Thực đơn AI:</span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Đã duyệt
            </span>
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              Chờ duyệt
            </span>
            <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-800 border border-red-200 px-2.5 py-1 rounded-full text-xs font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              Từ chối
            </span>
          </div>
        </div>

        {/* --- MAIN CLINICAL WEEKLY TIMETABLE CSS GRID --- */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1050px] grid grid-cols-[100px_repeat(7,1fr)] divide-x divide-y divide-outline-variant/60">

              {/* Corner Header Cell */}
              <div className="sticky left-0 z-20 bg-surface-container-low p-md flex items-center justify-center font-bold text-xs text-on-surface-variant border-r border-outline-variant">
                Bữa \ Ngày
              </div>

              {/* 7 Column Headers with Daily Clinical Metrics */}
              {weekDays.map((day) => {
                const dayPlans = getPlansForDate(day.isoDate);
                const { headerClass, badgeLabel, badgeClass } = getHeaderStatusStyle(dayPlans);

                // Compute daily total calo & salt for doctor view
                const dayLogs = allPatientLogs.filter((l) => l.date === day.isoDate);
                const dayCalo = dayLogs.reduce(
                  (sum, l) => sum + l.foodItems.reduce((fs, f) => fs + (f.calories || 0), 0),
                  0
                );
                const daySalt = Number(
                  dayLogs
                    .reduce(
                      (sum, l) => sum + l.foodItems.reduce((fs, f) => fs + (f.salt || 0), 0),
                      0
                    )
                    .toFixed(1)
                );

                return (
                  <div
                    key={day.isoDate}
                    onClick={() => handleHeaderClick(day.isoDate, dayPlans)}
                    className={`p-sm md:p-md flex flex-col justify-between min-h-[95px] transition-all cursor-pointer group hover:brightness-95 ${headerClass}`}
                    title="Bấm vào header ngày để xem hoặc duyệt thực đơn"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-body-bold font-bold text-sm block">
                          {day.fullDayName}
                        </span>
                        <span className="font-mono text-xs font-medium opacity-85">
                          {day.shortDate}
                        </span>
                      </div>

                      {badgeLabel && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${badgeClass}`}>
                          {badgeLabel}
                        </span>
                      )}
                    </div>

                    {/* Daily Clinical Nutrition Summary Bar */}
                    <div className="mt-2 pt-1 border-t border-black/10 flex items-center justify-between text-[11px] font-mono">
                      <span>{dayCalo > 0 ? `${dayCalo} kcal` : "—"}</span>
                      <span className={daySalt > 2.0 ? "text-red-700 font-bold" : "text-emerald-800 font-bold"}>
                        {daySalt > 0 ? `Na: ${daySalt}g` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Grid Rows for Breakfast, Lunch, Dinner */}
              {mealRows.map((row) => (
                <React.Fragment key={row.type}>
                  {/* Sticky Meal Row Label (Column 1) */}
                  <div className="sticky left-0 z-20 bg-surface-container-low p-md flex flex-col items-center justify-center border-r border-outline-variant font-bold text-sm text-on-surface">
                    <span className="material-symbols-outlined text-primary text-[20px] mb-0.5">
                      {row.icon}
                    </span>
                    <span>{row.label}</span>
                  </div>

                  {/* 7 Day Cells for this Meal Row */}
                  {weekDays.map((day) => {
                    const cellLogs = allPatientLogs.filter(
                      (l) => l.date === day.isoDate && l.mealType === row.type
                    );

                    const isPast = day.isoDate <= todayIso;

                    return (
                      <div
                        key={`${day.isoDate}-${row.type}`}
                        className="p-sm md:p-md min-h-[125px] bg-white flex flex-col justify-between hover:bg-surface-bright transition-colors"
                      >
                        {cellLogs.length > 0 ? (
                          <div className="space-y-sm">
                            {cellLogs.map((log) => (
                              <div key={log.id} className="space-y-1">
                                {/* Food Items List with Detailed Calories & Salt */}
                                <div className="space-y-1 font-body text-xs text-on-surface leading-snug">
                                  {log.foodItems.map((food, fIdx) => (
                                    <div key={fIdx} className="flex justify-between items-start text-xs border-b border-gray-100 pb-0.5">
                                      <span className="font-medium text-on-surface pr-1">
                                        • {food.name}
                                      </span>
                                      <span className="font-mono text-[10px] text-on-surface-variant shrink-0 font-semibold">
                                        {food.calories ? `${food.calories}k` : ""}{" "}
                                        {food.salt !== undefined ? `| ${food.salt}g` : ""}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Dual Badges: Source Origin + Compliance Result */}
                                <div className="pt-1 flex items-center gap-1 flex-wrap">
                                  {/* Origin Badge */}
                                  {log.source === "inferred" ? (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                      <span className="material-symbols-outlined text-[12px]">auto_graph</span>
                                      Suy ra tuân thủ
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                                      <span className="material-symbols-outlined text-[12px]">edit_note</span>
                                      Tự nhập
                                    </span>
                                  )}

                                  {/* Compliance Badge: "Ăn đúng" / "Ăn khác" */}
                                  {log.complianceType === "custom" || log.sourceBadgeText === "Ăn khác" ? (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      <span className="material-symbols-outlined text-[12px] text-amber-700">warning</span>
                                      Ăn khác
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                      <span className="material-symbols-outlined text-[12px] text-emerald-700">check_circle</span>
                                      Ăn đúng
                                    </span>
                                  )}
                                </div>

                                {/* Clinical Alert Pill if deviation exists */}
                                {log.comparisonNote && (
                                  <div className="mt-1 bg-rose-50 text-rose-800 text-[10px] p-1 rounded border border-rose-200 font-medium flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px] text-rose-600 shrink-0">error</span>
                                    <span className="truncate">{log.comparisonNote}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-center">
                            {isPast ? (
                              <span className="font-caption text-caption text-outline text-xs italic">
                                Chưa ghi nhận
                              </span>
                            ) : (
                              <span className="text-outline text-sm font-bold font-mono">
                                —
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Clinical Note Footer */}
        <div className="mt-md p-md bg-surface-container-low/50 border border-outline-variant/60 rounded-xl text-xs text-on-surface-variant flex items-center justify-between gap-md flex-wrap">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">
              medical_information
            </span>
            <span>
              Bấm vào tiêu đề ngày để xem chi tiết phương án thực đơn AI và phê duyệt kế hoạch dinh dưỡng.
            </span>
          </div>

          <Link
            href={`/doctor/patients/${patient.id}`}
            className="text-primary font-bold hover:underline text-xs flex items-center gap-xs"
          >
            <span>Quản lý hồ sơ bệnh nhân {patient.name} →</span>
          </Link>
        </div>
      </main>

      {/* --- DAY VARIANT SELECTION MODAL (Appears on Day Header Click) --- */}
      {selectedDayPlans && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-md animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg shadow-xl max-w-lg w-full flex flex-col">
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md">
              <div className="flex items-center gap-sm">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">
                    view_carousel
                  </span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Chọn phương án thực đơn AI
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs">
                    Ngày {selectedDayPlans.dateStr} có {selectedDayPlans.plans.length} thực đơn phù hợp
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDayPlans(null)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-sm my-xs max-h-[60vh] overflow-y-auto pr-xs">
              {selectedDayPlans.plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => {
                    setSelectedDayPlans(null);
                    router.push(`/doctor/reviews/${patient.id}/${plan.id}`);
                  }}
                  className="p-md bg-surface-container-lowest border border-outline-variant hover:border-primary/60 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-md group shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-xs mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-[10px]">
                        Phương án {plan.variantIndex || 1}
                      </span>
                      <span className="font-mono text-xs text-on-surface-variant font-semibold">
                        {plan.id}
                      </span>
                    </div>
                    <h4 className="font-body-bold text-on-surface text-sm font-semibold group-hover:text-primary transition-colors line-clamp-1">
                      {plan.planTitle}
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Calo: {plan.calories} • Muối: {plan.salt}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-sm">
                    {plan.status === "approved" && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Đã duyệt
                      </span>
                    )}
                    {plan.status === "pending" && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        Chờ duyệt
                      </span>
                    )}
                    {plan.status === "rejected" && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                        Từ chối
                      </span>
                    )}

                    <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform text-[20px]">
                      arrow_forward
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-md border-t border-outline-variant mt-md flex justify-end">
              <button
                onClick={() => setSelectedDayPlans(null)}
                className="px-md py-sm border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
