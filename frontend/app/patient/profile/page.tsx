/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { isPlaceholderAvatar, resolveUserAvatar, userInitials } from "@/lib/avatar";
import { AVATAR_PRESETS } from "@/lib/avatar-presets";
import {
  COMMON_ALLERGIES,
  DISEASE_OPTIONS,
  TREATMENT_GOAL_OPTIONS,
  calcBmi,
  diseaseCodeToLabel,
  normalizeMedications,
  suggestTargetKcal,
} from "@/lib/profile-mappers";
import {
  ApiError,
  type CatalogItem,
  type CatalogOut,
  type PatientProfile,
  type ProfileUpsert,
  type UserMeResponse,
} from "@/lib/types";

type EditFormState = {
  age: string;
  gender: string;
  phone: string;
  address: string;
  weight: string;
  height: string;
  bloodPressure: string;
  bloodGlucose: string;
  diseaseCodes: string[];
  medications: string[];
  allergies: string[];
  selectedGoals: string[];
  preferencesText: string;
  targetKcalInput: string;
  carbPerMeal: string;
  sodiumDaily: string;
};

function profileToForm(
  profile: PatientProfile,
  catalog: CatalogOut | null
): EditFormState {
  const medDisplay = (profile.medications ?? []).map((code) => {
    const fromCatalog = catalog?.medicines.find(
      (m) => normalizeMedications([m.name])[0] === code
    );
    return fromCatalog?.name ?? code;
  });

  return {
    age: profile.age != null ? String(profile.age) : "",
    gender: profile.gender ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    weight: profile.weight != null ? String(profile.weight) : "",
    height: profile.height != null ? String(profile.height) : "",
    bloodPressure: profile.blood_pressure ?? "",
    bloodGlucose: profile.blood_glucose ?? "",
    diseaseCodes: [...(profile.disease ?? [])],
    medications: medDisplay,
    allergies: [...(profile.allergies ?? [])],
    selectedGoals: [...(profile.treatment_goals ?? [])],
    preferencesText: (profile.preferences ?? []).join(", "),
    targetKcalInput: String(profile.target_kcal ?? 1800),
    carbPerMeal:
      profile.restrictions?.carb_per_meal != null
        ? String(profile.restrictions.carb_per_meal)
        : "",
    sodiumDaily:
      profile.restrictions?.sodium_daily != null
        ? String(profile.restrictions.sodium_daily)
        : "",
  };
}

/** BMI Category determination helper (Asian-Pacific / WPRO standards) */
function getBmiCategory(bmi: number | null): {
  label: string;
  status: "underweight" | "normal" | "overweight" | "obese";
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
} {
  if (bmi === null || bmi <= 0) {
    return {
      label: "Chưa có dữ liệu",
      status: "normal",
      colorClass: "text-slate-500",
      bgClass: "bg-slate-50",
      borderClass: "border-slate-200",
      badgeClass: "bg-slate-100 text-slate-700",
    };
  }
  if (bmi < 18.5) {
    return {
      label: "Thiếu cân",
      status: "underweight",
      colorClass: "text-sky-600",
      bgClass: "bg-sky-50/70",
      borderClass: "border-sky-200",
      badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
    };
  }
  if (bmi <= 22.9) {
    return {
      label: "Chuẩn sức khỏe (WPRO)",
      status: "normal",
      colorClass: "text-emerald-700",
      bgClass: "bg-emerald-50/70",
      borderClass: "border-emerald-200",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    };
  }
  if (bmi <= 24.9) {
    return {
      label: "Tiền béo phì",
      status: "overweight",
      colorClass: "text-amber-700",
      bgClass: "bg-amber-50/70",
      borderClass: "border-amber-200",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    };
  }
  return {
    label: "Béo phì",
    status: "obese",
    colorClass: "text-rose-700",
    bgClass: "bg-rose-50/70",
    borderClass: "border-rose-200",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
  };
}

