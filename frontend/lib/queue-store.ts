import { create } from "zustand";
import { api } from "./api";
import { DEFAULT_VARIANTS_PER_JOB, DEFAULT_PLAN_DAYS } from "./config";

export type JobLogItem = {
  text: string;
  time: string;
  status: "done" | "active" | "pending";
};

export interface GenerationJob {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar?: string;
  patientGender?: string;
  patientAge?: number;
  patientCondition?: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: Date;
  /** Mốc thời gian UI — set 1 lần khi tạo job, KHÔNG reset khi sang processing (tránh giật lùi). */
  uiStartedAt: number;
  processingStartedAt?: number;
  variantGroupId?: string;
  planIds?: string[];
  variantsCount?: number;
  daysCount?: number;
  notes?: string;
  priorities?: string[];
  errorMessage?: string;
  /** Tiến trình UI (0–100) — chỉ tăng, không giảm khi job còn active. */
  progress: number;
  activeStep: number;
  logs: JobLogItem[];
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
      avatar?: string;
      gender?: string;
      age?: number;
      condition?: string;
      notes?: string;
      priorities?: string[];
    }[],
    options?: { daysCount?: number; variantsCount?: number }
  ) => string[];
  retryJob: (jobId: string) => void;
  clearCompletedAndFailed: () => void;
  processQueue: () => Promise<void>;
}

