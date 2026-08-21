"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
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

function FieldRow({
  label,
  value,
  empty = "—",
}: {
  label: string;
  value: string | number | null | undefined;
  empty?: string;
}) {
  const display =
    value === null || value === undefined || value === "" ? empty : String(value);
  return (
    <div>
      <dt className="font-caption text-caption text-on-surface-variant text-xs mb-0.5">
        {label}
      </dt>
      <dd className="font-body text-body text-on-surface text-sm">{display}</dd>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg shadow-xs">
      <div className="flex items-center justify-between gap-md mb-md">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary text-[22px]">
            {icon}
          </span>
          <h2 className="font-h2 text-h2 text-on-surface font-bold text-base">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function PatientProfilePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);

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
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không tải được hồ sơ bệnh nhân."
      );
    } finally {
      setLoading(false);
    }
  }, []);

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

  const previewBmi = useMemo(() => {
    if (!form) return profile?.bmi ?? null;
    const w = Number(form.weight);
    const h = Number(form.height);
    if (!w || !h || w <= 0 || h <= 0) return null;
    return calcBmi(w, h);
  }, [form, profile?.bmi]);

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
    return pool.filter((i) => !selected.includes(i.name)).slice(0, 5);
  };

  const chipClass = (active: boolean) =>
    `px-md py-xs rounded-full text-xs font-medium border transition-colors cursor-pointer ${
      active
        ? "bg-primary text-on-primary border-primary"
        : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary"
    }`;

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
        setSaveNotice("Đã lưu hồ sơ thành công.");
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
      <TopBar title="Hồ sơ bệnh nhân" />
      <main className="flex-1 overflow-y-auto p-md md:p-lg max-w-4xl mx-auto w-full space-y-lg pb-xl">
        {loading ? (
          <div className="text-sm text-on-surface-variant py-xl text-center">
            Đang tải hồ sơ...
          </div>
        ) : !profile ? (
          <div className="rounded-xl border border-error/30 bg-error-container/20 px-md py-sm text-sm text-error">
            {error ?? "Không tải được hồ sơ."}
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md">
              <div>
                <h1 className="font-h1 text-h1 text-on-surface font-bold text-xl">
                  Hồ sơ của tôi
                </h1>
                <p className="font-caption text-caption text-on-surface-variant text-xs mt-xs">
                  Thông tin lâm sàng dùng để cá nhân hóa thực đơn và cảnh báo an toàn.
                </p>
              </div>
              {!editing && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center justify-center gap-xs bg-primary text-on-primary font-body-bold py-sm px-lg rounded-xl hover:bg-primary-container transition-colors shadow-xs text-sm font-bold cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Chỉnh sửa
                </button>
              )}
            </div>

            {isProfileEmpty && !editing && (
              <div className="rounded-xl border border-primary/30 bg-primary-container/10 px-md py-sm text-sm text-on-surface">
                Bạn chưa hoàn tất thiết lập hồ sơ.{" "}
                <Link href="/patient/onboarding" className="text-primary font-semibold hover:underline">
                  Thiết lập hồ sơ lần đầu →
                </Link>
              </div>
            )}

            {saveNotice && (
              <div className="rounded-xl border border-primary/30 bg-primary-container/10 px-md py-sm text-sm text-on-surface">
                {saveNotice}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-error/30 bg-error-container/20 px-md py-sm text-sm text-error">
                {error}
              </div>
            )}

            {profile.constraints_status === "pending_doctor_review" && !editing && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-md py-sm text-sm text-amber-900 flex items-start gap-sm">
                <span className="material-symbols-outlined text-[20px] shrink-0">
                  pending_actions
                </span>
                <span>
                  Ràng buộc dinh dưỡng đang chờ bác sĩ duyệt lại. Bạn vẫn có thể
                  sử dụng ứng dụng bình thường.
                </span>
              </div>
            )}

            {!editing ? (
              <div className="space-y-lg">
                <SectionCard title="Tài khoản" icon="account_circle">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <FieldRow label="Họ tên" value={user?.full_name} />
                    <FieldRow label="Email" value={user?.email ?? email} />
                  </dl>
                </SectionCard>

                <SectionCard title="Thông tin cá nhân" icon="person">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <FieldRow label="Tuổi" value={profile.age} />
                    <FieldRow label="Giới tính" value={profile.gender} />
                    <FieldRow label="Số điện thoại" value={profile.phone} />
                    <FieldRow label="Địa chỉ" value={profile.address} />
                  </dl>
                </SectionCard>

                <SectionCard
                  title="Chỉ số cơ thể"
                  icon="monitor_heart"
                  action={
                    <Link
                      href="/patient/history"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Xem lịch sử chỉ số →
                    </Link>
                  }
                >
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-md">
                    <FieldRow label="Cân nặng (kg)" value={profile.weight} />
                    <FieldRow label="Chiều cao (cm)" value={profile.height} />
                    <FieldRow label="BMI" value={profile.bmi} />
                    <FieldRow label="Huyết áp" value={profile.blood_pressure} />
                    <FieldRow label="Đường huyết" value={profile.blood_glucose} />
                  </dl>
                </SectionCard>

                <SectionCard title="Hồ sơ lâm sàng" icon="clinical_notes">
                  <div className="space-y-md">
                    <div>
                      <p className="font-caption text-caption text-on-surface-variant text-xs mb-xs">
                        Bệnh lý nền
                      </p>
                      <div className="flex flex-wrap gap-xs">
                        {profile.disease.length === 0 ? (
                          <span className="text-sm text-on-surface-variant">—</span>
                        ) : (
                          profile.disease.map((code) => {
                            const fromCatalog = catalog?.diagnoses.find(
                              (d) => d.code === code
                            );
                            return (
                              <span
                                key={code}
                                className="px-md py-xs rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/30"
                              >
                                {fromCatalog?.name ?? diseaseCodeToLabel(code)}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-caption text-caption text-on-surface-variant text-xs mb-xs">
                        Thuốc đang dùng
                      </p>
                      <div className="flex flex-wrap gap-xs">
                        {profile.medications.length === 0 ? (
                          <span className="text-sm text-on-surface-variant">—</span>
                        ) : (
                          profile.medications.map((med) => (
                            <span
                              key={med}
                              className="px-md py-xs rounded-full text-xs font-medium bg-surface-container-low border border-outline-variant"
                            >
                              {med}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-caption text-caption text-on-surface-variant text-xs mb-xs">
                        Dị ứng & kiêng kỵ
                      </p>
                      <div className="flex flex-wrap gap-xs">
                        {profile.allergies.length === 0 ? (
                          <span className="text-sm text-on-surface-variant">—</span>
                        ) : (
                          profile.allergies.map((a) => (
                            <span
                              key={a}
                              className="px-md py-xs rounded-full text-xs font-medium bg-error-container/30 text-error border border-error/20"
                            >
                              {a}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Mục tiêu điều trị & Dinh dưỡng" icon="restaurant">
                  <div className="space-y-md">
                    <div>
                      <p className="font-caption text-caption text-on-surface-variant text-xs mb-xs">
                        Trạng thái ràng buộc
                      </p>
                      <span
                        className={`inline-flex items-center gap-xs px-md py-xs rounded-full text-xs font-semibold ${
                          profile.constraints_status === "pending_doctor_review"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {profile.constraints_status === "pending_doctor_review"
                            ? "schedule"
                            : "verified"}
                        </span>
                        {profile.constraints_status === "pending_doctor_review"
                          ? "Đang chờ bác sĩ duyệt"
                          : "Đã xác nhận"}
                      </span>
                    </div>
                    <div>
                      <p className="font-caption text-caption text-on-surface-variant text-xs mb-xs">
                        Mục tiêu điều trị
                      </p>
                      {!(profile.treatment_goals?.length) ? (
                        <span className="text-sm text-on-surface-variant">—</span>
                      ) : (
                        <ul className="list-disc list-inside text-sm text-on-surface space-y-xs">
                          {profile.treatment_goals!.map((g) => (
                            <li key={g}>{g}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="font-caption text-caption text-on-surface-variant text-xs mb-xs">
                        Sở thích ăn uống
                      </p>
                      {profile.preferences.length === 0 ? (
                        <span className="text-sm text-on-surface-variant">—</span>
                      ) : (
                        <p className="text-sm text-on-surface">
                          {profile.preferences.join(", ")}
                        </p>
                      )}
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                      <FieldRow
                        label="Mục tiêu kcal / ngày"
                        value={profile.target_kcal}
                      />
                      <FieldRow
                        label="Carb / bữa (g)"
                        value={profile.restrictions?.carb_per_meal}
                      />
                      <FieldRow
                        label="Natri / ngày (mg)"
                        value={profile.restrictions?.sodium_daily}
                      />
                      {profile.restrictions?.salt_daily_g != null && (
                        <FieldRow
                          label="Muối / ngày (g) — do bác sĩ đặt"
                          value={profile.restrictions.salt_daily_g}
                        />
                      )}
                      {profile.restrictions?.sugar_daily_g != null && (
                        <FieldRow
                          label="Đường / ngày (g) — do bác sĩ đặt"
                          value={profile.restrictions.sugar_daily_g}
                        />
                      )}
                    </dl>
                  </div>
                </SectionCard>
              </div>
            ) : form ? (
              <div className="space-y-lg">
                <SectionCard title="Thông tin cá nhân" icon="person">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Tuổi <span className="text-error">*</span>
                      </label>
                      <input
                        type="number"
                        value={form.age}
                        onChange={(e) =>
                          setForm({ ...form, age: e.target.value })
                        }
                        min={1}
                        max={130}
                        className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Giới tính <span className="text-error">*</span>
                      </label>
                      <select
                        value={form.gender}
                        onChange={(e) =>
                          setForm({ ...form, gender: e.target.value })
                        }
                        className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      >
                        <option value="" disabled>
                          Chọn giới tính
                        </option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Số điện thoại
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                        className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Địa chỉ
                      </label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) =>
                          setForm({ ...form, address: e.target.value })
                        }
                        className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Chỉ số cơ thể" icon="monitor_heart">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Cân nặng (kg) <span className="text-error">*</span>
                      </label>
                      <input
                        type="number"
                        value={form.weight}
                        onChange={(e) =>
                          setForm({ ...form, weight: e.target.value })
                        }
                        className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Chiều cao (cm) <span className="text-error">*</span>
                      </label>
                      <input
                        type="number"
                        value={form.height}
                        onChange={(e) =>
                          setForm({ ...form, height: e.target.value })
                        }
                        className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                    {previewBmi != null && (
                      <p className="sm:col-span-2 text-xs text-on-surface-variant">
                        BMI ước tính:{" "}
                        <span className="font-bold text-on-surface">{previewBmi}</span>
                      </p>
                    )}
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Huyết áp
                      </label>
                      <input
                        type="text"
                        value={form.bloodPressure}
                        onChange={(e) =>
                          setForm({ ...form, bloodPressure: e.target.value })
                        }
                        placeholder="130/80"
                        className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Đường huyết
                      </label>
                      <input
                        type="text"
                        value={form.bloodGlucose}
                        onChange={(e) =>
                          setForm({ ...form, bloodGlucose: e.target.value })
                        }
                        placeholder="135 mg/dL"
                        className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Hồ sơ lâm sàng" icon="clinical_notes">
                  <div className="space-y-md">
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Bệnh lý nền <span className="text-error">*</span>
                      </label>
                      <div className="flex flex-wrap gap-xs">
                        {diagnosisOptions.map((opt) => {
                          const isSelected = form.diseaseCodes.includes(opt.code);
                          return (
                            <button
                              key={opt.code}
                              type="button"
                              onClick={() => toggleDisease(opt.code)}
                              className={`px-md py-sm rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-primary/10 border-primary text-primary"
                                  : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary/50"
                              }`}
                            >
                              {isSelected && "✓ "}
                              {opt.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Dị ứng & Kiêng kỵ
                      </label>
                      {catalogLoading && (
                        <p className="text-xs text-on-surface-variant mb-xs">
                          Đang tải danh mục...
                        </p>
                      )}
                      <input
                        type="text"
                        value={allergySearch}
                        onChange={(e) => setAllergySearch(e.target.value)}
                        placeholder="Tìm dị ứng..."
                        className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      />
                      <div className="flex flex-wrap gap-xs mt-sm">
                        {form.allergies.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => toggleListItem("allergies", v)}
                            className={`${chipClass(true)} border-dashed`}
                          >
                            {v} ✕
                          </button>
                        ))}
                        {visibleCatalog(
                          catalog?.allergies ?? [],
                          allergySearch,
                          form.allergies
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
                    </div>

                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Thuốc đang sử dụng
                      </label>
                      <input
                        type="text"
                        value={medSearch}
                        onChange={(e) => setMedSearch(e.target.value)}
                        placeholder="Tìm thuốc..."
                        className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                      />
                      <div className="flex flex-wrap gap-xs mt-sm">
                        {form.medications.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => toggleListItem("medications", v)}
                            className={`${chipClass(true)} border-dashed`}
                          >
                            {v} ✕
                          </button>
                        ))}
                        {visibleCatalog(
                          catalog?.medicines ?? [],
                          medSearch,
                          form.medications
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
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Mục tiêu điều trị & Dinh dưỡng" icon="restaurant">
                  <div className="space-y-md">
                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Mục tiêu điều trị <span className="text-error">*</span>
                      </label>
                      <div className="flex flex-wrap gap-xs mb-sm">
                        {TREATMENT_GOAL_OPTIONS.map((goal) => {
                          const isSelected = form.selectedGoals.includes(goal);
                          return (
                            <button
                              key={goal}
                              type="button"
                              onClick={() => toggleGoal(goal)}
                              className={`px-md py-sm rounded-full text-xs font-semibold border transition-all cursor-pointer text-left ${
                                isSelected
                                  ? "bg-primary/10 border-primary text-primary"
                                  : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary/50"
                              }`}
                            >
                              {isSelected && "✓ "}
                              {goal}
                            </button>
                          );
                        })}
                        {form.selectedGoals
                          .filter((g) => !TREATMENT_GOAL_OPTIONS.includes(g))
                          .map((goal) => (
                            <button
                              key={goal}
                              type="button"
                              onClick={() => toggleGoal(goal)}
                              className="px-md py-sm rounded-full text-xs font-semibold border bg-primary/10 border-primary text-primary text-left"
                            >
                              ✓ {goal}
                            </button>
                          ))}
                      </div>
                      <div className="flex gap-xs">
                        <input
                          type="text"
                          value={customGoalInput}
                          onChange={(e) => setCustomGoalInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomGoal();
                            }
                          }}
                          placeholder="Thêm mục tiêu khác..."
                          className="flex-1 px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomGoal}
                          className="px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high"
                        >
                          + Thêm
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                        Sở thích ăn uống
                      </label>
                      <textarea
                        value={form.preferencesText}
                        onChange={(e) =>
                          setForm({ ...form, preferencesText: e.target.value })
                        }
                        rows={2}
                        placeholder="Ví dụ: thích ăn cơm, không ăn thịt bò"
                        className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                      <div>
                        <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                          Mục tiêu kcal / ngày <span className="text-error">*</span>
                        </label>
                        <input
                          type="number"
                          value={form.targetKcalInput}
                          onChange={(e) =>
                            setForm({ ...form, targetKcalInput: e.target.value })
                          }
                          min={800}
                          max={5000}
                          className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                        />
                        <p className="mt-xs text-xs text-on-surface-variant">
                          Gợi ý: {suggestedKcal} kcal
                        </p>
                      </div>
                      <div>
                        <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                          Carb / bữa (g)
                        </label>
                        <input
                          type="number"
                          value={form.carbPerMeal}
                          onChange={(e) =>
                            setForm({ ...form, carbPerMeal: e.target.value })
                          }
                          className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                          Natri / ngày (mg)
                        </label>
                        <input
                          type="number"
                          value={form.sodiumDaily}
                          onChange={(e) =>
                            setForm({ ...form, sodiumDaily: e.target.value })
                          }
                          className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {(profile.restrictions?.salt_daily_g != null ||
                      profile.restrictions?.sugar_daily_g != null) && (
                      <p className="text-xs text-on-surface-variant italic">
                        Muối/đường do bác sĩ đặt (
                        {profile.restrictions?.salt_daily_g != null &&
                          `muối ${profile.restrictions.salt_daily_g}g`}
                        {profile.restrictions?.salt_daily_g != null &&
                          profile.restrictions?.sugar_daily_g != null &&
                          ", "}
                        {profile.restrictions?.sugar_daily_g != null &&
                          `đường ${profile.restrictions.sugar_daily_g}g`}
                        ) — không thể sửa tại đây.
                      </p>
                    )}
                  </div>
                </SectionCard>

                <div className="flex gap-sm pt-md border-t border-outline-variant">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="flex-1 bg-surface-container-low text-on-surface font-body-bold py-md px-lg rounded-xl border border-outline-variant hover:bg-surface-container-high transition-colors text-sm font-bold cursor-pointer disabled:opacity-60"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="flex-[2] bg-primary text-on-primary font-body-bold py-md px-lg rounded-xl hover:bg-primary-container transition-colors shadow-xs text-sm font-bold cursor-pointer disabled:opacity-60"
                  >
                    {saving ? "Đang lưu..." : "Lưu hồ sơ"}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
