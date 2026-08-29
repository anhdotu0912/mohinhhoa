"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { asRouteId } from "@/lib/route-params";
import { PatientRecordId } from "@/components/doctor/chart/PatientRecordId";
import { PatientMetricsCard } from "@/components/doctor/PatientMetricsCard";
import { PlanExpiryBadge } from "@/components/doctor/PlanExpiryBadge";
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
import { DEFAULT_PLAN_DAYS } from "@/lib/config";
import {
  isReviewedPlanStatus,
  patientUsageLabel,
} from "@/lib/plan-expiry";
import { DISEASE_OPTIONS } from "@/lib/profile-mappers";
import { doctorReviewHref } from "@/lib/doctor-routes";

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
    patientCode: summary.id,
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);

  const handleDeletePatient = async () => {
    if (!patientId) return;
    setIsDeletingPatient(true);
    try {
      await api.deleteDoctorPatient(patientId);
      router.replace("/doctor/patients");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể xóa bệnh nhân.";
      showToast(msg);
      setIsDeletingPatient(false);
    }
  };

  // Hiển thị "Xem thêm" khi danh sách dài
  const [showAllMeds, setShowAllMeds] = useState(false);
  const [showAllAllergies, setShowAllAllergies] = useState(false);
  const MAX_LIST_ITEMS = 3;

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
        api.listPatientMealPlans(patientId, "all").catch(() => [] as MealPlanOutput[]),
      ]);
      setSummary(patient);
      setGoals(patient.treatment_goals || []);
      setPlans(allPlans);
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

  const reviewedPlans = useMemo(
    () => plans.filter((p) => isReviewedPlanStatus(p.status)),
    [plans]
  );

  const activePlan = useMemo(() => {
    if (!summary?.active_plan_id) return null;
    return plans.find((p) => p.id === summary.active_plan_id) ?? null;
  }, [summary, plans]);

  const activePlanUsage = useMemo(() => {
    if (!summary) return "none" as const;
    if (summary.plan_usage === "active") return "active" as const;
    if (summary.plan_usage === "finished") return "finished" as const;
    return "none" as const;
  }, [summary]);

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
    `px-md py-xs rounded-md text-xs font-medium border transition-colors cursor-pointer ${active
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
  const hasGenerateRequest = summary?.meal_plan_request_status === "pending";

  return (
    <>
      <div className="flex flex-col min-h-[calc(100vh-64px)] bg-background font-body">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-md py-sm rounded-xl shadow-xl border border-primary-fixed/30 flex items-center gap-xs font-body text-sm animate-slide-down">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span className="font-body-bold font-bold">{toastMessage}</span>
          </div>
        )}

        <main className="p-4 sm:p-6 md:p-8 w-full max-w-[1600px] mx-auto space-y-6 flex-1">
          {/* Top Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">

            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="bg-surface-container-lowest border border-outline-variant/60 text-on-surface-variant hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Xóa bệnh nhân</span>
              </button>
              <button
                type="button"
                onClick={openEditProfile}
                className="bg-surface-container-lowest border border-outline-variant/60 text-on-surface px-4 py-2 rounded-lg text-xs font-bold hover:bg-surface-container-low transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                <span>Chỉnh sửa hồ sơ</span>
              </button>
              {!hasGenerateRequest && (
                <Link
                  href={`/doctor/patients/${patientId}/generate`}
                  className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  <span>Tạo thực đơn AI</span>
                </Link>
              )}
            </div>
          </div>

          {hasGenerateRequest && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs animate-in fade-in duration-200">
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
                  <span>Bệnh nhân đã gửi yêu cầu tạo thực đơn mới</span>
                </p>
                {summary.meal_plan_request_note ? (
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Ghi chú từ bệnh nhân: “{summary.meal_plan_request_note}”
                  </p>
                ) : (
                  <p className="text-xs text-on-surface-variant mt-1">
                    Bệnh nhân đang chờ bác sĩ kích hoạt thực đơn AI tuần tiếp theo.
                  </p>
                )}
              </div>
              <Link
                href={`/doctor/patients/${patientId}/generate`}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shrink-0 shadow-2xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>Tạo thực đơn AI ngay</span>
              </Link>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column: Patient Profile & Demographics (32%) */}
            <div className="w-full lg:w-[32%] flex flex-col gap-6">
              {/* Profile Card */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 p-6 flex flex-col items-center text-center shadow-xs">
                <div className="relative mb-4">
                  <div className="relative w-24 h-24 rounded-full ring-4 ring-primary/20 p-1 bg-white shadow-md overflow-hidden">
                    <div
                      translate="no"
                      className="absolute inset-1 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold"
                    >
                      {initials(patient.name)}
                    </div>
                    {avatarSrc && (
                      <img
                        alt={`${patient.name} Avatar`}
                        className="relative z-10 w-full h-full rounded-full object-cover"
                        src={avatarSrc}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 z-20 w-4 h-4 bg-emerald-500 ring-2 ring-white rounded-full"></span>
                </div>
                <h3 className="text-on-surface mb-1 font-black text-xl tracking-tight">
                  {patient.name}
                </h3>
                <p className="text-on-surface-variant mb-4 text-xs font-semibold">
                  {patient.age > 0 ? `${patient.age} tuổi` : "—"} • {patient.gender === "male" ? "Nam" : patient.gender === "female" ? "Nữ" : patient.gender}
                </p>

                <div className="w-full text-left pt-4 border-t border-outline-variant/40">
                  <p className="text-on-surface-variant mb-2 uppercase tracking-wider text-[10px] font-bold">
                    Chẩn đoán &amp; Bệnh lý
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-start">
                    {patient.diagnoses.length === 0 ? (
                      <span className="text-xs text-on-surface-variant italic">
                        Chưa khai báo bệnh lý
                      </span>
                    ) : (
                      patient.diagnoses.map((diag, index) => (
                        <span
                          key={index}
                          className="bg-primary/10 text-primary px-3 py-1 rounded-md font-caption text-caption border border-primary/20 text-xs font-semibold"
                        >
                          {diag}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Contact & Extra Info Card */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 p-5 shadow-xs">
                <h4 className="text-on-surface mb-3.5 pb-2.5 border-b border-outline-variant/40 font-bold flex items-center justify-between text-xs uppercase tracking-wider">
                  <span>Thông tin liên hệ &amp; Hồ sơ</span>
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    badge
                  </span>
                </h4>
                <ul className="space-y-3 text-on-surface-variant text-xs">
                  <li className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-outline text-[16px] mt-0.5">
                      fingerprint
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5">
                        Mã định danh
                      </p>
                      <PatientRecordId id={patient.patientCode} />
                    </div>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-outline text-[16px]">
                      phone
                    </span>
                    <span className="font-semibold text-on-surface">{patient.phone || "—"}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-outline text-[16px]">
                      mail
                    </span>
                    <span className="truncate font-semibold text-on-surface">{patient.email}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-outline text-[16px]">
                      home
                    </span>
                    <span className="font-medium text-on-surface">{patient.address || "—"}</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Stacked Cards (68%) */}
            <div className="w-full lg:w-[68%] flex flex-col gap-6">
              {/* Card 1: Body Vitals (Chỉ số cơ thể) */}
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

              {/* Card 2: Medications & Allergies */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Sub-card: Thuốc đang dùng */}
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-xs flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-outline-variant/40 bg-surface-container-low/40">
                    <h4 className="text-on-surface flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        medication
                      </span>
                      <span>Thuốc điều trị đang dùng</span>
                    </h4>
                  </div>
                  <div className="p-4 flex-1">
                    {patient.medications.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">
                        Chưa ghi nhận đơn thuốc.
                      </p>
                    ) : (
                      <>
                        <ul className="space-y-2.5">
                          {(showAllMeds
                            ? patient.medications
                            : patient.medications.slice(0, MAX_LIST_ITEMS)
                          ).map((med, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-container-low/30 border border-outline-variant/30">
                              <span className="material-symbols-outlined text-primary text-[16px] mt-0.5">
                                pill
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-on-surface text-xs truncate">
                                  {med.name}
                                </p>
                                <p className="text-on-surface-variant text-[11px] mt-0.5 font-medium">
                                  {med.dosage || "Theo chỉ định bác sĩ"}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {patient.medications.length > MAX_LIST_ITEMS && (
                          <button
                            type="button"
                            onClick={() => setShowAllMeds((v) => !v)}
                            className="mt-3 text-primary hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
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
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-xs flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-outline-variant/40 bg-surface-container-low/40">
                    <h4 className="text-on-surface flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-rose-600 text-[18px]">
                        warning
                      </span>
                      <span>Dị ứng &amp; Phản ứng phụ</span>
                    </h4>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    {patient.allergies.severe.length === 0 &&
                      patient.allergies.mild.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">
                        Không ghi nhận tiền sử dị ứng thực phẩm.
                      </p>
                    ) : (
                      <>
                        <ul className="list-disc list-inside space-y-1 text-on-surface-variant text-xs mb-2 font-medium">
                          {patient.allergies.mild.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                        <div className="pt-2.5 border-t border-outline-variant/30">
                          <p className="text-rose-900 mb-1.5 text-[10px] uppercase tracking-wider font-black">
                            Cần tránh tuyệt đối:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(showAllAllergies
                              ? patient.allergies.severe
                              : patient.allergies.severe.slice(0, MAX_LIST_ITEMS)
                            ).map((item, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 px-2.5 py-0.5 rounded-md border border-rose-200 text-xs font-bold"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                {item}
                              </span>
                            ))}
                          </div>
                          {patient.allergies.severe.length > MAX_LIST_ITEMS && (
                            <button
                              type="button"
                              onClick={() => setShowAllAllergies((v) => !v)}
                              className="mt-2.5 text-primary hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
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

              {/* Card 3: Treatment Goals */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-xs flex flex-col overflow-hidden">
                <div className="p-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface-container-low/40">
                  <h4 className="text-on-surface flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      flag
                    </span>
                    <span>Mục tiêu điều trị &amp; Dinh dưỡng</span>
                  </h4>
                  <button
                    onClick={() => setIsEditingGoals(!isEditingGoals)}
                    disabled={savingGoals}
                    className="text-primary hover:text-primary/80 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isEditingGoals ? "check_circle" : "edit_note"}
                    </span>
                    {isEditingGoals ? "Hoàn tất" : "Quản lý mục tiêu"}
                  </button>
                </div>

                <div className="p-4 flex-1 space-y-4">
                  <div className="bg-surface-container-low/30 border border-outline-variant/40 rounded-lg p-4 min-h-[100px]">
                    {goals.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">
                        Chưa thiết lập mục tiêu điều trị cụ thể.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-on-surface">
                        {goals.map((goal, idx) => (
                          <li
                            key={idx}
                            className="flex items-center justify-between group"
                          >
                            <div className="flex items-start gap-2">
                              <span className="material-symbols-outlined text-primary text-[15px] mt-0.5">
                                check_circle
                              </span>
                              <span className="text-xs font-bold">{goal}</span>
                            </div>
                            {isEditingGoals && (
                              <button
                                onClick={() => void handleDeleteGoal(idx)}
                                disabled={savingGoals}
                                className="text-rose-600 hover:text-rose-700 transition-colors p-1 rounded-lg hover:bg-rose-50 cursor-pointer disabled:opacity-60"
                                title="Xóa mục tiêu"
                              >
                                <span className="material-symbols-outlined text-[15px]">
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
                      <div className="mt-3 pt-3 border-t border-outline-variant/40 flex gap-2">
                        <input
                          type="text"
                          value={newGoalInput}
                          onChange={(e) => setNewGoalInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleAddGoal();
                          }}
                          placeholder="Nhập mục tiêu dinh dưỡng/điều trị mới..."
                          disabled={savingGoals}
                          className="flex-1 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                        />
                        <button
                          onClick={() => void handleAddGoal()}
                          disabled={savingGoals || !newGoalInput.trim()}
                          className="bg-primary text-on-primary px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs cursor-pointer disabled:opacity-60 active:scale-95"
                        >
                          {savingGoals ? "Đang lưu..." : "Thêm"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dinh dưỡng & Sở thích */}
                  {patient.preferences.length > 0 && (
                    <div className="pt-2 border-t border-outline-variant/30">
                      <p className="text-on-surface-variant mb-2 text-[10px] uppercase tracking-wider font-bold">
                        Sở thích &amp; Thói quen ăn uống
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {patient.preferences.map((pref, idx) => (
                          <span
                            key={idx}
                            className="inline-block bg-primary/10 text-primary px-2.5 py-0.5 rounded-md border border-primary/20 text-xs font-semibold"
                          >
                            {pref}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Lịch sử thực đơn (Tóm tắt) */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-xs flex flex-col overflow-hidden">
                <div className="p-4 border-b border-outline-variant/40 flex justify-between items-center bg-surface-container-low/40">
                  <h4 className="text-on-surface flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      history
                    </span>
                    <span>Thực đơn &amp; Lịch trình gần đây</span>
                  </h4>
                  <Link
                    href={`/doctor/patients/${patientId}/history`}
                    className="text-primary hover:text-primary/80 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lưới 3 tuần</span>
                    <span className="material-symbols-outlined text-[15px]">
                      arrow_forward
                    </span>
                  </Link>
                </div>

                <div className="p-4 space-y-4">
                  {summary && summary.active_plan_id && activePlanUsage === "active" ? (
                    <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                      <div>
                        <p className="text-xs font-bold text-emerald-950">
                          Thực đơn đang áp dụng
                        </p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                          {patientUsageLabel(activePlanUsage)}
                          {summary.plan_starts_on && summary.plan_end_date
                            ? ` · ${summary.plan_starts_on} – ${summary.plan_end_date}`
                            : ""}
                        </p>
                        {activePlan && (
                          <Link
                            href={doctorReviewHref(patientId, activePlan.id)}
                            className="text-xs text-primary font-bold hover:underline mt-1 inline-flex items-center gap-1"
                          >
                            <span>Xem chi tiết thực đơn</span>
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </Link>
                        )}
                      </div>
                      <PlanExpiryBadge
                        expiry={{
                          plan_expiry: summary.plan_expiry ?? "none",
                          plan_days_left: summary.plan_days_left ?? null,
                          plan_end_date: summary.plan_end_date ?? null,
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant italic">
                      Chưa có thực đơn đang áp dụng trong chu kỳ này.
                    </p>
                  )}

                  <div className="space-y-2">
                    <h5 className="text-on-surface font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary">
                        menu_book
                      </span>
                      <span>Danh sách thực đơn gần nhất ({recentPlans.length})</span>
                    </h5>

                    {recentPlans.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic py-2">
                        Chưa có thực đơn nào được khởi tạo.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {recentPlans.map((plan) => (
                          <Link
                            key={plan.id}
                            href={doctorReviewHref(patientId, plan.id)}
                            className="bg-surface-container-low/30 border border-outline-variant/40 hover:border-primary/50 transition-all rounded-lg p-3 flex items-center justify-between gap-3 text-xs group cursor-pointer block shadow-2xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-on-surface group-hover:text-primary transition-colors truncate text-xs">
                                {plan.planTitle}
                              </p>
                              <p className="text-on-surface-variant text-[11px] mt-0.5 font-mono">
                                Khởi tạo: {plan.createdAt}
                              </p>
                            </div>

                            <div>
                              {plan.status === "approved" && (
                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-900 border border-emerald-500/20">
                                  Đã duyệt
                                </span>
                              )}
                              {plan.status === "rejected" && (
                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                  Đã từ chối
                                </span>
                              )}
                              {plan.status === "pending" && (
                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-900 border border-amber-500/20">
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

                <div className="px-4 py-2.5 bg-surface-container-low/40 border-t border-outline-variant/40 flex justify-end">
                  <Link
                    href={`/doctor/patients/${patientId}/history`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    <span>
                      Xem toàn bộ lịch trình ({reviewedPlans.length} thực đơn đã duyệt)
                    </span>
                    <span className="material-symbols-outlined text-[15px]">
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
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
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
                <div className="rounded-lg border border-error/30 bg-error-container/20 px-md py-sm text-xs text-error font-medium">
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

      {/* DELETE PATIENT CONFIRMATION MODAL */}
      {isDeleteModalOpen && patient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 max-w-md w-full shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">person_remove</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">Xóa hồ sơ bệnh nhân</h3>
                <p className="text-xs text-on-surface-variant">Mã: {patient.id}</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Bạn có chắc chắn muốn xóa hồ sơ bệnh nhân{" "}
              <strong className="text-on-surface">{patient.name}</strong>?
              <br />
              <span className="text-xs text-rose-600 font-semibold mt-1 block">
                ⚠️ Toàn bộ thực đơn, nhật ký bữa ăn, chỉ số sức khỏe và tin nhắn của bệnh nhân này sẽ bị xóa vĩnh viễn khỏi hệ thống.
              </span>
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingPatient}
                className="px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => void handleDeletePatient()}
                disabled={isDeletingPatient}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isDeletingPatient ? "hourglass_empty" : "delete_forever"}
                </span>
                <span>{isDeletingPatient ? "Đang xóa..." : "Xác nhận xóa"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