function stamp() {
  return new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function pushLog(logs: JobLogItem[], text: string, status: JobLogItem["status"] = "active") {
  if (logs.some((l) => l.text === text)) return logs;
  return [...logs, { text, time: stamp(), status }];
}

function safeNum(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** Các mốc UI giả lập theo thời gian từ uiStartedAt (một chiều). */
const PROGRESS_MILESTONES = [
  { atMs: 0, progress: 12, step: 0, log: "Khởi tạo pipeline sinh thực đơn 7 ngày" },
  { atMs: 1200, progress: 25, step: 1, log: "Tải hồ sơ: BMI, dị ứng & mục tiêu kcal" },
  { atMs: 2400, progress: 45, step: 2, log: "Lọc catalog món ăn theo dị ứng & bệnh lý" },
  { atMs: 4000, progress: 60, step: 3, log: "Áp dụng ngưỡng kcal / natri / carb" },
  { atMs: 6000, progress: 78, step: 4, log: "LLM đang soạn thực đơn 7 ngày" },
  { atMs: 9000, progress: 90, step: 5, log: "Gắn món thay thế cùng nhóm cho từng món" },
] as const;

function milestoneTargets(elapsedMs: number, status: GenerationJob["status"]) {
  // Queued: chỉ tới bước phân tích hồ sơ; Processing: full pipeline (tối đa 95% tới khi API xong)
  const maxStep = status === "queued" ? 1 : 5;
  let progress = 0;
  let activeStep = 0;
  const logsToAdd: string[] = [];

  for (const m of PROGRESS_MILESTONES) {
    if (m.step > maxStep) break;
    if (elapsedMs >= m.atMs) {
      progress = m.progress;
      activeStep = m.step;
      logsToAdd.push(m.log);
    }
  }

  if (status === "processing") {
    progress = Math.min(progress, 95);
  }

  return { progress, activeStep, logsToAdd };
}

let uiTickerId: ReturnType<typeof setInterval> | null = null;

function stopUiTicker() {
  if (uiTickerId != null) {
    clearInterval(uiTickerId);
    uiTickerId = null;
  }
}

function ensureUiTicker() {
  if (uiTickerId != null) return;
  uiTickerId = setInterval(() => {
    const { jobs } = useQueueStore.getState();
    const hasActive = jobs.some(
      (j) => j.status === "queued" || j.status === "processing"
    );
    if (!hasActive) {
      stopUiTicker();
      return;
    }

    const now = Date.now();
    useQueueStore.setState((state) => ({
      jobs: state.jobs.map((job) => {
        if (job.status !== "queued" && job.status !== "processing") return job;

        const started = safeNum(
          job.uiStartedAt,
          job.createdAt instanceof Date
            ? job.createdAt.getTime()
            : typeof job.createdAt === "string" || typeof job.createdAt === "number"
              ? new Date(job.createdAt).getTime()
              : safeNum(job.processingStartedAt, now)
        );
        const elapsed = Math.max(0, now - started);
        const targets = milestoneTargets(elapsed, job.status);

        // Chỉ tăng — không bao giờ giảm progress/step (tránh giật lùi khi đổi trang / status muộn)
        const prevProgress = safeNum(job.progress, 0);
        const prevStep = safeNum(job.activeStep, 0);
        const progress = Math.max(prevProgress, targets.progress);
        const activeStep = Math.max(prevStep, targets.activeStep);

        let logs = job.logs ?? [];
        for (const text of targets.logsToAdd) {
          logs = pushLog(logs, text, "active");
        }

        if (
          progress === prevProgress &&
          activeStep === prevStep &&
          logs.length === (job.logs?.length ?? 0)
        ) {
          return job;
        }
        return { ...job, progress, activeStep, logs };
      }),
    }));
  }, 400);
}

async function generateMealPlanApi(
  patientId: string,
  notes?: string,
  priorities?: string[]
): Promise<{ variantGroupId: string; planIds: string[] }> {
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
    const now = Date.now();

    const newJobs: GenerationJob[] = patients.map((p) => ({
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patientId: p.id,
      patientName: p.name,
      patientAvatar: p.avatar,
      patientGender: p.gender,
      patientAge: p.age,
      patientCondition: p.condition,
      status: "queued",
      createdAt: new Date(now),
      uiStartedAt: now,
      daysCount,
      variantsCount,
      notes: p.notes,
      priorities: p.priorities,
      progress: 12,
      activeStep: 0,
      logs: [
        {
          text: `Đã thêm vào hàng đợi — sinh thực đơn cho ${p.name}`,
          time: stamp(),
          status: "done",
        },
      ],
    }));

    set((state) => ({
      jobs: [...state.jobs, ...newJobs],
    }));

    ensureUiTicker();
    get().processQueue();
    return newJobs.map((j) => j.id);
  },

  retryJob: (jobId) => {
    const now = Date.now();
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "queued" as const,
              errorMessage: undefined,
              variantGroupId: undefined,
              planIds: undefined,
              processingStartedAt: undefined,
              uiStartedAt: now,
              progress: 12,
              activeStep: 0,
              logs: [
                { text: `Thử lại — đưa lại vào hàng đợi`, time: stamp(), status: "done" as const },
                {
                  text: `Đã thêm lại vào hàng đợi — ${job.patientName}`,
                  time: stamp(),
                  status: "done" as const,
                },
              ],
            }
          : job
      ),
    }));

    ensureUiTicker();
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

    const startedAt = Date.now();
    set((state) => ({
      isProcessingWorker: true,
      jobs: state.jobs.map((job) =>
        job.id === nextJob.id
          ? {
              ...job,
              status: "processing" as const,
              processingStartedAt: startedAt,
              // Giữ nguyên uiStartedAt / progress / activeStep — không reset timeline
              logs: pushLog(
                job.logs,
                `Hàng đợi đang xử lý — tạo thực đơn cho ${job.patientName}`,
                "active"
              ),
            }
          : job
      ),
    }));
    ensureUiTicker();

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
                status: "completed" as const,
                variantGroupId: result.variantGroupId,
                planIds: result.planIds,
                progress: 100,
                activeStep: 5,
                logs: pushLog(
                  job.logs,
                  result.planIds[0]
                    ? `Đã lưu thực đơn ${result.planIds[0].slice(0, 8)}… — chờ duyệt.`
                    : "Đã hoàn tất tạo thực đơn — chờ duyệt.",
                  "done"
                ),
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
            ? {
                ...job,
                status: "failed" as const,
                errorMessage: errorMsg,
                // Giữ progress/step hiện tại (không tụt về 0 — tránh giật lùi trên UI)
                logs: pushLog(job.logs, errorMsg, "pending"),
              }
            : job
        ),
        isProcessingWorker: false,
      }));
    }

    get().processQueue();
  },
}));
