"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { PatientCard, truncatePatientId } from "@/components/doctor/PatientCard";
import { doctorPatientToUi, type Patient } from "@/lib/mock-data";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError, type DoctorPatientSummary } from "@/lib/types";
import { asRouteId } from "@/lib/route-params";

const PRIORITY_OPTIONS = [
  "Ưu tiên món quen thuộc",
  "Đa dạng món ăn",
  "Giảm calo nhanh hơn mục tiêu",
  "Món ăn mềm dễ tiêu hóa",
  "Nguyên liệu dễ tìm kiếm",
];

const PIPELINE_NODES = [
  { title: "Phân tích hồ sơ", desc: "Tải BMI, dị ứng & mục tiêu" },
  { title: "Catalog món ăn", desc: "Chọn món khớp bệnh lý" },
  { title: "Áp dụng ràng buộc", desc: "Dị ứng, muối, đường, đạm" },
  { title: "Gọi LLM", desc: "Sinh thực đơn 7 ngày" },
  { title: "Món thay thế", desc: "1–2 lựa chọn cùng nhóm / món" },
  { title: "Hoàn thiện & Lưu", desc: "Persist + chờ bác sĩ duyệt" },
];

function toUiPatient(row: DoctorPatientSummary): Patient {
  const ui = doctorPatientToUi(row);
  return { ...ui, avatar: assetUrl(ui.avatar) || ui.avatar };
}

export default function DoctorGenerateMealPlanPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = asRouteId(params?.patientId);

  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);

  const [summary, setSummary] = useState<DoctorPatientSummary | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [stage, setStage] = useState<1 | 2>(1);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([
    "Ưu tiên món quen thuộc",
  ]);
  const [isCustomPriorityActive, setIsCustomPriorityActive] = useState(false);
  const [customPriorityText, setCustomPriorityText] = useState("");
  const [aiNotes, setAiNotes] = useState("");

  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [logs, setLogs] = useState<
    { text: string; time: string; status: "done" | "active" | "pending" }[]
  >([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedPlanId, setGeneratedPlanId] = useState<string | null>(null);

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

  const nowTime = () =>
    new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const handleStartGeneration = async () => {
    if (!patientId || !patient) return;
    setStage(2);
    setProgress(12);
    setActiveStep(0);
    setGenerateError(null);
    setGeneratedPlanId(null);
    setLogs([
      {
        text: `Khởi tạo sinh thực đơn 7 ngày (kèm món thay thế) cho ${patient.name}`,
        time: nowTime(),
        status: "done",
      },
    ]);

    const priorities = [
      ...selectedPriorities,
      ...(isCustomPriorityActive && customPriorityText.trim()
        ? [customPriorityText.trim()]
        : []),
    ];

    try {
      const plan = await api.generateMealPlanForPatient(patientId, {
        notes: aiNotes.trim(),
        priorities,
      });
      setProgress(100);
      setActiveStep(5);
      setGeneratedPlanId(plan.id);
      setLogs((prev) => [
        ...prev,
        {
          text: `Đã lưu thực đơn ${plan.id.slice(0, 8)}… — ${plan.days.length} ngày, chờ duyệt.`,
          time: nowTime(),
          status: "done",
        },
      ]);
    } catch (err) {
      setProgress(0);
      setGenerateError(
        err instanceof ApiError
          ? err.message
          : "Không tạo được thực đơn. Kiểm tra backend / API key."
      );
    }
  };

  useEffect(() => {
    if (stage !== 2 || generatedPlanId || generateError) return;
    const script = [
      { progress: 25, step: 1, log: `Tải hồ sơ: ${patient?.condition || "—"}` },
      { progress: 45, step: 2, log: "Lọc catalog món ăn theo dị ứng & bệnh lý" },
      { progress: 60, step: 3, log: "Áp dụng ngưỡng kcal / natri / carb" },
      { progress: 78, step: 4, log: "LLM đang soạn thực đơn từ catalog mock" },
      { progress: 90, step: 5, log: "Gắn món thay thế cùng nhóm cho từng món" },
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= script.length) {
        clearInterval(interval);
        return;
      }
      const item = script[idx];
      setProgress((p) => (p >= 100 ? 100 : Math.max(p, item.progress)));
      setActiveStep(item.step);
      setLogs((prev) => [
        ...prev,
        { text: item.log, time: nowTime(), status: "active" },
      ]);
      idx += 1;
    }, 900);
    return () => clearInterval(interval);
  }, [stage, generatedPlanId, generateError, patient?.condition]);

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

      <main className="p-lg max-w-[1400px]">
        <div className="mb-md flex items-center justify-between">
          <Link
            href={`/doctor/patients/${patient.id}`}
            className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại Hồ sơ bệnh nhân
          </Link>
          {stage === 2 && (
            <button
              onClick={() => {
                setStage(1);
                setGenerateError(null);
                setGeneratedPlanId(null);
                setProgress(0);
              }}
              className="px-md py-1 border border-outline-variant text-on-surface-variant rounded-lg text-xs hover:bg-surface-container-low transition-colors"
            >
              Hủy / Tạo lại
            </button>
          )}
        </div>

        {stage === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-sm pb-md border-b border-outline-variant mb-lg">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    auto_awesome
                  </span>
                  <div>
                    <h2 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                      Thiết lập yêu cầu cho AI Agent
                    </h2>
                    <p className="font-caption text-caption text-on-surface-variant text-xs">
                      AI sinh 1 thực đơn 7 ngày, mỗi món kèm lựa chọn thay thế cho {patient.name}
                    </p>
                  </div>
                </div>

                <div className="space-y-lg">
                  <div>
                    <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                      Số ngày mỗi thực đơn bao phủ
                    </label>
                    <div className="inline-flex p-1 bg-surface-container-low border border-outline-variant rounded-xl gap-1">
                      <button
                        type="button"
                        className="px-md py-sm rounded-lg text-xs font-semibold bg-primary text-on-primary shadow-xs"
                      >
                        7 ngày (Khuyến nghị)
                      </button>
                      <span className="px-md py-sm rounded-lg text-xs text-on-surface-variant/50">
                        3 ngày
                      </span>
                      <span className="px-md py-sm rounded-lg text-xs text-on-surface-variant/50">
                        14 ngày
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-xs">
                      MVP cố định 7 ngày theo contract.
                    </p>
                  </div>

                  <div>
                    <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                      Món thay thế
                    </label>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Mỗi món trong thực đơn có 1–2 món cùng nhóm (kcal gần) để bác sĩ/bệnh nhân đổi khi cần.
                      Không còn sinh nhiều phương án thực đơn song song.
                    </p>
                  </div>

                  <div>
                    <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                      Ưu tiên đặc biệt
                    </label>
                    <div className="flex flex-wrap gap-xs">
                      {PRIORITY_OPTIONS.map((item) => {
                        const isSelected = selectedPriorities.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => togglePriority(item)}
                            className={`px-md py-sm rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-xs ${
                              isSelected
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary/50"
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
                        className={`px-md py-sm rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-xs ${
                          isCustomPriorityActive
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary/50"
                        }`}
                      >
                        {isCustomPriorityActive && (
                          <span className="material-symbols-outlined text-[14px]">check</span>
                        )}
                        Khác...
                      </button>
                    </div>
                    {isCustomPriorityActive && (
                      <div className="mt-xs">
                        <input
                          type="text"
                          value={customPriorityText}
                          onChange={(e) => setCustomPriorityText(e.target.value)}
                          placeholder="Nhập ưu tiên đặc biệt khác..."
                          className="w-full p-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-body text-on-surface focus:outline-none focus:border-primary transition-all shadow-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                      Ghi chú bổ sung cho AI Agent
                    </label>
                    <textarea
                      value={aiNotes}
                      onChange={(e) => setAiNotes(e.target.value)}
                      rows={3}
                      placeholder="Ví dụ: ưu tiên món hấp luộc miền Bắc, hạn chế đồ chiên xào..."
                      className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body text-body text-on-surface focus:outline-none focus:border-primary text-sm transition-shadow"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-lg border-t border-outline-variant mt-lg">
                <button
                  onClick={() => void handleStartGeneration()}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-body-bold py-md px-lg rounded-lg transition-colors shadow-xs active:scale-[0.99] flex items-center justify-center gap-sm text-sm font-bold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  <span>Bắt đầu sinh thực đơn 7 ngày</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-md">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs">
                <div className="flex justify-between items-center pb-sm border-b border-outline-variant mb-md">
                  <h3 className="font-h2 text-h2 text-on-surface font-semibold text-sm flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                    Tóm tắt bệnh nhân
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsSelectModalOpen(true)}
                    className="px-sm py-1 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-xs font-semibold text-primary flex items-center gap-xs transition-colors cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                    Thay đổi
                  </button>
                </div>
                <div className="space-y-sm text-xs">
                  <div className="flex items-center gap-sm min-w-0">
                    {patient.avatar ? (
                      <img
                        src={patient.avatar}
                        alt={patient.name}
                        className="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full border border-outline-variant shrink-0 bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                        {(patient.name.trim().charAt(0) || "?").toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-on-surface truncate">{patient.name}</p>
                      <p className="text-on-surface-variant text-[11px] truncate" title={patient.id}>
                        {patient.age} tuổi • {patient.gender} • ID: {truncatePatientId(patient.id)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block mb-1">Chẩn đoán:</span>
                    <span className="px-sm py-1 bg-tertiary-container/30 text-tertiary font-semibold rounded-full text-[11px] inline-block border border-tertiary/20">
                      {patient.condition}
                    </span>
                  </div>
                  {summary && (
                    <>
                      <p className="text-on-surface-variant">
                        Mục tiêu: <strong className="text-on-surface">{summary.target_kcal} kcal</strong>
                      </p>
                      <p className="text-on-surface-variant">
                        Dị ứng: {summary.allergies.length ? summary.allergies.join(", ") : "—"}
                      </p>
                      <p className="text-on-surface-variant">
                        Thuốc: {summary.medications.length ? summary.medications.join(", ") : "—"}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs">
                <div className="flex justify-between items-center pb-sm border-b border-outline-variant mb-md">
                  <h3 className="font-h2 text-h2 text-on-surface font-semibold text-sm flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary text-[18px]">gavel</span>
                    Quy tắc sinh thực đơn
                  </h3>
                </div>
                <div className="space-y-xs text-xs text-on-surface-variant leading-relaxed">
                  <p>• 1 thực đơn 7 ngày, status chờ duyệt.</p>
                  <p>• Mỗi món kèm 1–2 món thay thế cùng nhóm.</p>
                  <p>• LLM chỉ chọn món trong catalog mock (tạm, khi AI core chưa xong).</p>
                  <p>• Tương tác thuốc nguy hiểm sẽ được đổi món và ghi vào nhật ký swap.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === 2 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-md max-w-[1100px] mx-auto">
            <div className="mb-lg">
              <div className="flex justify-between items-center mb-xs">
                <div className="flex items-center gap-xs">
                  {progress < 100 && !generateError && (
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping inline-block"></span>
                  )}
                  <h2 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    {generateError
                      ? "Không tạo được thực đơn"
                      : progress < 100
                        ? "AI đang tạo thực đơn 7 ngày kèm món thay thế..."
                        : "Đã hoàn tất tạo thực đơn!"}
                  </h2>
                </div>
                <span className="font-mono text-sm font-bold text-primary">{progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            <div className="py-md px-sm bg-surface-container-low/50 border border-outline-variant/60 rounded-xl mb-lg overflow-x-auto">
              <div className="flex items-center justify-between min-w-[750px] relative px-xs">
                <div className="absolute top-[20px] left-[40px] right-[40px] h-[2px] bg-outline-variant z-0"></div>
                {PIPELINE_NODES.map((node, idx) => {
                  const isDone = idx < activeStep || progress === 100;
                  const isActive = idx === activeStep && progress < 100 && !generateError;
                  return (
                    <div key={idx} className="flex flex-col items-center text-center relative z-10 w-[110px]">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isDone
                            ? "bg-primary text-on-primary shadow-xs"
                            : isActive
                              ? "bg-primary text-on-primary ring-4 ring-primary/20 scale-110 shadow-md"
                              : "bg-surface-container-lowest border-2 border-outline-variant text-outline"
                        }`}
                      >
                        {isDone ? (
                          <span className="material-symbols-outlined text-[20px]">check</span>
                        ) : isActive ? (
                          <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                        ) : (
                          <span className="text-xs font-bold">{idx + 1}</span>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-xs font-semibold leading-tight ${
                          isDone || isActive ? "text-on-surface font-bold" : "text-on-surface-variant/60"
                        }`}
                      >
                        {node.title}
                      </p>
                      <p className="text-[10px] text-on-surface-variant line-clamp-1 mt-0.5">{node.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-inner mb-lg">
              <div className="flex justify-between items-center border-b border-outline-variant/40 pb-xs mb-sm">
                <span className="font-mono text-xs text-on-surface-variant font-bold flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
                  Nhật ký tiến trình
                </span>
              </div>
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-xs font-mono text-xs">
                {logs.map((log, lIdx) => (
                  <div
                    key={lIdx}
                    className={`flex items-start gap-sm p-sm rounded-lg border ${
                      lIdx === logs.length - 1
                        ? "bg-primary/5 border-primary/30 text-on-surface font-semibold"
                        : "bg-surface-container-low/40 border-transparent text-on-surface-variant"
                    }`}
                  >
                    <span className="text-[10px] text-on-surface-variant shrink-0 mt-[2px]">[{log.time}]</span>
                    <p className="flex-1 text-[12px] leading-relaxed">{log.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {generateError && (
              <div className="mb-md p-md bg-error-container/30 border border-error/30 rounded-xl text-sm text-error">
                {generateError}
              </div>
            )}

            {(progress === 100 && generatedPlanId) || generateError ? (
              <div className="flex justify-end gap-md pt-sm border-t border-outline-variant">
                <button
                  onClick={() => {
                    setStage(1);
                    setGenerateError(null);
                    setGeneratedPlanId(null);
                    setProgress(0);
                  }}
                  className="px-md py-sm border border-outline-variant text-on-surface-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low transition-colors"
                >
                  Tạo lại với tham số khác
                </button>
                {generatedPlanId && (
                  <Link
                    href={`/doctor/reviews/${patient.id}/${generatedPlanId}`}
                    className="bg-emerald-700 text-white font-body-bold px-lg py-sm rounded-lg hover:bg-emerald-800 transition-colors text-xs font-bold flex items-center gap-xs shadow-xs"
                  >
                    <span>Xem thực đơn & món thay thế</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </Link>
                )}
              </div>
            ) : null}
          </div>
        )}
      </main>

      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-outline-variant shrink-0">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Chọn bệnh nhân để tạo thực đơn AI</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {filteredPatients.length} bệnh nhân
                </p>
              </div>
              <button
                onClick={() => setIsSelectModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="px-5 py-3 shrink-0">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Tìm theo tên, mã, hoặc bệnh lý..."
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
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
