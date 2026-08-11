"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";
import { PatientCard } from "@/components/doctor/PatientCard";

export interface PatientListPageProps {
  topBarTitle?: string;
  headerTitle: string;
  headerSubtitle: string;
  actionLabel?: string;
  onSelectPatient: (patientId: string) => void;
}

export function PatientListPage({
  topBarTitle = "Lịch sử bệnh nhân",
  headerTitle = "Lịch sử ăn uống & thực đơn bệnh nhân",
  headerSubtitle = "Chọn bệnh nhân để xem toàn bộ nhật ký ghi nhận ăn uống và lịch sử thực đơn theo dòng thời gian",
  actionLabel = "Xem lịch sử",
  onSelectPatient,
}: PatientListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredPatients = MOCK_PATIENTS.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.condition.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "attention") return matchesSearch && patient.status === "Cần chú ý";
    if (statusFilter === "warning") return matchesSearch && patient.status === "Cảnh báo";
    if (statusFilter === "stable") return matchesSearch && patient.status === "Ổn định";

    return matchesSearch;
  });

  return (
    <>
      <TopBar title={topBarTitle} />

      <main className="p-lg max-w-[1400px]">
        {/* Page Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              {headerTitle}
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              {headerSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-sm">
            {/* Search Box */}
            <div className="relative min-w-[260px] w-full md:w-auto">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm tên, Mã BN (VD: BN-10293)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-sm border-b border-outline-variant mb-lg pb-xs">
          <button
            onClick={() => setStatusFilter("all")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer ${
              statusFilter === "all"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Tất cả ({MOCK_PATIENTS.length})
          </button>
          <button
            onClick={() => setStatusFilter("attention")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer ${
              statusFilter === "attention"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Cần chú ý ({MOCK_PATIENTS.filter((p) => p.status === "Cần chú ý").length})
          </button>
          <button
            onClick={() => setStatusFilter("warning")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer ${
              statusFilter === "warning"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Cảnh báo ({MOCK_PATIENTS.filter((p) => p.status === "Cảnh báo").length})
          </button>
          <button
            onClick={() => setStatusFilter("stable")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer ${
              statusFilter === "stable"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Ổn định ({MOCK_PATIENTS.filter((p) => p.status === "Ổn định").length})
          </button>
        </div>

        {/* Patient Cards List */}
        <div className="flex flex-col gap-md">
          {filteredPatients.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
                person_search
              </span>
              <p className="font-body-bold text-body-bold">Không tìm thấy bệnh nhân phù hợp</p>
              <p className="font-caption text-caption text-xs mt-xs">
                Thử thay đổi từ khóa tìm kiếm hoặc chọn tab bộ lọc khác.
              </p>
            </div>
          ) : (
            filteredPatients.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                actionText={actionLabel}
                onSelect={onSelectPatient}
              />
            ))
          )}
        </div>
      </main>
    </>
  );
}
