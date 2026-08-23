"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import Pagination, { getPageItems } from "@/components/shared/Pagination";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { shortCondition } from "@/lib/format";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";

interface PatientConstraints {
  salt: number; // g/day
  sugar: number; // g/day
  targetKcal: number; // kcal/day
  notes: string;
}

const PAGE_SIZE = 10;
const MAX_LIST_ITEMS = 3;

/** Local-only clinical notes (no backend field). */
const INITIAL_NOTES: Record<string, string> = {
  "BN-10293":
    "Hạn chế hải sản, giảm muối nghiêm ngặt cho suy thận độ 3. Theo dõi sát chỉ số đường huyết sau bữa trưa.",
  "BN-10294": "Ưu tiên đạm thực vật. Giảm chất béo bão hòa.",
  "BN-10295":
    "Kiêng tuyệt đối nội tạng động vật và hải sản có hàm lượng purin cao.",
  "BN-10296": "Giảm muối vừa phải, tăng cường rau xanh giàu kali.",
  "BN-10297":
    "Kiểm soát đường huyết nghiêm ngặt, chia nhỏ các bữa ăn trong ngày.",
};

function getDefaultConstraints(patient?: Patient): Omit<PatientConstraints, "notes"> {
  const condition = (patient?.condition || "").toLowerCase();
  let salt = 5.0;
  let sugar = 25;
  let targetKcal = patient?.targetKcal ?? 1800;

  if (condition.includes("thận") || condition.includes("ckd")) {
    salt = 3.5;
    sugar = 20;
    targetKcal = patient?.targetKcal ?? 1800;
  } else if (condition.includes("tiểu đường") || condition.includes("đường huyết")) {
    salt = 4.5;
    sugar = 15;
    targetKcal = patient?.targetKcal ?? 1600;
  } else if (condition.includes("huyết áp") || condition.includes("tim")) {
    salt = 3.0;
    sugar = 20;
    targetKcal = patient?.targetKcal ?? 1700;
  }

  return { salt, sugar, targetKcal };
}

