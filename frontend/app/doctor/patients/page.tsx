"use client";

/* eslint-disable @next/next/no-img-element */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { PatientCard } from "@/components/doctor/PatientCard";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { ApiError, type CatalogItem, type CatalogOut } from "@/lib/types";

type StatusFilter = "all" | "attention" | "warning" | "stable" | "pending";

const ADD_STEP_LABELS = [
  "Tài khoản & Chung",
  "Chỉ số & Liên hệ",
  "Hồ sơ lâm sàng",
  "Dinh dưỡng & Mục tiêu",
];

function truncateId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

export default function PatientsListPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);

  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    age: "",
    gender: "",
    weight: "",
    height: "",
    bloodPressure: "",
    bloodGlucose: "",
    phone: "",
    address: "",
    disease: [] as string[],
    medications: [] as string[],
    allergies: [] as string[],
    preferencesText: "",
    goalsText: "",
  });
  const [addingPatient, setAddingPatient] = useState(false);
  const [step, setStep] = useState(1);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [catalog, setCatalog] = useState<CatalogOut | null>(null);
  const [medSearch, setMedSearch] = useState("");
  const [allergySearch, setAllergySearch] = useState("");
  const [diagnosisSearch, setDiagnosisSearch] = useState("");

  useEffect(() => {
    setHydrated(true);
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.listDoctorPatients();
      setPatients(rows.map(doctorPatientToUi));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Không tải được danh sách bệnh nhân. Kiểm tra backend.";
      setError(message);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
    void loadPatients();
  }, [hydrated, token, role, router, loadPatients]);

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesSearch =
        !q ||
        patient.name.toLowerCase().includes(q) ||
        patient.id.toLowerCase().includes(q) ||
        (patient.email || "").toLowerCase().includes(q) ||
        patient.condition.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (statusFilter === "all") return true;
      return patient.statusKey === statusFilter;
    });
  }, [patients, searchQuery, statusFilter]);

  const counts = useMemo(
    () => ({
      all: patients.length,
      attention: patients.filter((p) => p.statusKey === "attention").length,
      warning: patients.filter((p) => p.statusKey === "warning").length,
      stable: patients.filter((p) => p.statusKey === "stable").length,
      pending: patients.filter((p) => p.statusKey === "pending").length,
    }),
    [patients]
  );

  const modalFilteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.condition.toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  }, [patients, patientSearch]);

  const toggleSelectPatient = (id: string) => {
    setSelectedPatientIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPatientIds.length === filteredPatients.length) {
      setSelectedPatientIds([]);
    } else {
      setSelectedPatientIds(filteredPatients.map((p) => p.id));
    }
  };

  const generateForPatients = async (ids: string[]) => {
    if (ids.length === 0) return;
    setGenerating(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const id of ids) {
        try {
          await api.generateMealPlanForPatient(id);
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      if (ok > 0) {
        showToast(
          fail > 0
            ? `Đã tạo ${ok} thực đơn, ${fail} lỗi`
            : `Đã tạo ${ok} thực đơn (chờ duyệt)`
        );
        await loadPatients();
      } else {
        setError("Không tạo được thực đơn. Kiểm tra quyền doctor / backend.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    const ids = [...selectedPatientIds];
    setSelectedPatientIds([]);
    setIsMultiSelect(false);
    await generateForPatients(ids);
  };

  const handleSingleSelectPatient = (patientId: string) => {
    setIsSelectModalOpen(false);
    // Vào trang cấu hình AI — không generate API + nhảy thẳng [planId]
    router.push(`/doctor/patients/${encodeURIComponent(patientId)}/generate`);
  };

  useEffect(() => {
    if (!isAddPatientOpen) return;
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
  }, [isAddPatientOpen]);

  const toggleListItem = (
    key: "disease" | "medications" | "allergies",
    value: string
  ) => {
    setAddForm((f) => ({
      ...f,
      [key]: f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value],
    }));
  };

  const diagnosisOptions = useMemo(() => {
    const base = catalog
      ? catalog.diagnoses.map((d) => ({ code: d.code, name: d.name }))
      : [];
    const merged = [...base];
    for (const d of addForm.disease) {
      if (!merged.some((o) => o.code === d)) merged.push({ code: d, name: d });
    }
    return merged;
  }, [catalog, addForm.disease]);

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
    return pool.filter((i) => !selected.includes(i.name)).slice(0, 5);
  };

  const visibleDiagnoses = (query: string): { code: string; name: string }[] => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? diagnosisOptions.filter((d) => d.name.toLowerCase().includes(q))
      : diagnosisOptions;
    return pool.filter((d) => !addForm.disease.includes(d.code)).slice(0, 5);
  };

  const chipClass = (active: boolean) =>
    `px-md py-xs rounded-full text-xs font-medium border transition-colors cursor-pointer ${
      active
        ? "bg-primary text-on-primary border-primary"
        : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary"
    }`;

  // Clean medical input style (viền mảnh, bo nhẹ, placeholder mờ)
  const fieldClass =
    "w-full px-md py-2 bg-surface-container-low/60 border border-outline-variant/70 rounded-md text-sm font-body text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all";
  const fieldLabelClass =
    "font-label text-label text-on-surface-variant block mb-xs";
  const sectionTitleClass =
    "font-label text-label text-on-surface font-semibold text-xs uppercase tracking-wider mb-sm";

  const resetAddForm = () => {
    setAddForm({
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      age: "",
      gender: "",
      weight: "",
      height: "",
      bloodPressure: "",
      bloodGlucose: "",
      phone: "",
      address: "",
      disease: [],
      medications: [],
      allergies: [],
      preferencesText: "",
      goalsText: "",
    });
    setPendingAvatar(null);
  };

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      if (!addForm.email.trim()) {
        setError("Vui lòng nhập email.");
        return;
      }
      if (addForm.password.length < 6) {
        setError("Mật khẩu tối thiểu 6 ký tự.");
        return;
      }
      if (addForm.password !== addForm.confirmPassword) {
        setError("Mật khẩu xác nhận không khớp.");
        return;
      }
      const age = addForm.age.trim() === "" ? null : parseInt(addForm.age, 10);
      if (age != null && (Number.isNaN(age) || age < 0 || age > 130)) {
        setError("Tuổi phải nằm trong khoảng 0–130.");
        return;
      }
    }
    if (step === 2) {
      const weight =
        addForm.weight.trim() === "" ? null : parseFloat(addForm.weight);
      const height =
        addForm.height.trim() === "" ? null : parseFloat(addForm.height);
      if (weight != null && (!Number.isFinite(weight) || weight <= 0)) {
        setError("Cân nặng phải là số lớn hơn 0 (kg).");
        return;
      }
      if (height != null && (!Number.isFinite(height) || height <= 0)) {
        setError("Chiều cao phải là số lớn hơn 0 (cm).");
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleAddPatient = async () => {
    setError(null);
    const email = addForm.email.trim();
    if (!email) {
      setError("Vui lòng nhập email.");
      return;
    }
    if (addForm.password.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    if (addForm.password !== addForm.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    const age = addForm.age.trim() === "" ? null : parseInt(addForm.age, 10);
    if (age != null && (Number.isNaN(age) || age < 0 || age > 130)) {
      setError("Tuổi phải nằm trong khoảng 0–130.");
      return;
    }
    const weight =
      addForm.weight.trim() === "" ? null : parseFloat(addForm.weight);
    const height =
      addForm.height.trim() === "" ? null : parseFloat(addForm.height);
    if (weight != null && (!Number.isFinite(weight) || weight <= 0)) {
      setError("Cân nặng phải là số lớn hơn 0 (kg).");
      return;
    }
    if (height != null && (!Number.isFinite(height) || height <= 0)) {
      setError("Chiều cao phải là số lớn hơn 0 (cm).");
      return;
    }
    setAddingPatient(true);
    try {
      const created = await api.register({
        email,
        password: addForm.password,
        role: "patient",
        full_name: addForm.fullName.trim() || undefined,
      });

      let profileNote: string | null = null;
      try {
        await api.updateDoctorPatientProfile(created.id, {
          full_name: addForm.fullName.trim() || null,
          email,
          age,
          gender: addForm.gender.trim() || null,
          phone: addForm.phone.trim() || null,
          address: addForm.address.trim() || null,
          blood_pressure: addForm.bloodPressure.trim() || null,
          blood_glucose: addForm.bloodGlucose.trim() || null,
          disease: addForm.disease,
          medications: addForm.medications,
          allergies: addForm.allergies,
          preferences: addForm.preferencesText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          treatment_goals: addForm.goalsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        });
        if (weight != null && height != null) {
          await api.updatePatientMetrics(created.id, { weight, height });
        }
        if (pendingAvatar) {
          await api.uploadPatientAvatar(created.id, pendingAvatar);
        }
      } catch {
        profileNote = " (chưa lưu được hồ sơ chi tiết)";
      }

      showToast(`Đã thêm bệnh nhân mới${profileNote ?? ""}`);
      setIsAddPatientOpen(false);
      setStep(1);
      resetAddForm();
      setMedSearch("");
      setAllergySearch("");
      setDiagnosisSearch("");
      await loadPatients();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Không thêm được bệnh nhân. Kiểm tra backend.";
      setError(message);
    } finally {
      setAddingPatient(false);
    }
  };

  if (!hydrated || !token || role !== "doctor") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-on-surface-variant">
        Đang tải...
      </div>
    );
  }

  return (
    <>
      <TopBar title="Bệnh nhân" />

      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-md py-sm rounded-xl shadow-lg border border-emerald-600 flex items-center gap-xs font-body text-sm">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-lg max-w-[1400px] pb-24">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Danh sách bệnh nhân
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Dữ liệu thật từ API — hồ sơ, trạng thái thực đơn và cảnh báo tương tác
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-sm">
            <div className="relative min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm tên, email, Mã BN, bệnh lý..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddPatientOpen(true)}
              className="px-md py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold hover:bg-surface-variant transition-colors cursor-pointer flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Thêm bệnh nhân</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMultiSelect(!isMultiSelect);
                if (isMultiSelect) setSelectedPatientIds([]);
              }}
              className={`px-md py-2 rounded-lg font-body-bold text-sm transition-all flex items-center gap-xs cursor-pointer border shadow-xs ${
                isMultiSelect
                  ? "bg-emerald-50 text-emerald-800 border-emerald-500 font-semibold"
                  : "bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isMultiSelect ? "check_box" : "checklist"}
              </span>
              <span>{isMultiSelect ? "Tắt chọn nhiều" : "Chọn nhiều"}</span>
            </button>

            <button
              type="button"
              disabled={generating || patients.length === 0}
              onClick={() => setIsSelectModalOpen(true)}
              className="bg-primary text-on-primary px-md py-2 rounded-lg font-body-bold text-sm hover:bg-primary-container transition-all shadow-xs flex items-center gap-xs cursor-pointer active:scale-95 font-semibold disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>{generating ? "Đang tạo..." : "Tạo thực đơn AI"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-md rounded-xl border border-error/30 bg-error-container/20 px-md py-sm text-xs text-error font-medium flex items-center justify-between gap-sm">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="underline cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        <div className="flex items-center gap-sm border-b border-outline-variant mb-lg pb-xs overflow-x-auto">
          {(
            [
              ["all", "Tất cả", counts.all],
              ["pending", "Chờ duyệt", counts.pending],
              ["attention", "Cần chú ý", counts.attention],
              ["warning", "Cảnh báo", counts.warning],
              ["stable", "Ổn định", counts.stable],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === key
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-xl text-center text-on-surface-variant text-sm">
              Đang tải danh sách bệnh nhân...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-xl text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
                search_off
              </span>
              <p className="font-body-bold text-body-bold">
                {patients.length === 0
                  ? "Chưa có bệnh nhân nào trong hệ thống"
                  : "Không tìm thấy bệnh nhân phù hợp"}
              </p>
              <p className="font-caption text-caption text-xs mt-xs">
                {patients.length === 0
                  ? "Đăng ký tài khoản patient hoặc dùng demo_patient_1@example.com"
                  : "Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    {isMultiSelect && (
                      <th className="p-md w-12 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedPatientIds.length > 0 &&
                            selectedPatientIds.length === filteredPatients.length
                          }
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                      Bệnh nhân
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                      Mã BN
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                      Chẩn đoán / Bệnh lý
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                      Thực đơn
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                      Cập nhật
                    </th>
                    <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-body text-body">
                  {filteredPatients.map((patient) => {
                    const isSelected = selectedPatientIds.includes(patient.id);
                    return (
                      <tr
                        key={patient.id}
                        onClick={() => {
                          if (isMultiSelect) toggleSelectPatient(patient.id);
                        }}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-emerald-50/60 hover:bg-emerald-50"
                            : "hover:bg-surface-bright"
                        } ${isMultiSelect ? "cursor-pointer" : ""}`}
                      >
                        {isMultiSelect && (
                          <td
                            className="p-md text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectPatient(patient.id)}
                              className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="p-md">
                          <div className="flex items-center gap-sm">
                            <img
                              src={patient.avatar}
                              alt={patient.name}
                              className="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0 bg-surface-container"
                            />
                            <div>
                              <p className="font-body-bold text-on-surface font-semibold text-sm">
                                {patient.name}
                              </p>
                              <p className="font-caption text-caption text-on-surface-variant text-xs">
                                {patient.email ||
                                  (patient.age > 0
                                    ? `${patient.age} tuổi • ${patient.gender}`
                                    : "")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-md">
                          <div className="group/mabn inline-flex items-center gap-xs">
                            <span className="font-mono text-xs font-medium text-on-surface-variant">
                              {truncateId(patient.id)}
                            </span>
                            <button
                              type="button"
                              title="Sao chép mã bệnh nhân"
                              onClick={(e) => {
                                e.stopPropagation();
                                void navigator.clipboard
                                  .writeText(patient.id)
                                  .then(() => showToast("Đã sao chép mã BN"));
                              }}
                              className="opacity-0 group-hover/mabn:opacity-100 transition-opacity text-on-surface-variant hover:text-primary cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                content_copy
                              </span>
                            </button>
                          </div>
                        </td>
                        <td className="p-md text-on-surface text-sm max-w-[220px]">
                          {patient.condition}
                          {(patient.alertCount || 0) > 0 && (
                            <span className="ml-xs text-xs text-error font-semibold">
                              · {patient.alertCount} alert
                            </span>
                          )}
                        </td>
                        <td className="p-md">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full font-caption text-xs font-semibold ${patient.statusColor}`}
                          >
                            {patient.status}
                          </span>
                        </td>
                        <td className="p-md text-xs text-on-surface-variant">
                          {patient.latestPlanStatus || "Chưa có"}
                        </td>
                        <td className="p-md text-on-surface-variant text-xs">
                          {patient.lastUpdate}
                        </td>
                        <td className="p-md text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-xs">
                            <button
                              type="button"
                              title="Tạo thực đơn AI"
                              disabled={generating}
                              onClick={() => handleSingleSelectPatient(patient.id)}
                              className="w-8 h-8 inline-flex items-center justify-center bg-primary text-on-primary font-body-bold rounded-lg hover:bg-primary-container transition-all cursor-pointer active:scale-95 shadow-xs disabled:opacity-60"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                auto_awesome
                              </span>
                            </button>
                            <Link
                              href={`/doctor/patients/${patient.id}`}
                              title="Xem hồ sơ"
                              className="w-8 h-8 inline-flex items-center justify-center bg-surface-container-lowest border border-primary text-primary font-body-bold rounded-lg hover:bg-primary hover:text-on-primary transition-all cursor-pointer active:scale-95 shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                visibility
                              </span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {isMultiSelect && selectedPatientIds.length >= 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 text-white px-lg py-md rounded-2xl shadow-2xl border border-gray-700/60 backdrop-blur-md flex items-center gap-lg">
          <div className="flex items-center gap-sm">
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
              {selectedPatientIds.length}
            </span>
            <span className="font-body-bold font-medium text-sm">
              Đã chọn{" "}
              <strong className="text-emerald-400">{selectedPatientIds.length}</strong> bệnh
              nhân
            </span>
          </div>

          <div className="flex items-center gap-sm">
            <button
              type="button"
              onClick={() => setSelectedPatientIds([])}
              className="px-md py-2 text-xs text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              Hủy chọn
            </button>
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleBulkGenerate()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-lg py-2.5 rounded-xl font-body-bold text-sm transition-all shadow-md flex items-center gap-xs cursor-pointer active:scale-95 font-semibold disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>{generating ? "Đang tạo..." : "Tạo thực đơn hàng loạt"}</span>
            </button>
          </div>
        </div>
      )}

      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md bg-black/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Chọn bệnh nhân để tạo thực đơn AI
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs">
                    Tạo plan thật qua API — trạng thái pending_review
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSelectModalOpen(false)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="relative mb-md">
              <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline text-[20px]">
                search
              </span>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Tìm theo tên, mã bệnh nhân, email..."
                className="w-full pl-xl pr-md py-sm bg-surface-container-low border border-outline-variant rounded-xl font-body text-body text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-sm pr-xs">
              {modalFilteredPatients.length === 0 ? (
                <div className="text-center py-xl text-on-surface-variant text-xs">
                  Không tìm thấy bệnh nhân phù hợp.
                </div>
              ) : (
                modalFilteredPatients.map((patient) => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    onSelect={handleSingleSelectPatient}
                  />
                ))
              )}
            </div>

            <div className="pt-md border-t border-outline-variant mt-md flex justify-between items-center text-xs text-on-surface-variant">
              <span>Hiển thị {modalFilteredPatients.length} bệnh nhân</span>
              <button
                type="button"
                onClick={() => setIsSelectModalOpen(false)}
                className="px-md py-sm border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md bg-black/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-3xl p-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-lg border-b border-outline-variant mb-lg shrink-0">
              <div className="flex items-center gap-md">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    person_add
                  </span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-semibold text-lg leading-tight">
                    Thêm bệnh nhân
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant/80 text-xs mt-0.5">
                    Tạo tài khoản + hồ sơ đầy đủ (tham khảo onboarding)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddPatientOpen(false);
                  setStep(1);
                }}
                className="text-on-surface-variant/60 hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container-low cursor-pointer"
                title="Đóng"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-xs space-y-lg">
              {/* Stepper */}
              <div className="flex items-center gap-2 mb-lg">
                {ADD_STEP_LABELS.map((label, i) => {
                  const n = i + 1;
                  const isActive = step === n;
                  const isDone = step > n;
                  return (
                    <Fragment key={label}>
                      {i > 0 && (
                        <div
                          className={`flex-1 h-px transition-colors ${
                            isDone ? "bg-primary/40" : "bg-outline-variant/70"
                          }`}
                        />
                      )}
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            isActive
                              ? "bg-primary text-on-primary shadow-[0_0_0_4px_rgba(13,148,136,0.15)] ring-1 ring-primary"
                              : isDone
                                ? "bg-primary/15 text-primary"
                                : "bg-surface-container-low text-on-surface-variant/60 border border-outline-variant"
                          }`}
                        >
                          {isDone ? (
                            <span
                              className="material-symbols-outlined text-[14px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              check
                            </span>
                          ) : (
                            n
                          )}
                        </div>
                        <p
                          className={`font-caption text-caption whitespace-nowrap ${
                            isActive
                              ? "text-primary font-semibold"
                              : "text-on-surface-variant/60"
                          }`}
                        >
                          {label}
                        </p>
                      </div>
                    </Fragment>
                  );
                })}
              </div>

              {step === 1 && (
                <>
              {/* Tài khoản */}
              <section>
                <div className="flex items-center justify-between mb-sm">
                  <h5 className={sectionTitleClass}>
                    Tài khoản đăng nhập
                  </h5>
                  <label className="inline-flex items-center gap-1 font-caption text-caption font-semibold text-primary hover:text-primary-container cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith("image/")) {
                          setError("File phải là ảnh (png/jpg/webp/gif).");
                          return;
                        }
                        if (file.size > 2 * 1024 * 1024) {
                          setError("Ảnh tối đa 2MB.");
                          return;
                        }
                        setError(null);
                        setPendingAvatar(file);
                      }}
                    />
                    <span className="material-symbols-outlined text-[16px]">upload</span>
                    {pendingAvatar ? "Đã chọn ảnh" : "Tải ảnh lên"}
                  </label>
                </div>
                {pendingAvatar && (
                  <div className="mb-sm flex items-center gap-xs bg-surface-container-low/60 border border-outline-variant/60 rounded-lg px-sm py-xs text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      image
                    </span>
                    <span className="truncate flex-1">{pendingAvatar.name}</span>
                    <button
                      type="button"
                      onClick={() => setPendingAvatar(null)}
                      className="text-error/70 hover:text-error transition-colors cursor-pointer"
                      title="Bỏ ảnh"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                  <div className="sm:col-span-1">
                    <label className={fieldLabelClass}>
                      Email <span className="text-error">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={addForm.email}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="benhnhan@example.com"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>
                      Mật khẩu <span className="text-error">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={addForm.password}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, password: e.target.value }))
                      }
                      placeholder="Tối thiểu 6 ký tự"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>
                      Xác nhận <span className="text-error">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={addForm.confirmPassword}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, confirmPassword: e.target.value }))
                      }
                      placeholder="Nhập lại mật khẩu"
                      className={fieldClass}
                    />
                  </div>
                </div>
              </section>

              {/* Thông tin chung */}
              <section>
                <h5 className={sectionTitleClass}>
                  Thông tin chung
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                  <div className="sm:col-span-1">
                    <label className={fieldLabelClass}>
                      Họ tên
                    </label>
                    <input
                      type="text"
                      value={addForm.fullName}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, fullName: e.target.value }))
                      }
                      placeholder="VD: Nguyễn Văn A"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>
                      Tuổi
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={130}
                      value={addForm.age}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, age: e.target.value }))
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>
                      Giới tính
                    </label>
                    <div className="relative">
                      <select
                        value={addForm.gender}
                        onChange={(e) =>
                          setAddForm((f) => ({ ...f, gender: e.target.value }))
                        }
                        className={`${fieldClass} appearance-none pr-lg cursor-pointer`}
                      >
                          <option value="">—</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
                        <span className="material-symbols-outlined text-[16px]">
                          arrow_drop_down
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </section>
                </>
              )}

              {step === 2 && (
                <>
              {/* Chỉ số cơ thể */}
              <section>
                <h5 className={sectionTitleClass}>
                  Chỉ số cơ thể
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
                  <div>
                    <label className={fieldLabelClass}>
                      Cân nặng (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={addForm.weight}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, weight: e.target.value }))
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>
                      Chiều cao (cm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={addForm.height}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, height: e.target.value }))
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>
                      Huyết áp
                    </label>
                    <input
                      type="text"
                      value={addForm.bloodPressure}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, bloodPressure: e.target.value }))
                      }
                      placeholder="130/80"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>
                      Đường huyết
                    </label>
                    <input
                      type="text"
                      value={addForm.bloodGlucose}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, bloodGlucose: e.target.value }))
                      }
                      placeholder="135"
                      className={fieldClass}
                    />
                  </div>
                </div>
              </section>

              {/* Liên hệ */}
              <section>
                <h5 className={sectionTitleClass}>
                  Thông tin liên hệ
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <div>
                    <label className={fieldLabelClass}>
                      Điện thoại
                    </label>
                    <input
                      type="text"
                      value={addForm.phone}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="font-label text-label text-on-surface-variant block mb-xs">
                      Địa chỉ
                    </label>
                    <input
                      type="text"
                      value={addForm.address}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, address: e.target.value }))
                      }
                      className={fieldClass}
                    />
                  </div>
                </div>
              </section>
                </>
              )}

              {step === 3 && (
                <>
              {/* Chẩn đoán */}
              <section>
                <h5 className={sectionTitleClass}>
                  Chẩn đoán hiện tại
                </h5>
                <input
                  type="text"
                  value={diagnosisSearch}
                  onChange={(e) => setDiagnosisSearch(e.target.value)}
                  placeholder="Tìm bệnh lý..."
                  className={fieldClass}
                />
                <div className="flex flex-wrap gap-xs mt-sm">
                  {addForm.disease.map((code) => {
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

              {/* Thuốc */}
              <section>
                <h5 className={sectionTitleClass}>
                  Thuốc đang dùng
                </h5>
                <input
                  type="text"
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Tìm thuốc..."
                  className={fieldClass}
                />
                <div className="flex flex-wrap gap-xs mt-sm">
                  {addForm.medications.map((v) => (
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
                    addForm.medications
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
                    addForm.medications
                  ).length === 0 && (
                    <p className="text-xs text-on-surface-variant italic mt-xs">
                      Không tìm thấy thuốc phù hợp.
                    </p>
                  )}
              </section>

              {/* Dị ứng */}
              <section>
                <h5 className={sectionTitleClass}>
                  Dị ứng & Phản ứng phụ
                </h5>
                <input
                  type="text"
                  value={allergySearch}
                  onChange={(e) => setAllergySearch(e.target.value)}
                  placeholder="Tìm dị ứng..."
                  className={fieldClass}
                />
                <div className="flex flex-wrap gap-xs mt-sm">
                  {addForm.allergies.map((v) => (
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
                    addForm.allergies
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
                    addForm.allergies
                  ).length === 0 && (
                    <p className="text-xs text-on-surface-variant italic mt-xs">
                      Không tìm thấy dị ứng phù hợp.
                    </p>
                  )}
              </section>
                </>
              )}

              {step === 4 && (
                <>
              {/* Dinh dưỡng & Mục tiêu */}
              <section>
                <h5 className={sectionTitleClass}>
                  Dinh dưỡng & Mục tiêu điều trị
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <div>
                    <label className={fieldLabelClass}>
                      Dinh dưỡng / Sở thích (mỗi dòng 1 mục)
                    </label>
                    <textarea
                      rows={4}
                      value={addForm.preferencesText}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, preferencesText: e.target.value }))
                      }
                      placeholder={"thích ăn cơm\nkhông ăn thịt bò"}
                      className={`${fieldClass} resize-y`}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>
                      Mục tiêu điều trị (mỗi dòng 1 mục tiêu)
                    </label>
                    <textarea
                      rows={4}
                      value={addForm.goalsText}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, goalsText: e.target.value }))
                      }
                      placeholder={"Kiểm soát đường huyết (HbA1c < 7%).\nGiảm cân 2kg trong 1 tháng."}
                      className={`${fieldClass} resize-y`}
                    />
                  </div>
                </div>
              </section>
                </>
              )}

              {error && (
                <div className="rounded-xl border border-error/30 bg-error-container/20 px-md py-sm text-xs text-error font-medium">
                  {error}
                </div>
              )}
            </div>

            <div className="pt-md border-t border-outline-variant/70 mt-md flex justify-between items-center gap-sm shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAddPatientOpen(false);
                  setStep(1);
                }}
                disabled={addingPatient}
                className="text-on-surface-variant hover:text-on-surface px-2 py-2 text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
              >
                Hủy
              </button>
              <div className="flex items-center gap-sm">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                    disabled={addingPatient}
                    className="px-md py-2 border border-outline-variant/70 text-on-surface-variant rounded-lg text-sm font-medium hover:bg-surface-container-low hover:text-on-surface transition-colors flex items-center gap-xs disabled:opacity-60 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_back
                    </span>
                    Quay lại
                  </button>
                )}
                {step < ADD_STEP_LABELS.length ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="bg-primary text-on-primary px-md py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary/90 hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    Tiếp tục
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_forward
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleAddPatient()}
                    disabled={addingPatient}
                    className="bg-primary text-on-primary px-md py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary/90 hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      person_add
                    </span>
                    <span>{addingPatient ? "Đang thêm..." : "Thêm bệnh nhân"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
