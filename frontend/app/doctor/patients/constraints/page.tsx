"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";
import { PatientCard } from "@/components/doctor/PatientCard";

interface PatientConstraints {
  salt: number;
  sugar: number;
  protein: number;
  notes: string;
}

export default function PatientConstraintsPage() {
  const [selectedPatientId, setSelectedPatientId] = useState("BN-10293");
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Per-patient constraint state store
  const [constraintsMap, setConstraintsMap] = useState<Record<string, PatientConstraints>>({
    "BN-10293": {
      salt: 4.5,
      sugar: 20,
      protein: 60,
      notes: "Hạn chế hải sản, giảm muối nghiêm ngặt cho suy thận độ 3. Theo dõi sát chỉ số đường huyết sau bữa trưa.",
    },
    "BN-10294": {
      salt: 3.0,
      sugar: 15,
      protein: 50,
      notes: "Ưu tiên đạm thực vật. Giảm chất béo bão hòa.",
    },
    "BN-10295": {
      salt: 5.0,
      sugar: 25,
      protein: 45,
      notes: "Kiêng tuyệt đối nội tạng động vật và hải sản có hàm lượng purin cao.",
    },
  });

  const currentConstraints = constraintsMap[selectedPatientId] || {
    salt: 4.5,
    sugar: 20,
    protein: 60,
    notes: "",
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdateConstraint = (field: keyof PatientConstraints, value: number | string) => {
    setConstraintsMap((prev) => ({
      ...prev,
      [selectedPatientId]: {
        ...(prev[selectedPatientId] || currentConstraints),
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    showToast(`Đã lưu ràng buộc lâm sàng cho ${selectedPatient.name} thành công!`);
  };

  return (
    <>
      <TopBar title="Ràng buộc lâm sàng" />
      <main className="p-lg max-w-[1400px]">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-lg py-sm rounded-lg shadow-lg flex items-center gap-sm animate-bounce">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="font-body-bold">{toastMessage}</span>
          </div>
        )}

        {/* Page Header & Patient Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Thiết lập ràng buộc lâm sàng
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Cấu hình các giới hạn vi chất và quy tắc dinh dưỡng y khoa riêng cho từng bệnh nhân
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

        {/* Main Form Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs">
          <div className="border-b border-outline-variant pb-md mb-lg flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-2xl">
                rule
              </span>
              <div>
                <h3 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                  Thiết lập giới hạn dinh dưỡng cho {selectedPatient.name}
                </h3>
                <p className="font-caption text-caption text-on-surface-variant text-xs">
                  Chẩn đoán: {selectedPatient.condition}
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="bg-primary text-on-primary font-body-bold py-2 px-md rounded-lg hover:bg-primary-container transition-colors shadow-xs active:scale-95 flex items-center gap-xs text-xs font-semibold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              Lưu thay đổi
            </button>
          </div>

          <div className="space-y-lg">
            {/* Row 1: Muối */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-md py-sm">
              <div className="md:w-1/3">
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Giới hạn muối (g/ngày)
                </label>
                <p className="font-caption text-caption text-on-surface-variant text-xs">
                  Khuyến nghị &lt; 5g/ngày cho người trưởng thành.
                </p>
              </div>
              <div className="md:w-2/3 flex items-center gap-md">
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={currentConstraints.salt}
                  onChange={(e) =>
                    handleUpdateConstraint("salt", parseFloat(e.target.value))
                  }
                  className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                />
                <div className="relative shrink-0">
                  <input
                    type="number"
                    step="0.5"
                    value={currentConstraints.salt}
                    onChange={(e) =>
                      handleUpdateConstraint(
                        "salt",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-24 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body text-body text-on-surface text-sm focus:outline-none focus:border-primary text-center font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-caption text-on-surface-variant text-xs pointer-events-none">
                    g
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Đường */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-md py-sm border-t border-outline-variant/40">
              <div className="md:w-1/3">
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Giới hạn đường (g/ngày)
                </label>
                <p className="font-caption text-caption text-on-surface-variant text-xs">
                  Đường tự do &lt; 25g/ngày tốt cho tim mạch và kiểm soát đường huyết.
                </p>
              </div>
              <div className="md:w-2/3 flex items-center gap-md">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={currentConstraints.sugar}
                  onChange={(e) =>
                    handleUpdateConstraint("sugar", parseFloat(e.target.value))
                  }
                  className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                />
                <div className="relative shrink-0">
                  <input
                    type="number"
                    value={currentConstraints.sugar}
                    onChange={(e) =>
                      handleUpdateConstraint(
                        "sugar",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-24 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body text-body text-on-surface text-sm focus:outline-none focus:border-primary text-center font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-caption text-on-surface-variant text-xs pointer-events-none">
                    g
                  </span>
                </div>
              </div>
            </div>

            {/* Row 3: Đạm */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-md py-sm border-t border-outline-variant/40">
              <div className="md:w-1/3">
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Giới hạn đạm (g/ngày)
                </label>
                <p className="font-caption text-caption text-on-surface-variant text-xs">
                  Điều chỉnh theo chức năng thận và bệnh lý nền của bệnh nhân.
                </p>
              </div>
              <div className="md:w-2/3 flex items-center gap-md">
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={currentConstraints.protein}
                  onChange={(e) =>
                    handleUpdateConstraint("protein", parseFloat(e.target.value))
                  }
                  className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                />
                <div className="relative shrink-0">
                  <input
                    type="number"
                    step="5"
                    value={currentConstraints.protein}
                    onChange={(e) =>
                      handleUpdateConstraint(
                        "protein",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-24 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body text-body text-on-surface text-sm focus:outline-none focus:border-primary text-center font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-caption text-on-surface-variant text-xs pointer-events-none">
                    g
                  </span>
                </div>
              </div>
            </div>

            {/* Row 4: Ghi chú */}
            <div className="pt-md border-t border-outline-variant/40">
              <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                Ghi chú ràng buộc bổ sung
              </label>
              <textarea
                value={currentConstraints.notes}
                onChange={(e) => handleUpdateConstraint("notes", e.target.value)}
                rows={4}
                placeholder="Nhập các lưu ý về dị ứng, tương tác thuốc, hoặc các hạn chế lâm sàng khác..."
                className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body text-body text-on-surface focus:outline-none focus:border-primary text-sm transition-shadow"
              />
            </div>
          </div>
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
                  <span className="material-symbols-outlined text-[22px]">gavel</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Chọn bệnh nhân để thiết lập ràng buộc lâm sàng
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
