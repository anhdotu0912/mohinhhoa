"use client";

/* eslint-disable @next/next/no-img-element */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { NotificationBadge } from "@/components/shared/NotificationBadge";
import Pagination, { getPageItems } from "@/components/shared/Pagination";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import {
  patientUsageLabel,
  patientUsageStatus,
} from "@/lib/plan-expiry";
import { ApiError, type CatalogItem, type CatalogOut } from "@/lib/types";

const ADD_STEP_LABELS = [
  "Tài khoản & Chung",
  "Chỉ số & Liên hệ",
  "Hồ sơ lâm sàng",
  "Dinh dưỡng & Mục tiêu",
];

const PAGE_SIZE = 10;

type UsageTab = "all" | "none" | "active" | "finished";

type UsageTabCounts = {
  all: number;
  none: number;
  active: number;
  finished: number;
};

function UsageStatusFilterMenu({
  value,
  onChange,
  counts,
}: {
  value: UsageTab;
  onChange: (next: UsageTab) => void;
  counts: UsageTabCounts;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options: {
    key: UsageTab;
    label: string;
    count: number;
    icon: string;
    description: string;
  }[] = [
    {
      key: "all",
      label: "Tất cả",
      count: counts.all,
      icon: "groups",
      description: "Mọi trạng thái thực đơn",
    },
    {
      key: "none",
      label: "Chưa áp dụng",
      count: counts.none,
      icon: "hourglass_empty",
      description: "Chưa có thực đơn được kích hoạt",
    },
    {
      key: "active",
      label: "Đang sử dụng",
      count: counts.active,
      icon: "play_circle",
      description: "Đang hoặc sắp áp dụng",
    },
    {
      key: "finished",
      label: "Đã hoàn thành",
      count: counts.finished,
      icon: "check_circle",
      description: "Đã hết chu kỳ thực đơn",
    },
  ];

  const activeLabel = options.find((o) => o.key === value)?.label ?? "Tất cả";

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={`Lọc trạng thái thực đơn: ${activeLabel}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Lọc trạng thái thực đơn, đang chọn ${activeLabel}`}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl border bg-surface-container-lowest transition-all cursor-pointer shadow-2xs active:scale-95 ${
          open || value !== "all"
            ? "border-primary/40 text-primary"
            : "border-outline-variant/60 text-on-surface-variant hover:text-primary hover:border-primary/40"
        }`}
      >
        <span className="material-symbols-outlined text-[20px]">filter_list</span>
        {value !== "all" && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-white"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Lọc trạng thái thực đơn"
          className="absolute right-0 z-50 mt-2 w-[min(calc(100vw-2rem),288px)] bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-lg overflow-hidden animate-slide-down"
        >
          <div className="px-4 py-3 border-b border-outline-variant/30 bg-surface-container-low/40">
            <p className="text-sm font-bold text-on-surface">Trạng thái thực đơn</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Chọn nhóm bệnh nhân cần xem
            </p>
          </div>
          <div className="py-1.5">
            {options.map((opt) => {
              const selected = value === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt.key);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    selected
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <span className="flex items-start gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                      {opt.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate">{opt.label}</span>
                      <span className="block text-[11px] text-on-surface-variant/90 truncate mt-0.5">
                        {opt.description}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className={`min-w-[24px] h-6 px-1.5 rounded-full text-[11px] font-bold tabular-nums inline-flex items-center justify-center ${
                        selected
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {opt.count}
                    </span>
                    {selected && (
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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

export default function PatientsListPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [diagnosisFilter, setDiagnosisFilter] = useState<string>("all");
  const [usageTab, setUsageTab] = useState<UsageTab>("all");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [page, setPage] = useState(1);

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
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeletePatient = async () => {
    if (!patientToDelete) return;
    setIsDeletingPatient(true);
    try {
      await api.deleteDoctorPatient(patientToDelete.id);
      showToast(`Đã xóa bệnh nhân ${patientToDelete.name} thành công.`);
      setPatientToDelete(null);
      await loadPatients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể xóa bệnh nhân lúc này.";
      showToast(msg);
    } finally {
      setIsDeletingPatient(false);
    }
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
      if (diagnosisFilter !== "all" && !(patient.disease ?? []).includes(diagnosisFilter)) {
        return false;
      }
      const usage = patientUsageStatus(patient);
      if (usageTab === "none" && usage !== "none") return false;
      if (usageTab === "active" && usage !== "active") return false;
      if (usageTab === "finished" && usage !== "finished") return false;
      return true;
    });
  }, [patients, searchQuery, diagnosisFilter, usageTab]);

  const usageTabCounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = patients.filter((patient) => {
      const matchesSearch =
        !q ||
        patient.name.toLowerCase().includes(q) ||
        patient.id.toLowerCase().includes(q) ||
        (patient.email || "").toLowerCase().includes(q) ||
        patient.condition.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (diagnosisFilter !== "all" && !(patient.disease ?? []).includes(diagnosisFilter)) {
        return false;
      }
      return true;
    });
    return {
      all: base.length,
      none: base.filter((p) => patientUsageStatus(p) === "none").length,
      active: base.filter((p) => patientUsageStatus(p) === "active").length,
      finished: base.filter((p) => patientUsageStatus(p) === "finished").length,
    };
  }, [patients, searchQuery, diagnosisFilter]);

  const activeUsageCount = useMemo(
    () => patients.filter((p) => patientUsageStatus(p) === "active").length,
    [patients]
  );
  const pendingPlanCount = useMemo(
    () => patients.filter((p) => (p.planPending ?? 0) > 0).length,
    [patients]
  );
  const requestPlanCount = useMemo(
    () => patients.filter((p) => (p.mealPlanRequestStatus ?? "none") === "pending").length,
    [patients]
  );

  /** Các nhóm chẩn đoán (kèm số BN) để lọc — lấy từ dữ liệu bệnh nhân thật. */
  const diagnosisFilters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of patients) {
      for (const code of p.disease ?? []) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
    const labelFor = (code: string) =>
      catalog?.diagnoses.find((d) => d.code === code)?.name ?? code;
    return [...counts.entries()]
      .map(([code, count]) => ({ code, count, label: labelFor(code) }))
      .sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi")
      );
  }, [patients, catalog]);

  // Về trang 1 khi đổi tab lọc / từ khóa tìm kiếm
  useEffect(() => {
    setPage(1);
  }, [searchQuery, diagnosisFilter, usageTab]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPatients = getPageItems(filteredPatients, safePage, PAGE_SIZE);

  // Lấy catalog để hiển thị nhãn chẩn đoán cho bộ lọc.
  useEffect(() => {
    let cancelled = false;
    api
      .getCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch(() => {
        /* bỏ qua — filter vẫn hoạt động với mã chẩn đoán */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    `px-3.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
      active
        ? "bg-primary text-on-primary border-primary shadow-2xs"
        : "bg-surface-container-low text-on-surface-variant border-outline-variant/60 hover:border-primary hover:text-primary"
    }`;

  // Clean medical input style (Clinical Calm 2.0)
  const fieldClass =
    "w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-body text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
  const fieldLabelClass =
    "text-xs font-bold text-on-surface-variant block mb-1";
  const sectionTitleClass =
    "text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5";

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
      if (addForm.password.length < 8) {
        setError("Mật khẩu tối thiểu 8 ký tự.");
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
    if (addForm.password.length < 8) {
      setError("Mật khẩu tối thiểu 8 ký tự.");
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
      <TopBar title="Quản lý Danh bạ Bệnh nhân" />

      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-800 text-white px-4 py-2.5 rounded-lg shadow-xl border border-emerald-600 flex items-center gap-2 font-medium text-sm animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-24 space-y-6">
        {/* Header Title & CTA */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-on-surface font-black text-2xl tracking-tight">
              Danh bạ Bệnh nhân
            </h2>
            <p className="text-on-surface-variant mt-1 text-xs font-medium">
              Quản lý hồ sơ lâm sàng, theo dõi chỉ số thể trạng và điều phối thực đơn AI cá nhân hóa
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <div className="relative min-w-[260px] flex-1 sm:flex-none">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm tên, email, Mã BN, bệnh lý..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant/70 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs placeholder:text-on-surface-variant/60"
              />
            </div>

            <UsageStatusFilterMenu
              value={usageTab}
              onChange={setUsageTab}
              counts={usageTabCounts}
            />

            <button
              type="button"
              onClick={() => setIsAddPatientOpen(true)}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Thêm bệnh nhân</span>
            </button>
          </div>
        </div>

        {/* 4 Clinical KPI Chips */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Tổng bệnh nhân
              </span>
              <span className="text-xl font-black text-on-surface tabular-nums">
                {patients.length}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">play_circle</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Đang áp dụng thực đơn
              </span>
              <span className="text-xl font-black text-emerald-900 tabular-nums">
                {activeUsageCount}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Thực đơn chờ duyệt
              </span>
              <span className="text-xl font-black text-amber-900 tabular-nums">
                {pendingPlanCount}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Yêu cầu tạo thực đơn
              </span>
              <span className="text-xl font-black text-sky-900 tabular-nums">
                {requestPlanCount}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 font-semibold flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="underline cursor-pointer font-bold"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Diagnosis Filter Pills */}
        <div className="flex items-center gap-1.5 pb-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setDiagnosisFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              diagnosisFilter === "all"
                ? "bg-primary text-on-primary shadow-2xs"
                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            Tất cả ({patients.length})
          </button>
          {diagnosisFilters.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => setDiagnosisFilter(opt.code)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                diagnosisFilter === opt.code
                  ? "bg-primary text-on-primary shadow-2xs font-bold"
                  : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>

        {/* Patients Table Container */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-on-surface-variant text-sm font-semibold animate-pulse flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[32px] text-primary animate-spin">
                progress_activity
              </span>
              <span>Đang tải danh sách bệnh nhân...</span>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline/40 mb-2">
                search_off
              </span>
              <p className="text-on-surface text-sm font-bold">
                {patients.length === 0
                  ? "Chưa có bệnh nhân nào trong hệ thống"
                  : "Không tìm thấy bệnh nhân phù hợp"}
              </p>
              <p className="text-xs mt-1 text-on-surface-variant">
                {patients.length === 0
                  ? "Đăng ký tài khoản patient hoặc dùng demo_patient_1@example.com"
                  : "Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[860px]">
                  <thead>
                    <tr className="bg-surface-container-low/60 border-b border-outline-variant/40">
                      <th className="px-5 py-3.5 text-on-surface-variant uppercase tracking-wider text-[10px] font-bold">
                        Mã BN
                      </th>
                      <th className="px-5 py-3.5 text-on-surface-variant uppercase tracking-wider text-[10px] font-bold">
                        Bệnh nhân
                      </th>
                      <th className="px-5 py-3.5 text-on-surface-variant uppercase tracking-wider text-[10px] font-bold">
                        Chẩn đoán / Bệnh lý
                      </th>
                      <th className="px-5 py-3.5 text-on-surface-variant uppercase tracking-wider text-[10px] font-bold">
                        Thực đơn
                      </th>
                      <th className="px-5 py-3.5 text-on-surface-variant uppercase tracking-wider text-[10px] font-bold">
                        Trạng thái áp dụng
                      </th>
                      <th className="px-5 py-3.5 text-on-surface-variant uppercase tracking-wider text-[10px] font-bold">
                        Cập nhật
                      </th>
                      <th className="px-5 py-3.5 text-on-surface-variant uppercase tracking-wider text-[10px] font-bold text-right">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {pagedPatients.map((patient) => {
                      const planPending = patient.planPending ?? 0;
                      const planTotal = patient.planTotal ?? 0;
                      const hasMealPlanRequest =
                        (patient.mealPlanRequestStatus ?? "none") === "pending";
                      const mealPlanRequestTitle = patient.mealPlanRequestNote
                        ? `Yêu cầu thực đơn: ${patient.mealPlanRequestNote}`
                        : "Bệnh nhân yêu cầu tạo thực đơn";
                      const avatar =
                        patient.avatar &&
                        !patient.avatar.startsWith("https://api.dicebear.com")
                          ? assetUrl(patient.avatar)
                          : "";
                      const avatarContent = (
                        <div className="relative w-9 h-9 rounded-full overflow-hidden">
                          <div className="absolute inset-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-1 ring-primary/25">
                            {initials(patient.name)}
                          </div>
                          {avatar && (
                            <img
                              src={avatar}
                              alt={patient.name}
                              className="absolute inset-0 w-full h-full rounded-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          {hasMealPlanRequest && (
                            <NotificationBadge dot className="-top-0.5 -right-0.5 bottom-auto z-10" />
                          )}
                        </div>
                      );
                      return (
                        <tr key={patient.id} className="transition-colors hover:bg-surface-container-low/40 group">
                          <td className="px-5 py-3.5">
                            <span
                              title={patient.id}
                              className="font-mono text-xs font-bold text-primary"
                            >
                              {truncateId(patient.id)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="relative w-9 h-9 shrink-0">
                                {hasMealPlanRequest ? (
                                  <Link
                                    href={`/doctor/patients/${patient.id}/generate`}
                                    title={mealPlanRequestTitle}
                                    aria-label={mealPlanRequestTitle}
                                    className="relative block w-9 h-9 rounded-xl transition-transform hover:scale-105 active:scale-95"
                                  >
                                    {avatarContent}
                                  </Link>
                                ) : (
                                  avatarContent
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-on-surface text-sm truncate group-hover:text-primary transition-colors">
                                  {patient.name}
                                </p>
                                {patient.age ? (
                                  <p className="text-[11px] text-on-surface-variant font-medium">
                                    {patient.age} tuổi · {patient.gender === "male" ? "Nam" : patient.gender === "female" ? "Nữ" : patient.gender}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              title={patient.condition}
                              className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-surface-container-low text-on-surface border border-outline-variant/60 max-w-[240px] truncate"
                            >
                              {patient.condition}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs font-medium">
                            {planTotal === 0 ? (
                              <span className="text-on-surface-variant text-[11px]">Chưa có</span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {planPending > 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-900 border border-amber-500/20 text-[11px] font-bold">
                                    {planPending} chờ duyệt
                                  </span>
                                ) : (
                                  <span className="font-bold text-on-surface font-mono">{planTotal} kế hoạch</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                patientUsageStatus(patient) === "active"
                                  ? "bg-emerald-500/10 text-emerald-900 border-emerald-500/20"
                                  : patientUsageStatus(patient) === "finished"
                                    ? "bg-surface-container-high text-on-surface-variant border-outline-variant/60"
                                    : "bg-surface-container-low text-on-surface-variant border-outline-variant/60"
                              }`}
                            >
                              {patientUsageLabel(patientUsageStatus(patient))}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-on-surface-variant text-xs font-mono">
                            {patient.lastUpdate}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/doctor/patients/${patient.id}`}
                                title="Xem hồ sơ chi tiết"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95 shadow-2xs"
                              >
                                <span className="material-symbols-outlined text-[15px]">
                                  clinical_notes
                                </span>
                                <span>Hồ sơ</span>
                              </Link>
                              <Link
                                href={`/doctor/patients/${patient.id}/generate`}
                                title="Sinh thực đơn AI"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-container-low hover:bg-surface-container-high text-on-surface font-semibold text-xs rounded-xl transition-all cursor-pointer active:scale-95 border border-outline-variant/60"
                              >
                                <span className="material-symbols-outlined text-[15px] text-primary">
                                  auto_awesome
                                </span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => setPatientToDelete(patient)}
                                title="Xóa bệnh nhân này"
                                className="w-7 h-7 rounded-xl border border-outline-variant/60 text-on-surface-variant hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
                              >
                                <span className="material-symbols-outlined text-[15px]">delete</span>
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
            </>
          )}
        </div>
      </main>

      {isAddPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-scaleUp overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    person_add
                  </span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-lg leading-tight">
                    Thêm bệnh nhân mới
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                    Tạo tài khoản & thiết lập hồ sơ lâm sàng ban đầu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddPatientOpen(false);
                  setStep(1);
                }}
                className="text-on-surface-variant hover:text-on-surface transition-colors p-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer"
                title="Đóng"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-6">
              {/* Stepper */}
              <div className="flex items-center gap-2 mb-6">
                {ADD_STEP_LABELS.map((label, i) => {
                  const n = i + 1;
                  const isActive = step === n;
                  const isDone = step > n;
                  return (
                    <Fragment key={label}>
                      {i > 0 && (
                        <div
                          className={`flex-1 h-0.5 transition-colors ${
                            isDone ? "bg-primary" : "bg-outline-variant/50"
                          }`}
                        />
                      )}
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            isActive
                              ? "bg-primary text-on-primary shadow-xs ring-4 ring-primary/20"
                              : isDone
                                ? "bg-primary/20 text-primary"
                                : "bg-surface-container-low text-on-surface-variant/60 border border-outline-variant/60"
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
                          className={`font-caption text-caption whitespace-nowrap text-[11px] ${
                            isActive
                              ? "text-primary font-bold"
                              : "text-on-surface-variant"
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
                <div className="flex items-center justify-between mb-2">
                  <h5 className={sectionTitleClass}>
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                    Tài khoản đăng nhập
                  </h5>
                  <label className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 cursor-pointer transition-colors">
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
                  <div className="mb-3 flex items-center gap-2 bg-surface-container-low/60 border border-outline-variant/60 rounded-xl px-3 py-1.5 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      image
                    </span>
                    <span className="truncate flex-1 font-medium">{pendingAvatar.name}</span>
                    <button
                      type="button"
                      onClick={() => setPendingAvatar(null)}
                      className="text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                      title="Bỏ ảnh"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                      minLength={8}
                      maxLength={128}
                      value={addForm.password}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, password: e.target.value }))
                      }
                      placeholder="Tối thiểu 8 ký tự"
                      title="Mật khẩu tối thiểu 8 ký tự"
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
                      minLength={8}
                      maxLength={128}
                      value={addForm.confirmPassword}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, confirmPassword: e.target.value }))
                      }
                      placeholder="Nhập lại mật khẩu"
                      title="Mật khẩu tối thiểu 8 ký tự"
                      className={fieldClass}
                    />
                  </div>
                </div>
              </section>

              {/* Thông tin chung */}
              <section>
                <h5 className={sectionTitleClass}>
                  <span className="material-symbols-outlined text-[16px]">badge</span>
                  Thông tin chung
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        className={`${fieldClass} appearance-none pr-8 cursor-pointer`}
                      >
                        <option value="">—</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
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
                  <span className="material-symbols-outlined text-[16px]">monitor_weight</span>
                  Chỉ số cơ thể
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  <span className="material-symbols-outlined text-[16px]">call</span>
                  Thông tin liên hệ
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <label className={fieldLabelClass}>
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
                  <span className="material-symbols-outlined text-[16px]">medical_services</span>
                  Chẩn đoán lâm sàng
                </h5>
                <input
                  type="text"
                  value={diagnosisSearch}
                  onChange={(e) => setDiagnosisSearch(e.target.value)}
                  placeholder="Tìm bệnh lý..."
                  className={fieldClass}
                />
                <div className="flex flex-wrap gap-1.5 mt-2.5">
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
                    <p className="text-xs text-on-surface-variant italic mt-1">
                      Không tìm thấy bệnh lý phù hợp.
                    </p>
                  )}
              </section>

              {/* Thuốc */}
              <section>
                <h5 className={sectionTitleClass}>
                  <span className="material-symbols-outlined text-[16px]">prescriptions</span>
                  Thuốc đang dùng
                </h5>
                <input
                  type="text"
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Tìm thuốc..."
                  className={fieldClass}
                />
                <div className="flex flex-wrap gap-1.5 mt-2.5">
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
                    <p className="text-xs text-on-surface-variant italic mt-1">
                      Không tìm thấy thuốc phù hợp.
                    </p>
                  )}
              </section>

              {/* Dị ứng */}
              <section>
                <h5 className={sectionTitleClass}>
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  Dị ứng & Phản ứng phụ
                </h5>
                <input
                  type="text"
                  value={allergySearch}
                  onChange={(e) => setAllergySearch(e.target.value)}
                  placeholder="Tìm dị ứng..."
                  className={fieldClass}
                />
                <div className="flex flex-wrap gap-1.5 mt-2.5">
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
                    <p className="text-xs text-on-surface-variant italic mt-1">
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
                  <span className="material-symbols-outlined text-[16px]">restaurant</span>
                  Dinh dưỡng & Mục tiêu điều trị
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-xs text-error font-medium">
                  {error}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-outline-variant/40 mt-4 flex justify-between items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAddPatientOpen(false);
                  setStep(1);
                }}
                disabled={addingPatient}
                className="text-on-surface-variant hover:text-on-surface px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                Hủy
              </button>
              <div className="flex items-center gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                    disabled={addingPatient}
                    className="px-4 py-2.5 border border-outline-variant/60 text-on-surface-variant rounded-xl text-sm font-semibold hover:bg-surface-container-low hover:text-on-surface transition-colors flex items-center gap-1 disabled:opacity-60 cursor-pointer"
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
                    className="bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-bold shadow-2xs hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
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
                    className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold shadow-2xs hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60"
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

      {/* DELETE PATIENT CONFIRMATION MODAL */}
      {patientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 max-w-md w-full shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">person_remove</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">Xóa bệnh nhân</h3>
                <p className="text-xs text-on-surface-variant">Mã: {patientToDelete.id}</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Bạn có chắc chắn muốn xóa hồ sơ bệnh nhân{" "}
              <strong className="text-on-surface">{patientToDelete.name}</strong>? 
              <br />
              <span className="text-xs text-rose-600 font-semibold mt-1 block">
                ⚠️ Toàn bộ thực đơn, nhật ký bữa ăn, chỉ số sức khỏe và tin nhắn của bệnh nhân này sẽ bị xóa vĩnh viễn khỏi hệ thống.
              </span>
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPatientToDelete(null)}
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
