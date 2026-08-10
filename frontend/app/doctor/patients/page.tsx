"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";

export default function PatientsListPage() {
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
      <TopBar title="Bệnh nhân" />
      <main className="p-lg max-w-[1400px]">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">Danh sách bệnh nhân</h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Quản lý và xem hồ sơ chi tiết của các bệnh nhân đang theo dõi dinh dưỡng
            </p>
          </div>

          <div className="flex items-center gap-sm">
            {/* Search Input */}
            <div className="relative min-w-[260px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm tên, Mã BN, bệnh lý..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
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
            Cần chú ý (
            {MOCK_PATIENTS.filter((p) => p.status === "Cần chú ý").length})
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

        {/* Patients Table Container */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden">
          {filteredPatients.length === 0 ? (
            <div className="p-xl text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
                search_off
              </span>
              <p className="font-body-bold text-body-bold">Không tìm thấy bệnh nhân phù hợp</p>
              <p className="font-caption text-caption text-xs mt-xs">
                Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Bệnh nhân
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Mã BN
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Chẩn đoán / Bệnh lý
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Cập nhật
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-body text-body">
                {filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-surface-bright transition-colors"
                  >
                    <td className="p-md">
                      <div className="flex items-center gap-sm">
                        <img
                          src={patient.avatar}
                          alt={patient.name}
                          className="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0"
                        />
                        <div>
                          <p className="font-body-bold text-on-surface font-semibold text-sm">
                            {patient.name}
                          </p>
                          <p className="font-caption text-caption text-on-surface-variant text-xs">
                            {patient.age} tuổi • {patient.gender}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-md font-mono text-xs font-medium text-on-surface-variant">
                      {patient.id}
                    </td>
                    <td className="p-md text-on-surface text-sm">{patient.condition}</td>
                    <td className="p-md">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full font-caption text-xs font-semibold ${patient.statusColor}`}
                      >
                        {patient.status}
                      </span>
                    </td>
                    <td className="p-md text-on-surface-variant text-xs">
                      {patient.lastUpdate}
                    </td>
                    <td className="p-md text-right">
                      <Link
                        href={`/doctor/patients/${patient.id}`}
                        className="inline-flex items-center gap-xs px-md py-1.5 bg-surface-container-lowest border border-primary text-primary font-body-bold rounded-lg hover:bg-primary hover:text-on-primary transition-all text-xs cursor-pointer active:scale-95 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          visibility
                        </span>
                        Xem hồ sơ
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}

