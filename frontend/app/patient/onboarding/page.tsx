"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  DISEASE_OPTIONS,
  TREATMENT_GOAL_OPTIONS,
  calcBmi,
  diseaseLabelsToCodes,
  normalizeMedications,
  suggestRestrictions,
  suggestTargetKcal,
} from "@/lib/profile-mappers";
import { ApiError, type CatalogItem, type CatalogOut } from "@/lib/types";

const STEP_META = [
  {
    title: "Thông tin & chỉ số cơ thể",
    subtitle:
      "Điền thông tin cá nhân và chỉ số để bác sĩ theo dõi hồ sơ chính xác.",
  },
  {
    title: "Hồ sơ lâm sàng",
    subtitle:
      "Chọn bệnh lý, thuốc và dị ứng — nền tảng để AI tạo thực đơn an toàn.",
  },
  {
    title: "Mục tiêu điều trị & Dinh dưỡng",
    subtitle:
      "Chọn mục tiêu điều trị và sở thích ăn uống để cá nhân hóa kế hoạch.",
  },
] as const;

export default function PatientOnboardingPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [age, setAge] = useState("45");
  const [gender, setGender] = useState("Nam");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [weight, setWeight] = useState("68");
  const [height, setHeight] = useState("168");
  const [bloodPressure, setBloodPressure] = useState("130/80");
  const [bloodGlucose, setBloodGlucose] = useState("135");

  // Step 2
  const [selectedConditions, setSelectedConditions] = useState<string[]>([
    "Tiểu đường type 2",
    "Tăng huyết áp",
  ]);
  const [allergies, setAllergies] = useState<string[]>(["Hải sản"]);
  const [allergySearch, setAllergySearch] = useState("");
  const [medications, setMedications] = useState<string[]>([
    "Metformin 500mg",
    "Amlodipine 5mg",
  ]);
  const [medSearch, setMedSearch] = useState("");
  const [catalog, setCatalog] = useState<CatalogOut | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Step 3
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    TREATMENT_GOAL_OPTIONS[0],
    TREATMENT_GOAL_OPTIONS[1],
  ]);
  const [customGoalInput, setCustomGoalInput] = useState("");
  const [preferencesText, setPreferencesText] = useState(
    "thích ăn cơm, không ăn thịt bò"
  );
  const [targetKcalInput, setTargetKcalInput] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const conditionOptions = useMemo(() => {
    if (catalog?.diagnoses?.length) {
      return catalog.diagnoses.map((d) => d.name);
    }
    return DISEASE_OPTIONS.map((d) => d.label);
  }, [catalog]);

  const previewBmi = useMemo(() => {
    const w = Number(weight);
    const h = Number(height);
    if (!w || !h || w <= 0 || h <= 0) return null;
    return calcBmi(w, h);
  }, [weight, height]);

  const suggestedKcal = useMemo(() => {
    const diseaseCodes = diseaseLabelsToCodes(selectedConditions);
    return suggestTargetKcal(previewBmi, diseaseCodes);
  }, [previewBmi, selectedConditions]);

  /** Hiển thị tối đa 5 mục trong catalog theo từ khóa tìm kiếm (giống doctor edit). */
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
    let cancelled = false;
    setCatalogLoading(true);
    api
      .getCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {
        if (!cancelled) setCatalog(null);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, token, role]);

  const toggleCondition = (cond: string) => {
    if (selectedConditions.includes(cond)) {
      setSelectedConditions(selectedConditions.filter((c) => c !== cond));
    } else {
      setSelectedConditions([...selectedConditions, cond]);
    }
  };

  const toggleListItem = (key: "medications" | "allergies", value: string) => {
    if (key === "medications") {
      setMedications((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else {
      setAllergies((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    }
  };

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter((g) => g !== goal));
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const handleAddCustomGoal = () => {
    const g = customGoalInput.trim();
    if (!g) return;
    if (!selectedGoals.includes(g)) {
      setSelectedGoals([...selectedGoals, g]);
    }
    setCustomGoalInput("");
  };

  const validateStep1 = (): string | null => {
    const ageNum = Number(age);
    if (!age || !Number.isFinite(ageNum) || ageNum <= 0 || ageNum > 130) {
      return "Nhập tuổi hợp lệ (1–130).";
    }
    if (!gender.trim()) {
      return "Chọn giới tính.";
    }
    const w = Number(weight);
    const h = Number(height);
    if (!w || !h || w <= 0 || h <= 0) {
      return "Nhập cân nặng và chiều cao hợp lệ.";
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (selectedConditions.length === 0) {
      return "Chọn ít nhất một bệnh lý nền.";
    }
    return null;
  };

  const validateStep3 = (): string | null => {
    if (selectedGoals.length === 0) {
      return "Chọn ít nhất một mục tiêu điều trị & dinh dưỡng.";
    }
    const kcal = Number(targetKcalInput);
    if (!kcal || kcal < 800 || kcal > 5000) {
      return "Nhập mục tiêu kcal hợp lệ (800–5000).";
    }
    return null;
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) {
        setError(err);
        return;
      }
      setTargetKcalInput((prev) => prev || String(suggestedKcal));
      // Defer step change so the click that triggered "Tiếp tục" cannot
      // land on a newly-mounted type="submit" button and auto-submit.
      window.setTimeout(() => setStep(3), 0);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const completeOnboarding = async () => {
    setError(null);
    const err1 = validateStep1();
    if (err1) {
      setError(err1);
      setStep(1);
      return;
    }
    const err2 = validateStep2();
    if (err2) {
      setError(err2);
      setStep(2);
      return;
    }
    const err3 = validateStep3();
    if (err3) {
      setError(err3);
      return;
    }

    const w = Number(weight);
    const h = Number(height);
    const diseaseCodes = catalog?.diagnoses?.length
      ? selectedConditions
          .map(
            (name) =>
              catalog.diagnoses.find((d) => d.name === name)?.code ??
              diseaseLabelsToCodes([name])[0]
          )
          .filter(Boolean)
      : diseaseLabelsToCodes(selectedConditions);
    const medCodes = normalizeMedications(medications);
    const bmi = calcBmi(w, h);
    const restrictions = suggestRestrictions(diseaseCodes);
    const targetKcal = Number(targetKcalInput) || suggestTargetKcal(bmi, diseaseCodes);
    const preferences = preferencesText
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      await api.upsertProfile({
        disease: diseaseCodes,
        medications: medCodes,
        allergies,
        bmi,
        weight: w,
        height: h,
        age: Number(age),
        gender: gender.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        blood_pressure: bloodPressure.trim() || null,
        blood_glucose: bloodGlucose.trim() || null,
        target_kcal: targetKcal,
        restrictions,
        preferences,
        treatment_goals: selectedGoals,
      });
      router.push("/patient");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Không lưu được hồ sơ. Kiểm tra kết nối backend.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Never auto-advance via implicit form submit while leaving step 2;
    // only complete when the user is already on step 3 (e.g. Enter in input).
    if (step !== 3) {
      goNext();
      return;
    }
    void completeOnboarding();
  };

  if (!hydrated || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low text-sm text-on-surface-variant">
        Đang tải...
      </div>
    );
  }

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;
  const progressWidth = step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full";
  const meta = STEP_META[step - 1];

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col justify-center items-center p-md py-xl font-body">
      <div className="mb-lg text-center">
        <div className="inline-flex items-center gap-xs mb-xs">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold shadow-xs">
            <span className="material-symbols-outlined text-[22px]">vital_signs</span>
          </div>
          <span className="font-h1 text-h1 text-primary font-bold text-2xl tracking-tight">
            VMEC-10
          </span>
        </div>
        <p className="font-caption text-caption text-on-surface-variant text-xs">
          Hệ thống Trợ lý Dinh dưỡng & Sinh hoạt cho Bệnh nhân Mạn tính
        </p>
      </div>

      <div className="w-full max-w-[560px] bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg md:p-xl shadow-md">
        <div className="mb-lg">
          <div className="flex justify-between items-center mb-xs">
            <span className="font-label text-label text-primary font-bold text-xs uppercase tracking-wider">
              Bước {step} / 3: {meta.title}
            </span>
            <span className="font-mono text-xs font-semibold text-on-surface-variant">
              {progressPct}%
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className={`h-full bg-primary ${progressWidth} rounded-full transition-all`}
            />
          </div>
        </div>

        <div className="mb-lg">
          <h1 className="font-h1 text-h1 text-on-surface font-bold text-xl mb-xs">
            {meta.title}
          </h1>
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            {meta.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-lg">
          {step === 1 && (
            <>
              <div>
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Email
                </label>
                <input
                  type="email"
                  value={email || ""}
                  readOnly
                  className="w-full px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface-variant"
                />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                    Tuổi <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min={1}
                    max={130}
                    className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                    Giới tính <span className="text-error">*</span>
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901 234 567"
                  className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Quận 1, TP. Hồ Chí Minh"
                  className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                    Cân nặng (kg) <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                    Chiều cao (cm) <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {previewBmi != null && (
                <p className="text-xs text-on-surface-variant">
                  BMI ước tính:{" "}
                  <span className="font-bold text-on-surface">{previewBmi}</span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                    Huyết áp
                  </label>
                  <input
                    type="text"
                    value={bloodPressure}
                    onChange={(e) => setBloodPressure(e.target.value)}
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
                    value={bloodGlucose}
                    onChange={(e) => setBloodGlucose(e.target.value)}
                    placeholder="135 mg/dL"
                    className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Bệnh lý nền đang điều trị <span className="text-error">*</span>
                </label>
                <div className="flex flex-wrap gap-xs">
                  {conditionOptions.map((cond) => {
                    const isSelected = selectedConditions.includes(cond);
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => toggleCondition(cond)}
                        className={`px-md py-sm rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary shadow-xs"
                            : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary/50"
                        }`}
                      >
                        {isSelected && "✓ "}
                        {cond}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Dị ứng & Kiêng kỵ thực phẩm
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
                  className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
                <div className="flex flex-wrap gap-xs mt-sm">
                  {allergies.map((v) => (
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
                    allergies
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
                    allergies
                  ).length === 0 && (
                    <p className="text-xs text-on-surface-variant italic mt-xs">
                      Không tìm thấy dị ứng phù hợp.
                    </p>
                  )}
              </div>

              <div>
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Thuốc đang sử dụng hàng ngày
                </label>
                <input
                  type="text"
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Tìm thuốc..."
                  className="w-full px-md py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
                <div className="flex flex-wrap gap-xs mt-sm">
                  {medications.map((v) => (
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
                    medications
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
                    medications
                  ).length === 0 && (
                    <p className="text-xs text-on-surface-variant italic mt-xs">
                      Không tìm thấy thuốc phù hợp.
                    </p>
                  )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Mục tiêu điều trị & Dinh dưỡng{" "}
                  <span className="text-error">*</span>
                </label>
                <p className="font-caption text-caption text-on-surface-variant text-xs mb-sm">
                  Chọn một hoặc nhiều mục tiêu phù hợp với tình trạng của bạn.
                </p>
                <div className="flex flex-wrap gap-xs mb-sm">
                  {TREATMENT_GOAL_OPTIONS.map((goal) => {
                    const isSelected = selectedGoals.includes(goal);
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => toggleGoal(goal)}
                        className={`px-md py-sm rounded-full text-xs font-semibold border transition-all cursor-pointer text-left ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary shadow-xs"
                            : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary/50"
                        }`}
                      >
                        {isSelected && "✓ "}
                        {goal}
                      </button>
                    );
                  })}
                  {selectedGoals
                    .filter((g) => !TREATMENT_GOAL_OPTIONS.includes(g))
                    .map((goal) => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => toggleGoal(goal)}
                        className="px-md py-sm rounded-full text-xs font-semibold border bg-primary/10 border-primary text-primary shadow-xs text-left"
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
                    className="px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors"
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
                  value={preferencesText}
                  onChange={(e) => setPreferencesText(e.target.value)}
                  rows={2}
                  placeholder="Ví dụ: thích ăn cơm, không ăn thịt bò (cách nhau bằng dấu phẩy)"
                  className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                  Mục tiêu kcal / ngày
                </label>
                <input
                  type="number"
                  value={targetKcalInput}
                  onChange={(e) => setTargetKcalInput(e.target.value)}
                  min={800}
                  max={5000}
                  className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
                />
                <p className="mt-xs text-xs text-on-surface-variant">
                  Gợi ý theo BMI & bệnh lý: {suggestedKcal} kcal
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-error/30 bg-error-container/20 px-md py-sm text-xs text-error font-medium">
              {error}
            </div>
          )}

          <div className="pt-md border-t border-outline-variant flex gap-sm">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                disabled={loading}
                className="flex-1 bg-surface-container-low text-on-surface font-body-bold py-md px-lg rounded-xl border border-outline-variant hover:bg-surface-container-high transition-colors text-sm font-bold cursor-pointer disabled:opacity-60"
              >
                Quay lại
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex-[2] bg-primary text-on-primary font-body-bold py-md px-lg rounded-xl hover:bg-primary-container transition-colors shadow-xs active:scale-[0.99] flex items-center justify-center gap-xs text-sm font-bold cursor-pointer"
              >
                Tiếp tục
                <span className="material-symbols-outlined text-[18px]">
                  arrow_forward
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void completeOnboarding()}
                disabled={loading}
                className="flex-[2] bg-primary text-on-primary font-body-bold py-md px-lg rounded-xl hover:bg-primary-container transition-colors shadow-xs active:scale-[0.99] flex items-center justify-center gap-xs text-sm font-bold cursor-pointer disabled:opacity-60"
              >
                {loading ? "Đang lưu..." : "Hoàn tất hồ sơ"}
                {!loading && (
                  <span className="material-symbols-outlined text-[18px]">
                    check
                  </span>
                )}
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="mt-md text-center">
        <Link
          href="/patient"
          className="font-caption text-caption text-on-surface-variant hover:text-primary text-xs"
        >
          Bỏ qua thiết lập, tới Trang chủ Bệnh nhân →
        </Link>
      </div>
    </div>
  );
}