function getDefaultNotes(patient?: Patient): string {
  const condition = (patient?.condition || "").toLowerCase();
  if (condition.includes("thận") || condition.includes("ckd")) {
    return "Kiểm soát đạm và muối nghiêm ngặt theo phác đồ suy thận.";
  }
  if (condition.includes("tiểu đường") || condition.includes("đường huyết")) {
    return "Hạn chế đường tự do < 15g/ngày, bổ sung chất xơ hòa tan.";
  }
  if (condition.includes("huyết áp") || condition.includes("tim")) {
    return "Áp dụng chế độ ăn giảm muối DASH, tăng kali tự nhiên.";
  }
  return "Chế độ ăn cân bằng dinh dưỡng, theo dõi định kỳ.";
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

function bmiCategoryOf(bmi: number | null | undefined): string {
  if (bmi == null) return "—";
  if (bmi < 18.5) return "Thiếu cân";
  if (bmi < 23) return "Bình thường";
  if (bmi < 25) return "Thừa cân nhẹ";
  return "Béo phì";
}

function resolveAvatarSrc(avatar?: string | null): string {
  if (!avatar || avatar.startsWith("https://api.dicebear.com")) return "";
  return assetUrl(avatar) || avatar;
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

  const [notesMap, setNotesMap] = useState<Record<string, string>>(INITIAL_NOTES);

  // Detail Modal State
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [viewingDetail, setViewingDetail] = useState<DoctorPatientSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showAllMeds, setShowAllMeds] = useState(false);
  const [showAllAllergies, setShowAllAllergies] = useState(false);

  // Editing Modal State
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editingForm, setEditingForm] = useState<PatientConstraints>({
    salt: 4.5,
    sugar: 20,
    targetKcal: 1800,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [approveBusy, setApproveBusy] = useState(false);

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
      setPatients(rows.map(toUiPatient));
    } catch (err) {
      setPatients([]);
      if (err instanceof ApiError && err.status !== 401) {
        setLoadError(err.message);
      } else if (!(err instanceof ApiError)) {
        setLoadError("Không tải được danh sách bệnh nhân. Kiểm tra backend.");
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
      const defaults = getDefaultConstraints(patient);
      return {
        salt: patient.saltDailyG ?? defaults.salt,
        sugar: patient.sugarDailyG ?? defaults.sugar,
        targetKcal: patient.targetKcal ?? defaults.targetKcal,
        notes: notesMap[patient.id] ?? getDefaultNotes(patient),
      };
    },
    [notesMap]
  );

  const handleOpenDetail = useCallback((patient: Patient) => {
    setViewingPatient(patient);
    setViewingDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setShowAllMeds(false);
    setShowAllAllergies(false);

    void api
      .getDoctorPatient(patient.id)
      .then((detail) => {
        setViewingDetail(detail);
      })
      .catch((err) => {
        setDetailError(
          err instanceof ApiError
            ? err.message
            : "Không tải được hồ sơ chi tiết. Hiển thị dữ liệu tóm tắt."
        );
      })
      .finally(() => {
        setDetailLoading(false);
      });
  }, []);

  const handleApproveConstraints = async (patientId: string) => {
    if (approveBusy) return;
    setApproveBusy(true);
    try {
      await api.approveDoctorConstraints(patientId);
      showToast("Đã xác nhận ràng buộc lâm sàng.");
      await loadPatients();
      const detail = await api.getDoctorPatient(patientId);
      setViewingDetail(detail);
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patientId ? { ...p, constraintsStatus: "confirmed" } : p
        )
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Không xác nhận được ràng buộc."
      );
    } finally {
      setApproveBusy(false);
    }
  };

  const handleCloseDetail = () => {
    setViewingPatient(null);
    setViewingDetail(null);
    setDetailError(null);
    setDetailLoading(false);
    setShowAllMeds(false);
    setShowAllAllergies(false);
  };

  const handleOpenEdit = (patient: Patient) => {
    const current = getPatientConstraint(patient);
    setEditingPatient(patient);
    setEditingForm({ ...current });
    setSaveError(null);
  };

  const handleCloseEdit = () => {
    setEditingPatient(null);
    setSaveError(null);
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editingPatient || saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      const updated = await api.updateDoctorConstraints(editingPatient.id, {
        target_kcal: editingForm.targetKcal,
        salt_daily_g: editingForm.salt,
        sugar_daily_g: editingForm.sugar,
      });

      const uiPatient = toUiPatient(updated);
      setPatients((prev) =>
        prev.map((p) => (p.id === editingPatient.id ? { ...p, ...uiPatient } : p))
      );

      setNotesMap((prev) => ({
        ...prev,
        [editingPatient.id]: editingForm.notes,
      }));

      showToast(`Đã lưu ràng buộc lâm sàng cho ${editingPatient.name} thành công!`);
      setEditingPatient(null);
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? err.message
          : "Không thể lưu ràng buộc. Vui lòng thử lại."
      );
    } finally {
      setSaving(false);
    }
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

      {toastMessage && (
        <div className="fixed top-20 right-6 z-[60] bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm animate-slide-down">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {loadError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center justify-between shadow-2xs">
            <span>{loadError}</span>
            <button
              onClick={() => void loadPatients()}
              className="text-primary font-bold hover:underline cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold text-2xl">
              Thiết lập ràng buộc lâm sàng
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-1 text-xs">
              Quản lý và điều chỉnh các giới hạn vi chất dinh dưỡng (Calo, Muối, Đường) y khoa cho từng bệnh nhân
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm mã BN, tên bệnh nhân, bệnh lý..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs"
              />
            </div>

            <div className="relative min-w-[180px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                filter_alt
              </span>
              <select
                value={diagnosisFilter}
                onChange={(e) => setDiagnosisFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer shadow-2xs font-medium"
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

        {filteredPatients.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-12 text-center text-on-surface-variant shadow-subtle">
            <span className="material-symbols-outlined text-[48px] text-outline/40 mb-2">
              rule
            </span>
            <p className="font-body-bold text-body-bold text-sm font-bold">
              Không tìm thấy bệnh nhân phù hợp
            </p>
            <p className="font-caption text-caption text-xs mt-1">
              Thử thay đổi từ khóa tìm kiếm hoặc chọn lại nhóm bệnh lý.
            </p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[980px]">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-outline-variant/40">
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                      Mã BN
                    </th>
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                      Bệnh nhân
                    </th>
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                      Chẩn đoán bệnh lý
                    </th>
                    <th className="px-3 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold text-center whitespace-nowrap">
                      Calo/ngày
                    </th>
                    <th className="px-3 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold text-center whitespace-nowrap">
                      Muối (Na)
                    </th>
                    <th className="px-3 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold text-center whitespace-nowrap">
                      Đường
                    </th>
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold min-w-[200px] max-w-[320px]">
                      Ghi chú lâm sàng
                    </th>
                    <th className="px-5 py-3.5 font-label text-label text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30 font-body text-body">
                  {pagedPatients.map((patient) => {
                    const c = getPatientConstraint(patient);
                    return (
                      <tr
                        key={patient.id}
                        className="transition-colors hover:bg-surface-container-low/40"
                      >
                        <td className="px-5 py-3.5">
                          <span
                            title={patient.id}
                            className="font-mono text-xs font-semibold text-on-surface-variant"
                          >
                            {truncateId(patient.id)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-label text-xs font-bold ring-2 ring-primary/20 shrink-0">
                              {initials(patient.name)}
                              {patient.avatar &&
                                !patient.avatar.startsWith("https://api.dicebear.com") && (
                                  <img
                                    src={patient.avatar}
                                    alt={patient.name}
                                    className="absolute inset-0 w-9 h-9 rounded-full object-cover ring-2 ring-outline-variant/40"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-body-bold text-on-surface font-bold text-sm whitespace-nowrap">
                                {patient.name}
                              </p>
                              {patient.constraintsStatus === "pending_doctor_review" && (
                                <span className="inline-flex mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Chờ xác nhận
                                </span>
                              )}
                              <p className="text-xs text-on-surface-variant">
                                {patient.age ? `${patient.age} tuổi` : "—"}{" "}
                                {patient.gender ? `• ${patient.gender}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-on-surface-variant">
                          <span
                            className="bg-primary/10 text-primary px-3 py-1 rounded-full font-caption text-xs font-semibold border border-primary/20 inline-block max-w-[180px] truncate"
                            title={patient.condition}
                          >
                            {shortCondition(patient.condition, 2)}
                          </span>
                        </td>

                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-900 border border-violet-200 tabular-nums">
                            <span className="material-symbols-outlined text-[14px] text-violet-600">
                              local_fire_department
                            </span>
                            {c.targetKcal}
                          </span>
                        </td>

                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 tabular-nums">
                            <span className="material-symbols-outlined text-[14px] text-amber-600">
                              water_drop
                            </span>
                            &le; {c.salt}g
                          </span>
                        </td>

                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-900 border border-sky-200 tabular-nums">
                            <span className="material-symbols-outlined text-[14px] text-sky-600">
                              spa
                            </span>
                            &le; {c.sugar}g
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-on-surface-variant min-w-[200px] max-w-[320px]">
                          <p
                            className="text-xs italic text-on-surface-variant line-clamp-2 leading-relaxed whitespace-normal break-words font-medium"
                            title={c.notes || "Không có ghi chú"}
                          >
                            {c.notes || "—"}
                          </p>
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(patient)}
                              title="Xem chi tiết ràng buộc lâm sàng"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant hover:border-primary text-on-surface hover:text-primary font-body-bold text-xs rounded-xl hover:bg-surface-container-low transition-all cursor-pointer active:scale-95 shadow-2xs font-semibold"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              <span>Chi tiết</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(patient)}
                              title="Điều chỉnh ràng buộc dinh dưỡng"
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-primary text-on-primary font-body-bold text-xs rounded-xl hover:bg-primary/90 transition-all cursor-pointer active:scale-95 shadow-2xs font-bold"
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl p-6 md:p-8 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col animate-scaleUp overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">tune</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Điều chỉnh ràng buộc lâm sàng
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                    {editingPatient.name} ({editingPatient.id}) •{" "}
                    {editingPatient.age ? `${editingPatient.age} tuổi` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseEdit}
                disabled={saving}
                className="text-on-surface-variant hover:text-primary p-1.5 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="mb-4 p-3 bg-surface-container-low/60 rounded-2xl border border-outline-variant/60 flex items-start gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">
                medical_information
              </span>
              <div>
                <span className="font-bold text-on-surface">Chẩn đoán y khoa: </span>
                <span>{editingPatient.condition || "Chưa có chẩn đoán chi tiết"}</span>
              </div>
            </div>

            <p className="mb-4 text-[11px] text-on-surface-variant italic px-1">
              Áp dụng ngay cho lần tạo thực đơn AI kế tiếp — thực đơn đã tạo trước đó không tự tính lại.
            </p>

            {saveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                <span>{saveError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Calo */}
              <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl space-y-2 shadow-2xs">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="font-label text-xs font-bold text-on-surface block">
                      Mục tiêu Calo (năng lượng)
                    </label>
                    <span className="text-[11px] text-on-surface-variant">
                      Khuyến nghị 1500–2000 kcal/ngày tùy BMI &amp; mục tiêu điều trị
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold bg-violet-50 text-violet-900 border border-violet-200 px-2.5 py-1 rounded-full">
                    <span>{editingForm.targetKcal}</span>
                    <span className="text-[10px] font-normal">kcal/ngày</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="800"
                  max="2500"
                  step="50"
                  value={editingForm.targetKcal}
                  disabled={saving}
                  onChange={(e) =>
                    setEditingForm((prev) => ({
                      ...prev,
                      targetKcal: parseInt(e.target.value, 10) || 1800,
                    }))
                  }
                  className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary disabled:opacity-50"
                />
              </div>

              {/* Muối */}
              <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl space-y-2 shadow-2xs">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="font-label text-xs font-bold text-on-surface block">
                      Giới hạn Muối (Natri)
                    </label>
                    <span className="text-[11px] text-on-surface-variant">
                      Khuyến nghị &le; 5.0g/ngày (DASH &le; 3.0g)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-full">
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
                  disabled={saving}
                  onChange={(e) =>
                    setEditingForm((prev) => ({
                      ...prev,
                      salt: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary disabled:opacity-50"
                />
              </div>

              {/* Đường */}
              <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl space-y-2 shadow-2xs">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="font-label text-xs font-bold text-on-surface block">
                      Giới hạn Đường tự do
                    </label>
                    <span className="text-[11px] text-on-surface-variant">
                      Khuyến nghị &le; 25g/ngày cho kiểm soát đường huyết
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold bg-sky-50 text-sky-900 border border-sky-200 px-2.5 py-1 rounded-full">
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
                  disabled={saving}
                  onChange={(e) =>
                    setEditingForm((prev) => ({
                      ...prev,
                      sugar: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary disabled:opacity-50"
                />
              </div>

              {/* Ghi chú */}
              <div>
                <label className="font-label text-xs font-bold text-on-surface block mb-1">
                  Ghi chú lâm sàng & Dị ứng / Lưu ý đặc biệt
                </label>
                <span className="text-[10px] text-on-surface-variant italic block mb-1">
                  Chỉ lưu cục bộ trên trình duyệt — không ảnh hưởng AI gen thực đơn.
                </span>
                <textarea
                  value={editingForm.notes}
                  disabled={saving}
                  onChange={(e) =>
                    setEditingForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                  placeholder="Nhập ghi chú về thực phẩm dị ứng, kiêng cữ bệnh lý, phác đồ điều trị..."
                  className="w-full p-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl font-body text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/40 mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={saving}
                className="px-4 py-2 border border-outline-variant/60 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={saving}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    <span>Đang lưu…</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>Lưu thay đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL CONSTRAINTS MODAL */}
      {viewingPatient &&
        (() => {
          const c = getPatientConstraint(viewingPatient);
          const detail = viewingDetail;
          const diagnoses = detail?.condition_label
            ? detail.condition_label.split(", ").filter(Boolean)
            : viewingPatient.condition
              ? viewingPatient.condition.split(", ").filter(Boolean)
              : [];
          const medications = detail?.medications ?? [];
          const allergies = detail?.allergies ?? [];
          const goals = detail?.treatment_goals ?? [];
          const preferences = detail?.preferences ?? [];
          const avatarSrc = resolveAvatarSrc(detail?.avatar ?? viewingPatient.avatar);
          const displayName = detail?.name ?? viewingPatient.name;
          const displayAge = detail?.age ?? viewingPatient.age;
          const displayGender = detail?.gender ?? viewingPatient.gender;
          const displayPhone = detail?.phone ?? viewingPatient.phone;
          const displayEmail = detail?.email ?? viewingPatient.email;
          const displayAddress = detail?.address ?? viewingPatient.address;
          const displayWeight = detail?.weight ?? viewingPatient.weight;
          const displayHeight = detail?.height ?? viewingPatient.height;
          const displayBmi = detail?.bmi ?? viewingPatient.bmi;
          const displayBp = detail?.blood_pressure ?? viewingPatient.bloodPressure;
          const displayGlucose = detail?.blood_glucose ?? viewingPatient.bloodSugar;
          const displayTargetKcal =
            detail?.target_kcal ?? viewingPatient.targetKcal ?? c.targetKcal;
          const displaySalt = detail?.salt_daily_g ?? viewingPatient.saltDailyG ?? c.salt;
          const displaySugar = detail?.sugar_daily_g ?? viewingPatient.sugarDailyG ?? c.sugar;

          return (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl p-6 md:p-8 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-scaleUp overflow-hidden">
                <div className="flex items-start justify-between pb-4 border-b border-outline-variant/40 mb-4 shrink-0 gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="relative w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-label text-lg font-bold ring-2 ring-primary/20 shrink-0">
                      {initials(displayName)}
                      {avatarSrc && (
                        <img
                          src={avatarSrc}
                          alt={displayName}
                          className="absolute inset-0 w-14 h-14 rounded-full object-cover ring-2 ring-outline-variant/40"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-h2 text-h2 text-on-surface font-bold text-lg">
                        {displayName}
                      </h3>
                      <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                        {displayAge ? `${displayAge} tuổi` : "—"} • {displayGender || "—"} •{" "}
                        {truncateId(viewingPatient.id)}
                      </p>
                      {diagnoses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {diagnoses.map((diag, index) => (
                            <span
                              key={index}
                              className="bg-primary/10 text-primary px-3 py-0.5 rounded-full font-caption text-caption border border-primary/20 text-xs font-semibold"
                            >
                              {diag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(detail?.constraints_status ?? viewingPatient.constraintsStatus) ===
                      "pending_doctor_review" && (
                      <button
                        type="button"
                        disabled={approveBusy}
                        onClick={() => void handleApproveConstraints(viewingPatient.id)}
                        className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 disabled:opacity-60 shadow-2xs"
                      >
                        {approveBusy ? "Đang xác nhận…" : "Xác nhận"}
                      </button>
                    )}
                    <button
                    onClick={handleCloseDetail}
                    className="text-on-surface-variant hover:text-primary p-1.5 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {detailLoading && (
                    <div className="flex items-center gap-2 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/60 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px] animate-spin text-primary">
                        progress_activity
                      </span>
                      <span>Đang tải hồ sơ bệnh nhân…</span>
                    </div>
                  )}

                  {detailError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                        info
                      </span>
                      <span>{detailError}</span>
                    </div>
                  )}

                  <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-2xs">
                    <h4 className="font-body-bold text-xs font-bold text-on-surface mb-3 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
                      Thông tin liên hệ
                    </h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-on-surface-variant">
                      <li className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-outline text-[16px] shrink-0">
                          phone
                        </span>
                        <span className="truncate">{displayPhone || "—"}</span>
                      </li>
                      <li className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-outline text-[16px] shrink-0">
                          mail
                        </span>
                        <span className="truncate">{displayEmail || "—"}</span>
                      </li>
                      <li className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-outline text-[16px] shrink-0">
                          home
                        </span>
                        <span className="truncate">{displayAddress || "—"}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-2xs">
                    <h4 className="font-body-bold text-xs font-bold text-on-surface mb-3 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        monitor_heart
                      </span>
                      Chỉ số cơ thể
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="p-3 bg-surface-container-low/40 border border-outline-variant/40 rounded-xl text-center">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          Cân nặng
                        </p>
                        <p className="text-sm font-bold text-on-surface mt-0.5 tabular-nums">
                          {displayWeight ? `${displayWeight} kg` : "—"}
                        </p>
                      </div>
                      <div className="p-3 bg-surface-container-low/40 border border-outline-variant/40 rounded-xl text-center">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          Chiều cao
                        </p>
                        <p className="text-sm font-bold text-on-surface mt-0.5 tabular-nums">
                          {displayHeight ? `${displayHeight} cm` : "—"}
                        </p>
                      </div>
                      <div className="p-3 bg-surface-container-low/40 border border-outline-variant/40 rounded-xl text-center">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          BMI
                        </p>
                        <p className="text-sm font-bold text-primary mt-0.5 tabular-nums">
                          {displayBmi != null ? displayBmi.toFixed(1) : "—"}
                        </p>
                        <p className="text-[10px] text-on-surface-variant font-medium">
                          {bmiCategoryOf(displayBmi)}
                        </p>
                      </div>
                      <div className="p-3 bg-surface-container-low/40 border border-outline-variant/40 rounded-xl text-center">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          Huyết áp
                        </p>
                        <p className="text-sm font-bold text-on-surface mt-0.5 tabular-nums">
                          {displayBp || "—"}
                        </p>
                      </div>
                      <div className="p-3 bg-surface-container-low/40 border border-outline-variant/40 rounded-xl text-center">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          Đường huyết
                        </p>
                        <p className="text-sm font-bold text-on-surface mt-0.5 tabular-nums">
                          {displayGlucose || "—"}
                        </p>
                      </div>
                      <div className="p-3 bg-surface-container-low/40 border border-outline-variant/40 rounded-xl text-center">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          Mục tiêu kcal
                        </p>
                        <p className="text-sm font-bold text-on-surface mt-0.5 tabular-nums">
                          {displayTargetKcal ? `${displayTargetKcal} kcal` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-2xs">
                      <h4 className="font-body-bold text-xs font-bold text-on-surface mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          medication
                        </span>
                        Thuốc đang dùng
                      </h4>
                      {medications.length === 0 ? (
                        <p className="text-xs text-on-surface-variant italic">Chưa khai báo thuốc.</p>
                      ) : (
                        <>
                          <ul className="space-y-sm">
                            {(showAllMeds ? medications : medications.slice(0, MAX_LIST_ITEMS)).map(
                              (med, idx) => (
                                <li key={idx} className="flex items-start gap-xs text-xs">
                                  <span className="material-symbols-outlined text-primary text-[16px] mt-0.5 shrink-0">
                                    pill
                                  </span>
                                  <span className="font-semibold text-on-surface">{med}</span>
                                </li>
                              )
                            )}
                          </ul>
                          {medications.length > MAX_LIST_ITEMS && (
                            <button
                              type="button"
                              onClick={() => setShowAllMeds((v) => !v)}
                              className="mt-sm text-primary hover:underline text-xs font-semibold flex items-center gap-xs cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {showAllMeds ? "expand_less" : "expand_more"}
                              </span>
                              {showAllMeds
                                ? "Thu gọn"
                                : `Xem thêm ${medications.length - MAX_LIST_ITEMS} thuốc`}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    <div className="p-md bg-surface rounded-xl border border-outline-variant">
                      <h4 className="font-body-bold text-xs font-semibold text-on-surface mb-sm flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-error">warning</span>
                        Dị ứng &amp; Phản ứng phụ
                      </h4>
                      {allergies.length === 0 ? (
                        <p className="text-xs text-on-surface-variant italic">Không khai báo dị ứng.</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-xs">
                            {(showAllAllergies ? allergies : allergies.slice(0, MAX_LIST_ITEMS)).map(
                              (item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block bg-error-container/50 text-error px-sm py-xs rounded-full font-body-bold border border-error/20 text-xs font-semibold"
                                >
                                  {item}
                                </span>
                              )
                            )}
                          </div>
                          {allergies.length > MAX_LIST_ITEMS && (
                            <button
                              type="button"
                              onClick={() => setShowAllAllergies((v) => !v)}
                              className="mt-sm text-primary hover:underline text-xs font-semibold flex items-center gap-xs cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {showAllAllergies ? "expand_less" : "expand_more"}
                              </span>
                              {showAllAllergies
                                ? "Thu gọn"
                                : `Xem thêm ${allergies.length - MAX_LIST_ITEMS} dị ứng`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-md bg-surface rounded-xl border border-outline-variant">
                    <h4 className="font-body-bold text-xs font-semibold text-on-surface mb-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">flag</span>
                      Mục tiêu điều trị &amp; Dinh dưỡng
                    </h4>
                    {goals.length === 0 && preferences.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">
                        Chưa có mục tiêu hoặc sở thích.
                      </p>
                    ) : (
                      <div className="space-y-sm">
                        {goals.length > 0 && (
                          <ul className="space-y-xs">
                            {goals.map((goal, idx) => (
                              <li key={idx} className="flex items-start gap-xs text-xs text-on-surface">
                                <span className="material-symbols-outlined text-primary text-[14px] mt-0.5 shrink-0">
                                  check_circle
                                </span>
                                <span>{goal}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {preferences.length > 0 && (
                          <div
                            className={
                              goals.length > 0 ? "pt-sm border-t border-outline-variant/40" : ""
                            }
                          >
                            <p className="font-label text-[10px] text-outline uppercase tracking-wider font-semibold mb-xs">
                              Sở thích ăn uống
                            </p>
                            <div className="flex flex-wrap gap-xs">
                              {preferences.map((pref, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block bg-primary-container/20 text-primary px-sm py-xs rounded-full border border-primary-container/30 text-xs font-medium"
                                >
                                  {pref}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant">
                    <h4 className="font-body-bold text-xs font-semibold text-on-surface mb-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">rule</span>
                      Ràng buộc lâm sàng (Calo · Muối · Đường)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm mb-sm">
                      <div className="p-3 bg-violet-50/70 border border-violet-200/80 rounded-xl text-center">
                        <div className="flex items-center justify-center gap-1 text-violet-900 text-xs font-semibold mb-1">
                          <span className="material-symbols-outlined text-[16px] text-violet-700">
                            local_fire_department
                          </span>
                          <span>Mục tiêu Calo</span>
                        </div>
                        <p className="text-base font-bold text-violet-950">{displayTargetKcal} kcal</p>
                        <span className="text-[10px] text-violet-800">mỗi ngày</span>
                      </div>

                      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-center">
                        <div className="flex items-center justify-center gap-1 text-amber-900 text-xs font-semibold mb-1">
                          <span className="material-symbols-outlined text-[16px] text-amber-700">
                            water_drop
                          </span>
                          <span>Muối (Natri)</span>
                        </div>
                        <p className="text-base font-bold text-amber-950">&le; {displaySalt}g</p>
                        <span className="text-[10px] text-amber-800">mỗi ngày</span>
                      </div>

                      <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl text-center">
                        <div className="flex items-center justify-center gap-1 text-sky-900 text-xs font-semibold mb-1">
                          <span className="material-symbols-outlined text-[16px] text-sky-700">spa</span>
                          <span>Đường tự do</span>
                        </div>
                        <p className="text-base font-bold text-sky-950">&le; {displaySugar}g</p>
                        <span className="text-[10px] text-sky-800">mỗi ngày</span>
                      </div>
                    </div>

                    <div className="p-sm bg-surface-container-lowest border border-outline-variant/80 rounded-xl">
                      <p className="font-label text-[10px] text-outline uppercase tracking-wider font-semibold mb-xs">
                        Ghi chú lâm sàng
                      </p>
                      <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line">
                        {c.notes || "Chưa có ghi chú đặc biệt cho bệnh nhân này."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-md border-t border-outline-variant mt-md flex flex-col sm:flex-row sm:justify-between sm:items-center gap-sm shrink-0">
                  <Link
                    href={`/doctor/patients/${encodeURIComponent(viewingPatient.id)}`}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Đến hồ sơ bệnh nhân đầy đủ</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>

                  <div className="flex items-center gap-sm justify-end">
                    <button
                      type="button"
                      onClick={handleCloseDetail}
                      className="px-md py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingPatient;
                        handleCloseDetail();
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
