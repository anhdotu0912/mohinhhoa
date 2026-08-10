"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";

interface PatientConstraints {
  salt: number;
  sugar: number;
  protein: number;
  notes: string;
}

export default function PatientConstraintsPage() {
  const [selectedPatientId, setSelectedPatientId] = useState("BN-10293");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedPatient =
    MOCK_PATIENTS.find((p) => p.id === selectedPatientId) || MOCK_PATIENTS[0];

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

          {/* Patient Selector Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-sm px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl font-body text-body text-on-surface hover:border-primary transition-all cursor-pointer shadow-xs min-w-[260px] justify-between"
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
              <span className="material-symbols-outlined text-outline text-[20px]">
                arrow_drop_down
              </span>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-xs w-full bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-30 overflow-hidden py-xs">
                {MOCK_PATIENTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-md py-sm flex items-center gap-sm hover:bg-surface-container-low transition-colors cursor-pointer text-xs ${
                      p.id === selectedPatientId
                        ? "bg-primary-container/10 font-bold text-primary"
                        : "text-on-surface"
                    }`}
                  >
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {p.id} • {p.condition}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
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
    </>
  );
}

