"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";
import { usePlansStore, MealPlanItem } from "@/lib/plans-store";

export default function PatientMealPlansListPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = (params?.patientId as string) || "BN-10293";

  const patient =
    MOCK_PATIENTS.find((p) => p.id === patientId) || MOCK_PATIENTS[0];

  const { getPlansByPatientId } = usePlansStore();
  const allPatientPlans = getPlansByPatientId(patient.id);

  // Filter tabs: "pending", "approved", "rejected", "unselected", "all"
  const [activeTab, setActiveTab] = useState<
    "all" | "pending" | "approved" | "rejected" | "unselected"
  >("pending");

  // State to track which variant groups are expanded (dropdown open)
  // By default, groups are open so doctor sees them, or click to collapse/expand
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: prev[groupId] === undefined ? false : !prev[groupId],
    }));
  };

  const filteredPlans = allPatientPlans.filter((plan) => {
    if (activeTab === "all") return true;
    return plan.status === activeTab;
  });

  const pendingCount = allPatientPlans.filter((p) => p.status === "pending").length;
  const approvedCount = allPatientPlans.filter((p) => p.status === "approved").length;
  const rejectedCount = allPatientPlans.filter((p) => p.status === "rejected").length;
  const unselectedCount = allPatientPlans.filter((p) => p.status === "unselected").length;

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
            Quay lại Danh sách bệnh nhân
          </Link>
        </div>

        {/* Header Patient Info */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg mb-section-gap flex flex-col md:flex-row md:items-center justify-between gap-md shadow-xs">
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
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                {patient.age} tuổi • {patient.gender} • Chẩn đoán:{" "}
                <strong className="text-on-surface font-semibold">
                  {patient.condition}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-sm">
            <Link
              href={`/doctor/patients/${patient.id}/generate`}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-body-bold px-md py-2 rounded-lg text-xs font-semibold flex items-center gap-xs shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">
                auto_awesome
              </span>
              <span>Tạo thêm phương án mới (AI)</span>
            </Link>
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
          {unselectedCount > 0 && (
            <button
              onClick={() => setActiveTab("unselected")}
              className={`font-label text-label pb-xs px-sm border-b-2 transition-all cursor-pointer ${
                activeTab === "unselected"
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Không chọn ({unselectedCount})
            </button>
          )}
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
                            plan.status === "approved"
                              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
                              : plan.status === "unselected"
                              ? "border-gray-200 opacity-75 bg-gray-50/50"
                              : "border-outline-variant hover:border-primary/50"
                          }`}
                        >
                          {/* Left Side: Variant Index Tag & Title */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-xs mb-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-[11px] shadow-2xs">
                                Phương án {plan.variantIndex || 1}/{plan.totalVariants || 3}
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
                                  Đã chọn duyệt
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
                              {plan.status === "unselected" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                  <span className="material-symbols-outlined text-[14px]">
                                    remove_done
                                  </span>
                                  Không chọn
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() =>
                                router.push(`/doctor/reviews/${patient.id}/${plan.id}`)
                              }
                              className={`px-md py-1.5 rounded-lg font-body-bold text-xs font-semibold transition-all shadow-xs flex items-center gap-xs cursor-pointer active:scale-95 ${
                                plan.status === "approved"
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
                  Thực đơn đơn lẻ khác
                </h3>
                {standalonePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-md"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-bold text-primary mb-1">{plan.id}</p>
                      <h4 className="font-h2 text-h2 font-semibold text-on-surface text-sm mb-xs">
                        {plan.planTitle}
                      </h4>
                      <p className="text-xs text-on-surface-variant">Calo: {plan.calories} • Muối: {plan.salt}</p>
                    </div>

                    <button
                      onClick={() => router.push(`/doctor/reviews/${patient.id}/${plan.id}`)}
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
