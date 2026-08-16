"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { asRouteId } from "@/lib/route-params";
import { TopBar } from "@/components/shared/TopBar";
import { PatientMetricsCard } from "@/components/doctor/PatientMetricsCard";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { statusColorFor, type Patient } from "@/lib/mock-data";
import {
  ApiError,
  type CatalogItem,
  type CatalogOut,
  type DoctorPatientSummary,
  type DoctorPatientUpdate,
  type MealPlanOutput,
} from "@/lib/types";
import { useMealLogsStore } from "@/lib/meal-logs-store";
import { DEFAULT_PLAN_DAYS } from "@/lib/config";

const DISEASE_OPTIONS: { code: string; label: string }[] = [
  { code: "diabetes_t2", label: "Tiểu đường type 2" },
  { code: "hypertension", label: "Tăng huyết áp" },
  { code: "ckd", label: "Suy thận mạn" },
  { code: "gout", label: "Gout" },
  { code: "dyslipidemia", label: "Rối loạn lipid máu" },
  { code: "nafld", label: "Gan nhiễm mỡ" },
];

interface PatientDetailData extends Omit<Patient, "medications" | "allergies"> {
  patientCode: string;
  doctorInCharge: string;
  diagnoses: string[];
  vitals: {
    weight: number;
    height: number;
    bmi: number;
    bmiCategory: string;
    bloodGlucose: string;
    bloodPressure: string;
    updatedAt: string;
  };
  medications: {
    name: string;
    dosage: string;
  }[];
  allergies: {
    mild: string[];
    severe: string[];
  };
  treatmentGoals: string[];
  preferences: string[];
}

function truncateId(id: string): string {
  return id.length > 6 ? `...${id.slice(-4)}` : id;
}

