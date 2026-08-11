"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";
import { PatientCard } from "@/components/doctor/PatientCard";
import { DEFAULT_PLAN_DAYS, DEFAULT_VARIANTS_PER_JOB, DURATION_OPTIONS } from "@/lib/config";
import { usePlansStore, MealPlanItem, DayMealPlan } from "@/lib/plans-store";

const ALLERGIES_LIST = ["Hải sản", "Sulfonamides"];

export default function DoctorGenerateMealPlanPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = (params?.patientId as string) || "BN-10293";

  const patient =
    MOCK_PATIENTS.find((p) => p.id === patientId) || MOCK_PATIENTS[0];

  // Stage: 1 = Configuration Form, 2 = Agent Processing
  const [stage, setStage] = useState<1 | 2>(1);

  // Form states
  const [daysCount, setDaysCount] = useState<number>(DEFAULT_PLAN_DAYS);
  const [variantsCount, setVariantsCount] = useState<number>(DEFAULT_VARIANTS_PER_JOB);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([
    "Ưu tiên món quen thuộc",
  ]);
  const [isCustomPriorityActive, setIsCustomPriorityActive] = useState(false);
  const [customPriorityText, setCustomPriorityText] = useState("");
  const [aiNotes, setAiNotes] = useState("");

  // Patient Selection Modal state
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  const { addPlanGroup } = usePlansStore();

  const filteredPatients = MOCK_PATIENTS.filter((p) => {
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

  // Agent Processing states
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [logs, setLogs] = useState<
    { text: string; time: string; status: "done" | "active" | "pending" }[]
  >([]);

  const priorityOptions = [
    "Ưu tiên món quen thuộc",
    "Đa dạng món ăn",
    "Giảm calo nhanh hơn mục tiêu",
    "Món ăn mềm dễ tiêu hóa",
    "Nguyên liệu dễ tìm kiếm",
  ];

  const pipelineNodes = [
    { title: "Phân tích hồ sơ", desc: "Tải BMI, dị ứng & mục tiêu" },
    { title: "Truy vấn CSDL (RAG)", desc: "Tìm món ăn khớp tiêu chí" },
    { title: "Áp dụng ràng buộc", desc: "Giới hạn muối, đường, đạm" },
    { title: "Sinh 3 phương án", desc: "Đa dạng hóa cơ cấu món" },
    { title: "Bao phủ nhiều ngày", desc: `Tạo đủ ${daysCount} ngày/phương án` },
    { title: "Hoàn thiện & Lưu", desc: "Gom nhóm variantGroupId" },
  ];

  const togglePriority = (item: string) => {
    if (selectedPriorities.includes(item)) {
      setSelectedPriorities(selectedPriorities.filter((p) => p !== item));
    } else {
      setSelectedPriorities([...selectedPriorities, item]);
    }
  };

  const handleStartGeneration = () => {
    setStage(2);
    setProgress(10);
    setActiveStep(0);
    setLogs([
      {
        text: `Đã khởi tạo phiên sinh ${variantsCount} phương án thực đơn (${daysCount} ngày) cho bệnh nhân ${patient.name} (${patient.id})`,
        time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        status: "done",
      },
    ]);
  };

  // Simulation effect for Stage 2
  useEffect(() => {
    if (stage !== 2) return;

    const customLogText = isCustomPriorityActive && customPriorityText.trim()
      ? `, Ưu tiên riêng: "${customPriorityText.trim()}"`
      : "";

    const streamScript = [
      {
        progress: 20,
        step: 1,
        log: `Tải thông tin lâm sàng: Chẩn đoán ${patient.condition}, dị ứng (${ALLERGIES_LIST.join(", ")})${customLogText}`,
      },
      {
        progress: 40,
        step: 2,
        log: `Truy vấn CSDL dinh dưỡng Việt Nam: Đã chuẩn bị kho món ăn phù hợp chỉ số đường huyết & suy thận`,
      },
      {
        progress: 60,
        step: 3,
        log: `Khởi tạo 3 phương án thực đơn song song: Phương án 1 (DASH Chuẩn), Phương án 2 (Tăng xơ & Đạm kiềm), Phương án 3 (Mềm dễ tiêu)`,
      },
      {
        progress: 80,
        step: 4,
        log: `Xây dựng chi tiết đủ ${daysCount} ngày cho từng phương án (cân bằng calo, muối < 2g/ngày từng bữa chính & bữa phụ)`,
      },
      {
        progress: 95,
        step: 5,
        log: "Kiểm tra an toàn dị ứng & tương tác thuốc trên cả 3 phương án: Đã thông qua kiểm soát lâm sàng",
      },
      {
        progress: 100,
        step: 5,
        log: `Đã tạo xong ${variantsCount} phương án thực đơn (${daysCount} ngày)! Sẵn sàng để bác sĩ so sánh & chọn duyệt.`,
      },
    ];

    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < streamScript.length) {
        const item = streamScript[currentIdx];
        setProgress(item.progress);
        setActiveStep(item.step);
        setLogs((prev) => [
          ...prev,
          {
            text: item.log,
            time: new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            status: item.progress === 100 ? "done" : "active",
          },
        ]);
        currentIdx++;
      } else {
        // Materialize plans to Zustand store on completion
        const timestamp = Date.now().toString().slice(-6);
        const variantGroupId = `GRP-${patient.id.replace(/[^a-zA-Z0-9]/g, "")}-${timestamp}`;
        const createdTimeString = new Date().toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const titles = [
          `Phương án 1: Thực đơn Chuẩn y khoa DASH (${daysCount} ngày)`,
          `Phương án 2: Thực đơn Tăng cường chất xơ & Đạm kiềm tính (${daysCount} ngày)`,
          `Phương án 3: Thực đơn Mềm dễ chế biến & Tiêu hóa nhanh (${daysCount} ngày)`,
        ];

        const newPlans: MealPlanItem[] = [];

        for (let idx = 1; idx <= variantsCount; idx++) {
          const planId = `PLAN-${patient.id.replace(/[^a-zA-Z0-9]/g, "")}-V${idx}-${timestamp}`;
          const mockDays: DayMealPlan[] = [];

          for (let d = 1; d <= daysCount; d++) {
            mockDays.push({
              dayIndex: d,
              dayName: `Ngày ${d}`,
              breakfast: [{ name: "Phở gà ít béo / Cháo yến mạch", calories: 330, salt: 1.0, sugar: 0 }],
              lunch: [{ name: "Cơm gạo lứt + Cá hồi / Đậu phụ sốt cà", calories: 460, salt: 0.7, sugar: 0 }],
              dinner: [{ name: "Ức gà hấp gừng / Nấm đùi gà kho", calories: 300, salt: 0.5, sugar: 1 }],
              snack: [{ name: "Trái cây ít ngọt (Ổi/Táo)", calories: 80, salt: 0, sugar: 6 }],
              totalCalories: 1750,
              totalSalt: 1.6,
              totalSugar: 7.0,
            });
          }

          newPlans.push({
            id: planId,
            variantGroupId,
            variantIndex: idx,
            totalVariants: variantsCount,
            patientId: patient.id,
            patientName: patient.name,
            patientCode: patient.id,
            condition: patient.condition,
            duration: `${daysCount} ngày`,
            daysCount,
            status: "pending",
            planTitle: titles[(idx - 1) % titles.length],
            calories: "1750 kcal/ngày",
            salt: "1.6g/ngày",
            sugar: "7g/ngày",
            createdAt: createdTimeString,
            days: mockDays,
            breakfast: mockDays[0].breakfast,
            lunch: mockDays[0].lunch,
            dinner: mockDays[0].dinner,
            warnings: [`Tự động kiểm soát Natri & Đường theo guideline cho ${daysCount} ngày.`],
            citations: ["QĐ 41/2016-BYT (Hướng dẫn Dinh dưỡng Lâm sàng)", "AHA 2023 Guidelines"],
          });
        }

        addPlanGroup(newPlans);
        clearInterval(interval);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [stage, patient, daysCount, variantsCount, isCustomPriorityActive, customPriorityText, addPlanGroup]);

  return (
    <>
      <TopBar
        title="Tạo thực đơn mới bằng AI (Nhiều phương án)"
      />

      <main className="p-lg max-w-[1400px]">
        {/* Back Link & Header */}
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
              onClick={() => setStage(1)}
              className="px-md py-1 border border-outline-variant text-on-surface-variant rounded-lg text-xs hover:bg-surface-container-low transition-colors"
            >
              Hủy / Tạo lại
            </button>
          )}
        </div>

        {/* STAGE 1: FORM CONFIGURATION */}
        {stage === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            {/* Left Column: Form Card */}
            <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-sm pb-md border-b border-outline-variant mb-lg">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    auto_awesome
                  </span>
                  <div>
                    <h2 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                      Thiết lập yêu cầu cho AI Agent (Sinh 3 phương án)
                    </h2>
                    <p className="font-caption text-caption text-on-surface-variant text-xs">
                      AI sẽ tự động sinh 3 phương án thực đơn bao phủ đủ số ngày cấu hình cho {patient.name}
                    </p>
                  </div>
                </div>

                <div className="space-y-lg">
                  {/* Option 1: Segmented Control - Duration */}
                  <div>
                    <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                      Số ngày mỗi thực đơn bao phủ (Cấu hình linh hoạt)
                    </label>
                    <div className="inline-flex p-1 bg-surface-container-low border border-outline-variant rounded-xl gap-1">
                      {DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDaysCount(opt.value)}
                          className={`px-md py-sm rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            daysCount === opt.value
                              ? "bg-primary text-on-primary shadow-xs"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Option 2: Variants Count Setting */}
                  <div>
                    <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                      Số lượng phương án tạo ra (Mặc định 3 phương án/lần)
                    </label>
                    <div className="inline-flex p-1 bg-surface-container-low border border-outline-variant rounded-xl gap-1">
                      {[2, 3, 4].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setVariantsCount(v)}
                          className={`px-md py-sm rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            variantsCount === v
                              ? "bg-primary text-on-primary shadow-xs font-bold"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          {v} phương án {v === DEFAULT_VARIANTS_PER_JOB ? "(Mặc định)" : ""}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Option 3: Multi-select Chips - Priorities */}
                  <div>
                    <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                      Ưu tiên đặc biệt
                    </label>
                    <div className="flex flex-wrap gap-xs">
                      {priorityOptions.map((item) => {
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
                              <span className="material-symbols-outlined text-[14px]">
                                check
                              </span>
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
                          <span className="material-symbols-outlined text-[14px]">
                            check
                          </span>
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
                          placeholder="Nhập ưu tiên đặc biệt khác (ví dụ: Ăn chay thanh đạm, ít dầu mỡ...)..."
                          className="w-full p-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-body text-on-surface focus:outline-none focus:border-primary transition-all shadow-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Option 4: Multiline Textarea - Notes for AI */}
                  <div>
                    <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                      Ghi chú bổ sung cho AI Agent
                    </label>
                    <textarea
                      value={aiNotes}
                      onChange={(e) => setAiNotes(e.target.value)}
                      rows={3}
                      placeholder="Ví dụ: Bệnh nhân không thích hải sản, ưu tiên món hấp luộc miền Bắc, hạn chế đồ chiên xào..."
                      className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body text-body text-on-surface focus:outline-none focus:border-primary text-sm transition-shadow"
                    />
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-lg border-t border-outline-variant mt-lg">
                <button
                  onClick={handleStartGeneration}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-body-bold py-md px-lg rounded-lg transition-colors shadow-xs active:scale-[0.99] flex items-center justify-center gap-sm text-sm font-bold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  <span>Bắt đầu sinh {variantsCount} phương án ({daysCount} ngày)</span>
                </button>
              </div>
            </div>

            {/* Right Column: Patient Reference Info */}
            <div className="lg:col-span-5 space-y-md">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs">
                <div className="flex justify-between items-center pb-sm border-b border-outline-variant mb-md">
                  <h3 className="font-h2 text-h2 text-on-surface font-semibold text-sm flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      person
                    </span>
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
                  <div className="flex items-center gap-sm">
                    <img
                      src={patient.avatar}
                      alt={patient.name}
                      className="w-10 h-10 rounded-full object-cover border border-outline-variant"
                    />
                    <div>
                      <p className="font-bold text-on-surface">{patient.name}</p>
                      <p className="text-on-surface-variant text-[11px]">
                        {patient.age} tuổi • {patient.gender} • ID: {patient.id}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block mb-1">Chẩn đoán:</span>
                    <span className="px-sm py-1 bg-tertiary-container/30 text-tertiary font-semibold rounded-full text-[11px] inline-block border border-tertiary/20">
                      {patient.condition}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-xs">
                <div className="flex justify-between items-center pb-sm border-b border-outline-variant mb-md">
                  <h3 className="font-h2 text-h2 text-on-surface font-semibold text-sm flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      gavel
                    </span>
                    Quy tắc sinh 3 phương án
                  </h3>
                </div>
                <div className="space-y-xs text-xs text-on-surface-variant leading-relaxed">
                  <p>• <strong>Phương án 1:</strong> Chuẩn y khoa DASH truyền thống.</p>
                  <p>• <strong>Phương án 2:</strong> Đậm vị thực vật, tăng cường chất xơ & đạm kiềm tính.</p>
                  <p>• <strong>Phương án 3:</strong> Món ăn mềm, dễ chuẩn bị nhanh & dễ tiêu hóa.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: AI AGENT PROCESSING & LOG REASONING STREAM */}
        {stage === 2 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-md max-w-[1100px] mx-auto">
            {/* Header / Progress Bar */}
            <div className="mb-lg">
              <div className="flex justify-between items-center mb-xs">
                <div className="flex items-center gap-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping inline-block"></span>
                  <h2 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    {progress < 100
                      ? `AI đang tạo ${variantsCount} phương án thực đơn (${daysCount} ngày)...`
                      : `Đã hoàn tất tạo ${variantsCount} phương án thực đơn!`}
                  </h2>
                </div>
                <span className="font-mono text-sm font-bold text-primary">
                  {progress}%
                </span>
              </div>

              <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* NODE-FLOW DIAGRAM */}
            <div className="py-md px-sm bg-surface-container-low/50 border border-outline-variant/60 rounded-xl mb-lg overflow-x-auto">
              <div className="flex items-center justify-between min-w-[750px] relative px-xs">
                <div className="absolute top-[20px] left-[40px] right-[40px] h-[2px] bg-outline-variant z-0"></div>

                {pipelineNodes.map((node, idx) => {
                  const isDone = idx < activeStep || progress === 100;
                  const isActive = idx === activeStep && progress < 100;

                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-center text-center relative z-10 w-[110px]"
                    >
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
                          <span className="material-symbols-outlined text-[20px]">
                            check
                          </span>
                        ) : isActive ? (
                          <span className="material-symbols-outlined text-[20px] animate-spin">
                            sync
                          </span>
                        ) : (
                          <span className="text-xs font-bold">{idx + 1}</span>
                        )}
                      </div>

                      <p
                        className={`text-xs mt-xs font-semibold leading-tight ${
                          isDone || isActive
                            ? "text-on-surface font-bold"
                            : "text-on-surface-variant/60"
                        }`}
                      >
                        {node.title}
                      </p>
                      <p className="text-[10px] text-on-surface-variant line-clamp-1 mt-0.5">
                        {node.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LIVE ACTIVITY LOG PANEL */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-inner mb-lg">
              <div className="flex justify-between items-center border-b border-outline-variant/40 pb-xs mb-sm">
                <span className="font-mono text-xs text-on-surface-variant font-bold flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    terminal
                  </span>
                  LIVE MULTI-VARIANT AGENT STREAM
                </span>
                <span className="font-caption text-[11px] text-on-surface-variant">
                  {logs.length} sự kiện được ghi nhận
                </span>
              </div>

              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-xs font-mono text-xs">
                {logs.map((log, lIdx) => (
                  <div
                    key={lIdx}
                    className={`flex items-start gap-sm p-sm rounded-lg border transition-all ${
                      lIdx === logs.length - 1
                        ? "bg-primary/5 border-primary/30 text-on-surface font-semibold"
                        : "bg-surface-container-low/40 border-transparent text-on-surface-variant"
                    }`}
                  >
                    <span className="text-[10px] text-on-surface-variant shrink-0 mt-[2px]">
                      [{log.time}]
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-primary shrink-0 mt-[2px]">
                      chevron_right
                    </span>
                    <p className="flex-1 text-[12px] leading-relaxed">{log.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ACTION AFTER COMPLETION */}
            {progress === 100 && (
              <div className="flex justify-end gap-md pt-sm border-t border-outline-variant animate-fadeIn">
                <button
                  onClick={() => setStage(1)}
                  className="px-md py-sm border border-outline-variant text-on-surface-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low transition-colors"
                >
                  Tạo lại với tham số khác
                </button>
                <Link
                  href={`/doctor/reviews/${patient.id}`}
                  className="bg-emerald-700 text-white font-body-bold px-lg py-sm rounded-lg hover:bg-emerald-800 transition-colors text-xs font-bold flex items-center gap-xs shadow-xs"
                >
                  <span>Xem & So sánh {variantsCount} phương án</span>
                  <span className="material-symbols-outlined text-[18px]">
                    arrow_forward
                  </span>
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* PATIENT SELECTION MODAL */}
      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-md animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-md border-b border-outline-variant mb-md">
              <div className="flex items-center gap-sm">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                </div>
                <div>
                  <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                    Chọn bệnh nhân để tạo thực đơn AI
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsSelectModalOpen(false)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
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
                placeholder="Tìm theo tên, mã bệnh nhân (VD: BN-10293), hoặc bệnh lý..."
                className="w-full pl-xl pr-md py-sm bg-surface-container-low border border-outline-variant rounded-xl font-body text-body text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-sm pr-xs">
              {filteredPatients.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  isSelected={p.id === patient.id}
                  actionText={p.id === patient.id ? "Đang chọn" : "Chọn bệnh nhân"}
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
