"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import Pagination, { getPageItems } from "@/components/shared/Pagination";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { doctorPatientToUi, type Patient, MOCK_PATIENTS } from "@/lib/mock-data";
import { shortCondition } from "@/lib/format";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";

interface PatientConstraints {
  salt: number; // g/day
  sugar: number; // g/day
  protein: number; // g/day
  notes: string;
}

const PAGE_SIZE = 10;

const INITIAL_CONSTRAINTS: Record<string, PatientConstraints> = {
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
  "BN-10296": {
    salt: 4.0,
    sugar: 18,
    protein: 55,
    notes: "Giảm muối vừa phải, tăng cường rau xanh giàu kali.",
  },
  "BN-10297": {
    salt: 3.5,
    sugar: 12,
    protein: 65,
    notes: "Kiểm soát đường huyết nghiêm ngặt, chia nhỏ các bữa ăn trong ngày.",
  },
};

function getDefaultConstraints(patient?: Patient): PatientConstraints {
  const condition = (patient?.condition || "").toLowerCase();
  let salt = 5.0;
  let sugar = 25;
  let protein = 60;
  let notes = "Chế độ ăn cân bằng dinh dưỡng, theo dõi định kỳ.";

  if (condition.includes("thận") || condition.includes("ckd")) {
    salt = 3.5;
    sugar = 20;
    protein = 45;
    notes = "Kiểm soát đạm và muối nghiêm ngặt theo phác đồ suy thận.";
  } else if (condition.includes("tiểu đường") || condition.includes("đường huyết")) {
    salt = 4.5;
    sugar = 15;
    protein = 55;
    notes = "Hạn chế đường tự do < 15g/ngày, bổ sung chất xơ hòa tan.";
  } else if (condition.includes("huyết áp") || condition.includes("tim")) {
    salt = 3.0;
    sugar = 20;
    protein = 50;
    notes = "Áp dụng chế độ ăn giảm muối DASH, tăng kali tự nhiên.";
  }

  return { salt, sugar, protein, notes };
}

function truncateId(id: string): string {
  return id.length > 6 ? `...${id.slice(-4)}` : id;
}

