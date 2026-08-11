"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";
import { PatientCard } from "@/components/doctor/PatientCard";
import { useQueueStore } from "@/lib/queue-store";

export default function PatientsListPage() {
  const router = useRouter();
  const { addJobs } = useQueueStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Multi-select mode state
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);

  // Single patient modal state
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

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

  // Modal filtered patients
  const modalFilteredPatients = MOCK_PATIENTS.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q)
    );
  });

  const toggleSelectPatient = (id: string) => {
    if (selectedPatientIds.includes(id)) {
      setSelectedPatientIds(selectedPatientIds.filter((pid) => pid !== id));
    } else {
      setSelectedPatientIds([...selectedPatientIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedPatientIds.length === filteredPatients.length) {
      setSelectedPatientIds([]);
    } else {
      setSelectedPatientIds(filteredPatients.map((p) => p.id));
    }
  };

  const handleBulkGenerate = () => {
    const selectedPatients = MOCK_PATIENTS.filter((p) =>
      selectedPatientIds.includes(p.id)
    ).map((p) => ({ id: p.id, name: p.name }));

    if (selectedPatients.length === 0) return;

    addJobs(selectedPatients);
    showToast(`Đã thêm ${selectedPatients.length} thực đơn vào hàng đợi`);

    // Reset multi select state
    setSelectedPatientIds([]);
    setIsMultiSelect(false);
  };

  const handleSingleSelectPatient = (patientId: string) => {
    setIsSelectModalOpen(false);
    router.push(`/doctor/patients/${patientId}/generate`);
  };

  return (
    <>
      <TopBar title="Bệnh nhân" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm animate-slide-down">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-lg max-w-[1400px] pb-24">
        {/* Page Header & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">Danh sách bệnh nhân</h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Quản lý và xem hồ sơ chi tiết của các bệnh nhân đang theo dõi dinh dưỡng
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-sm">
            {/* Search Input */}
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

            {/* Select Multiple Toggle Button */}
            <button
              onClick={() => {
                setIsMultiSelect(!isMultiSelect);
                if (isMultiSelect) setSelectedPatientIds([]);
              }}
              className={`px-md py-2 rounded-lg font-body-bold text-sm transition-all flex items-center gap-xs cursor-pointer border shadow-xs ${
                isMultiSelect
                  ? "bg-emerald-50 text-emerald-800 border-emerald-500 font-semibold"
                  : "bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isMultiSelect ? "check_box" : "checklist"}
              </span>
              <span>{isMultiSelect ? "Tắt chọn nhiều" : "Chọn nhiều"}</span>
            </button>

            {/* Single Generate Modal Trigger */}
            <button
              onClick={() => setIsSelectModalOpen(true)}
              className="bg-primary text-on-primary px-md py-2 rounded-lg font-body-bold text-sm hover:bg-primary-container transition-all shadow-xs flex items-center gap-xs cursor-pointer active:scale-95 font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Tạo thực đơn AI</span>
            </button>
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
                  {isMultiSelect && (
                    <th className="p-md w-12 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedPatientIds.length > 0 &&
                          selectedPatientIds.length === filteredPatients.length
                        }
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                  )}
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
                {filteredPatients.map((patient) => {
                  const isSelected = selectedPatientIds.includes(patient.id);
                  return (
                    <tr
                      key={patient.id}
                      onClick={() => {
                        if (isMultiSelect) toggleSelectPatient(patient.id);
                      }}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-emerald-50/60 hover:bg-emerald-50"
                          : "hover:bg-surface-bright"
                      } ${isMultiSelect ? "cursor-pointer" : ""}`}
                    >
                      {isMultiSelect && (
                        <td className="p-md text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectPatient(patient.id)}
                            className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                      )}
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
                      <td className="p-md text-right" onClick={(e) => e.stopPropagation()}>
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Sticky Action Bar (appears when >= 1 patient is selected in multi-select mode) */}
      {isMultiSelect && selectedPatientIds.length >= 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 text-white px-lg py-md rounded-2xl shadow-2xl border border-gray-700/60 backdrop-blur-md flex items-center gap-lg animate-slide-up">
          <div className="flex items-center gap-sm">
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
              {selectedPatientIds.length}
            </span>
            <span className="font-body-bold font-medium text-sm">
              Đã chọn <strong className="text-emerald-400">{selectedPatientIds.length}</strong> bệnh nhân
            </span>
          </div>

          <div className="flex items-center gap-sm">
            <button
              onClick={() => setSelectedPatientIds([])}
              className="px-md py-2 text-xs text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              Hủy chọn
            </button>
            <button
              onClick={handleBulkGenerate}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-lg py-2.5 rounded-xl font-body-bold text-sm transition-all shadow-md flex items-center gap-xs cursor-pointer active:scale-95 font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>Tạo thực đơn hàng loạt</span>
            </button>
          </div>
        </div>
      )}

      {/* Single Patient Generation Modal */}
      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md bg-black/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
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
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors"
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
                    onSelect={handleSingleSelectPatient}
                  />
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-md border-t border-outline-variant mt-md flex justify-between items-center text-xs text-on-surface-variant">
              <span>Hiển thị {modalFilteredPatients.length} bệnh nhân</span>
              <button
                onClick={() => setIsSelectModalOpen(false)}
                className="px-md py-sm border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors"
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
