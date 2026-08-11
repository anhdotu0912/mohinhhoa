"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";
import { PatientCard } from "@/components/doctor/PatientCard";
import { usePlansStore } from "@/lib/plans-store";

export default function DoctorReviewsPage() {
  const router = useRouter();
  const { getPendingCountByPatientId, plans } = usePlansStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved">("all");

  // Patient Selection Modal state
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  const filteredPatients = MOCK_PATIENTS.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.condition.toLowerCase().includes(searchQuery.toLowerCase());

    const pendingCount = getPendingCountByPatientId(patient.id);
    const hasApproved = plans.some(
      (p) => p.patientId === patient.id && p.status === "approved"
    );

    if (activeTab === "pending") return matchesSearch && pendingCount > 0;
    if (activeTab === "approved") return matchesSearch && hasApproved;
    return matchesSearch;
  });

  const modalFilteredPatients = MOCK_PATIENTS.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q)
    );
  });

  const handleSelectPatientForGenerate = (patientId: string) => {
    setIsSelectModalOpen(false);
    router.push(`/doctor/patients/${patientId}/generate`);
  };

  return (
    <>
      <TopBar title="Hàng đợi duyệt kế hoạch" />

      <main className="p-lg max-w-[1400px]">
        {/* Page Title & Subtitle + Action Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Danh sách bệnh nhân duyệt thực đơn
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Chọn bệnh nhân để xem và phê duyệt các thực đơn dinh dưỡng do AI khởi tạo
            </p>
          </div>

          <div className="flex items-center gap-sm">
            {/* Search Box */}
            <div className="relative min-w-[240px]">
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

            <button
              onClick={() => setIsSelectModalOpen(true)}
              className="bg-primary text-on-primary px-md py-2 rounded-lg font-body-bold text-sm hover:bg-primary-container transition-all shadow-xs flex items-center gap-xs cursor-pointer active:scale-95 font-semibold shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Tạo thực đơn mới bằng AI</span>
            </button>
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
            Tất cả bệnh nhân ({MOCK_PATIENTS.length})
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 ${
              activeTab === "pending"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-primary"
            }`}
          >
            Có thực đơn chờ duyệt (
            {
              MOCK_PATIENTS.filter((p) => getPendingCountByPatientId(p.id) > 0)
                .length
            }
            )
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`font-label text-label pb-sm px-sm transition-colors cursor-pointer border-b-2 ${
              activeTab === "approved"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-primary"
            }`}
          >
            Đã có thực đơn được duyệt (
            {
              MOCK_PATIENTS.filter((p) =>
                plans.some((pl) => pl.patientId === p.id && pl.status === "approved")
              ).length
            }
            )
          </button>
        </div>

        {/* Patients List Grid / Cards */}
        <div className="flex flex-col gap-md">
          {filteredPatients.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
                person_search
              </span>
              <p className="font-body-bold text-body-bold">Không tìm thấy bệnh nhân phù hợp</p>
              <p className="font-caption text-caption text-xs mt-xs">
                Thử đổi từ khóa tìm kiếm hoặc chọn tab bộ lọc khác.
              </p>
            </div>
          ) : (
            filteredPatients.map((patient) => {
              const pendingCount = getPendingCountByPatientId(patient.id);
              const patientPlans = plans.filter((p) => p.patientId === patient.id);

              return (
                <div
                  key={patient.id}
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs hover:border-primary/50 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-md"
                >
                  {/* Left Section: Avatar & Demographics */}
                  <div className="flex items-center gap-md md:w-1/3">
                    <img
                      src={patient.avatar}
                      alt={patient.name}
                      className="w-12 h-12 rounded-full object-cover border border-outline-variant shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-xs mb-1">
                        <h3 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                          {patient.name}
                        </h3>
                        <span className="font-mono text-caption text-on-surface-variant text-xs">
                          ({patient.id})
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        {patient.age} tuổi • {patient.gender} • {patient.condition}
                      </p>
                    </div>
                  </div>

                  {/* Middle Section: Plans Summary Badges */}
                  <div className="flex-1 border-t md:border-t-0 md:border-l border-outline-variant/40 pt-md md:pt-0 md:pl-lg flex items-center gap-sm flex-wrap">
                    {pendingCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        {pendingCount} thực đơn chờ duyệt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        Không có thực đơn chờ duyệt
                      </span>
                    )}

                    <span className="text-xs text-on-surface-variant">
                      Tổng số: {patientPlans.length} thực đơn đã khởi tạo
                    </span>
                  </div>

                  {/* Right Section: Action Button to Level 2 */}
                  <div className="flex items-center gap-md md:w-1/4 justify-end shrink-0 w-full md:w-auto">
                    <Link
                      href={`/doctor/reviews/${patient.id}`}
                      className="w-full md:w-auto bg-primary hover:bg-primary-container text-on-primary font-body-bold h-10 px-lg rounded-lg transition-all flex items-center justify-center gap-xs text-xs font-semibold shrink-0 cursor-pointer active:scale-95 shadow-xs"
                    >
                      <span>Xem thực đơn</span>
                      <span className="material-symbols-outlined text-[16px]">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* PATIENT SELECTION MODAL */}
      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-md animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md">
              <div className="flex items-center gap-sm">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Chọn bệnh nhân để tạo thực đơn AI
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs">
                    Vui lòng chọn một bệnh nhân trong danh sách phụ trách bên dưới
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSelectModalOpen(false)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Search Input Box */}
            <div className="relative mb-md">
              <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline text-[20px]">
                search
              </span>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Tìm theo tên, mã bệnh nhân (VD: BN-10293), hoặc bệnh lý..."
                className="w-full pl-xl pr-md py-sm bg-surface-container-low border border-outline-variant rounded-xl font-body text-body text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                autoFocus
              />
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto space-y-sm pr-xs">
              {modalFilteredPatients.length === 0 ? (
                <div className="text-center py-xl text-on-surface-variant text-xs">
                  Không tìm thấy bệnh nhân phù hợp với từ khóa &quot;{patientSearch}&quot;.
                </div>
              ) : (
                modalFilteredPatients.map((patient) => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    onSelect={handleSelectPatientForGenerate}
                  />
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-md border-t border-outline-variant mt-md flex justify-between items-center text-xs text-on-surface-variant">
              <span>Hiển thị {modalFilteredPatients.length} bệnh nhân</span>
              <button
                onClick={() => setIsSelectModalOpen(false)}
                className="px-md py-sm border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
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