/** Lấy chữ cái đầu của tên (vd "Nguyễn Văn A" → "NA") cho avatar dự phòng. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

function bmiCategoryOf(bmi: number | null | undefined): string {
  if (bmi == null) return "—";
  if (bmi < 18.5) return "Thiếu cân";
  if (bmi < 23) return "Bình thường";
  if (bmi < 25) return "Thừa cân nhẹ";
  return "Béo phì";
}

function buildDetail(summary: DoctorPatientSummary): PatientDetailData {
  return {
    id: summary.id,
    name: summary.name,
    age: summary.age ?? 0,
    gender: summary.gender ?? "—",
    condition: summary.condition_label,
    status: summary.status,
    statusColor: statusColorFor(summary.status),
    lastUpdate: summary.last_update,
    avatar: summary.avatar,
    email: summary.email,
    phone: summary.phone || undefined,
    address: summary.address || undefined,
    bmi: summary.bmi ?? undefined,
    statusKey: summary.status_key,
    latestPlanId: summary.latest_plan_id,
    latestPlanStatus: summary.latest_plan_status,
    alertCount: summary.alert_count,
    patientCode: truncateId(summary.id),
    doctorInCharge: "",
    diagnoses: summary.condition_label ? summary.condition_label.split(", ") : [],
    vitals: {
      weight: summary.weight ?? 0,
      height: summary.height ?? 0,
      bmi: summary.bmi ?? 0,
      bmiCategory: bmiCategoryOf(summary.bmi),
      bloodGlucose: summary.blood_glucose || "—",
      bloodPressure: summary.blood_pressure || "—",
      updatedAt: summary.last_update || "—",
    },
    medications: (summary.medications || []).map((name) => ({ name, dosage: "" })),
    allergies: { mild: [], severe: summary.allergies || [] },
    treatmentGoals: summary.treatment_goals || [],
    preferences: summary.preferences || [],
  };
}

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = asRouteId(params?.patientId);
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  const [summary, setSummary] = useState<DoctorPatientSummary | null>(null);
  const [plans, setPlans] = useState<MealPlanOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Treatment goals (persist qua API)
  const [goals, setGoals] = useState<string[]>([]);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [newGoalInput, setNewGoalInput] = useState("");
  const [savingGoals, setSavingGoals] = useState(false);

  // Edit hồ sơ chung (tên/avatar/liên hệ/chẩn đoán/thuốc/dị ứng)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogOut | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [medSearch, setMedSearch] = useState("");
  const [allergySearch, setAllergySearch] = useState("");
  const [diagnosisSearch, setDiagnosisSearch] = useState("");
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    avatarUrl: "",
    age: "",
    gender: "",
    phone: "",
    address: "",
    bloodPressure: "",
    bloodGlucose: "",
    disease: [] as string[],
    medications: [] as string[],
    allergies: [] as string[],
    preferencesText: "",
    goalsText: "",
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Hiển thị "Xem thêm" khi danh sách dài
  const [showAllMeds, setShowAllMeds] = useState(false);
  const [showAllAllergies, setShowAllAllergies] = useState(false);
  const MAX_LIST_ITEMS = 3;

  // Stores data for History tab summary (meal logs — demo store)
  const { getLogsByPatientId } = useMealLogsStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      setError("Thiếu mã bệnh nhân.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [patient, allPlans] = await Promise.all([
        api.getDoctorPatient(patientId),
        api.listDoctorMealPlans("all").catch(() => [] as MealPlanOutput[]),
      ]);
      setSummary(patient);
      setGoals(patient.treatment_goals || []);
      setPlans(allPlans.filter((p) => p.user_id === patientId));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Không tải được hồ sơ bệnh nhân. Kiểm tra backend."
      );
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (role !== "doctor") {
      router.replace("/patient");
      return;
    }
    if (!patientId) return;
    void loadData();
  }, [hydrated, token, role, router, loadData, patientId]);

  const patient = useMemo(
    () => (summary ? buildDetail(summary) : null),
    [summary]
  );

  const allLogs = getLogsByPatientId(patientId);
  const recentMealLogs = allLogs.slice(0, 4);
  const allPlans = plans;

  const recentPlans = useMemo(
    () =>
      plans.slice(0, 4).map((p) => ({
        id: p.id,
        planTitle: `Thực đơn ${p.days?.length ?? DEFAULT_PLAN_DAYS} ngày`,
        createdAt: formatDateTime(p.created_at),
        status:
          p.status === "approved"
            ? "approved"
            : p.status === "rejected"
              ? "rejected"
              : "pending",
      })),
    [plans]
  );

  const persistGoals = async (next: string[]): Promise<boolean> => {
    setSavingGoals(true);
    try {
      const out = await api.updatePatientGoals(patientId, next);
      setGoals(out.goals);
      return true;
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không lưu được mục tiêu điều trị."
      );
      return false;
    } finally {
      setSavingGoals(false);
    }
  };

  const handleAddGoal = async () => {
    const text = newGoalInput.trim();
    if (!text) return;
    setGoals((prev) => [...prev, text]);
    setNewGoalInput("");
    const ok = await persistGoals([...goals, text]);
    if (ok) showToast("Đã thêm mục tiêu điều trị");
  };

  const handleDeleteGoal = async (index: number) => {
    const next = goals.filter((_, i) => i !== index);
    setGoals(next);
    const ok = await persistGoals(next);
    if (ok) showToast("Đã xóa mục tiêu");
  };

  const openEditProfile = () => {
    if (!summary) return;
    setEditForm({
      fullName: summary.name || "",
      email: summary.email || "",
      avatarUrl: summary.avatar?.startsWith("https://api.dicebear.com")
        ? ""
        : summary.avatar || "",
      age: summary.age != null ? String(summary.age) : "",
      gender: summary.gender || "",
      phone: summary.phone || "",
      address: summary.address || "",
      bloodPressure: summary.blood_pressure || "",
      bloodGlucose: summary.blood_glucose || "",
      disease: [...(summary.disease || [])],
      medications: [...(summary.medications || [])],
      allergies: [...(summary.allergies || [])],
      preferencesText: (summary.preferences || []).join("\n"),
      goalsText: (summary.treatment_goals || []).join("\n"),
    });
    setEditError(null);
    setMedSearch("");
    setAllergySearch("");
    setDiagnosisSearch("");
    setIsEditProfileOpen(true);
  };

  useEffect(() => {
    if (!isEditProfileOpen) return;
    let cancelled = false;
    api
      .getCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch(() => {
        if (!cancelled) setCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditProfileOpen]);

  const toggleListItem = (
    key: "disease" | "medications" | "allergies",
    value: string
  ) => {
    setEditForm((f) => ({
      ...f,
      [key]: f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value],
    }));
  };

  /** Hiển thị tối đa 5 mục trong catalog theo từ khóa tìm kiếm. */
  const visibleCatalog = (
    items: CatalogItem[],
    query: string,
    selected: string[]
  ): CatalogItem[] => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? items.filter((i) => i.name.toLowerCase().includes(q))
      : items;
    return pool
      .filter((i) => !selected.includes(i.name))
      .slice(0, 5);
  };

  const visibleDiagnoses = (
    query: string
  ): { code: string; name: string }[] => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? diagnosisOptions.filter((d) => d.name.toLowerCase().includes(q))
      : diagnosisOptions;
    return pool
      .filter((d) => !editForm.disease.includes(d.code))
      .slice(0, 5);
  };

  const handleUploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setEditError("File phải là ảnh (png/jpg/webp/gif).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setEditError("Ảnh tối đa 2MB.");
      return;
    }
    setUploadingAvatar(true);
    setEditError(null);
    try {
      const out = await api.uploadPatientAvatar(patientId, file);
      setEditForm((f) => ({ ...f, avatarUrl: out.avatar }));
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : "Upload ảnh thất bại."
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const diagnosisOptions = useMemo(() => {
    const base: { code: string; name: string }[] = catalog
      ? catalog.diagnoses.map((d) => ({ code: d.code, name: d.name }))
      : DISEASE_OPTIONS.map((d) => ({ code: d.code, name: d.label }));
    const merged = [...base];
    for (const d of editForm.disease) {
      if (!merged.some((o) => o.code === d)) merged.push({ code: d, name: d });
    }
    return merged;
  }, [catalog, editForm.disease]);

  const chipClass = (active: boolean) =>
    `px-md py-xs rounded-full text-xs font-medium border transition-colors cursor-pointer ${active
      ? "bg-primary text-on-primary border-primary"
      : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary"
    }`;

  const handleSaveProfile = async () => {
    const email = editForm.email.trim();
    if (!email) {
      setEditError("Email không được để trống.");
      return;
    }
    const age =
      editForm.age.trim() === "" ? null : parseInt(editForm.age.trim(), 10);
    if (age != null && (Number.isNaN(age) || age < 0 || age > 130)) {
      setEditError("Tuổi phải nằm trong khoảng 0–130.");
      return;
    }
    const payload: DoctorPatientUpdate = {
      full_name: editForm.fullName.trim() || null,
      email,
      avatar: editForm.avatarUrl.trim() || null,
      age,
      gender: editForm.gender.trim() || null,
      phone: editForm.phone.trim() || null,
      address: editForm.address.trim() || null,
      blood_pressure: editForm.bloodPressure.trim() || null,
      blood_glucose: editForm.bloodGlucose.trim() || null,
      disease: editForm.disease,
      medications: editForm.medications,
      allergies: editForm.allergies,
      preferences: editForm.preferencesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      treatment_goals: editForm.goalsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    setSavingProfile(true);
    setEditError(null);
    try {
      const updated = await api.updateDoctorPatientProfile(patientId, payload);
      setSummary(updated);
      setGoals(updated.treatment_goals || []);
      setIsEditProfileOpen(false);
      showToast("Đã cập nhật hồ sơ bệnh nhân");
    } catch (err) {
      setEditError(
        err instanceof ApiError
          ? err.message
          : "Không lưu được hồ sơ. Kiểm tra backend."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  if (!hydrated || !token || role !== "doctor") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-on-surface-variant">
        Đang tải...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-on-surface-variant">
        Đang tải hồ sơ bệnh nhân...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-md p-lg text-center">
        <span className="material-symbols-outlined text-[48px] text-outline">
          search_off
        </span>
        <p className="font-body-bold text-body-bold text-on-surface">
          Không tải được hồ sơ bệnh nhân
        </p>
        <p className="font-caption text-caption text-on-surface-variant max-w-md text-xs">
          {error || "Không tìm thấy bệnh nhân hoặc backend đang tắt."}
        </p>
        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={() => void loadData()}
            className="px-md py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            Thử lại
          </button>
          <Link
            href="/doctor/patients"
            className="px-md py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold"
          >
            Về danh sách
          </Link>
        </div>
      </div>
    );
  }

  // Bỏ avatar seed từ dicebear (thường lỗi do offline); resolve path /static/ theo API_BASE
  const avatarSrc =
    patient.avatar && !patient.avatar.startsWith("https://api.dicebear.com")
      ? assetUrl(patient.avatar)
      : "";
  const previewAvatarUrl = editForm.avatarUrl.trim();
  const previewAvatarSrc =
    previewAvatarUrl &&
    !previewAvatarUrl.startsWith("https://api.dicebear.com")
      ? assetUrl(previewAvatarUrl)
      : "";

  return (
    <>
      <TopBar title="Chi tiết bệnh nhân" />
      <div className="flex flex-col min-h-[calc(100vh-64px)] bg-background font-body">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-lg py-sm rounded-lg shadow-lg flex items-center gap-sm animate-bounce">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="font-body-bold">{toastMessage}</span>
          </div>
        )}

        {/* Dynamic Sub-header / Navigation Header */}
        <header className="bg-surface border-b border-outline-variant px-lg py-md flex justify-between items-center sticky top-16 z-10 shadow-subtle">
          <div className="flex items-center gap-md">
            <Link
              href="/doctor/patients"
              className="flex items-center gap-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer active:scale-95"
              title="Quay lại danh sách"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              <span className="font-caption text-caption text-xs uppercase tracking-wider hidden sm:inline">
                Danh sách bệnh nhân
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-md">
            <button
              type="button"
              onClick={openEditProfile}
              className="bg-surface border border-outline-variant text-on-surface px-md py-sm rounded-lg font-body-bold text-body-bold hover:bg-surface-container-low transition-all shadow-sm flex items-center gap-xs cursor-pointer active:scale-95 text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Chỉnh sửa hồ sơ
            </button>
            <Link
              href={`/doctor/patients/${patientId}/generate`}
              className="bg-primary text-on-primary px-md py-sm rounded-lg font-body-bold text-body-bold hover:bg-primary-container transition-all shadow-sm flex items-center gap-xs cursor-pointer active:scale-95 text-sm font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Tạo thực đơn bằng AI
            </Link>
          </div>
        </header>

        {/* Main Container */}
        <main className="p-lg flex-1">
          <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row gap-section-gap">
            {/* Left Column: Patient Profile (30%) */}
            <div className="w-full md:w-[30%] flex flex-col gap-section-gap">
              {/* Profile Card */}
              <div className="bg-surface rounded-xl border border-outline-variant p-card-padding flex flex-col items-center text-center shadow-subtle hover:shadow-hover transition-shadow">
                <div className="relative mb-md">
                  <div className="w-24 h-24 rounded-full bg-primary/15 text-primary flex items-center justify-center font-label text-2xl font-semibold">
                    {initials(patient.name)}
                  </div>
                  {avatarSrc && (
                    <img
                      alt={`${patient.name} Avatar`}
                      className="absolute inset-0 w-24 h-24 rounded-full object-cover shadow-sm border-2 border-primary-fixed-dim"
                      src={avatarSrc}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>
                <h3 className="font-h2 text-h2 text-on-surface mb-xs font-bold text-lg">
                  {patient.name}
                </h3>
                <p className="font-body text-body text-on-surface-variant mb-md text-sm">
                  {patient.age > 0 ? `${patient.age} tuổi` : "—"} • {patient.gender} •{" "}
                  {patient.patientCode}
                </p>

                <div className="w-full text-left pt-sm border-t border-outline-variant">
                  <p className="font-label text-label text-outline mb-sm uppercase tracking-wider text-xs font-semibold">
                    Chẩn đoán hiện tại
                  </p>
                  <div className="flex flex-wrap gap-xs justify-start">
                    {patient.diagnoses.length === 0 ? (
                      <span className="text-xs text-on-surface-variant italic">
                        Chưa khai báo bệnh lý
                      </span>
                    ) : (
                      patient.diagnoses.map((diag, index) => (
                        <span
                          key={index}
                          className="bg-tertiary-container/20 text-tertiary px-sm py-xs rounded-full font-caption text-caption border border-tertiary-container/30 text-xs font-medium"
                        >
                          {diag}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Contact & Extra Info Card */}
              <div className="bg-surface rounded-xl border border-outline-variant p-card-padding shadow-subtle">
                <h4 className="font-body-bold text-body-bold text-on-surface mb-md pb-sm border-b border-outline-variant font-semibold flex items-center justify-between">
                  <span>Thông tin liên hệ</span>
                  <span className="material-symbols-outlined text-outline text-lg">
                    badge
                  </span>
                </h4>
                <ul className="space-y-md text-on-surface-variant font-body text-body text-sm">
                  <li className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-outline text-lg">
                      phone
                    </span>
                    <span>{patient.phone || "—"}</span>
                  </li>
                  <li className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-outline text-lg">
                      mail
                    </span>
                    <span className="truncate">{patient.email}</span>
                  </li>
                  <li className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-outline text-lg">
                      home
                    </span>
                    <span>{patient.address || "—"}</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Stacked Cards (70%) */}
            <div className="w-full md:w-[70%] flex flex-col gap-section-gap">
              {/* Card 1: Body Vitals (Chỉ số cơ thể) — inline edit qua API */}
              <PatientMetricsCard
                patientId={patientId}
                initialMetrics={{
                  weight: summary?.weight ?? null,
                  height: summary?.height ?? null,
                  bmi: summary?.bmi ?? null,
                  bmi_category: bmiCategoryOf(summary?.bmi),
                  updated_at: summary?.last_update || "—",
                }}
                bloodPressure={patient.vitals.bloodPressure}
                bloodGlucose={patient.vitals.bloodGlucose}
              />

              {/* Card 2: Medications & Allergies (Thuốc đang dùng & Dị ứng) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-section-gap">
                {/* Left Sub-card: Thuốc đang dùng */}
                <div className="bg-surface rounded-xl border border-outline-variant shadow-subtle flex flex-col">
                  <div className="p-card-padding border-b border-outline-variant bg-surface-container-lowest">
                    <h4 className="font-body-bold text-body-bold text-on-surface flex items-center gap-sm font-semibold text-base">
                      <span className="material-symbols-outlined text-primary">
                        medication
                      </span>
                      Thuốc đang dùng
                    </h4>
                  </div>
                  <div className="p-card-padding flex-1">
                    {patient.medications.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">
                        Chưa khai báo thuốc.
                      </p>
                    ) : (
                      <>
                        <ul className="space-y-md">
                          {(showAllMeds
                            ? patient.medications
                            : patient.medications.slice(0, MAX_LIST_ITEMS)
                          ).map((med, idx) => (
                            <li key={idx} className="flex items-start gap-sm">
                              <span className="material-symbols-outlined text-primary mt-xs">
                                pill
                              </span>
                              <div>
                                <p className="font-body-bold text-body-bold text-on-surface font-semibold text-sm">
                                  {med.name}
                                </p>
                                <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                                  {med.dosage || "—"}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {patient.medications.length > MAX_LIST_ITEMS && (
                          <button
                            type="button"
                            onClick={() => setShowAllMeds((v) => !v)}
                            className="mt-md text-primary hover:underline text-xs font-semibold flex items-center gap-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {showAllMeds ? "expand_less" : "expand_more"}
                            </span>
                            {showAllMeds
                              ? "Thu gọn"
                              : `Xem thêm ${patient.medications.length - MAX_LIST_ITEMS} thuốc`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Right Sub-card: Dị ứng */}
                <div className="bg-surface rounded-xl border border-outline-variant shadow-subtle flex flex-col">
                  <div className="p-card-padding border-b border-outline-variant bg-surface-container-lowest">
                    <h4 className="font-body-bold text-body-bold text-on-surface flex items-center gap-sm font-semibold text-base">
                      <span className="material-symbols-outlined text-error">
                        warning
                      </span>
                      Dị ứng & Phản ứng phụ
                    </h4>
                  </div>
                  <div className="p-card-padding flex-1 flex flex-col justify-between">
                    {patient.allergies.severe.length === 0 &&
                      patient.allergies.mild.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">
                        Không khai báo dị ứng.
                      </p>
                    ) : (
                      <>
                        <ul className="list-disc list-inside space-y-sm font-body text-body text-on-surface-variant text-sm mb-md">
                          {patient.allergies.mild.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                        <div className="pt-sm border-t border-outline-variant/40">
                          <p className="font-label text-label text-outline mb-xs text-xs uppercase tracking-wider font-semibold">
                            Nghiêm trọng:
                          </p>
                          <div className="flex flex-wrap gap-xs">
                            {(showAllAllergies
                              ? patient.allergies.severe
                              : patient.allergies.severe.slice(0, MAX_LIST_ITEMS)
                            ).map((item, idx) => (
                              <span
                                key={idx}
                                className="inline-block bg-error-container/50 text-error px-md py-xs rounded-full font-body-bold text-body-bold border border-error/20 text-xs font-semibold"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                          {patient.allergies.severe.length > MAX_LIST_ITEMS && (
                            <button
                              type="button"
                              onClick={() => setShowAllAllergies((v) => !v)}
                              className="mt-md text-primary hover:underline text-xs font-semibold flex items-center gap-xs cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {showAllAllergies ? "expand_less" : "expand_more"}
                              </span>
                              {showAllAllergies
                                ? "Thu gọn"
                                : `Xem thêm ${patient.allergies.severe.length - MAX_LIST_ITEMS} dị ứng`}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 3: Treatment Goals (Mục tiêu điều trị) */}
              <div className="bg-surface rounded-xl border border-outline-variant shadow-subtle flex flex-col">
                <div className="p-card-padding border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                  <h4 className="font-body-bold text-body-bold text-on-surface flex items-center gap-sm font-semibold text-base">
                    <span className="material-symbols-outlined text-primary">
                      flag
                    </span>
                    Mục tiêu điều trị & Dinh dưỡng
                  </h4>
                  <button
                    onClick={() => setIsEditingGoals(!isEditingGoals)}
                    disabled={savingGoals}
                    className="text-primary hover:text-primary-container transition-colors text-xs font-body-bold flex items-center gap-xs cursor-pointer disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isEditingGoals ? "check_circle" : "edit_note"}
                    </span>
                    {isEditingGoals ? "Xong" : "Quản lý mục tiêu"}
                  </button>
                </div>

                <div className="p-card-padding flex-1">
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md min-h-[120px]">
                    {goals.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">
                        Chưa có mục tiêu điều trị.
                      </p>
                    ) : (
                      <ul className="space-y-sm font-body text-body text-on-surface">
                        {goals.map((goal, idx) => (
                          <li
                            key={idx}
                            className="flex items-center justify-between group"
                          >
                            <div className="flex items-start gap-xs">
                              <span className="material-symbols-outlined text-primary text-sm mt-1">
                                check_circle
                              </span>
                              <span className="text-sm font-medium">{goal}</span>
                            </div>
                            {isEditingGoals && (
                              <button
                                onClick={() => void handleDeleteGoal(idx)}
                                disabled={savingGoals}
                                className="text-error hover:text-red-700 transition-colors p-1 rounded hover:bg-error-container/20 cursor-pointer disabled:opacity-60"
                                title="Xóa mục tiêu"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  delete
                                </span>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Add New Goal Form */}
                    {isEditingGoals && (
                      <div className="mt-md pt-md border-t border-outline-variant flex gap-sm">
                        <input
                          type="text"
                          value={newGoalInput}
                          onChange={(e) => setNewGoalInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleAddGoal();
                          }}
                          placeholder="Nhập mục tiêu mới..."
                          disabled={savingGoals}
                          className="flex-1 px-md py-xs bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary disabled:opacity-60"
                        />
                        <button
                          onClick={() => void handleAddGoal()}
                          disabled={savingGoals || !newGoalInput.trim()}
                          className="bg-primary text-on-primary px-md py-xs rounded-lg text-xs font-body-bold hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {savingGoals ? "Đang lưu..." : "Thêm"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dinh dưỡng & Sở thích */}
                  {patient.preferences.length > 0 && (
                    <div className="mt-md pt-md border-t border-outline-variant/40">
                      <p className="font-label text-label text-outline mb-xs text-xs uppercase tracking-wider font-semibold">
                        Dinh dưỡng & Sở thích
                      </p>
                      <div className="flex flex-wrap gap-xs">
                        {patient.preferences.map((pref, idx) => (
                          <span
                            key={idx}
                            className="inline-block bg-primary-container/20 text-primary px-md py-xs rounded-full font-body-bold text-body-bold border border-primary-container/30 text-xs font-medium"
                          >
                            {pref}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Lịch sử ăn uống & thực đơn (Tóm tắt) */}
              <div className="bg-surface rounded-xl border border-outline-variant shadow-subtle flex flex-col">
                <div className="p-card-padding border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                  <h4 className="font-body-bold text-body-bold text-on-surface flex items-center gap-sm font-semibold text-base">
                    <span className="material-symbols-outlined text-primary">
                      history
                    </span>
                    Lịch sử ăn uống & thực đơn gần đây
                  </h4>
                  <Link
                    href={`/doctor/history/${patientId}`}
                    className="text-primary hover:text-primary-container transition-colors text-xs font-body-bold flex items-center gap-xs cursor-pointer font-semibold"
                  >
                    <span>Xem đầy đủ lịch sử</span>
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_forward
                    </span>
                  </Link>
                </div>

                <div className="p-card-padding grid grid-cols-1 lg:grid-cols-2 gap-section-gap">
                  {/* Left Column: Recent Diet Logs */}
                  <div className="space-y-sm">
                    <h5 className="font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        restaurant
                      </span>
                      Nhật ký ăn uống gần đây ({recentMealLogs.length})
                    </h5>

                    {recentMealLogs.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic py-sm">
                        Chưa có nhật ký ghi nhận.
                      </p>
                    ) : (
                      <div className="space-y-xs">
                        {recentMealLogs.map((log) => (
                          <div
                            key={log.id}
                            className="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-sm flex items-center justify-between gap-sm text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-xs mb-0.5">
                                <span className="font-semibold text-on-surface">
                                  {log.mealLabel}
                                </span>
                                <span className="text-on-surface-variant font-caption text-[11px]">
                                  • {log.loggedAt}
                                </span>
                              </div>
                              <p className="text-on-surface-variant truncate text-[11px]">
                                {log.foodItems.map((f) => f.name).join(", ") ||
                                  "Ghi nhận sự kiện tuân thủ"}
                              </p>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${log.complianceType === "custom" ||
                                log.sourceBadgeText === "Ăn khác"
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                }`}
                            >
                              {log.complianceType === "custom" ||
                                log.sourceBadgeText === "Ăn khác"
                                ? "Ăn khác"
                                : "Ăn đúng"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Recent Menu Plans */}
                  <div className="space-y-sm">
                    <h5 className="font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        menu_book
                      </span>
                      Thực đơn gần đây ({recentPlans.length})
                    </h5>

                    {recentPlans.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic py-sm">
                        Chưa có thực đơn nào được khởi tạo.
                      </p>
                    ) : (
                      <div className="space-y-xs">
                        {recentPlans.map((plan) => (
                          <Link
                            key={plan.id}
                            href={`/doctor/reviews/${patientId}/${plan.id}`}
                            className="bg-surface-container-lowest border border-outline-variant/60 hover:border-primary/50 transition-all rounded-lg p-sm flex items-center justify-between gap-sm text-xs group cursor-pointer block"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-on-surface group-hover:text-primary transition-colors truncate text-xs">
                                {plan.planTitle}
                              </p>
                              <p className="text-on-surface-variant font-caption text-[11px]">
                                Khởi tạo: {plan.createdAt}
                              </p>
                            </div>

                            <div>
                              {plan.status === "approved" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Đã duyệt
                                </span>
                              )}
                              {plan.status === "rejected" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-800 border border-red-200">
                                  Đã từ chối
                                </span>
                              )}
                              {plan.status === "pending" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  Chờ duyệt
                                </span>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-card-padding py-sm bg-surface-container-low/40 border-t border-outline-variant/60 flex justify-end rounded-b-xl">
                  <Link
                    href={`/doctor/history/${patientId}`}
                    className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <span>
                      Xem toàn bộ dòng thời gian lịch sử ({allLogs.length} nhật ký,{" "}
                      {allPlans.length} thực đơn)
                    </span>
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal: Chỉnh sửa hồ sơ bệnh nhân */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md bg-black/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md shrink-0">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">edit</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Chỉnh sửa hồ sơ bệnh nhân
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs">
                    Lưu qua API — danh sách bệnh nhân cập nhật ngay
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-xs space-y-md">
              {/* Ảnh đại diện */}
              <section>
                <h5 className="font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider mb-sm">
                  Ảnh đại diện
                </h5>
                <div className="flex items-center gap-md">
                  <div className="relative w-16 h-16 shrink-0">
                    <div className="absolute inset-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-label text-sm font-semibold">
                      {initials(editForm.fullName.trim() || patient.name)}
                    </div>
                    {previewAvatarSrc && (
                      <img
                        src={previewAvatarSrc}
                        alt="Avatar preview"
                        className="absolute inset-0 w-16 h-16 rounded-full object-cover border border-outline-variant bg-surface-container"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 space-y-xs">
                    <label className="flex items-center gap-xs cursor-pointer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => void handleUploadAvatar(e.target.files?.[0])}
                      />
                      <span
                        className={`inline-flex items-center gap-xs px-md py-2 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-on-primary transition-colors ${uploadingAvatar ? "opacity-60 pointer-events-none" : ""
                          }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[18px] ${uploadingAvatar ? "animate-spin" : ""
                            }`}
                        >
                          {uploadingAvatar ? "progress_activity" : "upload"}
                        </span>
                        {uploadingAvatar ? "Đang tải lên..." : "Tải ảnh lên"}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={editForm.avatarUrl}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, avatarUrl: e.target.value }))
                      }
                      placeholder="Hoặc dán URL ảnh (bỏ trống = avatar mặc định)"
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, avatarUrl: "" }))}
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Dùng avatar mặc định
                    </button>
                  </div>
                </div>
              </section>
              {/* Thông tin chung */}
              <section>
                <h5 className="font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider mb-sm">
                  Thông tin chung
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Họ tên
                    </label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, fullName: e.target.value }))
                      }
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Email <span className="text-error">*</span>
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, email: e.target.value }))
                      }
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Tuổi
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={130}
                      value={editForm.age}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, age: e.target.value }))
                      }
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Giới tính
                    </label>
                    <select
                      value={editForm.gender}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, gender: e.target.value }))
                      }
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">—</option>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>
              </section>
              {/* Thông tin liên hệ */}
              <section>
                <h5 className="font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider mb-sm">
                  Thông tin liên hệ
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Điện thoại
                    </label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Địa chỉ
                    </label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, address: e.target.value }))
                      }
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Huyết áp
                    </label>
                    <input
                      type="text"
                      value={editForm.bloodPressure}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, bloodPressure: e.target.value }))
                      }
                      placeholder="VD: 130/80 mmHg"
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Đường huyết
                    </label>
                    <input
                      type="text"
                      value={editForm.bloodGlucose}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, bloodGlucose: e.target.value }))
                      }
                      placeholder="VD: 135 mg/dL"
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </section>


              {/* Chẩn đoán */}
              <section>
                <h5 className="font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider mb-sm">
                  Chẩn đoán hiện tại
                </h5>
                <input
                  type="text"
                  value={diagnosisSearch}
                  onChange={(e) => setDiagnosisSearch(e.target.value)}
                  placeholder="Tìm bệnh lý..."
                  className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
                <div className="flex flex-wrap gap-xs mt-sm">
                  {editForm.disease.map((code) => {
                    const label =
                      diagnosisOptions.find((o) => o.code === code)?.name ?? code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleListItem("disease", code)}
                        className={`${chipClass(true)} border-dashed`}
                        title="Bấm để bỏ chọn"
                      >
                        {label} ✕
                      </button>
                    );
                  })}
                  {visibleDiagnoses(diagnosisSearch).map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => toggleListItem("disease", opt.code)}
                      className={chipClass(false)}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
                {diagnosisSearch.trim() &&
                  visibleDiagnoses(diagnosisSearch).length === 0 && (
                    <p className="text-xs text-on-surface-variant italic mt-xs">
                      Không tìm thấy bệnh lý phù hợp.
                    </p>
                  )}
              </section>



              {/* Thuốc đang dùng */}
              <section>
                <h5 className="font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider mb-sm">
                  Thuốc đang dùng
                </h5>
                <input
                  type="text"
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Tìm thuốc..."
                  className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
                <div className="flex flex-wrap gap-xs mt-sm">
                  {editForm.medications.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleListItem("medications", v)}
                      className={`${chipClass(true)} border-dashed`}
                      title="Bấm để bỏ chọn"
                    >
                      {v} ✕
                    </button>
                  ))}
                  {visibleCatalog(
                    catalog?.medicines ?? [],
                    medSearch,
                    editForm.medications
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleListItem("medications", m.name)}
                      className={chipClass(false)}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                {medSearch.trim() &&
                  visibleCatalog(
                    catalog?.medicines ?? [],
                    medSearch,
                    editForm.medications
                  ).length === 0 && (
                    <p className="text-xs text-on-surface-variant italic mt-xs">
                      Không tìm thấy thuốc phù hợp.
                    </p>
                  )}
              </section>

              {/* Dị ứng */}
              <section>
                <h5 className="font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider mb-sm">
                  Dị ứng & Phản ứng phụ
                </h5>
                <input
                  type="text"
                  value={allergySearch}
                  onChange={(e) => setAllergySearch(e.target.value)}
                  placeholder="Tìm dị ứng..."
                  className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
                <div className="flex flex-wrap gap-xs mt-sm">
                  {editForm.allergies.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleListItem("allergies", v)}
                      className={`${chipClass(true)} border-dashed`}
                      title="Bấm để bỏ chọn"
                    >
                      {v} ✕
                    </button>
                  ))}
                  {visibleCatalog(
                    catalog?.allergies ?? [],
                    allergySearch,
                    editForm.allergies
                  ).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleListItem("allergies", a.name)}
                      className={chipClass(false)}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
                {allergySearch.trim() &&
                  visibleCatalog(
                    catalog?.allergies ?? [],
                    allergySearch,
                    editForm.allergies
                  ).length === 0 && (
                    <p className="text-xs text-on-surface-variant italic mt-xs">
                      Không tìm thấy dị ứng phù hợp.
                    </p>
                  )}
              </section>

              {/* Dinh dưỡng & Mục tiêu điều trị */}
              <section>
                <h5 className="font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider mb-sm">
                  Dinh dưỡng & Mục tiêu điều trị
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Dinh dưỡng / Sở thích ăn uống (mỗi dòng 1 mục)
                    </label>
                    <textarea
                      rows={4}
                      value={editForm.preferencesText}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          preferencesText: e.target.value,
                        }))
                      }
                      placeholder={"thích ăn cơm\nkhông ăn thịt bò"}
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors resize-y"
                    />
                  </div>
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Mục tiêu điều trị (mỗi dòng 1 mục tiêu)
                    </label>
                    <textarea
                      rows={4}
                      value={editForm.goalsText}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, goalsText: e.target.value }))
                      }
                      placeholder={"Kiểm soát đường huyết (HbA1c < 7%).\nGiảm cân 2kg trong 1 tháng."}
                      className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors resize-y"
                    />
                  </div>
                </div>
              </section>

              {editError && (
                <div className="rounded-xl border border-error/30 bg-error-container/20 px-md py-sm text-xs text-error font-medium">
                  {editError}
                </div>
              )}
            </div>

            <div className="pt-md border-t border-outline-variant mt-md flex justify-end items-center gap-sm shrink-0">
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                disabled={savingProfile}
                className="px-md py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-container-low transition-colors disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile}
                className="bg-primary text-on-primary px-lg py-2 rounded-lg font-body-bold text-sm hover:bg-primary-container transition-all shadow-xs flex items-center gap-xs cursor-pointer active:scale-95 font-semibold disabled:opacity-60"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${savingProfile ? "animate-spin" : ""
                    }`}
                >
                  {savingProfile ? "progress_activity" : "save"}
                </span>
                {savingProfile ? "Đang lưu..." : "Lưu lại"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
