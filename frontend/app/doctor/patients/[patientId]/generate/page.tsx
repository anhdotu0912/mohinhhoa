"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { PatientCard, truncatePatientId } from "@/components/doctor/PatientCard";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useQueueStore } from "@/lib/queue-store";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";
import { asRouteId } from "@/lib/route-params";
import {
  formatDateFull,
  parseFlexibleDate,
} from "@/lib/plan-expiry";
import {
  parseSlotIntentParams,
  saveSlotIntent,
  type MealPlanSlotIntent,
} from "@/lib/plan-slot-intent";

const PRIORITY_OPTIONS = [
  "Ưu tiên món quen thuộc",
  "Đa dạng món ăn",
  "Giảm calo nhanh hơn mục tiêu",
  "Món ăn mềm dễ tiêu hóa",
  "Nguyên liệu dễ tìm kiếm",
];

/** Lấy chữ cái đầu của tên (vd "Nguyễn Văn A" → "NA") — khớp /doctor/patients. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function resolvePatientAvatar(raw: string | null | undefined): string {
  if (
    !raw ||
    raw.startsWith("https://api.dicebear.com") ||
    raw.includes("googleusercontent.com")
  ) {
    return "";
  }
  return assetUrl(raw) || "";
}

function toUiPatient(row: DoctorPatientSummary): Patient {
  const ui = doctorPatientToUi(row);
  return { ...ui, avatar: resolvePatientAvatar(ui.avatar) };
}

export default function DoctorGenerateMealPlanPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const patientId = asRouteId(params?.patientId);

  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);

  const [summary, setSummary] = useState<DoctorPatientSummary | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([
    "Ưu tiên món quen thuộc",
  ]);
  const [isCustomPriorityActive, setIsCustomPriorityActive] = useState(false);
  const [customPriorityText, setCustomPriorityText] = useState("");
  const [aiNotes, setAiNotes] = useState("");

  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [enqueueing, setEnqueueing] = useState(false);

  const openDrawer = useQueueStore((s) => s.openDrawer);
  const jobs = useQueueStore((s) => s.jobs);

  const activeJob = useMemo(
    () =>
      patientId
        ? jobs.find(
            (j) =>
              j.patientId === patientId &&
              (j.status === "queued" || j.status === "processing")
          )
        : undefined,
    [jobs, patientId]
  );

  const slotIntent = useMemo((): MealPlanSlotIntent | null => {
    if (!patientId) return null;
    return parseSlotIntentParams(patientId, searchParams);
  }, [patientId, searchParams]);

  const slotIntentLabel = useMemo(() => {
    if (!slotIntent) return null;
    const start = parseFlexibleDate(slotIntent.startsOn);
    const end = start ? new Date(start) : null;
    if (end) end.setDate(end.getDate() + 6);
    const range =
      start && end
        ? `${formatDateFull(start)} – ${formatDateFull(end)}`
        : slotIntent.startsOn;
    if (slotIntent.action === "replace") {
      return `Sẽ thay thế thực đơn tuần ${slotIntent.slotKey === "current" ? "này" : "sau"} (${range})`;
    }
    if (slotIntent.slotKey === "next") {
      return `Sẽ gán vào tuần sau (${range})`;
    }
    if (slotIntent.slotKey === "current") {
      return `Sẽ gán vào tuần hiện tại (${range})`;
    }
    return `Sẽ gán vào tuần trống (${range})`;
  }, [slotIntent]);

  useEffect(() => {
    if (slotIntent) saveSlotIntent(slotIntent);
  }, [slotIntent]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
    }
  }, [hydrated, token, role, router]);

  const loadPatient = useCallback(async () => {
    if (!token || role !== "doctor") return;
    if (!patientId) {
      setLoading(false);
      setLoadError("Thiếu mã bệnh nhân.");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [row, list] = await Promise.all([
        api.getDoctorPatient(patientId),
        api.listDoctorPatients().catch(() => [] as DoctorPatientSummary[]),
      ]);
      setSummary(row);
      setPatient(toUiPatient(row));
      setAllPatients(list.map(toUiPatient));
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Không tải được hồ sơ bệnh nhân."
      );
      setSummary(null);
      setPatient(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, token, role]);

  useEffect(() => {
    void loadPatient();
  }, [loadPatient]);

  const filteredPatients = allPatients.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q)
    );
  });

  const handleSelectPatient = (newPatientId: string) => {
    setIsSelectModalOpen(false);
    router.push(`/doctor/patients/${newPatientId}/generate`);
  };

  const togglePriority = (item: string) => {
    if (selectedPriorities.includes(item)) {
      setSelectedPriorities(selectedPriorities.filter((p) => p !== item));
    } else {
      setSelectedPriorities([...selectedPriorities, item]);
    }
  };

  /** Đưa 1 bệnh nhân vào hàng đợi AI rồi chuyển sang trang theo dõi. */
  const handleStartGeneration = () => {
    if (!patientId || !patient || enqueueing) return;

    // Đã có job đang chờ/xử lý → mở bảng hàng đợi
    if (activeJob) {
      if (slotIntent) saveSlotIntent(slotIntent);
      openDrawer();
      router.push("/doctor/patients/queue");
      return;
    }

    const priorities = [
      ...selectedPriorities,
      ...(isCustomPriorityActive && customPriorityText.trim()
        ? [customPriorityText.trim()]
        : []),
    ];

    setEnqueueing(true);
    if (slotIntent) saveSlotIntent(slotIntent);
    useQueueStore.getState().addJobs([
      {
        id: patientId,
        name: patient.name,
        avatar: patient.avatar,
        condition: patient.condition,
        age: patient.age,
        gender: patient.gender,
        notes: aiNotes.trim() || undefined,
        priorities,
        slotIntent: slotIntent ?? undefined,
      },
    ]);
    openDrawer();
    // Vào bảng hàng đợi — bấm "Xem quy trình" tại cột Thao tác
    router.push("/doctor/patients/queue");
  };

  if (!hydrated || !token || role !== "doctor") {
    return null;
  }

  if (loading) {
    return (
      <>
        <TopBar title="Tạo thực đơn mới bằng AI" />
        <main className="p-lg max-w-[1400px] text-sm text-on-surface-variant">
          Đang tải hồ sơ bệnh nhân…
        </main>
      </>
    );
  }

  if (loadError || !patient) {
    return (
      <>
        <TopBar title="Tạo thực đơn mới bằng AI" />
        <main className="p-lg max-w-[1400px]">
          <p className="text-sm text-error mb-md">{loadError || "Không tìm thấy bệnh nhân."}</p>
          <Link href="/doctor/patients" className="text-xs font-semibold text-primary hover:underline">
            Quay lại danh sách bệnh nhân
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Tạo thực đơn mới bằng AI" />

      <main className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {slotIntentLabel && (
          <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 text-sm text-on-surface font-medium shadow-2xs">
            <span className="material-symbols-outlined text-primary text-[18px] align-middle mr-1.5">
              event_available
            </span>
            {slotIntentLabel}
          </div>
        )}
        <div className="flex items-center justify-between">
          <Link
            href={
              slotIntent
                ? `/doctor/history/${patient.id}`
                : `/doctor/patients/${patient.id}`
            }
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            {slotIntent ? "Quay lại Lịch sử tuần" : "Quay lại Hồ sơ bệnh nhân"}
          </Link>
        </div>

        {activeJob && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl border border-primary/30 bg-primary/5 shadow-2xs">
            <div className="flex items-start gap-3 min-w-0">
              <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
                hourglass_top
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface">
                  Đang có job trong hàng đợi tạo thực đơn AI
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                  Trạng thái:{" "}
                  {activeJob.status === "processing" ? "Đang xử lý" : "Đang chờ"} — có thể
                  theo dõi tiến trình trên trang hàng đợi.
                </p>
              </div>
            </div>
            <Link
              href="/doctor/patients/queue"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              Mở hàng đợi
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-subtle flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-3 pb-4 border-b border-outline-variant/40 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">
                    auto_awesome
                  </span>
                </div>
                <div>
                  <h2 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Thiết lập yêu cầu cho AI Agent
                  </h2>
                  <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                    AI sinh 1 thực đơn 7 ngày, mỗi món kèm lựa chọn thay thế cho {patient.name}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="font-label text-label text-on-surface block mb-1.5 font-bold text-xs uppercase tracking-wider">
                    Số ngày mỗi thực đơn bao phủ
                  </label>
                  <div className="inline-flex p-1 bg-surface-container-low border border-outline-variant/60 rounded-xl gap-1">
                    <button
                      type="button"
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary text-on-primary shadow-2xs"
                    >
                      7 ngày (Khuyến nghị)
                    </button>
                    <span className="px-4 py-1.5 rounded-lg text-xs text-on-surface-variant/50 font-medium">
                      3 ngày
                    </span>
                    <span className="px-4 py-1.5 rounded-lg text-xs text-on-surface-variant/50 font-medium">
                      14 ngày
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1.5 font-medium">
                    MVP cố định 7 ngày theo contract.
                  </p>
                </div>

                <div>
                  <label className="font-label text-label text-on-surface block mb-1 font-bold text-xs uppercase tracking-wider">
                    Món thay thế
                  </label>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Mỗi món trong thực đơn có 1–2 món cùng nhóm (kcal gần) để bác sĩ/bệnh nhân đổi khi cần.
                    Không còn sinh nhiều phương án thực đơn song song.
                  </p>
                </div>

                <div>
                  <label className="font-label text-label text-on-surface block mb-2 font-bold text-xs uppercase tracking-wider">
                    Ưu tiên đặc biệt
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITY_OPTIONS.map((item) => {
                      const isSelected = selectedPriorities.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => togglePriority(item)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 ${
                            isSelected
                              ? "bg-primary text-on-primary border-primary"
                              : "bg-surface-container-low text-on-surface-variant border-outline-variant/60 hover:border-primary/50"
                          }`}
                        >
                          {isSelected && (
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          )}
                          {item}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setIsCustomPriorityActive(!isCustomPriorityActive)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 ${
                        isCustomPriorityActive
                          ? "bg-primary text-on-primary border-primary"
                          : "bg-surface-container-low text-on-surface-variant border-outline-variant/60 hover:border-primary/50"
                      }`}
                    >
                      {isCustomPriorityActive && (
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      )}
                      Khác...
                    </button>
                  </div>
                  {isCustomPriorityActive && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={customPriorityText}
                        onChange={(e) => setCustomPriorityText(e.target.value)}
                        placeholder="Nhập ưu tiên đặc biệt khác..."
                        className="w-full px-3.5 py-2 bg-surface-container-low border border-outline-variant/60 rounded-xl text-xs font-body text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-label text-label text-on-surface block mb-1.5 font-bold text-xs uppercase tracking-wider">
                    Ghi chú bổ sung cho AI Agent
                  </label>
                  <textarea
                    value={aiNotes}
                    onChange={(e) => setAiNotes(e.target.value)}
                    rows={3}
                    placeholder="Ví dụ: ưu tiên món hấp luộc miền Bắc, hạn chế đồ chiên xào..."
                    className="w-full p-3.5 bg-surface-container-low border border-outline-variant/60 rounded-xl font-body text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-outline-variant/40 mt-6">
              <button
                onClick={handleStartGeneration}
                disabled={enqueueing}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-on-primary font-bold py-3 px-6 rounded-xl transition-all shadow-2xs active:scale-[0.99] flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {activeJob ? "queue" : "playlist_add"}
                </span>
                <span>
                  {activeJob
                    ? "Xem tiến trình trong hàng đợi"
                    : "Thêm vào hàng đợi tạo thực đơn AI"}
                </span>
              </button>
              <p className="text-[11px] text-on-surface-variant text-center mt-2 font-medium">
                Vì thời gian sinh thực đơn khá lâu, job sẽ chạy trong hàng đợi — bạn có thể
                chuyển tab / làm việc khác.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-subtle">
              <div className="flex justify-between items-center pb-3 border-b border-outline-variant/40 mb-4">
                <h3 className="font-h2 text-h2 text-on-surface font-bold text-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                  Tóm tắt bệnh nhân
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSelectModalOpen(true)}
                  className="px-3 py-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-xs font-bold text-primary flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  Thay đổi
                </button>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-10 h-10 shrink-0">
                    <div className="absolute inset-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-label text-xs font-bold ring-2 ring-primary/20">
                      {initials(patient.name)}
                    </div>
                    {patient.avatar && (
                      <img
                        src={patient.avatar}
                        alt={patient.name}
                        className="absolute inset-0 w-10 h-10 rounded-full object-cover ring-2 ring-outline-variant/40 bg-surface-container"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{patient.name}</p>
                    <p className="text-on-surface-variant text-[11px] truncate font-medium" title={patient.id}>
                      {patient.age} tuổi • {patient.gender} • ID: <span className="font-mono text-primary font-semibold">{truncatePatientId(patient.id)}</span>
                    </p>
                  </div>
                </div>
                <div>
                  <span className="text-on-surface-variant block mb-1 font-semibold text-[11px] uppercase tracking-wider">Chẩn đoán:</span>
                  <span className="px-3 py-1 bg-primary/10 text-primary font-bold rounded-full text-xs inline-block border border-primary/20">
                    {patient.condition}
                  </span>
                </div>
                {summary && (
                  <div className="space-y-1.5 pt-2 border-t border-outline-variant/30 text-on-surface-variant">
                    <p>
                      Mục tiêu: <strong className="text-on-surface tabular-nums">{summary.target_kcal} kcal</strong>
                    </p>
                    <p>
                      Dị ứng: {summary.allergies.length ? summary.allergies.join(", ") : "—"}
                    </p>
                    <p>
                      Thuốc: {summary.medications.length ? summary.medications.join(", ") : "—"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-subtle">
              <div className="flex justify-between items-center pb-3 border-b border-outline-variant/40 mb-3">
                <h3 className="font-h2 text-h2 text-on-surface font-bold text-sm flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">gavel</span>
                  Quy tắc sinh thực đơn
                </h3>
              </div>
              <div className="space-y-2 text-xs text-on-surface-variant leading-relaxed font-medium">
                <p>• 1 thực đơn 7 ngày, status chờ duyệt.</p>
                <p>• Mỗi món kèm 1–2 món thay thế cùng nhóm.</p>
                <p>• Job chạy tuần tự trong hàng đợi (FIFO).</p>
                <p>• Tương tác thuốc nguy hiểm sẽ được đổi món và ghi vào nhật ký swap.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden animate-scaleUp">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant/40 shrink-0">
              <div>
                <h3 className="text-base font-bold text-on-surface">Chọn bệnh nhân để tạo thực đơn AI</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {filteredPatients.length} bệnh nhân
                </p>
              </div>
              <button
                onClick={() => setIsSelectModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-xl hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="px-6 py-3 shrink-0">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Tìm theo tên, mã, hoặc bệnh lý..."
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant/60 rounded-xl text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
              {filteredPatients.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  isSelected={p.id === patient.id}
                  actionText={p.id === patient.id ? "Đang chọn" : "Chọn"}
                  onSelect={handleSelectPatient}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
