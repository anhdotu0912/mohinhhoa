import { create } from "zustand";
import { usePlansStore, MealPlanItem, DayMealPlan } from "./plans-store";
import { MOCK_PATIENTS } from "./mock-data";
import { DEFAULT_VARIANTS_PER_JOB, DEFAULT_PLAN_DAYS } from "./config";

export interface GenerationJob {
  id: string;
  patientId: string;
  patientName: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: Date;
  variantGroupId?: string;
  planIds?: string[];
  variantsCount?: number;
  daysCount?: number;
  errorMessage?: string;
}

interface QueueState {
  jobs: GenerationJob[];
  isDrawerOpen: boolean;
  isProcessingWorker: boolean;

  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  addJobs: (
    patients: { id: string; name: string }[],
    options?: { daysCount?: number; variantsCount?: number }
  ) => void;
  retryJob: (jobId: string) => void;
  clearCompletedAndFailed: () => void;
  processQueue: () => Promise<void>;
}

// Generate realistic multi-day plan structure for simulated AI output
function generateMockDays(variantIndex: number, daysCount: number): DayMealPlan[] {
  const days: DayMealPlan[] = [];

  const dishVariations = [
    // Variant 1: Standard DASH
    {
      b: [{ name: "Phở gà ít béo (thịt lườn, nước dùng trong)", calories: 350, salt: 1.2, sugar: 0 }],
      l: [{ name: "Cơm gạo lứt + Cá hồi áp chảo măng tây", calories: 470, salt: 0.8, sugar: 0 }],
      d: [{ name: "Ức gà hấp gừng sả + Rau củ luộc thập cẩm", calories: 310, salt: 0.5, sugar: 1 }],
    },
    // Variant 2: High Fiber / Plant-Forward
    {
      b: [{ name: "Súp yến mạch rau củ + Sữa hạt óc chó", calories: 280, salt: 0.4, sugar: 1 }],
      l: [{ name: "Cơm diêm mạch Quinoa + Đậu hũ sốt cà chua ít muối", calories: 410, salt: 0.6, sugar: 1 }],
      d: [{ name: "Nấm đùi gà kho tộ + Canh bí đỏ nấu nấm", calories: 280, salt: 0.4, sugar: 0 }],
    },
    // Variant 3: Easy Prep / Comfort Digest
    {
      b: [{ name: "Cháo yến mạch ức gà xé", calories: 300, salt: 0.8, sugar: 0 }],
      l: [{ name: "Cơm trắng (1 bát con) + Trứng đúc thịt hấp thủy", calories: 440, salt: 0.7, sugar: 0 }],
      d: [{ name: "Cháo cá chép nấu hành nén", calories: 300, salt: 0.5, sugar: 0 }],
    },
  ];

  const variantStyle = dishVariations[(variantIndex - 1) % dishVariations.length];

  for (let i = 1; i <= daysCount; i++) {
    days.push({
      dayIndex: i,
      dayName: `Ngày ${i}`,
      breakfast: variantStyle.b,
      lunch: variantStyle.l,
      dinner: variantStyle.d,
      snack: [{ name: "Trái cây ít ngọt (Táo/Ổi)", calories: 80, salt: 0, sugar: 6 }],
      totalCalories: 1700 + (i * 10) % 100,
      totalSalt: 1.5,
      totalSugar: 7.0,
    });
  }

  return days;
}