function toUiPatient(row: DoctorPatientSummary): Patient {
  const ui = doctorPatientToUi(row);
  return { ...ui, avatar: assetUrl(ui.avatar) || ui.avatar };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export default function PatientConstraintsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [diagnosisFilter, setDiagnosisFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [constraintsMap, setConstraintsMap] =
    useState<Record<string, PatientConstraints>>(INITIAL_CONSTRAINTS);

  // Detail Modal State
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);

  // Editing Modal State
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editingForm, setEditingForm] = useState<PatientConstraints>({
    salt: 4.5,
    sugar: 20,
    protein: 60,
    notes: "",
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadPatients = useCallback(async () => {
    if (!token || role !== "doctor") return;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await api.listDoctorPatients();
      if (rows && rows.length > 0) {
        setPatients(rows.map(toUiPatient));
      } else {
        setPatients(MOCK_PATIENTS);
      }
    } catch (err) {
      // Fallback to mock data for smooth demo
      setPatients(MOCK_PATIENTS);
      if (err instanceof ApiError && err.status !== 401) {
        setLoadError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, role]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void loadPatients();
  }, [hydrated, token, role, router, loadPatients]);

  const getPatientConstraint = useCallback(
    (patient: Patient): PatientConstraints => {
      return constraintsMap[patient.id] || getDefaultConstraints(patient);
    },
    [constraintsMap]
  );

  const handleOpenEdit = (patient: Patient) => {
    const current = getPatientConstraint(patient);
    setEditingPatient(patient);
    setEditingForm({ ...current });
  };

  const handleCloseEdit = () => {
    setEditingPatient(null);
  };

  const handleSaveEdit = () => {
    if (!editingPatient) return;
    setConstraintsMap((prev) => ({
      ...prev,
      [editingPatient.id]: { ...editingForm },
    }));
    showToast(`Đã lưu ràng buộc lâm sàng cho ${editingPatient.name} thành công!`);
    setEditingPatient(null);
  };

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesSearch =
        !q ||
        patient.name.toLowerCase().includes(q) ||
        patient.id.toLowerCase().includes(q) ||
        (patient.condition || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (diagnosisFilter === "all") return true;
      return (patient.condition || "").toLowerCase().includes(diagnosisFilter.toLowerCase());
    });
  }, [patients, searchQuery, diagnosisFilter]);

  // Reset to page 1 on search / filter
  useEffect(() => {
    setPage(1);
  }, [searchQuery, diagnosisFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPatients = getPageItems(filteredPatients, safePage, PAGE_SIZE);

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <>
        <TopBar title="Ràng buộc lâm sàng" />
        <main className="p-lg text-sm text-on-surface-variant">
          Đang tải danh sách ràng buộc bệnh nhân…
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Ràng buộc lâm sàng" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[60] bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm animate-slide-down">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-lg max-w-[1400px]">
        {loadError && (
          <div className="mb-md p-md bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
            <span>{loadError}</span>
            <button
              onClick={() => void loadPatients()}
              className="text-primary font-semibold hover:underline cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Page Title & Subtitle + Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Thiết lập ràng buộc lâm sàng
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Quản lý và điều chỉnh các giới hạn vi chất dinh dưỡng (Muối, Đường, Đạm) y khoa cho từng bệnh nhân
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            {/* Search Box */}
            <div className="relative min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã BN, tên bệnh nhân, bệnh lý..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Diagnosis Filter */}
            <div className="relative min-w-[180px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                filter_alt
              </span>
              <select
                value={diagnosisFilter}
                onChange={(e) => setDiagnosisFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Tất cả bệnh lý</option>
                <option value="tiểu đường">Tiểu đường</option>
                <option value="huyết áp">Tăng huyết áp</option>
                <option value="thận">Bệnh thận / CKD</option>
                <option value="lipid">Rối loạn lipid</option>
                <option value="gout">Gút (Gout)</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                arrow_drop_down
              </span>
            </div>
          </div>
        </div>

        {/* Patients Constraints Table */}
        {filteredPatients.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
              rule
            </span>
            <p className="font-body-bold text-body-bold">
              Không tìm thấy bệnh nhân phù hợp
            </p>
            <p className="font-caption text-caption text-xs mt-xs">
              Thử thay đổi từ khóa tìm kiếm hoặc chọn lại nhóm bệnh lý.
            </p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[980px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Mã BN
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Bệnh nhân
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs">
                      Chẩn đoán bệnh lý
                    </th>
                    <th className="px-sm py-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-center whitespace-nowrap">
                      Muối (Na)
                    </th>
                    <th className="px-sm py-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-center whitespace-nowrap">
                      Đường
                    </th>
                    <th className="px-sm py-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-center whitespace-nowrap">
                      Đạm (Protein)
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs min-w-[200px] max-w-[320px]">
                      Ghi chú lâm sàng
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-xs text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-body text-body">
                  {pagedPatients.map((patient) => {
                    const c = getPatientConstraint(patient);
                    return (
                      <tr
                        key={patient.id}
                        className="transition-colors hover:bg-surface-bright"
                      >
                        {/* Mã BN */}
                        <td className="p-md">
                          <span
                            title={patient.id}
                            className="font-mono text-xs font-medium text-on-surface-variant"
                          >
                            {truncateId(patient.id)}
                          </span>
                        </td>

                        {/* Bệnh nhân Info */}
                        <td className="p-md">
                          <div className="flex items-center gap-sm min-w-0">
                            <div className="relative w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-label text-xs font-semibold shrink-0">
                              {initials(patient.name)}
                              {patient.avatar &&
                                !patient.avatar.startsWith("https://api.dicebear.com") && (
                                  <img
                                    src={patient.avatar}
                                    alt={patient.name}
                                    className="absolute inset-0 w-9 h-9 rounded-full object-cover border border-outline-variant bg-surface-container"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-body-bold text-on-surface font-semibold text-sm whitespace-nowrap">
                                {patient.name}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                {patient.age ? `${patient.age} tuổi` : "—"} {patient.gender ? `• ${patient.gender}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Chẩn đoán */}
                        <td className="p-md text-on-surface-variant">
                          <span
                            className="bg-tertiary-container/20 text-tertiary px-sm py-xs rounded-full font-caption text-caption border border-tertiary-container/30 text-xs font-medium inline-block max-w-[180px] truncate"
                            title={patient.condition}
                          >
                            {shortCondition(patient.condition, 2)}
                          </span>
                        </td>

                        {/* Muối (Gọn) */}
                        <td className="px-sm py-md text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                            <span className="material-symbols-outlined text-[13px] text-amber-600">water_drop</span>
                            &le; {c.salt}g
                          </span>
                        </td>

                        {/* Đường (Gọn) */}
                        <td className="px-sm py-md text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200">
                            <span className="material-symbols-outlined text-[13px] text-sky-600">spa</span>
                            &le; {c.sugar}g
                          </span>
                        </td>

                        {/* Đạm (Gọn) */}
                        <td className="px-sm py-md text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                            <span className="material-symbols-outlined text-[13px] text-emerald-600">fitness_center</span>
                            {c.protein}g
                          </span>
                        </td>

                        {/* Ghi chú (Mở rộng thoải mái, nhiều dòng) */}
                        <td className="p-md text-on-surface-variant min-w-[200px] max-w-[320px]">
                          <p
                            className="text-xs italic text-on-surface-variant line-clamp-3 leading-relaxed whitespace-normal break-words"
                            title={c.notes || "Không có ghi chú"}
                          >
                            {c.notes || "—"}
                          </p>
                        </td>

                        {/* Thao tác */}
                        <td className="p-md text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-xs">
                            {/* Nút Xem chi tiết (Mở Dialog) */}
                            <button
                              type="button"
                              onClick={() => setViewingPatient(patient)}
                              title="Xem chi tiết ràng buộc lâm sàng"
                              className="inline-flex items-center gap-1.5 px-md py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface hover:border-primary hover:text-primary font-body-bold text-xs rounded-lg hover:bg-surface-container-low transition-all cursor-pointer active:scale-95 shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              <span>Xem chi tiết</span>
                            </button>

                            {/* Nút Điều chỉnh */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(patient)}
                              title="Điều chỉnh ràng buộc dinh dưỡng"
                              className="inline-flex items-center gap-1.5 px-md py-1.5 bg-primary text-on-primary font-body-bold text-xs rounded-lg hover:bg-primary-container transition-all cursor-pointer active:scale-95 shadow-xs font-semibold"
                            >
                              <span className="material-symbols-outlined text-[16px]">tune</span>
                              <span>Điều chỉnh</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safePage}
              totalItems={filteredPatients.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </main>

      {/* ADJUST CONSTRAINTS MODAL */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-md animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">tune</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Điều chỉnh ràng buộc lâm sàng
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs">
                    {editingPatient.name} ({editingPatient.id}) • {editingPatient.age ? `${editingPatient.age} tuổi` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseEdit}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Diagnosis Banner */}
            <div className="mb-md p-sm bg-surface-container-low rounded-xl border border-outline-variant/60 flex items-start gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">
                medical_information
              </span>
              <div>
                <span className="font-semibold text-on-surface">Chẩn đoán y khoa: </span>
                <span>{editingPatient.condition || "Chưa có chẩn đoán chi tiết"}</span>
              </div>
            </div>

            {/* Form Sliders */}
            <div className="flex-1 overflow-y-auto space-y-md pr-xs py-xs">
              {/* Muối */}
              <div className="p-3 bg-surface-container-lowest border border-outline-variant/80 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="font-label text-xs font-semibold text-on-surface block">
                      Giới hạn Muối (Natri)
                    </label>
                    <span className="text-[11px] text-on-surface-variant">Khuyến nghị &le; 5.0g/ngày (DASH &le; 3.0g)</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-1 rounded-md">
                    <span>{editingForm.salt}</span>
                    <span className="text-[10px] font-normal">g/ngày</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={editingForm.salt}
                  onChange={(e) =>
                    setEditingForm((prev) => ({ ...prev, salt: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Đường */}
              <div className="p-3 bg-surface-container-lowest border border-outline-variant/80 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="font-label text-xs font-semibold text-on-surface block">
                      Giới hạn Đường tự do
                    </label>
                    <span className="text-[11px] text-on-surface-variant">Khuyến nghị &le; 25g/ngày cho kiểm soát đường huyết</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold bg-sky-50 text-sky-900 border border-sky-200 px-2 py-1 rounded-md">
                    <span>{editingForm.sugar}</span>
                    <span className="text-[10px] font-normal">g/ngày</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={editingForm.sugar}
                  onChange={(e) =>
                    setEditingForm((prev) => ({ ...prev, sugar: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Đạm */}
              <div className="p-3 bg-surface-container-lowest border border-outline-variant/80 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="font-label text-xs font-semibold text-on-surface block">
                      Chỉ tiêu Đạm (Protein)
                    </label>
                    <span className="text-[11px] text-on-surface-variant">Điều chỉnh theo mức độ suy thận hoặc phục hồi thể trạng</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-1 rounded-md">
                    <span>{editingForm.protein}</span>
                    <span className="text-[10px] font-normal">g/ngày</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={editingForm.protein}
                  onChange={(e) =>
                    setEditingForm((prev) => ({ ...prev, protein: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Ghi chú */}
              <div>
                <label className="font-label text-xs font-semibold text-on-surface block mb-1">
                  Ghi chú lâm sàng & Dị ứng / Lưu ý đặc biệt
                </label>
                <textarea
                  value={editingForm.notes}
                  onChange={(e) =>
                    setEditingForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                  placeholder="Nhập ghi chú về thực phẩm dị ứng, kiêng cữ bệnh lý, phác đồ điều trị..."
                  className="w-full p-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl font-body text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-md border-t border-outline-variant mt-md flex justify-end gap-sm">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="px-md py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-md py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container transition-all shadow-xs active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL CONSTRAINTS MODAL */}
      {viewingPatient && (() => {
        const c = getPatientConstraint(viewingPatient);
        return (
          <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-md animate-fadeIn">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md shrink-0">
                <div className="flex items-center gap-sm">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[22px]">visibility</span>
                  </div>
                  <div>
                    <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                      Chi tiết ràng buộc lâm sàng
                    </h3>
                    <p className="font-caption text-caption text-on-surface-variant text-xs">
                      {viewingPatient.name} ({truncateId(viewingPatient.id)}) • {viewingPatient.age ? `${viewingPatient.age} tuổi` : "—"} {viewingPatient.gender ? `• ${viewingPatient.gender}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingPatient(null)}
                  className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto space-y-md pr-xs py-xs">
                {/* Diagnosis Banner */}
                <div className="p-sm bg-surface-container-low rounded-xl border border-outline-variant/60 flex items-start gap-2 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">
                    medical_information
                  </span>
                  <div>
                    <span className="font-semibold text-on-surface">Chẩn đoán y khoa: </span>
                    <span>{viewingPatient.condition || "Chưa có chẩn đoán chi tiết"}</span>
                  </div>
                </div>

                {/* 3 Nutrient Metric Cards */}
                <div className="grid grid-cols-3 gap-sm">
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-900 text-xs font-semibold mb-1">
                      <span className="material-symbols-outlined text-[16px] text-amber-700">water_drop</span>
                      <span>Muối (Natri)</span>
                    </div>
                    <p className="text-base font-bold text-amber-950">&le; {c.salt}g</p>
                    <span className="text-[10px] text-amber-800">mỗi ngày</span>
                  </div>

                  <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 text-sky-900 text-xs font-semibold mb-1">
                      <span className="material-symbols-outlined text-[16px] text-sky-700">spa</span>
                      <span>Đường tự do</span>
                    </div>
                    <p className="text-base font-bold text-sky-950">&le; {c.sugar}g</p>
                    <span className="text-[10px] text-sky-800">mỗi ngày</span>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 text-emerald-900 text-xs font-semibold mb-1">
                      <span className="material-symbols-outlined text-[16px] text-emerald-700">fitness_center</span>
                      <span>Chỉ tiêu Đạm</span>
                    </div>
                    <p className="text-base font-bold text-emerald-950">{c.protein}g</p>
                    <span className="text-[10px] text-emerald-800">mỗi ngày</span>
                  </div>
                </div>

                {/* Clinical Notes Card */}
                <div className="p-md bg-surface-container-lowest border border-outline-variant/80 rounded-xl">
                  <h4 className="font-body-bold text-xs font-semibold text-on-surface mb-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">clinical_notes</span>
                    Ghi chú lâm sàng &amp; Dị ứng:
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line">
                    {c.notes || "Chưa có ghi chú đặc biệt cho bệnh nhân này."}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-md border-t border-outline-variant mt-md flex justify-between items-center shrink-0">
                <Link
                  href={`/doctor/patients/${encodeURIComponent(viewingPatient.id)}`}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Đến hồ sơ bệnh nhân đầy đủ</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>

                <div className="flex items-center gap-sm">
                  <button
                    type="button"
                    onClick={() => setViewingPatient(null)}
                    className="px-md py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingPatient;
                      setViewingPatient(null);
                      handleOpenEdit(target);
                    }}
                    className="px-md py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container transition-all shadow-xs active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span>Điều chỉnh</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

