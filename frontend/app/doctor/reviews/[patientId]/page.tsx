"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { mealPlanToUiItem } from "@/lib/meal-plan-mappers";
import { shortCondition } from "@/lib/format";
import { MealPlanItem } from "@/lib/plans-store";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";
import { asRouteId } from "@/lib/route-params";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function resolvePatientAvatar(raw: string | null | undefined): string {
  if (
    !raw ||
    raw.startsWith("https://api.dicebear.com") ||
    raw.includes("googleusercontent.com")
  ) {
    return "";
  }
  return assetUrl(raw) || "";
}

function bmiCategoryOf(bmi: number | null | undefined): string {
  if (bmi == null || bmi <= 0) return "—";
  if (bmi < 18.5) return "Thiếu cân";
  if (bmi < 23) return "Bình thường";
  if (bmi < 25) return "Thừa cân nhẹ";
  return "Béo phì";
}

function toUiPatient(row: DoctorPatientSummary): Patient {
  const ui = doctorPatientToUi(row);
  return { ...ui, avatar: resolvePatientAvatar(ui.avatar) };
}

export default function PatientMealPlansListPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = asRouteId(params?.patientId);

  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DoctorPatientSummary | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allPatientPlans, setAllPatientPlans] = useState<MealPlanItem[]>([]);

  // Filter tabs: "pending", "approved", "rejected", "all"
  const [activeTab, setActiveTab] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");

  // State to track which variant groups are expanded (dropdown open)
  // By default, groups are open so doctor sees them, or click to collapse/expand
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setHydrated(true);
  }, []);

  const load = useCallback(async () => {
    if (!token || role !== "doctor") return;
    if (!patientId) {
      setLoading(false);
      setLoadError("Thiếu mã bệnh nhân.");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [patientRow, planRows] = await Promise.all([
        api.getDoctorPatient(patientId),
        api.listDoctorMealPlans("all"),
      ]);
      setSummary(patientRow);
      setPatient(toUiPatient(patientRow));
      const items = planRows
        .filter((row) => row.user_id === patientRow.id)
        .map((row) =>
          mealPlanToUiItem(row, {
            patientName: patientRow.name,
            patientCode: patientRow.id,
            condition: patientRow.condition_label,
          })
        );
      setAllPatientPlans(items);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Không tải được danh sách thực đơn của bệnh nhân."
      );
    } finally {
      setLoading(false);
    }
  }, [token, role, patientId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: prev[groupId] === undefined ? false : !prev[groupId],
    }));
  };

  const filteredPlans = allPatientPlans.filter((plan) => {
    if (activeTab === "all") return true;
    if (activeTab === "approved") {
      return plan.status === "approved" || plan.status === "edited";
    }
    return plan.status === activeTab;
  });

  const pendingCount = allPatientPlans.filter((p) => p.status === "pending").length;
  const approvedCount = allPatientPlans.filter(
    (p) => p.status === "approved" || p.status === "edited"
  ).length;
  const rejectedCount = allPatientPlans.filter((p) => p.status === "rejected").length;

  // Group filtered plans by variantGroupId (or standalone if no group id)
  const groupMap = new Map<string, MealPlanItem[]>();
  const standalonePlans: MealPlanItem[] = [];

  filteredPlans.forEach((plan) => {
    if (plan.variantGroupId) {
      if (!groupMap.has(plan.variantGroupId)) {
        groupMap.set(plan.variantGroupId, []);
      }
      groupMap.get(plan.variantGroupId)!.push(plan);
    } else {
      standalonePlans.push(plan);
    }
  });

  // Convert map to array of groups sorted by createdAt
  const groupsList = Array.from(groupMap.entries()).map(([groupId, plans]) => ({
    groupId,
    plans: plans.sort((a, b) => (a.variantIndex || 0) - (b.variantIndex || 0)),
    createdAt: plans[0]?.createdAt || "",
    duration: plans[0]?.duration || "7 ngày",
  }));

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <>
        <TopBar title="Danh sách thực đơn" />
        <main className="p-lg text-sm text-on-surface-variant">
          Đang tải thực đơn của bệnh nhân…
        </main>
      </>
    );
  }

  if (loadError || !patient) {
    return (
      <>
        <TopBar title="Danh sách thực đơn" />
        <main className="p-lg">
          <p className="text-sm text-error mb-md">
            {loadError || "Không tìm thấy bệnh nhân."}
          </p>
          <Link
            href="/doctor/reviews"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Quay lại danh sách thực đơn
          </Link>
        </main>
      </>
    );
  }

  const diagnoses = patient.condition
    ? patient.condition.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <>
      <TopBar title={`Danh sách thực đơn - ${patient.name}`} />

      <main className="p-lg max-w-[1400px]">
        {/* Back link */}
        <div className="mb-md">
          <Link
            href="/doctor/reviews"
            className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại Danh sách thực đơn
          </Link>
        </div>

        {/* Header Patient Info - Real Data Clinical Overview */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg mb-section-gap shadow-xs space-y-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md pb-md border-b border-outline-variant/60">
            <div className="flex items-start sm:items-center gap-md">
              <div className="relative w-16 h-16 shrink-0">
                <div
                  className={`w-16 h-16 rounded-full border flex items-center justify-center text-lg font-bold ${getAvatarColor(
                    patient.name
                  )}`}
                >
                  {initials(patient.name)}
                </div>
                {patient.avatar ? (
                  <img
                    src={patient.avatar}
                    alt={patient.name}
                    className="absolute inset-0 w-16 h-16 rounded-full object-cover border border-outline-variant bg-surface-container"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>

              <div>
                <div className="flex items-center gap-sm flex-wrap">
                  <h2 className="font-h1 text-h1 text-on-surface font-bold text-xl">
                    {patient.name}
                  </h2>
                  <span className="font-mono bg-surface-container-high px-2 py-0.5 rounded-md text-xs font-semibold text-on-surface-variant">
                    {patient.id}
                  </span>
                  {patient.status && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                        patient.status === "Cảnh báo"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : patient.status === "Cần chú ý"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : patient.status === "Chờ duyệt"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          patient.status === "Cảnh báo"
                            ? "bg-red-500 animate-pulse"
                            : patient.status === "Cần chú ý"
                            ? "bg-amber-500"
                            : patient.status === "Chờ duyệt"
                            ? "bg-blue-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      {patient.status}
                    </span>
                  )}
                </div>

                <p className="text-xs text-on-surface-variant mt-1">
                  {patient.age > 0 ? `${patient.age} tuổi` : ""}
                  {patient.gender && patient.gender !== "—" ? ` • ${patient.gender}` : ""}
                  {patient.phone ? ` • SĐT: ${patient.phone}` : ""}
                  {patient.email ? ` • ${patient.email}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-sm flex-wrap">
              <Link
                href={`/doctor/patients/${encodeURIComponent(patient.id)}`}
                className="px-3.5 py-2 border border-outline-variant hover:bg-surface-variant text-on-surface rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">
                  person
                </span>
                <span>Xem hồ sơ bệnh nhân</span>
              </Link>
              <Link
                href={`/doctor/patients/${encodeURIComponent(patient.id)}/generate`}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-body-bold px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">
                  auto_awesome
                </span>
                <span>Tạo thêm thực đơn mới (AI)</span>
              </Link>
            </div>
          </div>

          {/* Clinical Metrics & Dietary Targets Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-sm pt-xs">
            {/* Chẩn đoán */}
            <div className="bg-surface-container-low/60 border border-outline-variant/60 rounded-xl p-3 col-span-2 sm:col-span-3 lg:col-span-2">
              <div className="flex items-center gap-1 text-on-surface-variant text-[11px] font-semibold mb-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">
                  medical_information
                </span>
                <span>Bệnh lý chẩn đoán</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {diagnoses.length > 0 ? (
                  diagnoses.map((diag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-tertiary-container/30 text-tertiary border border-tertiary/20 rounded-md text-[11px] font-semibold"
                    >
                      {diag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-on-surface-variant">—</span>
                )}
              </div>
            </div>

            {/* Thể chất & BMI */}
            <div className="bg-surface-container-low/60 border border-outline-variant/60 rounded-xl p-3">
              <div className="flex items-center gap-1 text-on-surface-variant text-[11px] font-semibold mb-1">
                <span className="material-symbols-outlined text-[15px] text-amber-600">
                  accessibility_new
                </span>
                <span>Thể chất & BMI</span>
              </div>
              <p className="text-xs font-bold text-on-surface">
                {patient.bmi ? `BMI ${patient.bmi}` : "—"}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {patient.weight ? `${patient.weight} kg` : ""}
                {patient.height ? ` • ${patient.height} cm` : ""}
                {patient.bmi ? ` (${bmiCategoryOf(patient.bmi)})` : ""}
              </p>
            </div>

            {/* Mục tiêu Calo */}
            <div className="bg-surface-container-low/60 border border-outline-variant/60 rounded-xl p-3">
              <div className="flex items-center gap-1 text-on-surface-variant text-[11px] font-semibold mb-1">
                <span className="material-symbols-outlined text-[15px] text-emerald-600">
                  local_fire_department
                </span>
                <span>Mục tiêu Calo</span>
              </div>
              <p className="text-xs font-bold text-emerald-800">
                {patient.targetKcal ? `${patient.targetKcal} kcal` : "1800 kcal"}
                <span className="text-[10px] font-normal text-on-surface-variant">/ngày</span>
              </p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {patient.saltDailyG ? `Muối ≤ ${patient.saltDailyG}g` : "Muối chuẩn"}
              </p>
            </div>

            {/* Huyết áp & Đường huyết */}
            <div className="bg-surface-container-low/60 border border-outline-variant/60 rounded-xl p-3">
              <div className="flex items-center gap-1 text-on-surface-variant text-[11px] font-semibold mb-1">
                <span className="material-symbols-outlined text-[15px] text-rose-600">
                  monitor_heart
                </span>
                <span>Huyết áp / Đường huyết</span>
              </div>
              <p className="text-xs font-bold text-on-surface">
                {patient.bloodPressure || "—"}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                ĐH: {patient.bloodSugar || "—"}
              </p>
            </div>

            {/* Dị ứng & Thuốc */}
            <div className="bg-surface-container-low/60 border border-outline-variant/60 rounded-xl p-3">
              <div className="flex items-center gap-1 text-on-surface-variant text-[11px] font-semibold mb-1">
                <span className="material-symbols-outlined text-[15px] text-purple-600">
                  medication
                </span>
                <span>Dị ứng & Thuốc</span>
              </div>
              <p className="text-[11px] text-on-surface font-medium truncate" title={patient.allergies?.join(", ") || "Không có"}>
                Dị ứng: {patient.allergies?.length ? patient.allergies.join(", ") : "Không có"}
              </p>
              <p className="text-[11px] text-on-surface-variant truncate mt-0.5" title={patient.medications?.join(", ") || "Chưa có"}>
                Thuốc: {patient.medications?.length ? patient.medications.join(", ") : "Chưa có"}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-md border-b border-outline-variant mb-lg pb-xs flex-wrap">
          <button
            onClick={() => setActiveTab("pending")}
            className={`font-label text-label pb-xs px-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "pending"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Chờ duyệt ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`font-label text-label pb-xs px-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "approved"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Đã duyệt ({approvedCount})
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`font-label text-label pb-xs px-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "rejected"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Đã từ chối ({rejectedCount})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`font-label text-label pb-xs px-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "all"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Tất cả ({allPatientPlans.length})
          </button>
        </div>

        {/* Meal Plans Section */}
        {filteredPlans.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
              menu_book
            </span>
            <p className="font-body-bold text-body-bold">
              Không có thực đơn nào ở trạng thái này
            </p>
            <p className="font-caption text-caption text-xs mt-xs">
              Chuyển tab khác hoặc bấm &quot;Tạo thêm phương án mới (AI)&quot; cho bệnh nhân {patient.name}.
            </p>
          </div>
        ) : (
          <div className="space-y-xl">
            {/* Display Grouped Variant Batches */}
            {groupsList.map((group) => {
              const isExpanded = expandedGroups[group.groupId] !== false; // Default true (expanded)

              return (
                <div
                  key={group.groupId}
                  className="bg-surface-container-low/40 border border-outline-variant rounded-2xl p-md md:p-lg space-y-md shadow-xs"
                >
                  {/* Group Header Banner with Dropdown Toggle */}
                  <div
                    onClick={() => toggleGroupExpand(group.groupId)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-xs pb-sm border-b border-outline-variant/60 cursor-pointer select-none hover:opacity-90 transition-opacity"
                  >
                    <div className="flex items-center gap-xs flex-wrap">
                      <span className="material-symbols-outlined text-primary text-[22px]">
                        view_carousel
                      </span>
                      <h3 className="font-h2 text-h2 font-bold text-on-surface text-sm sm:text-base">
                        Đợt sinh thực đơn: {group.plans.length} phương án thay thế
                      </h3>
                      <span className="bg-primary/10 text-primary font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold">
                        {group.groupId}
                      </span>
                    </div>

                    <div className="flex items-center gap-md text-xs text-on-surface-variant font-caption">
                      <span>Thời gian: {group.createdAt}</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                        Độ dài: {group.duration}
                      </span>

                      {/* Dropdown Indicator Button */}
                      <button
                        type="button"
                        className="px-sm py-1 bg-surface-container-lowest border border-outline-variant hover:bg-surface-variant rounded-lg text-xs font-semibold text-on-surface flex items-center gap-xs shadow-2xs transition-colors"
                      >
                        <span>{isExpanded ? "Thu gọn" : "Xem phương án"}</span>
                        <span className="material-symbols-outlined text-[18px]">
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Cards Grid / List for Variants in this Group (Collapsible Dropdown Content) */}
                  {isExpanded && (
                    <div className="grid grid-cols-1 gap-md animate-fadeIn">
                      {group.plans.map((plan) => (
                        <div
                          key={plan.id}
                          className={`bg-surface-container-lowest border rounded-xl p-md shadow-xs transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-md ${
                            plan.status === "approved" || plan.status === "edited"
                              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
                              : plan.status === "rejected"
                              ? "border-red-200 opacity-75 bg-red-50/30"
                              : "border-outline-variant hover:border-primary/50"
                          }`}
                        >
                          {/* Left Side: Variant Index Tag & Title */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-xs mb-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-[11px] shadow-2xs">
                                Phương án {plan.variantIndex || 1}/{plan.totalVariants || 1}
                              </span>
                              <span className="font-mono text-xs font-semibold text-on-surface-variant">
                                {plan.id}
                              </span>
                              <span className="text-xs text-on-surface-variant">
                                • {plan.daysCount || 7} ngày
                              </span>
                            </div>

                            <h4 className="font-h2 text-h2 font-semibold text-on-surface text-sm sm:text-base mb-xs line-clamp-1">
                              {plan.planTitle}
                            </h4>

                            {/* Nutrition Summary */}
                            <div className="flex items-center gap-md font-caption text-caption text-on-surface-variant text-xs flex-wrap">
                              <span className="flex items-center gap-xs">
                                <span className="material-symbols-outlined text-[16px] text-outline">
                                  local_fire_department
                                </span>
                                Calo: {plan.calories}
                              </span>
                              <span className="flex items-center gap-xs">
                                <span className="material-symbols-outlined text-[16px] text-outline">
                                  grain
                                </span>
                                Muối: {plan.salt}
                              </span>
                              {plan.sugar && (
                                <span className="flex items-center gap-xs">
                                  <span className="material-symbols-outlined text-[16px] text-outline">
                                    opacity
                                  </span>
                                  Đường: {plan.sugar}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right Side: Status Badge & Action */}
                          <div className="flex items-center gap-md shrink-0 w-full md:w-auto justify-between md:justify-end pt-sm md:pt-0 border-t md:border-t-0 border-outline-variant">
                            <div>
                              {plan.status === "pending" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                  Chờ duyệt
                                </span>
                              )}
                              {plan.status === "approved" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span className="material-symbols-outlined text-[14px]">
                                    check_circle
                                  </span>
                                  Đã duyệt
                                </span>
                              )}
                              {plan.status === "edited" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                                  <span className="material-symbols-outlined text-[14px]">
                                    edit_note
                                  </span>
                                  Đã chỉnh sửa
                                </span>
                              )}
                              {plan.status === "rejected" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                                  <span className="material-symbols-outlined text-[14px]">
                                    cancel
                                  </span>
                                  Đã từ chối
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() =>
                                router.push(
                                  `/doctor/reviews/${encodeURIComponent(patient.id)}/${encodeURIComponent(plan.id)}`
                                )
                              }
                              className={`px-md py-1.5 rounded-lg font-body-bold text-xs font-semibold transition-all shadow-xs flex items-center gap-xs cursor-pointer active:scale-95 ${
                                plan.status === "approved" || plan.status === "edited"
                                  ? "bg-emerald-700 text-white hover:bg-emerald-800"
                                  : "bg-primary text-on-primary hover:bg-primary-container"
                              }`}
                            >
                              <span>So sánh & Xem</span>
                              <span className="material-symbols-outlined text-[16px]">
                                arrow_forward
                              </span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Display Standalone Plans if any */}
            {standalonePlans.length > 0 && (
              <div className="space-y-sm pt-md">
                <h3 className="font-h2 text-h2 font-bold text-on-surface text-sm">
                  Thực đơn của bệnh nhân
                </h3>
                {standalonePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-md"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-bold text-primary mb-1">
                        {plan.id}
                      </p>
                      <h4 className="font-h2 text-h2 font-semibold text-on-surface text-sm mb-xs">
                        {plan.planTitle}
                      </h4>
                      <p className="text-xs text-on-surface-variant">
                        {plan.daysCount || 7} ngày • Calo: {plan.calories} • Muối: {plan.salt}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        router.push(
                          `/doctor/reviews/${encodeURIComponent(patient.id)}/${encodeURIComponent(plan.id)}`
                        )
                      }
                      className="px-md py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold"
                    >
                      Xem chi tiết →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