// API simulation: Generates `variantsCount` plans covering `daysCount` days for 1 patient
async function generateMealPlanApi(
  patientId: string,
  daysCount: number = DEFAULT_PLAN_DAYS,
  variantsCount: number = DEFAULT_VARIANTS_PER_JOB
): Promise<{ variantGroupId: string; planIds: string[] }> {
  await new Promise((resolve) => setTimeout(resolve, 2500));

  if (patientId === "BN-FAIL-TEST") {
    throw new Error("Lỗi kết nối AI Service. Vui lòng kiểm tra lại thiết lập bệnh nhân.");
  }

  const patient = MOCK_PATIENTS.find((p) => p.id === patientId) || {
    id: patientId,
    name: "Bệnh nhân " + patientId,
    condition: "Tiểu đường type 2, Tăng huyết áp",
  };

  const cleanId = patientId.replace(/[^a-zA-Z0-9]/g, "");
  const timestamp = Date.now().toString().slice(-6);
  const variantGroupId = `GRP-${cleanId}-${timestamp}`;

  const titles = [
    `Phương án 1: Thực đơn Chuẩn y khoa DASH (${daysCount} ngày)`,
    `Phương án 2: Thực đơn Tăng cường chất xơ & Đạm kiềm tính (${daysCount} ngày)`,
    `Phương án 3: Thực đơn Mềm dễ chế biến (${daysCount} ngày)`,
  ];

  const generatedPlans: MealPlanItem[] = [];
  const planIds: string[] = [];

  const createdTimeString = new Date().toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  for (let idx = 1; idx <= variantsCount; idx++) {
    const planId = `PLAN-${cleanId}-V${idx}-${timestamp}`;
    planIds.push(planId);

    const daysData = generateMockDays(idx, daysCount);

    const plan: MealPlanItem = {
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
      calories: `${1700 + idx * 30} kcal/ngày`,
      salt: `${(1.5 + idx * 0.1).toFixed(1)}g/ngày`,
      sugar: "8g/ngày",
      createdAt: createdTimeString,
      days: daysData,
      breakfast: daysData[0].breakfast,
      lunch: daysData[0].lunch,
      dinner: daysData[0].dinner,
      warnings: [
        `Khuyến nghị theo dõi huyết áp & chỉ số đường huyết hàng ngày cho phác đồ ${daysCount} ngày.`,
      ],
      citations: [
        "QĐ 41/2016-BYT (Hướng dẫn Dinh dưỡng Lâm sàng)",
        "AHA 2023 Dietary Guidance",
      ],
    };

    generatedPlans.push(plan);
  }

  // Add the newly generated group of 3 multi-day plans directly to plansStore
  usePlansStore.getState().addPlanGroup(generatedPlans);

  return {
    variantGroupId,
    planIds,
  };
}

export const useQueueStore = create<QueueState>((set, get) => ({
  jobs: [],
  isDrawerOpen: false,
  isProcessingWorker: false,

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

  addJobs: (patients, options) => {
    const daysCount = options?.daysCount || DEFAULT_PLAN_DAYS;
    const variantsCount = options?.variantsCount || DEFAULT_VARIANTS_PER_JOB;

    const newJobs: GenerationJob[] = patients.map((p) => ({
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patientId: p.id,
      patientName: p.name,
      status: "queued",
      createdAt: new Date(),
      daysCount,
      variantsCount,
    }));

    set((state) => ({
      jobs: [...state.jobs, ...newJobs],
    }));

    get().processQueue();
  },

  retryJob: (jobId) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "queued",
              errorMessage: undefined,
              variantGroupId: undefined,
              planIds: undefined,
            }
          : job
      ),
    }));

    get().processQueue();
  },

  clearCompletedAndFailed: () => {
    set((state) => ({
      jobs: state.jobs.filter(
        (job) => job.status === "queued" || job.status === "processing"
      ),
    }));
  },

  processQueue: async () => {
    const { isProcessingWorker, jobs } = get();

    if (isProcessingWorker) return;

    const currentProcessingJob = jobs.find((j) => j.status === "processing");
    if (currentProcessingJob) return;

    const nextJob = jobs.find((j) => j.status === "queued");
    if (!nextJob) return;

    set((state) => ({
      isProcessingWorker: true,
      jobs: state.jobs.map((job) =>
        job.id === nextJob.id ? { ...job, status: "processing" } : job
      ),
    }));

    try {
      const result = await generateMealPlanApi(
        nextJob.patientId,
        nextJob.daysCount || DEFAULT_PLAN_DAYS,
        nextJob.variantsCount || DEFAULT_VARIANTS_PER_JOB
      );

      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === nextJob.id
            ? {
                ...job,
                status: "completed",
                variantGroupId: result.variantGroupId,
                planIds: result.planIds,
              }
            : job
        ),
        isProcessingWorker: false,
      }));
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Đã xảy ra lỗi không xác định khi tạo thực đơn";

      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === nextJob.id
            ? { ...job, status: "failed", errorMessage: errorMsg }
            : job
        ),
        isProcessingWorker: false,
      }));
    }

    get().processQueue();
  },
}));
