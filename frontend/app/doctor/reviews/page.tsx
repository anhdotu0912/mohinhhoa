"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";

export interface ReviewQueueItem {
  id: string;
  patientId: string;
  patientName: string;
  avatar: string;
  condition: string;
  conditionColor: string;
  planTitle: string;
  calories: string;
  salt: string;
  sugar?: string;
  water?: string;
  status: "pending" | "urgent" | "approved";
  statusLabel: string;
  statusColor: string;
  createdAt: string;
}

export const MOCK_REVIEWS_QUEUE: ReviewQueueItem[] = [
  {
    id: "PLAN-001",
    patientId: "BN-10293",
    patientName: "Nguyễn Văn A",
    avatar: MOCK_PATIENTS[0].avatar,
    condition: "Tiểu đường type 2",
    conditionColor: "bg-tertiary-fixed text-tertiary",
    planTitle: "Thực đơn giảm muối cho bệnh nhân suy thận giai đoạn 3, kiểm soát đường huyết",
    calories: "1800 kcal",
    salt: "2g",
    sugar: "10g",
    status: "pending",
    statusLabel: "Chờ duyệt",
    statusColor: "bg-tertiary-fixed text-tertiary border border-tertiary-fixed-dim",
    createdAt: "12/10/2023 08:30",
  },
  {
    id: "PLAN-002",
    patientId: "BN-10294",
    patientName: "Trần Thị B",
    avatar: MOCK_PATIENTS[1].avatar,
    condition: "Tăng huyết áp",
    conditionColor: "bg-error-container text-error",
    planTitle: "Điều chỉnh chế độ ăn thuần chay, tăng cường kali và canxi",
    calories: "1650 kcal",
    salt: "1.5g",
    sugar: "15g",
    status: "urgent",
    statusLabel: "Ưu tiên cao",
    statusColor: "bg-error-container text-error border border-error/30",
    createdAt: "12/10/2023 09:15",
  },
  {
    id: "PLAN-003",
    patientId: "BN-10295",
    patientName: "Lê Văn C",
    avatar: MOCK_PATIENTS[2].avatar,
    condition: "Gout",
    conditionColor: "bg-secondary-fixed text-on-secondary-fixed",
    planTitle: "Kế hoạch giảm purin trong bữa tối, tăng cường nước khoáng",
    calories: "2000 kcal",
    salt: "3g",
    water: "2.5L",
    status: "approved",
    statusLabel: "Đã duyệt",
    statusColor: "bg-surface-variant text-on-surface-variant border border-outline-variant",
    createdAt: "11/10/2023 16:45",
  },
];

export default function DoctorReviewsPage() {
  const [activeTab, setActiveTab] = useState<"all" | "urgent" | "approved">("all");

  const filteredQueue = MOCK_REVIEWS_QUEUE.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "urgent") return item.status === "urgent" || item.status === "pending";
    if (activeTab === "approved") return item.status === "approved";
    return true;
  });

  return (
    <>
      <TopBar title="Hàng đợi duyệt kế hoạch" />
      <main className="p-lg max-w-[1400px]">
        {/* Page Title & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Hàng đợi duyệt kế hoạch
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Danh sách thực đơn dinh dưỡng do AI đề xuất cần bác sĩ chuyên khoa xem xét và phê duyệt
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-md border-b border-outline-variant mb-lg pb-sm">
          <button
            onClick={() => setActiveTab("all")}
            className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 ${
              activeTab === "all"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-primary"
            }`}
          >
            Tất cả ({MOCK_REVIEWS_QUEUE.length})
          </button>
          <button
            onClick={() => setActiveTab("urgent")}
            className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 ${
              activeTab === "urgent"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-primary"
            }`}
          >
            Cần xử lý (
            {MOCK_REVIEWS_QUEUE.filter((i) => i.status !== "approved").length})
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 ${
              activeTab === "approved"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-primary"
            }`}
          >
            Đã duyệt (
            {MOCK_REVIEWS_QUEUE.filter((i) => i.status === "approved").length})
          </button>
        </div>

        {/* Queue List Cards */}
        <div className="flex flex-col gap-md">
          {filteredQueue.map((item) => (
            <div
              key={item.id}
              className={`bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-card-padding shadow-xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center gap-lg ${
                item.status === "approved" ? "opacity-80" : ""
              }`}
            >
              {/* Left Section: Patient Info */}
              <div className="flex items-center gap-md md:w-1/4 min-w-[220px]">
                <img
                  src={item.avatar}
                  alt={item.patientName}
                  className="w-12 h-12 rounded-full object-cover border border-outline-variant shrink-0"
                />
                <div className="flex flex-col">
                  <span className="font-body-bold text-body-bold text-on-surface font-semibold text-sm">
                    {item.patientName}
                  </span>
                  <span
                    className={`font-caption text-caption px-2 py-0.5 rounded-full mt-xs inline-block w-fit text-xs ${item.conditionColor}`}
                  >
                    {item.condition}
                  </span>
                </div>
              </div>

              {/* Middle Section: Plan Title & Nutrition Metrics */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <p
                  className="font-body text-body text-on-surface font-medium truncate mb-xs text-sm"
                  title={item.planTitle}
                >
                  {item.planTitle}
                </p>
                <div className="flex items-center gap-md font-caption text-caption text-on-surface-variant text-xs">
                  <span className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[16px] text-outline">
                      local_fire_department
                    </span>
                    Calo: {item.calories}
                  </span>
                  <span className="flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[16px] text-outline">
                      grain
                    </span>
                    Muối: {item.salt}
                  </span>
                  {item.sugar && (
                    <span className="flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[16px] text-outline">
                        opacity
                      </span>
                      Đường: {item.sugar}
                    </span>
                  )}
                  {item.water && (
                    <span className="flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[16px] text-outline">
                        water_drop
                      </span>
                      Nước: {item.water}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Section: Status Pill & Action Button */}
              <div className="flex items-center gap-md md:w-1/4 justify-end shrink-0">
                <span
                  className={`font-label text-label px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${item.statusColor}`}
                >
                  {item.statusLabel}
                </span>

                <Link
                  href={`/doctor/reviews/${item.id}`}
                  className={`font-body-bold text-body-bold h-10 px-md rounded-lg transition-all flex items-center justify-center text-xs font-semibold shrink-0 cursor-pointer active:scale-95 shadow-xs ${
                    item.status === "approved"
                      ? "bg-surface-container-lowest text-primary border border-primary hover:bg-primary hover:text-on-primary"
                      : "bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
                  }`}
                >
                  {item.status === "approved" ? "Xem lại" : "Xem chi tiết"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

