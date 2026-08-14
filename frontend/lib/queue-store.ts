import { create } from "zustand";
import { api } from "./api";
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
  notes?: string;
  priorities?: string[];
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
    patients: {
      id: string;
      name: string;
      notes?: string;
      priorities?: string[];
    }[],
    options?: { daysCount?: number; variantsCount?: number }
  ) => void;
  retryJob: (jobId: string) => void;
  clearCompletedAndFailed: () => void;
  processQueue: () => Promise<void>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Worker: gọi API thật + delay nhỏ để người dùng thấy trạng thái trong hàng chờ
async function generateMealPlanApi(
  patientId: string,
  notes?: string,
  priorities?: string[]
): Promise<{ variantGroupId: string; planIds: string[] }> {
  await sleep(2500);
  const plan = await api.generateMealPlanForPatient(patientId, {
    notes: notes || "",
    priorities: priorities || [],
  });
  return {
    variantGroupId: plan.variant_group_id || `GRP-${patientId}`,
    planIds: plan.id ? [plan.id] : [],
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
      notes: p.notes,
      priorities: p.priorities,
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
        nextJob.notes,
        nextJob.priorities
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
