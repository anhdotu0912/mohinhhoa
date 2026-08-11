"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";
import { PatientCard } from "@/components/doctor/PatientCard";

export default function PatientCompliancePage() {
  const [selectedPatientId, setSelectedPatientId] = useState("BN-10293");
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  const selectedPatient =
    MOCK_PATIENTS.find((p) => p.id === selectedPatientId) || MOCK_PATIENTS[0];

  const filteredPatients = MOCK_PATIENTS.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q)
    );
  });

  const handleSelectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setIsSelectModalOpen(false);
  };

  const complianceLogsMap: Record<
    string,
    {
      title: string;
      time: string;
      description: string;
      type: "warning" | "success" | "info";
    }[]
  > = {
    "BN-10293": [
      {
        title: "Vượt ngưỡng muối trong bữa trưa",
        time: "12:30, 15/10/2023",
        description:
          "Bệnh nhân nhập bữa ăn chứa lượng natri cao hơn 20% so với kế hoạch đề ra cho buổi trưa. Cần lưu ý tư vấn giảm muối trong bữa tối.",
        type: "warning",
      },
      {
        title: "Hoàn thành ghi nhận thực đơn bữa sáng",
        time: "08:15, 15/10/2023",
        description:
          "Nhập liệu đầy đủ bữa sáng đúng thời hạn. Calo và các chỉ số dinh dưỡng nằm trong khoảng cho phép.",
        type: "success",
      },
      {
        title: "Đạt mục tiêu uống nước (2.5L)",
        time: "20:00, 14/10/2023",
        description:
          "Bệnh nhân đạt mục tiêu uống đủ 2.5 lít nước trong ngày, hỗ trợ lọc thận hiệu quả.",
        type: "success",
      },
      {
        title: "Bỏ lỡ ghi nhận bữa tối",
        time: "21:30, 13/10/2023",
        description:
          "Bệnh nhân không ghi nhận nhật ký bữa tối. Hệ thống đã tự động gởi nhắc nhở qua tin nhắn.",
        type: "warning",
      },
    ],
    "BN-10294": [
      {
        title: "Tuân thủ tốt chế độ ăn ít lipid",
        time: "19:00, 15/10/2023",
        description: "Ghi nhận 3 bữa chính đạt chuẩn ít chất béo bão hòa.",
        type: "success",
      },
      {
        title: "Hoàn thành mục tiêu vận động nhẹ",
        time: "17:30, 14/10/2023",
        description: "Đi bộ 30 phút buổi chiều theo hướng dẫn.",
        type: "success",
      },
    ],
    "BN-10295": [
      {
        title: "Cảnh báo chỉ số purin cao",
        time: "13:00, 14/10/2023",
        description: "Khẩu phần chứa thịt đỏ vượt ngưỡng khuyến nghị cho người bệnh Gout.",
        type: "warning",
      },
    ],
  };

  const currentLogs = complianceLogsMap[selectedPatientId] || complianceLogsMap["BN-10293"];

  return (
    <>
      <TopBar title="Theo dõi tuân thủ" />
      <main className="p-lg max-w-[1400px]">
        {/* Header & Patient Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Theo dõi tuân thủ dinh dưỡng
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Thống kê mức độ tuân thủ thực đơn và nhật ký ghi nhận của bệnh nhân
            </p>
          </div>

          {/* Patient Selector Button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsSelectModalOpen(true)}
              className="flex items-center gap-sm px-md py-sm bg-surface-container-lowest border border-outline-variant hover:border-primary rounded-xl font-body text-body text-on-surface transition-all cursor-pointer shadow-xs min-w-[260px] justify-between group active:scale-95"
            >
              <div className="flex items-center gap-sm">
                <img
                  src={selectedPatient.avatar}
                  alt={selectedPatient.name}
                  className="w-7 h-7 rounded-full object-cover border border-outline-variant"
                />
                <span className="font-body-bold text-sm font-semibold">
                  {selectedPatient.name} ({selectedPatient.id})
                </span>
              </div>
              <span className="material-symbols-outlined text-primary group-hover:translate-x-0.5 transition-transform text-[20px]">
                swap_horiz
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-section-gap">
          {/* Chart Card */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs flex flex-col p-card-padding">
            <div className="flex justify-between items-center pb-md border-b border-outline-variant mb-md">
              <div>
                <h3 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                  Biểu đồ tuân thủ (14 ngày qua)
                </h3>
                <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                  Bệnh nhân: <span className="font-bold text-primary">{selectedPatient.name}</span>
                </p>
              </div>
              <div className="flex items-center gap-md">
                <span className="inline-flex items-center gap-xs font-caption text-caption text-on-surface-variant text-xs">
                  <span className="w-3 h-3 rounded-full bg-primary inline-block"></span> Mức độ tuân thủ (%)
                </span>
              </div>
            </div>

            {/* SVG Line Chart */}
            <div className="h-[280px] w-full relative pt-2">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 250">
                {/* Grid lines */}
                <g stroke="#e5e7eb" strokeDasharray="4 4" strokeWidth="1">
                  <line x1="40" x2="980" y1="20" y2="20" />
                  <line x1="40" x2="980" y1="75" y2="75" />
                  <line x1="40" x2="980" y1="130" y2="130" />
                  <line x1="40" x2="980" y1="185" y2="185" />
                  <line strokeDasharray="none" x1="40" x2="980" y1="240" y2="240" />
                </g>

                {/* Vertical axis labels */}
                <g fill="#6e7a75" fontFamily="Inter" fontSize="12" textAnchor="end">
                  <text x="30" y="24">100</text>
                  <text x="30" y="79">75</text>
                  <text x="30" y="134">50</text>
                  <text x="30" y="189">25</text>
                  <text x="30" y="244">0</text>
                </g>

                {/* Date Labels */}
                <g fill="#6e7a75" fontFamily="Inter" fontSize="12" textAnchor="middle">
                  <text x="40" y="265">1/10</text>
                  <text x="174" y="265">3/10</text>
                  <text x="308" y="265">5/10</text>
                  <text x="442" y="265">7/10</text>
                  <text x="576" y="265">9/10</text>
                  <text x="710" y="265">11/10</text>
                  <text x="844" y="265">13/10</text>
                  <text x="980" y="265">15/10</text>
                </g>

                {/* Line Path */}
                <path
                  d="M 40 40 L 107 50 L 174 30 L 241 80 L 308 60 L 375 90 L 442 40 L 509 35 L 576 65 L 643 50 L 710 85 L 777 45 L 844 30 L 911 25 L 980 40"
                  fill="none"
                  stroke="#006857"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                />

                {/* Area Gradient */}
                <path
                  d="M 40 40 L 107 50 L 174 30 L 241 80 L 308 60 L 375 90 L 442 40 L 509 35 L 576 65 L 643 50 L 710 85 L 777 45 L 844 30 L 911 25 L 980 40 L 980 240 L 40 240 Z"
                  fill="url(#teal-fade)"
                  opacity="0.12"
                />

                {/* Data Points */}
                <g fill="#ffffff" stroke="#006857" strokeWidth="2">
                  <circle cx="40" cy="40" r="4" />
                  <circle cx="174" cy="30" r="4" />
                  <circle cx="308" cy="60" r="4" />
                  <circle cx="442" cy="40" r="4" />
                  <circle cx="576" cy="65" r="4" />
                  <circle cx="710" cy="85" r="4" />
                  <circle cx="844" cy="30" r="4" />
                  <circle cx="980" cy="40" r="4" />
                </g>

                <defs>
                  <linearGradient id="teal-fade" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#006857" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </section>

          {/* Event Log Card */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs flex flex-col p-card-padding">
            <div className="pb-md border-b border-outline-variant mb-md flex justify-between items-center">
              <h3 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                Nhật ký sự kiện tuân thủ
              </h3>
              <span className="font-caption text-caption text-on-surface-variant text-xs">
                Mới nhất
              </span>
            </div>

            <div className="relative border-l border-outline-variant ml-[19px] py-xs flex flex-col gap-lg">
              {currentLogs.map((log, index) => (
                <div key={index} className="relative pl-lg flex items-start group">
                  {/* Timeline Icon Node */}
                  <div className="absolute -left-[20px] top-0.5 w-10 h-10 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center z-10 transition-colors shadow-xs">
                    {log.type === "warning" ? (
                      <span className="material-symbols-outlined text-tertiary text-[20px]">
                        warning
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-primary text-[20px]">
                        check_circle
                      </span>
                    )}
                  </div>

                  {/* Content Body */}
                  <div className="flex-1 bg-surface-container-low/40 p-md rounded-xl border border-outline-variant/40">
                    <div className="flex justify-between items-baseline mb-xs">
                      <h4 className="font-body-bold text-body-bold text-on-surface font-semibold text-sm">
                        {log.title}
                      </h4>
                      <span className="font-caption text-caption text-on-surface-variant text-xs shrink-0 ml-md">
                        {log.time}
                      </span>
                    </div>
                    <p className="font-body text-body text-on-surface-variant text-xs leading-relaxed">
                      {log.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
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
                  <span className="material-symbols-outlined text-[22px]">person_search</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Chọn bệnh nhân để theo dõi tuân thủ
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
              {filteredPatients.length === 0 ? (
                <div className="text-center py-xl text-on-surface-variant text-xs">
                  Không tìm thấy bệnh nhân phù hợp với từ khóa &quot;{patientSearch}&quot;.
                </div>
              ) : (
                filteredPatients.map((p) => (
                  <PatientCard
                    key={p.id}
                    patient={p}
                    isSelected={p.id === selectedPatientId}
                    actionText={p.id === selectedPatientId ? "Đang chọn" : "Chọn bệnh nhân"}
                    onSelect={handleSelectPatient}
                  />
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-md border-t border-outline-variant mt-md flex justify-between items-center text-xs text-on-surface-variant">
              <span>Hiển thị {filteredPatients.length} bệnh nhân</span>
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
