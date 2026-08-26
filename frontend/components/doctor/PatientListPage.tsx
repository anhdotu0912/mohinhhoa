"use client";

import React, { useEffect, useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { PatientCard } from "@/components/doctor/PatientCard";

export interface PatientListPageProps {
  topBarTitle?: string;
  headerTitle: string;
  headerSubtitle: string;
  actionLabel?: string;
  patients?: Patient[];
  onSelectPatient: (patientId: string) => void;
}

export function PatientListPage({
  topBarTitle = "Lịch sử bệnh nhân",
  headerTitle = "Lịch sử ăn uống & thực đơn bệnh nhân",
  headerSubtitle = "Chọn bệnh nhân để xem toàn bộ nhật ký ghi nhận ăn uống và lịch sử thực đơn theo dòng thời gian",
  actionLabel = "Xem lịch sử",
  patients: initialPatients,
  onSelectPatient,
}: PatientListPageProps) {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [patients, setPatients] = useState<Patient[]>(initialPatients || []);
  const [loading, setLoading] = useState(!initialPatients || initialPatients.length === 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (initialPatients && initialPatients.length > 0) {
      setPatients(initialPatients);
      setLoading(false);
      return;
    }
    if (!token || role !== "doctor") return;
    let cancelled = false;
    setLoading(true);
    void api
      .listDoctorPatients()
      .then((rows) => {
        if (cancelled) return;
        setPatients(
          rows.map((r) => {
            const ui = doctorPatientToUi(r);
            return { ...ui, avatar: assetUrl(ui.avatar) || ui.avatar };
          })
        );
      })
      .catch(() => {
        // Keep current state
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialPatients, token, role]);

  const filteredPatients = patients.filter((patient) => {
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
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-xs overflow-x-auto pb-sm mb-lg border-b border-outline-variant/60">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-md py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === "all"
                ? "bg-primary text-on-primary shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Tất cả ({patients.length})
          </button>
          <button
            onClick={() => setStatusFilter("attention")}
            className={`px-md py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === "attention"
                ? "bg-error text-on-error shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Cần chú ý ({patients.filter((p) => p.status === "Cần chú ý").length})
          </button>
          <button
            onClick={() => setStatusFilter("warning")}
            className={`px-md py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === "warning"
                ? "bg-tertiary text-on-tertiary shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Cảnh báo ({patients.filter((p) => p.status === "Cảnh báo").length})
          </button>
          <button
            onClick={() => setStatusFilter("stable")}
            className={`px-md py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === "stable"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Ổn định ({patients.filter((p) => p.status === "Ổn định").length})
          </button>
        </div>

        {/* Patient Cards List */}
        <div className="flex flex-col gap-md">
          {filteredPatients.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">
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
