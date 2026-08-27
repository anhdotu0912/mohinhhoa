/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
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
  firstFieldError,
  sanitizeBloodGlucoseInput,
  sanitizeBloodPressureInput,
  validateBloodGlucose,
  validateBloodPressure,
  validatePositiveNumber,
} from "@/lib/profile-validation";
import {
  ApiError,
  type CatalogItem,
  type CatalogOut,
  type PatientProfile,
  type ProfileUpsert,
  type UserMeResponse,
} from "@/lib/types";

type MetricField = "weight" | "height" | "bloodPressure" | "bloodGlucose";
type MetricFieldErrors = Partial<Record<MetricField, string>>;

function MetricFieldHint({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[11px] text-rose-600 mt-1 font-medium leading-snug">
      {message}
    </p>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggleVisible,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  visible: boolean;
  onToggleVisible: () => void;
  error?: string;
  placeholder: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-bold text-on-surface-variant mb-1 block">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={8}
          maxLength={128}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full px-3.5 py-2 pr-11 bg-surface-container-low border rounded-xl text-xs text-on-surface focus:outline-none ${
            error
              ? "border-rose-400 focus:border-rose-500"
              : "border-outline-variant focus:border-primary"
          }`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface rounded-lg cursor-pointer"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          <span className="material-symbols-outlined text-[18px]">
            {visible ? "visibility_off" : "visibility"}
          </span>
        </button>
      </div>
      <MetricFieldHint id={errorId} message={error} />
    </div>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearFieldError = (key: "current" | "next" | "confirm") => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    const nextErrors: { current?: string; next?: string; confirm?: string } = {};
    if (!currentPassword) {
      nextErrors.current = "Nhập mật khẩu hiện tại.";
    }
    if (newPassword.length < 8) {
      nextErrors.next = "Mật khẩu mới tối thiểu 8 ký tự.";
    } else if (currentPassword && newPassword === currentPassword) {
      nextErrors.next = "Mật khẩu mới phải khác mật khẩu hiện tại.";
    }
    if (!confirmPassword) {
      nextErrors.confirm = "Nhập lại mật khẩu mới.";
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirm = "Mật khẩu xác nhận không khớp.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setSuccess(res.message);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Không đổi được mật khẩu. Thử lại sau."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2 border-b border-outline-variant/50 pb-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
          <span className="material-symbols-outlined text-[22px]">lock</span>
        </div>
        <div>
          <h3 className="text-base font-bold text-on-surface">Bảo mật tài khoản</h3>
          <p className="text-xs text-on-surface-variant">
            Đổi mật khẩu đăng nhập. Mật khẩu mới tối thiểu 8 ký tự.
          </p>
        </div>
      </div>

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-900 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-emerald-600 text-[18px]">
            check_circle
          </span>
          <span>{success}</span>
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50/90 px-3.5 py-2.5 text-xs text-rose-900 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-rose-600 text-[18px]">error</span>
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
        <PasswordField
          id="profile-current-password"
          label="Mật khẩu hiện tại"
          value={currentPassword}
          onChange={(v) => {
            setCurrentPassword(v);
            clearFieldError("current");
            setFormError(null);
            setSuccess(null);
          }}
          autoComplete="current-password"
          visible={showCurrent}
          onToggleVisible={() => setShowCurrent((v) => !v)}
          error={fieldErrors.current}
          placeholder="Nhập mật khẩu đang dùng"
        />
        <div className="grid grid-cols-1 gap-3.5">
          <PasswordField
            id="profile-new-password"
            label="Mật khẩu mới"
            value={newPassword}
            onChange={(v) => {
              setNewPassword(v);
              clearFieldError("next");
              setFormError(null);
              setSuccess(null);
            }}
            autoComplete="new-password"
            visible={showNew}
            onToggleVisible={() => setShowNew((v) => !v)}
            error={fieldErrors.next}
            placeholder="Tối thiểu 8 ký tự"
          />
          <PasswordField
            id="profile-confirm-password"
            label="Xác nhận mật khẩu mới"
            value={confirmPassword}
            onChange={(v) => {
              setConfirmPassword(v);
              clearFieldError("confirm");
              setFormError(null);
              setSuccess(null);
            }}
            autoComplete="new-password"
            visible={showConfirm}
            onToggleVisible={() => setShowConfirm((v) => !v)}
            error={fieldErrors.confirm}
            placeholder="Nhập lại mật khẩu mới"
          />
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-bold py-2.5 px-5 rounded-xl hover:bg-primary-container transition-all shadow-xs text-sm cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
                Đang đổi mật khẩu...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">key</span>
                Đổi mật khẩu
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

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
  badgeClass: string;
  markerClass: string;
} {
  if (bmi === null || bmi <= 0) {
    return {
      label: "Chưa có dữ liệu",
      status: "normal",
      badgeClass: "bg-surface-container-low text-on-surface-variant border-outline-variant",
      markerClass: "bg-on-surface-variant",
    };
  }
  if (bmi < 18.5) {
    return {
      label: "Thiếu cân",
      status: "underweight",
      badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
      markerClass: "bg-slate-500",
    };
  }
  if (bmi <= 22.9) {
    return {
      label: "Chuẩn sức khỏe (WPRO)",
      status: "normal",
      badgeClass: "bg-primary/10 text-primary border-primary/25",
      markerClass: "bg-primary",
    };
  }
  if (bmi <= 24.9) {
    return {
      label: "Tiền béo phì",
      status: "overweight",
      badgeClass: "bg-amber-50 text-amber-900 border-amber-200/70",
      markerClass: "bg-amber-600",
    };
  }
  return {
    label: "Béo phì",
    status: "obese",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200/70",
    markerClass: "bg-rose-600",
  };
}

/** Map WPRO BMI bands onto a 0–100 track (12–35 scale). */
function bmiMarkerPercent(bmi: number | null): number | null {
  if (bmi == null || bmi <= 0) return null;
  let pct: number;
  if (bmi < 18.5) {
    pct = (Math.max(bmi, 12) / 18.5) * 30;
  } else if (bmi <= 22.9) {
    pct = 30 + ((bmi - 18.5) / (22.9 - 18.5)) * 35;
  } else if (bmi <= 24.9) {
    pct = 65 + ((bmi - 23) / (24.9 - 23)) * 15;
  } else {
    const capped = Math.min(bmi, 35);
    pct = 80 + ((capped - 25) / 10) * 20;
  }
  return Math.min(100, Math.max(2, pct));
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Edit form state
  const [form, setForm] = useState<EditFormState | null>(null);
  const [allergySearch, setAllergySearch] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [customGoalInput, setCustomGoalInput] = useState("");
  const [metricErrors, setMetricErrors] = useState<MetricFieldErrors>({});

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

      setUserProfile({
        avatar: userData.avatar ?? null,
        displayName: userData.full_name?.trim() || userData.email,
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không tải được hồ sơ bệnh nhân."
      );
    } finally {
      setLoading(false);
    }
  }, [setUserProfile]);

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

  const bmiMarkerPct = useMemo(() => bmiMarkerPercent(previewBmi), [previewBmi]);

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
    setMetricErrors({});
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
    setMetricErrors({});
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

  // Avatar file upload handler — persist via POST /auth/me/avatar
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarUploadError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setAvatarUploadError("Ảnh tối đa 2MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarUploadError("Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF).");
      return;
    }

    setUploadingAvatar(true);
    try {
      const out = await api.uploadMyAvatar(file);
      setUserProfile({ avatar: out.avatar });
      setUser((prev) => (prev ? { ...prev, avatar: out.avatar } : prev));
      setAvatarModalOpen(false);
      setSaveNotice("Đã cập nhật ảnh đại diện thành công.");
    } catch (err) {
      setAvatarUploadError(
        err instanceof ApiError ? err.message : "Không tải được ảnh đại diện."
      );
    } finally {
      setUploadingAvatar(false);
    }
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

  const setMetricError = (name: MetricField, message: string | null) => {
    setMetricErrors((prev) => {
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  };

  const collectMetricErrors = (f: EditFormState): MetricFieldErrors => {
    const next: MetricFieldErrors = {};
    const weightErr = validatePositiveNumber(f.weight, 20, 300, "Cân nặng");
    if (weightErr) next.weight = weightErr;
    const heightErr = validatePositiveNumber(f.height, 80, 250, "Chiều cao");
    if (heightErr) next.height = heightErr;
    const bpErr = validateBloodPressure(f.bloodPressure);
    if (bpErr) next.bloodPressure = bpErr;
    const glucoseErr = validateBloodGlucose(f.bloodGlucose);
    if (glucoseErr) next.bloodGlucose = glucoseErr;
    return next;
  };

  const validateForm = (): string | null => {
    if (!form) return "Form không hợp lệ.";
    const ageNum = Number(form.age);
    if (!form.age || !Number.isFinite(ageNum) || ageNum <= 0 || ageNum > 130) {
      return "Nhập tuổi hợp lệ (1–130).";
    }
    if (!form.gender.trim()) return "Chọn giới tính.";
    const metricErrs = collectMetricErrors(form);
    setMetricErrors(metricErrs);
    const firstMetric = firstFieldError(metricErrs);
    if (firstMetric) return firstMetric;
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
      setMetricErrors({});
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
              <div className="bg-white border border-outline-variant rounded-2xl p-6 h-40 animate-pulse" />
              <div className="bg-white border border-outline-variant rounded-2xl p-6 h-52 animate-pulse" />
            </div>
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border border-outline-variant rounded-2xl p-6 h-64 animate-pulse" />
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
            {/* LEFT COLUMN: IDENTITY, CONTACT & SECURITY (4 COLS)     */}
            {/* ======================================================== */}
            <div className="lg:col-span-4 space-y-6">
              {/* Profile Identity Card */}
              <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs relative overflow-hidden">
                {/* Decorative background aura */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-primary/5 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

                <div className="flex flex-col items-center text-center">
                  {/* Avatar with Upload & Glow */}
                  <div className="relative group mb-4 overflow-visible">
                    <div className="relative w-28 h-28 rounded-full ring-4 ring-primary/20 p-1 bg-white shadow-md overflow-hidden">
                      <div
                        translate="no"
                        className="absolute inset-1 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold"
                      >
                        {profileInitials}
                      </div>
                      {currentAvatar ? (
                        <img
                          key={currentAvatar}
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
                      className="absolute bottom-1 right-1 z-20 w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-white"
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

                <div className="grid grid-cols-1 gap-4">
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

              <ChangePasswordCard />
            </div>

            {/* ======================================================== */}
            {/* RIGHT COLUMN: VITALS, CLINICAL & NUTRITION (8 COLS)     */}
            {/* ======================================================== */}
            <div className="lg:col-span-8 space-y-6">
              {/* Vitals & Health Gauge Card */}
              <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-outline-variant/50 pb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-surface-container-low text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">
                      monitor_heart
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-on-surface">
                    Chỉ số Thể trạng & Sinh hiệu
                  </h3>
                </div>

                {/* BMI readout + quiet track */}
                <div className="p-4 rounded-xl border border-outline-variant bg-surface-container-low space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-on-surface-variant">
                        Chỉ số khối cơ thể (BMI)
                      </p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-3xl font-extrabold text-on-surface tabular-nums">
                          {previewBmi != null ? previewBmi : "—"}
                        </span>
                        <span className="text-xs text-on-surface-variant">kg/m²</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${bmiCategory.badgeClass}`}>
                      {bmiCategory.label}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div
                      className="relative h-2 w-full rounded-full bg-outline-variant/50"
                      role="meter"
                      aria-label="BMI trên thang WPRO"
                      aria-valuemin={12}
                      aria-valuemax={35}
                      aria-valuenow={previewBmi ?? undefined}
                      aria-valuetext={bmiCategory.label}
                    >
                      {bmiMarkerPct != null ? (
                        <span
                          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-xs ${bmiCategory.markerClass}`}
                          style={{ left: `${bmiMarkerPct}%` }}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className="flex justify-between text-[10px] text-on-surface-variant font-medium">
                      <span>&lt;18.5</span>
                      <span>18.5 - 22.9</span>
                      <span>23 - 24.9</span>
                      <span>≥25</span>
                    </div>
                  </div>
                </div>

                {/* Vitals fields */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                          min={20}
                          max={300}
                          inputMode="decimal"
                          value={form.weight}
                          onChange={(e) => {
                            setForm({ ...form, weight: e.target.value });
                            setMetricError("weight", null);
                          }}
                          onBlur={(e) =>
                            setMetricError(
                              "weight",
                              validatePositiveNumber(e.target.value, 20, 300, "Cân nặng")
                            )
                          }
                          aria-invalid={Boolean(metricErrors.weight)}
                          aria-describedby={
                            metricErrors.weight ? "profile-weight-error" : undefined
                          }
                          className={`w-full bg-white border rounded-lg px-2 py-1 text-sm font-bold text-on-surface focus:outline-none ${
                            metricErrors.weight
                              ? "border-rose-400 focus:border-rose-500"
                              : "border-outline-variant focus:border-primary"
                          }`}
                        />
                        <span className="text-xs text-on-surface-variant font-semibold">kg</span>
                      </div>
                    ) : (
                      <p className="text-lg font-bold text-on-surface">
                        {profile.weight ? `${profile.weight} kg` : "—"}
                      </p>
                    )}
                    {editing && (
                      <MetricFieldHint
                        id="profile-weight-error"
                        message={metricErrors.weight}
                      />
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
                          min={80}
                          max={250}
                          inputMode="decimal"
                          value={form.height}
                          onChange={(e) => {
                            setForm({ ...form, height: e.target.value });
                            setMetricError("height", null);
                          }}
                          onBlur={(e) =>
                            setMetricError(
                              "height",
                              validatePositiveNumber(e.target.value, 80, 250, "Chiều cao")
                            )
                          }
                          aria-invalid={Boolean(metricErrors.height)}
                          aria-describedby={
                            metricErrors.height ? "profile-height-error" : undefined
                          }
                          className={`w-full bg-white border rounded-lg px-2 py-1 text-sm font-bold text-on-surface focus:outline-none ${
                            metricErrors.height
                              ? "border-rose-400 focus:border-rose-500"
                              : "border-outline-variant focus:border-primary"
                          }`}
                        />
                        <span className="text-xs text-on-surface-variant font-semibold">cm</span>
                      </div>
                    ) : (
                      <p className="text-lg font-bold text-on-surface">
                        {profile.height ? `${profile.height} cm` : "—"}
                      </p>
                    )}
                    {editing && (
                      <MetricFieldHint
                        id="profile-height-error"
                        message={metricErrors.height}
                      />
                    )}
                  </div>

                  {/* Blood Pressure */}
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                    <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        cardiology
                      </span>
                      <span>Huyết áp</span>
                    </div>
                    {editing && form ? (
                      <>
                        <input
                          type="text"
                          placeholder="120/80"
                          value={form.bloodPressure}
                          onChange={(e) => {
                            setForm({
                              ...form,
                              bloodPressure: sanitizeBloodPressureInput(e.target.value),
                            });
                            setMetricError("bloodPressure", null);
                          }}
                          onBlur={(e) =>
                            setMetricError(
                              "bloodPressure",
                              validateBloodPressure(e.target.value)
                            )
                          }
                          maxLength={20}
                          aria-invalid={Boolean(metricErrors.bloodPressure)}
                          aria-describedby={
                            metricErrors.bloodPressure ? "profile-bp-error" : undefined
                          }
                          className={`w-full bg-white border rounded-lg px-2 py-1 text-sm font-bold text-on-surface focus:outline-none ${
                            metricErrors.bloodPressure
                              ? "border-rose-400 focus:border-rose-500"
                              : "border-outline-variant focus:border-primary"
                          }`}
                        />
                        <MetricFieldHint
                          id="profile-bp-error"
                          message={metricErrors.bloodPressure}
                        />
                      </>
                    ) : (
                      <p className="text-lg font-bold text-on-surface">
                        {profile.blood_pressure ? `${profile.blood_pressure} mmHg` : "—"}
                      </p>
                    )}
                  </div>

                  {/* Blood Glucose */}
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
                    <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        bloodtype
                      </span>
                      <span>Đường huyết</span>
                    </div>
                    {editing && form ? (
                      <>
                        <input
                          type="text"
                          placeholder="125 mg/dL"
                          value={form.bloodGlucose}
                          onChange={(e) => {
                            setForm({
                              ...form,
                              bloodGlucose: sanitizeBloodGlucoseInput(e.target.value),
                            });
                            setMetricError("bloodGlucose", null);
                          }}
                          onBlur={(e) =>
                            setMetricError(
                              "bloodGlucose",
                              validateBloodGlucose(e.target.value)
                            )
                          }
                          maxLength={24}
                          aria-invalid={Boolean(metricErrors.bloodGlucose)}
                          aria-describedby={
                            metricErrors.bloodGlucose
                              ? "profile-glucose-error"
                              : undefined
                          }
                          className={`w-full bg-white border rounded-lg px-2 py-1 text-sm font-bold text-on-surface focus:outline-none ${
                            metricErrors.bloodGlucose
                              ? "border-rose-400 focus:border-rose-500"
                              : "border-outline-variant focus:border-primary"
                          }`}
                        />
                        <MetricFieldHint
                          id="profile-glucose-error"
                          message={metricErrors.bloodGlucose}
                        />
                      </>
                    ) : (
                      <p className="text-lg font-bold text-on-surface truncate">
                        {profile.blood_glucose || "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

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
                  Định dạng JPG, PNG, WebP hoặc GIF (Tối đa 2MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-xs hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploadingAvatar ? "Đang tải ảnh..." : "Chọn tệp ảnh"}
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