export default function PatientProfilePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);
  const displayName = useAuthStore((s) => s.displayName);
  const authAvatar = useAuthStore((s) => s.avatar);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);

  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogOut | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Avatar selector modal & file upload states
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  // Edit form state
  const [form, setForm] = useState<EditFormState | null>(null);
  const [allergySearch, setAllergySearch] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [customGoalInput, setCustomGoalInput] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, userData, catalogData] = await Promise.all([
        api.getProfile(),
        api.getCurrentUser(),
        api.getCatalog().catch(() => null),
      ]);
      setProfile(profileData);
      setUser(userData);
      setCatalog(catalogData);

      // Prefer backend avatar; drop stale Stitch/dicebear placeholders from persist
      if (isPlaceholderAvatar(authAvatar)) {
        setUserProfile({
          avatar: userData.avatar ?? null,
          displayName: userData.full_name?.trim() || userData.email,
        });
      } else if (userData.full_name) {
        setUserProfile({ displayName: userData.full_name });
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không tải được hồ sơ bệnh nhân."
      );
    } finally {
      setLoading(false);
    }
  }, [authAvatar, setUserProfile]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (role === "doctor") {
      router.replace("/doctor");
    }
  }, [hydrated, token, role, router]);

  useEffect(() => {
    if (!hydrated || !token || role === "doctor") return;
    void loadData();
  }, [hydrated, token, role, loadData]);

  const currentAvatar = useMemo(() => {
    return resolveUserAvatar(authAvatar || user?.avatar);
  }, [authAvatar, user?.avatar]);

  const profileName = user?.full_name || displayName || email || "BN";
  const profileInitials = userInitials(profileName);

  // Diagnoses list from catalog & fallback
  const diagnosisOptions = useMemo(() => {
    const base: { code: string; name: string }[] = catalog
      ? catalog.diagnoses.map((d) => ({ code: d.code, name: d.name }))
      : DISEASE_OPTIONS.map((d) => ({ code: d.code, name: d.label }));
    const merged = [...base];
    for (const code of form?.diseaseCodes ?? profile?.disease ?? []) {
      if (!merged.some((o) => o.code === code)) {
        merged.push({ code, name: diseaseCodeToLabel(code) });
      }
    }
    return merged;
  }, [catalog, form?.diseaseCodes, profile?.disease]);

  // Dynamic preview BMI calculation
  const previewBmi = useMemo(() => {
    if (!form) return profile?.bmi ?? null;
    const w = Number(form.weight);
    const h = Number(form.height);
    if (!w || !h || w <= 0 || h <= 0) return null;
    return calcBmi(w, h);
  }, [form, profile?.bmi]);

  const bmiCategory = useMemo(() => {
    return getBmiCategory(previewBmi);
  }, [previewBmi]);

  // Suggested Kcal based on BMI & Diseases
  const suggestedKcal = useMemo(() => {
    const codes = form?.diseaseCodes ?? profile?.disease ?? [];
    return suggestTargetKcal(previewBmi, codes);
  }, [form?.diseaseCodes, profile?.disease, previewBmi]);

  const isProfileEmpty = useMemo(() => {
    if (!profile) return false;
    return (
      profile.disease.length === 0 &&
      profile.medications.length === 0 &&
      profile.allergies.length === 0
    );
  }, [profile]);

  const visibleCatalog = (
    items: CatalogItem[],
    query: string,
    selected: string[]
  ): CatalogItem[] => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? items.filter((i) => i.name.toLowerCase().includes(q))
      : items;
    return pool.filter((i) => !selected.includes(i.name)).slice(0, 6);
  };

  const startEditing = () => {
    if (!profile) return;
    setForm(profileToForm(profile, catalog));
    setSaveNotice(null);
    setError(null);
    setEditing(true);
    if (!catalog) {
      setCatalogLoading(true);
      api
        .getCatalog()
        .then(setCatalog)
        .catch(() => setCatalog(null))
        .finally(() => setCatalogLoading(false));
    }
  };

  const cancelEditing = () => {
    setForm(null);
    setAllergySearch("");
    setMedSearch("");
    setCustomGoalInput("");
    setError(null);
    setEditing(false);
  };

  const toggleDisease = (code: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.diseaseCodes.includes(code);
      return {
        ...prev,
        diseaseCodes: has
          ? prev.diseaseCodes.filter((c) => c !== code)
          : [...prev.diseaseCodes, code],
      };
    });
  };

  const toggleListItem = (key: "medications" | "allergies", value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value],
      };
    });
  };

  const toggleGoal = (goal: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.selectedGoals.includes(goal);
      return {
        ...prev,
        selectedGoals: has
          ? prev.selectedGoals.filter((g) => g !== goal)
          : [...prev.selectedGoals, goal],
      };
    });
  };

  const handleAddCustomGoal = () => {
    const g = customGoalInput.trim();
    if (!g || !form) return;
    if (!form.selectedGoals.includes(g)) {
      setForm({ ...form, selectedGoals: [...form.selectedGoals, g] });
    }
    setCustomGoalInput("");
  };

  // Avatar file upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      setAvatarUploadError("Kích thước ảnh tối đa 4MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarUploadError("Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUserProfile({ avatar: dataUrl });
      setAvatarModalOpen(false);
      setSaveNotice("Đã cập nhật ảnh đại diện thành công.");
    };
    reader.onerror = () => {
      setAvatarUploadError("Không đọc được tệp hình ảnh.");
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetAvatar = (svgDataUri: string) => {
    setUserProfile({ avatar: svgDataUri });
    setAvatarModalOpen(false);
    setSaveNotice("Đã đổi avatar theo bộ mẫu có sẵn.");
  };

  const handleResetAvatar = () => {
    setUserProfile({ avatar: null });
    setAvatarModalOpen(false);
    setSaveNotice("Đã đặt lại avatar mặc định.");
  };

  const validateForm = (): string | null => {
    if (!form) return "Form không hợp lệ.";
    const ageNum = Number(form.age);
    if (!form.age || !Number.isFinite(ageNum) || ageNum <= 0 || ageNum > 130) {
      return "Nhập tuổi hợp lệ (1–130).";
    }
    if (!form.gender.trim()) return "Chọn giới tính.";
    const w = Number(form.weight);
    const h = Number(form.height);
    if (!w || !h || w <= 0 || h <= 0) {
      return "Nhập cân nặng và chiều cao hợp lệ.";
    }
    if (form.diseaseCodes.length === 0) {
      return "Chọn ít nhất một bệnh lý nền.";
    }
    if (form.selectedGoals.length === 0) {
      return "Chọn ít nhất một mục tiêu điều trị.";
    }
    const kcal = Number(form.targetKcalInput);
    if (!kcal || kcal < 800 || kcal > 5000) {
      return "Nhập mục tiêu kcal hợp lệ (800–5000).";
    }
    return null;
  };

  const handleSave = async () => {
    if (!form || !profile) return;
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const w = Number(form.weight);
    const h = Number(form.height);
    const bmi = calcBmi(w, h);
    const targetKcal = Number(form.targetKcalInput);
    const preferences = form.preferencesText
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const restrictions: ProfileUpsert["restrictions"] = {
      carb_per_meal: form.carbPerMeal.trim()
        ? Number(form.carbPerMeal)
        : null,
      sodium_daily: form.sodiumDaily.trim()
        ? Number(form.sodiumDaily)
        : null,
      salt_daily_g: profile.restrictions?.salt_daily_g ?? null,
      sugar_daily_g: profile.restrictions?.sugar_daily_g ?? null,
    };

    const payload: ProfileUpsert = {
      disease: form.diseaseCodes,
      medications: normalizeMedications(form.medications),
      allergies: form.allergies,
      bmi,
      weight: w,
      height: h,
      age: Number(form.age),
      gender: form.gender.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      blood_pressure: form.bloodPressure.trim() || null,
      blood_glucose: form.bloodGlucose.trim() || null,
      target_kcal: targetKcal,
      restrictions,
      preferences,
      treatment_goals: form.selectedGoals,
    };

    setSaving(true);
    setError(null);
    setSaveNotice(null);
    try {
      const updated = await api.upsertProfile(payload);
      setProfile(updated);
      setEditing(false);
      setForm(null);
      if (updated.constraints_status === "pending_doctor_review") {
        setSaveNotice(
          "Thay đổi mục tiêu kcal hoặc ràng buộc dinh dưỡng đã được lưu và đang chờ bác sĩ duyệt lại."
        );
      } else {
        setSaveNotice("Đã lưu hồ sơ sức khỏe thành công.");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Không lưu được hồ sơ. Kiểm tra kết nối backend."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-on-surface-variant">
        Đang tải...
      </div>
    );
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-7xl mx-auto w-full space-y-6 pb-28">
      {/* Back to Chat Link */}
      <div>
        <Link
          href="/patient"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/50 text-xs font-bold transition-all shadow-2xs group"
        >
          <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">
            arrow_back
          </span>
          <span>Quay lại màn hình Chat</span>
        </Link>
      </div>

      {/* Page Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-outline-variant/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">
              badge
            </span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
              Hồ sơ sức khỏe cá nhân
            </h1>
          </div>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
            Thông tin lâm sàng, thể trạng và mục tiêu dinh dưỡng giúp AI cá nhân hóa
            thực đơn và kiểm soát an toàn tương tác thuốc.
          </p>
        </div>

          {!loading && profile && (
            <div className="flex items-center gap-3 shrink-0">
              {!editing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-bold py-2.5 px-5 rounded-xl hover:bg-primary-container transition-all shadow-xs text-sm cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                  Chỉnh sửa hồ sơ
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="inline-flex items-center justify-center gap-1.5 bg-surface-container-low text-on-surface-variant border border-outline-variant font-semibold py-2.5 px-4 rounded-xl hover:bg-surface-variant transition-all text-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-bold py-2.5 px-5 rounded-xl hover:bg-primary-container transition-all shadow-xs text-sm cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <span className="material-symbols-outlined text-[20px] animate-spin">
                          progress_activity
                        </span>
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px]">save</span>
                        Lưu hồ sơ
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Alerts */}
        {saveNotice && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-emerald-600 text-[22px]">
                check_circle
              </span>
              <span>{saveNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 text-xs font-semibold p-1"
            >
              Đóng
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-300 bg-rose-50/90 px-4 py-3 text-sm text-rose-900 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-rose-600 text-[22px]">
                error
              </span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-700 hover:text-rose-950 text-xs font-semibold p-1"
            >
              Đóng
            </button>
          </div>
        )}

        {isProfileEmpty && !editing && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-sm text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-600 text-[26px]">
                warning
              </span>
              <div>
                <p className="font-bold">Hồ sơ sức khỏe của bạn chưa hoàn thiện</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Vui lòng thiết lập các thông tin lâm sàng để AI hỗ trợ tính toán thực đơn an toàn.
                </p>
              </div>
            </div>
            <Link
              href="/patient/onboarding"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-700 transition-colors shrink-0"
            >
              Thiết lập ngay →
            </Link>
          </div>
        )}

        {/* Main Content Area */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-outline-variant rounded-2xl p-6 h-80 animate-pulse" />
              <div className="bg-white border border-outline-variant rounded-2xl p-6 h-60 animate-pulse" />
            </div>
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border border-outline-variant rounded-2xl p-6 h-72 animate-pulse" />
              <div className="bg-white border border-outline-variant rounded-2xl p-6 h-72 animate-pulse" />
            </div>
          </div>
        ) : !profile ? (
          <div className="rounded-2xl border border-outline-variant bg-white p-12 text-center max-w-md mx-auto">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/50">
              person_off
            </span>
            <p className="text-base font-semibold text-on-surface mt-3">
              Không tìm thấy dữ liệu hồ sơ
            </p>
            <p className="text-xs text-on-surface-variant mt-1 mb-4">
              Vui lòng tải lại trang hoặc đăng nhập lại tài khoản.
            </p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl"
            >
              Tải lại
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ======================================================== */}
            {/* LEFT COLUMN: HERO IDENTITY & VITALS PASSPORT (4 COLS)     */}
            {/* ======================================================== */}
            <div className="lg:col-span-4 space-y-6">
              {/* Profile Identity Card */}
              <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs relative overflow-hidden">
                {/* Decorative background aura */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-primary/5 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

                <div className="flex flex-col items-center text-center">
                  {/* Avatar with Upload & Glow */}
                  <div className="relative group mb-4">
                    <div className="relative w-28 h-28 rounded-full ring-4 ring-primary/20 p-1 bg-white shadow-md overflow-hidden">
                      <div
                        translate="no"
                        className="absolute inset-1 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold"
                      >
                        {profileInitials}
                      </div>
                      {currentAvatar ? (
                        <img
                          src={currentAvatar}
                          alt="Avatar bệnh nhân"
                          className="relative z-10 w-full h-full rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>

                    {/* Change Avatar Button */}
                    <button
                      type="button"
                      onClick={() => setAvatarModalOpen(true)}
                      title="Đổi ảnh đại diện"
                      className="absolute bottom-1 right-1 w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-white"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        photo_camera
                      </span>
                    </button>
                  </div>

                  <h2 className="text-xl font-bold text-on-surface">
                    {user?.full_name || displayName || "Bệnh nhân VMEC-10"}
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate max-w-full">
                    {user?.email ?? email}
                  </p>

                  {/* Demographic Badges */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-surface-container-low text-on-surface border border-outline-variant/80">
                      <span className="material-symbols-outlined text-[15px] text-primary">
                        cake
                      </span>
                      {editing && form ? `${form.age || "—"} tuổi` : `${profile.age ?? "—"} tuổi`}
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-surface-container-low text-on-surface border border-outline-variant/80">
                      <span className="material-symbols-outlined text-[15px] text-primary">
                        wc
                      </span>
                      {editing && form ? form.gender || "—" : profile.gender || "—"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                      ID: #{user?.id ? user.id.slice(0, 6) : "BN001"}
                    </span>
                  </div>

                  {/* Doctor Review Status Indicator */}
                  <div className="w-full mt-4 pt-4 border-t border-outline-variant/50">
                    <div
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold ${
                        profile.constraints_status === "pending_doctor_review"
                          ? "bg-amber-50 text-amber-900 border border-amber-300"
                          : "bg-emerald-50 text-emerald-900 border border-emerald-200"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {profile.constraints_status === "pending_doctor_review"
                          ? "schedule"
                          : "verified_user"}
                      </span>
                      <span>
                        {profile.constraints_status === "pending_doctor_review"
                          ? "Chờ bác sĩ duyệt dinh dưỡng"
                          : "Hồ sơ y khoa đã xác nhận"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vitals & Health Gauge Card */}
              <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">
                        monitor_heart
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-on-surface">
                      Chỉ số Thể trạng & Sinh hiệu
                    </h3>
                  </div>
                  <Link
                    href="/patient/history"
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
                  >
                    Chi tiết →
                  </Link>
                </div>

                {/* Visual BMI Gauge */}
                <div className={`p-4 rounded-xl border ${bmiCategory.bgClass} ${bmiCategory.borderClass} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                        Chỉ số khối cơ thể (BMI)
                      </p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-3xl font-extrabold text-on-surface">
                          {previewBmi != null ? previewBmi : "—"}
                        </span>
                        <span className="text-xs text-on-surface-variant">kg/m²</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${bmiCategory.badgeClass}`}>
                      {bmiCategory.label}
                    </span>
                  </div>

                  {/* Segmented Color Gauge */}
                  <div className="space-y-1.5">
                    <div className="relative h-3 w-full rounded-full bg-slate-200 overflow-hidden flex">
                      <div className="w-[30%] bg-sky-400" title="Thiếu cân (<18.5)" />
                      <div className="w-[35%] bg-emerald-500" title="Chuẩn (18.5-22.9)" />
                      <div className="w-[15%] bg-amber-400" title="Tiền béo phì (23-24.9)" />
                      <div className="w-[20%] bg-rose-500" title="Béo phì (≥25)" />
                    </div>
                    <div className="flex justify-between text-[10px] text-on-surface-variant font-medium">
                      <span>&lt;18.5</span>
                      <span>18.5 - 22.9</span>
                      <span>23 - 24.9</span>
                      <span>≥25</span>
                    </div>
                  </div>
                </div>

                {/* 2x2 Mini Vitals Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Weight */}
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                    <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        scale
                      </span>
                      <span>Cân nặng</span>
                    </div>
                    {editing && form ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={form.weight}
                          onChange={(e) => setForm({ ...form, weight: e.target.value })}
                          className="w-full bg-white border border-outline-variant rounded-lg px-2 py-1 text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                        />
                        <span className="text-xs text-on-surface-variant font-semibold">kg</span>
                      </div>
                    ) : (
                      <p className="text-lg font-bold text-on-surface">
                        {profile.weight ? `${profile.weight} kg` : "—"}
                      </p>
                    )}
                  </div>

                  {/* Height */}
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                    <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        straighten
                      </span>
                      <span>Chiều cao</span>
                    </div>
                    {editing && form ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          value={form.height}
                          onChange={(e) => setForm({ ...form, height: e.target.value })}
                          className="w-full bg-white border border-outline-variant rounded-lg px-2 py-1 text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                        />
                        <span className="text-xs text-on-surface-variant font-semibold">cm</span>
                      </div>
                    ) : (
                      <p className="text-lg font-bold text-on-surface">
                        {profile.height ? `${profile.height} cm` : "—"}
                      </p>
                    )}
                  </div>

                  {/* Blood Pressure */}
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                    <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
                      <span className="material-symbols-outlined text-[16px] text-rose-600">
                        cardiology
                      </span>
                      <span>Huyết áp</span>
                    </div>
                    {editing && form ? (
                      <input
                        type="text"
                        placeholder="120/80"
                        value={form.bloodPressure}
                        onChange={(e) => setForm({ ...form, bloodPressure: e.target.value })}
                        className="w-full bg-white border border-outline-variant rounded-lg px-2 py-1 text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                      />
                    ) : (
                      <p className="text-lg font-bold text-on-surface">
                        {profile.blood_pressure ? `${profile.blood_pressure} mmHg` : "—"}
                      </p>
                    )}
                  </div>

                  {/* Blood Glucose */}
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                    <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
                      <span className="material-symbols-outlined text-[16px] text-amber-600">
                        bloodtype
                      </span>
                      <span>Đường huyết</span>
                    </div>
                    {editing && form ? (
                      <input
                        type="text"
                        placeholder="125 mg/dL"
                        value={form.bloodGlucose}
                        onChange={(e) => setForm({ ...form, bloodGlucose: e.target.value })}
                        className="w-full bg-white border border-outline-variant rounded-lg px-2 py-1 text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                      />
                    ) : (
                      <p className="text-lg font-bold text-on-surface truncate">
                        {profile.blood_glucose || "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* RIGHT COLUMN: BENTO CARDS (8 COLS)                        */}
            {/* ======================================================== */}
            <div className="lg:col-span-8 space-y-6">
              {/* CARD 1: CLINICAL PROFILE & MEDICATION SAFETY */}
              <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-outline-variant/50 pb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">
                      clinical_notes
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">
                      Hồ sơ Lâm sàng & An toàn Dược lý
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Các chẩn đoán bệnh lý, danh sách thuốc và kiêng kỵ dị ứng của bạn.
                    </p>
                  </div>
                </div>

                {/* Disease Conditions */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span>Bệnh lý nền</span>
                    {editing && <span className="text-rose-500">*</span>}
                  </label>

                  {editing && form ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {diagnosisOptions.map((opt) => {
                        const isSelected = form.diseaseCodes.includes(opt.code);
                        return (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => toggleDisease(opt.code)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-primary text-on-primary border-primary shadow-xs"
                                : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/60"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {isSelected ? "check_circle" : "add_circle"}
                            </span>
                            {opt.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {profile.disease.length === 0 ? (
                        <span className="text-sm text-on-surface-variant italic">
                          Chưa cập nhật bệnh lý nền
                        </span>
                      ) : (
                        profile.disease.map((code) => {
                          const fromCatalog = catalog?.diagnoses.find(
                            (d) => d.code === code
                          );
                          return (
                            <span
                              key={code}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-900 border border-teal-200 flex items-center gap-1.5"
                            >
                              <span className="w-2 h-2 rounded-full bg-teal-600" />
                              {fromCatalog?.name ?? diseaseCodeToLabel(code)}
                            </span>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Medications List */}
                <div className="space-y-2 pt-2 border-t border-outline-variant/40">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      medication
                    </span>
                    <span>Thuốc đang sử dụng</span>
                  </label>

                  {editing && form ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={medSearch}
                          onChange={(e) => setMedSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const trimmed = medSearch.trim();
                              if (trimmed && !form.medications.includes(trimmed)) {
                                setForm({
                                  ...form,
                                  medications: [...form.medications, trimmed],
                                });
                                setMedSearch("");
                              }
                            }
                          }}
                          placeholder="Nhập tên thuốc (ví dụ: Metformin, Amlodipine) và nhấn Enter..."
                          className="flex-1 px-3.5 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = medSearch.trim();
                            if (trimmed && !form.medications.includes(trimmed)) {
                              setForm({
                                ...form,
                                medications: [...form.medications, trimmed],
                              });
                              setMedSearch("");
                            }
                          }}
                          className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shrink-0"
                        >
                          Thêm thuốc
                        </button>
                      </div>

                      {/* Catalog Suggestions */}
                      {catalog?.medicines && medSearch.trim() && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[11px] text-on-surface-variant self-center mr-1">
                            Gợi ý danh mục:
                          </span>
                          {visibleCatalog(catalog.medicines, medSearch, form.medications).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                toggleListItem("medications", m.name);
                                setMedSearch("");
                              }}
                              className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-900 rounded-lg text-xs font-medium hover:bg-teal-100"
                            >
                              + {m.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Selected Meds Pills */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {form.medications.map((med) => (
                          <span
                            key={med}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-surface-container-lowest border border-outline-variant shadow-2xs"
                          >
                            <span>{med}</span>
                            <button
                              type="button"
                              onClick={() => toggleListItem("medications", med)}
                              className="hover:text-rose-600 font-bold ml-1 text-sm leading-none"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {profile.medications.length === 0 ? (
                        <span className="text-sm text-on-surface-variant italic">
                          Chưa ghi nhận thuốc điều trị
                        </span>
                      ) : (
                        profile.medications.map((med) => (
                          <span
                            key={med}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-container-low text-on-surface border border-outline-variant/80"
                          >
                            <span className="material-symbols-outlined text-[15px] text-primary">
                              pill
                            </span>
                            {med}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Allergies & Intolerances */}
                <div className="space-y-2 pt-2 border-t border-outline-variant/40">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-rose-600">
                      warning_amber
                    </span>
                    <span>Dị ứng & Kiêng kỵ thực phẩm</span>
                  </label>

                  {editing && form ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={allergySearch}
                          onChange={(e) => setAllergySearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const trimmed = allergySearch.trim();
                              if (trimmed && !form.allergies.includes(trimmed)) {
                                setForm({
                                  ...form,
                                  allergies: [...form.allergies, trimmed],
                                });
                                setAllergySearch("");
                              }
                            }
                          }}
                          placeholder="Nhập dị ứng (Hải sản, Đậu phộng...) và nhấn Enter..."
                          className="flex-1 px-3.5 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = allergySearch.trim();
                            if (trimmed && !form.allergies.includes(trimmed)) {
                              setForm({
                                ...form,
                                allergies: [...form.allergies, trimmed],
                              });
                              setAllergySearch("");
                            }
                          }}
                          className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl shrink-0"
                        >
                          Thêm dị ứng
                        </button>
                      </div>

                      {/* Common Allergies Quick Toggle */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[11px] text-on-surface-variant self-center mr-1">
                          Phổ biến:
                        </span>
                        {COMMON_ALLERGIES.map((a) => {
                          const has = form.allergies.includes(a);
                          return (
                            <button
                              key={a}
                              type="button"
                              onClick={() => toggleListItem("allergies", a)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                has
                                  ? "bg-rose-100 text-rose-900 border-rose-300"
                                  : "bg-surface-container-low text-on-surface-variant border-outline-variant/60 hover:border-rose-300"
                              }`}
                            >
                              {has ? "✓ " : "+ "}
                              {a}
                            </button>
                          );
                        })}
                      </div>

                      {/* Selected Allergies */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {form.allergies.map((a) => (
                          <span
                            key={a}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-900 border border-rose-200"
                          >
                            <span>{a}</span>
                            <button
                              type="button"
                              onClick={() => toggleListItem("allergies", a)}
                              className="hover:text-rose-950 font-bold ml-1 text-sm leading-none"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {profile.allergies.length === 0 ? (
                        <span className="text-sm text-on-surface-variant italic">
                          Không ghi nhận dị ứng thực phẩm
                        </span>
                      ) : (
                        profile.allergies.map((a) => (
                          <span
                            key={a}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200"
                          >
                            <span className="material-symbols-outlined text-[15px] text-rose-600">
                              shield_with_heart
                            </span>
                            {a}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 2: NUTRITION TARGETS & TREATMENT GOALS */}
              <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-outline-variant/50 pb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">
                      restaurant
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">
                      Kế hoạch Dinh dưỡng & Mục tiêu Điều trị
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Chỉ tiêu Calo, hạn ngạch Carb/Muối và định hướng lối sống.
                    </p>
                  </div>
                </div>

                {/* Treatment Goals */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    Mục tiêu điều trị ưu tiên
                  </label>

                  {editing && form ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {TREATMENT_GOAL_OPTIONS.map((goal) => {
                          const isSelected = form.selectedGoals.includes(goal);
                          return (
                            <button
                              key={goal}
                              type="button"
                              onClick={() => toggleGoal(goal)}
                              className={`p-3 text-left rounded-xl border text-xs font-medium transition-all flex items-start gap-2.5 ${
                                isSelected
                                  ? "bg-teal-50/80 border-teal-500 text-teal-950 shadow-2xs font-semibold"
                                  : "bg-surface-container-low border-outline-variant/70 text-on-surface hover:border-teal-300"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px] text-teal-700 shrink-0">
                                {isSelected ? "check_box" : "check_box_outline_blank"}
                              </span>
                              <span>{goal}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Goal Input */}
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={customGoalInput}
                          onChange={(e) => setCustomGoalInput(e.target.value)}
                          placeholder="Thêm mục tiêu điều trị khác..."
                          className="flex-1 px-3.5 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomGoal}
                          className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-xl shrink-0"
                        >
                          Thêm mục tiêu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {!(profile.treatment_goals?.length) ? (
                        <p className="text-sm text-on-surface-variant italic">
                          Chưa chọn mục tiêu điều trị
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {profile.treatment_goals.map((g) => (
                            <div
                              key={g}
                              className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 flex items-start gap-2.5 text-xs text-on-surface font-medium"
                            >
                              <span className="material-symbols-outlined text-[18px] text-teal-700 shrink-0">
                                check_circle
                              </span>
                              <span>{g}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Target Calories & Smart Suggestions */}
                <div className="pt-3 border-t border-outline-variant/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-teal-50/70 border border-teal-200 rounded-2xl">
                    <div>
                      <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                        Năng lượng mục tiêu (Target Kcal)
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        {editing && form ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={800}
                              max={5000}
                              step={50}
                              value={form.targetKcalInput}
                              onChange={(e) =>
                                setForm({ ...form, targetKcalInput: e.target.value })
                              }
                              className="w-32 px-3 py-1.5 bg-white border border-teal-300 rounded-xl text-xl font-black text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            <span className="text-sm font-bold text-teal-900">
                              kcal / ngày
                            </span>
                          </div>
                        ) : (
                          <>
                            <span className="text-3xl font-black text-teal-950">
                              {profile.target_kcal.toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-teal-800">
                              kcal / ngày
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* AI Smart Suggestion pill */}
                    <div className="text-xs text-teal-900 bg-white/80 p-3 rounded-xl border border-teal-300/80 shadow-2xs max-w-sm">
                      <div className="flex items-center gap-1.5 font-bold text-teal-800 mb-0.5">
                        <span className="material-symbols-outlined text-[16px] text-teal-600">
                          auto_awesome
                        </span>
                        <span>Khuyến nghị từ AI Dinh dưỡng:</span>
                      </div>
                      <p className="text-[11px] text-teal-950">
                        Dựa trên BMI {previewBmi ?? "—"} và bệnh lý:{" "}
                        <strong className="font-bold text-teal-900">
                          {suggestedKcal} kcal/ngày
                        </strong>
                      </p>
                      {editing && form && form.targetKcalInput !== String(suggestedKcal) && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ ...form, targetKcalInput: String(suggestedKcal) })
                          }
                          className="mt-2 text-[11px] font-bold text-white bg-teal-700 hover:bg-teal-800 px-3 py-1 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          Áp dụng gợi ý này
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Macros & Restrictions Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {/* Carb per meal */}
                    <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                      <span className="text-[11px] text-on-surface-variant font-medium block mb-1">
                        Carb / bữa (g)
                      </span>
                      {editing && form ? (
                        <input
                          type="number"
                          placeholder="60"
                          value={form.carbPerMeal}
                          onChange={(e) =>
                            setForm({ ...form, carbPerMeal: e.target.value })
                          }
                          className="w-full bg-white border border-outline-variant rounded-lg px-2 py-1 text-sm font-bold text-on-surface"
                        />
                      ) : (
                        <p className="text-base font-bold text-on-surface">
                          {profile.restrictions?.carb_per_meal != null
                            ? `${profile.restrictions.carb_per_meal} g`
                            : "—"}
                        </p>
                      )}
                    </div>

                    {/* Sodium daily */}
                    <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                      <span className="text-[11px] text-on-surface-variant font-medium block mb-1">
                        Natri / ngày (mg)
                      </span>
                      {editing && form ? (
                        <input
                          type="number"
                          placeholder="2000"
                          value={form.sodiumDaily}
                          onChange={(e) =>
                            setForm({ ...form, sodiumDaily: e.target.value })
                          }
                          className="w-full bg-white border border-outline-variant rounded-lg px-2 py-1 text-sm font-bold text-on-surface"
                        />
                      ) : (
                        <p className="text-base font-bold text-on-surface">
                          {profile.restrictions?.sodium_daily != null
                            ? `${profile.restrictions.sodium_daily} mg`
                            : "—"}
                        </p>
                      )}
                    </div>

                    {/* Salt daily (Doctor prescribed) */}
                    <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                      <span className="text-[11px] text-on-surface-variant font-medium block mb-1">
                        Muối / ngày (BS đặt)
                      </span>
                      <p className="text-base font-bold text-on-surface">
                        {profile.restrictions?.salt_daily_g != null
                          ? `${profile.restrictions.salt_daily_g} g`
                          : "—"}
                      </p>
                    </div>

                    {/* Sugar daily (Doctor prescribed) */}
                    <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                      <span className="text-[11px] text-on-surface-variant font-medium block mb-1">
                        Đường / ngày (BS đặt)
                      </span>
                      <p className="text-base font-bold text-on-surface">
                        {profile.restrictions?.sugar_daily_g != null
                          ? `${profile.restrictions.sugar_daily_g} g`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Dietary Preferences */}
                  <div className="pt-2 space-y-1.5">
                    <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                      Sở thích & Khẩu vị ăn uống
                    </label>
                    {editing && form ? (
                      <textarea
                        rows={2}
                        value={form.preferencesText}
                        onChange={(e) =>
                          setForm({ ...form, preferencesText: e.target.value })
                        }
                        placeholder="Ví dụ: Thích ăn cá, thích canh rau ngót, ăn nhạt, khẩu vị miền Trung..."
                        className="w-full px-3.5 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {profile.preferences.length === 0 ? (
                          <span className="text-sm text-on-surface-variant italic">
                            Chưa cập nhật sở thích ẩm thực
                          </span>
                        ) : (
                          profile.preferences.map((p) => (
                            <span
                              key={p}
                              className="px-3 py-1 rounded-full text-xs font-medium bg-surface-container-low border border-outline-variant/70 text-on-surface"
                            >
                              {p}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CARD 3: CONTACT & ACCOUNT INFO */}
              <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-outline-variant/50 pb-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">
                      contact_phone
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">
                      Thông tin Liên hệ & Hành chính
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Số điện thoại và địa chỉ nhận hỗ trợ y tế.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant mb-1 block">
                      Số điện thoại
                    </label>
                    {editing && form ? (
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="0912 345 678"
                        className="w-full px-3.5 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-on-surface">
                        {profile.phone || "—"}
                      </p>
                    )}
                  </div>

                  {/* Address */}
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant mb-1 block">
                      Địa chỉ cư trú
                    </label>
                    {editing && form ? (
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Quận/Huyện, Tỉnh/Thành phố..."
                        className="w-full px-3.5 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-on-surface">
                        {profile.address || "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* STICKY BOTTOM ACTION BAR IN EDIT MODE                    */}
      {/* ======================================================== */}
      {editing && form && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-outline-variant px-4 py-3 shadow-lg flex items-center justify-between gap-4 max-w-7xl mx-auto md:px-8">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant hidden sm:flex">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Đang ở chế độ chỉnh sửa hồ sơ. Hãy lưu thay đổi khi hoàn tất.</span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={cancelEditing}
              className="px-4 py-2 bg-surface-container-low hover:bg-surface-variant text-on-surface font-semibold text-xs rounded-xl border border-outline-variant transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                  Đang lưu...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  Lưu hồ sơ sức khỏe
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* AVATAR SELECTOR & UPLOADER MODAL                         */}
      {/* ======================================================== */}
      {avatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-outline-variant rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">
                  account_circle
                </span>
                <h3 className="text-base font-bold text-on-surface">
                  Chọn ảnh đại diện
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAvatarModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {avatarUploadError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{avatarUploadError}</span>
              </div>
            )}

            {/* Upload from Local Computer */}
            <div className="p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-center space-y-2">
              <span className="material-symbols-outlined text-[32px] text-primary">
                cloud_upload
              </span>
              <div>
                <p className="text-xs font-bold text-on-surface">
                  Tải ảnh từ máy tính / điện thoại
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Định dạng JPG, PNG hoặc WebP (Tối đa 4MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-xs hover:bg-primary-container transition-colors cursor-pointer"
              >
                Chọn tệp ảnh
              </button>
            </div>

            {/* Preset Avatars Grid */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Hoặc chọn mẫu Avatar có sẵn
              </p>
              <div className="grid grid-cols-3 gap-3">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPresetAvatar(preset.svgDataUri)}
                    className="p-2.5 rounded-xl border border-outline-variant hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-2 group cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all">
                      <img
                        src={preset.svgDataUri}
                        alt={preset.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-on-surface truncate max-w-full">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Reset button */}
            <div className="flex items-center justify-between pt-3 border-t border-outline-variant/60">
              <button
                type="button"
                onClick={handleResetAvatar}
                className="text-xs text-on-surface-variant hover:text-rose-600 font-semibold"
              >
                Đặt lại avatar mặc định
              </button>
              <button
                type="button"
                onClick={() => setAvatarModalOpen(false)}
                className="px-4 py-2 bg-surface-container-low text-on-surface font-semibold text-xs rounded-xl hover:bg-surface-variant"
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
