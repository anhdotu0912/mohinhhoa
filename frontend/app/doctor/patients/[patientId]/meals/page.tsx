"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { mealPlanToUiItem } from "@/lib/meal-plan-mappers";
import { MealPlanItem } from "@/lib/plans-store";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";
import { asRouteId } from "@/lib/route-params";
import { doctorReviewHref } from "@/lib/doctor-routes";
import { NotificationBadge } from "@/components/shared/NotificationBadge";

const PLAN_STATUS: Record<MealPlanItem["status"], { label: string; color: string }> = {
  pending: { label: "Chờ duyệt", color: "border-amber-200 bg-amber-50 text-amber-800" },
  approved: { label: "Đã duyệt", color: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  edited: { label: "Đã chỉnh sửa", color: "border-sky-200 bg-sky-50 text-sky-800" },
  rejected: { label: "Đã từ chối", color: "border-rose-200 bg-rose-50 text-rose-800" },
  unselected: { label: "Chưa chọn", color: "border-slate-200 bg-slate-50 text-slate-600" },
};

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
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-4 text-sm text-on-surface-variant sm:px-6">
        Đang tải thực đơn của bệnh nhân…
      </main>
    );
  }

  if (loadError || !patient) {
    return (
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-4 sm:px-6">
        <p className="text-sm text-error mb-3">
          {loadError || "Không tìm thấy bệnh nhân."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 space-y-4 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[26px] font-bold tracking-tight text-slate-900">
            Quản lý thực đơn
          </h2>
        </div>
        <Link
          href="/doctor/inbox?type=plan_review"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary transition-colors hover:bg-teal-800"
        >
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          <span>Xem thực đơn chờ duyệt</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex justify-center"><div role="group" aria-label="Lọc thực đơn theo trạng thái" className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg border border-teal-100 bg-teal-50/60 p-1">
        <button
          type="button"
          aria-pressed={activeTab === "pending"}
          onClick={() => setActiveTab("pending")}
          className={`relative px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "pending"
              ? "bg-amber-600 text-white shadow-2xs"
              : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <span>Chờ duyệt ({pendingCount})</span>
          {pendingCount > 0 && activeTab !== "pending" && (
            <NotificationBadge
              dot
              className="bottom-auto top-1 right-1 w-2 h-2 ring-[1.5px] ring-white"
            />
          )}
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "approved"}
          onClick={() => setActiveTab("approved")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "approved"
              ? "bg-primary text-on-primary shadow-2xs"
              : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          Đã duyệt ({approvedCount})
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "rejected"}
          onClick={() => setActiveTab("rejected")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "rejected"
              ? "bg-rose-600 text-white shadow-2xs"
              : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          Đã từ chối ({rejectedCount})
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "all"}
          onClick={() => setActiveTab("all")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "all"
              ? "bg-teal-700 text-white shadow-2xs"
              : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          Tất cả ({allPatientPlans.length})
        </button>
      </div>
      </div>

      {/* Meal Plans Section */}
      {filteredPlans.length === 0 ? (
        <div className="mx-auto w-full max-w-[640px] rounded-xl border border-dashed border-teal-200 bg-white px-4 py-6 text-center text-on-surface-variant">
          <span className="material-symbols-outlined mb-2 text-[32px] text-teal-400">
            menu_book
          </span>
          <p className="text-on-surface text-sm font-bold">
            Không có thực đơn nào ở trạng thái này
          </p>
          <p className="text-xs mt-1 text-on-surface-variant">
            Bản AI do bệnh nhân khởi tạo sẽ xuất hiện tại đây. Chuyển tab để xem các trạng thái khác của bệnh nhân {patient.name}.
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[960px] space-y-4">
          {/* Display Grouped Variant Batches */}
          {groupsList.map((group) => {
            const isExpanded = expandedGroups[group.groupId] !== false; // Default true (expanded)
            const hasPendingInGroup = group.plans.some((p) => p.status === "pending");

            return (
              <div
                key={group.groupId}
                className="space-y-3 rounded-xl border border-teal-100 bg-white p-4 shadow-xs"
              >
                  {/* Group Header Banner with Dropdown Toggle */}
                  <div
                    onClick={() => toggleGroupExpand(group.groupId)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-teal-50/50 px-3 py-2.5 cursor-pointer select-none hover:opacity-90 transition-opacity"
                  >
                    <div className="flex items-center gap-xs flex-wrap">
                      <span className="relative inline-flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          view_carousel
                        </span>
                        {hasPendingInGroup && (
                          <NotificationBadge
                            dot
                            className="bottom-auto -top-0.5 -right-0.5 w-2.5 h-2.5 ring-[1.5px] ring-white"
                          />
                        )}
                      </span>
                      <h3 className="font-h2 text-h2 font-bold text-on-surface text-sm sm:text-base">
                        Đợt sinh thực đơn: {group.plans.length} phương án thay thế
                      </h3>
                      <span title={group.groupId} className="w-fit rounded-md border border-teal-100 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-teal-700">
                        …{group.groupId.slice(-8)}
                      </span>
                      {hasPendingInGroup && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Có phương án chờ duyệt
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant font-caption">
                      <span>Thời gian: {group.createdAt}</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-md font-semibold border border-emerald-200">
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
                          className={`relative bg-surface-container-lowest border rounded-xl p-md shadow-xs transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-md ${
                            plan.status === "pending"
                              ? "border-amber-300/80 bg-amber-50/15 hover:border-amber-400"
                              : plan.status === "approved" || plan.status === "edited"
                              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
                              : plan.status === "rejected"
                              ? "border-red-200 opacity-75 bg-red-50/30"
                              : "border-outline-variant hover:border-primary/50"
                          }`}
                        >
                          {/* Facebook-style red notification dot on top right of pending meal card */}
                          {plan.status === "pending" && (
                            <NotificationBadge
                              dot
                              className="bottom-auto top-2.5 right-2.5 w-3 h-3 ring-2 ring-white shadow-xs"
                            />
                          )}

                          {/* Left Side: Variant Index Tag & Title */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-xs mb-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-[11px] shadow-2xs">
                                Phương án {plan.variantIndex || 1}/{plan.totalVariants || 1}
                              </span>
                              <span title={plan.id} className="font-mono text-[11px] font-medium text-slate-500">
                                Mã: …{plan.id.slice(-8)}
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
                          <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 md:grid md:w-[260px] md:grid-cols-[minmax(0,1fr)_132px] md:border-t-0 md:pt-0">
                            <div>
                              {plan.status === "pending" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                  Chờ duyệt
                                </span>
                              )}
                              {plan.status === "approved" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span className="material-symbols-outlined text-[14px]">
                                    check_circle
                                  </span>
                                  Đã duyệt
                                </span>
                              )}
                              {plan.status === "edited" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                                  <span className="material-symbols-outlined text-[14px]">
                                    edit_note
                                  </span>
                                  Đã chỉnh sửa
                                </span>
                              )}
                              {plan.status === "rejected" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                                  <span className="material-symbols-outlined text-[14px]">
                                    cancel
                                  </span>
                                  Đã từ chối
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() =>
                                router.push(doctorReviewHref(patient.id, plan.id))
                              }
                              className={`flex w-[132px] items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                plan.status === "approved" || plan.status === "edited"
                                  ? "bg-emerald-700 text-white hover:bg-emerald-800"
                                  : "bg-primary text-on-primary hover:bg-primary/90"
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
              <div className="space-y-3">
                <h3 className="flex w-fit items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-[14px] font-semibold text-teal-800">
                  <span className="material-symbols-outlined text-[18px]">menu_book</span>
                  Thực đơn của bệnh nhân
                </h3>
                {standalonePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`flex flex-col items-start justify-between gap-3 rounded-xl border p-4 shadow-xs md:flex-row md:items-center ${
                      plan.status === "pending"
                        ? "border-amber-200 bg-amber-50/30"
                        : plan.status === "approved" || plan.status === "edited"
                          ? "border-teal-200 bg-teal-50/30"
                          : plan.status === "rejected"
                            ? "border-rose-200 bg-rose-50/30"
                            : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="text-[15px] font-semibold text-slate-900">
                        {plan.planTitle}
                      </h4>
                      <span title={plan.id} className="w-fit rounded-md border border-slate-200/70 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">Mã: …{plan.id.slice(-8)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600">
                        <span className="rounded-md border border-teal-100 bg-white px-2 py-1">{plan.daysCount || 7} ngày</span>
                        <span className="rounded-md border border-sky-100 bg-sky-50/60 px-2 py-1">Calo: {plan.calories}</span>
                        <span className="rounded-md border border-amber-100 bg-amber-50/60 px-2 py-1">Muối: {plan.salt}</span>
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:grid md:w-[260px] md:grid-cols-[minmax(0,1fr)_132px]">
                    <span className={`inline-flex w-fit items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${PLAN_STATUS[plan.status].color}`}>{PLAN_STATUS[plan.status].label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(doctorReviewHref(patient.id, plan.id))
                      }
                      className="flex w-[132px] items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-on-primary transition-colors hover:bg-teal-800"
                    >
                      Xem chi tiết<span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                    </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
  );
}
