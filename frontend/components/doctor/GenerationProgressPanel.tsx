"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueueStore, type GenerationJob } from "@/lib/queue-store";
import { buildReviewHref } from "@/lib/plan-slot-intent";

const PIPELINE_NODES = [
  { title: "Phân tích hồ sơ", desc: "Tải BMI, dị ứng & mục tiêu" },
  { title: "Catalog món ăn", desc: "Chọn món khớp bệnh lý" },
  { title: "Áp dụng ràng buộc", desc: "Dị ứng, muối, đường, đạm" },
  { title: "Gọi LLM", desc: "Sinh thực đơn 7 ngày" },
  { title: "Món thay thế", desc: "1–2 lựa chọn cùng nhóm / món" },
  { title: "Hoàn thiện & Lưu", desc: "Persist + chờ bác sĩ duyệt" },
];

function safeNum(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/**
 * Hiển thị tiến trình từ queue-store.
 * High-water mark: UI không bao giờ giật lùi khi status/store cập nhật muộn hoặc remount.
 */
export function GenerationProgressPanel({
  job,
  backHref = "/doctor/patients/queue",
}: {
  job: GenerationJob;
  backHref?: string;
}) {
  const retryJob = useQueueStore((s) => s.retryJob);
  const jobIdRef = useRef(job.id);

  const storeProgress = safeNum(job.progress, 0);
  const storeStep = safeNum(job.activeStep, 0);

  const [displayProgress, setDisplayProgress] = useState(storeProgress);
  const [displayStep, setDisplayStep] = useState(storeStep);

  // Đổi job → lấy mốc mới; cùng job → chỉ cho tăng (không tụt)
  useEffect(() => {
    if (jobIdRef.current !== job.id) {
      jobIdRef.current = job.id;
      setDisplayProgress(storeProgress);
      setDisplayStep(storeStep);
      return;
    }
    setDisplayProgress((p) => Math.max(p, storeProgress));
    setDisplayStep((s) => Math.max(s, storeStep));
  }, [job.id, storeProgress, storeStep]);

  // Completed luôn 100%; failed giữ high-water (không kéo về 0)
  useEffect(() => {
    if (job.status === "completed") {
      setDisplayProgress(100);
      setDisplayStep(5);
    }
  }, [job.status]);

  const isDone = job.status === "completed";
  const isFailed = job.status === "failed";
  const isActive = job.status === "queued" || job.status === "processing";
  const planId = job.planIds?.[0];
  const progress = isDone ? 100 : displayProgress;
  const activeStep = isDone ? 5 : displayStep;
  const logs = job.logs ?? [];

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-md max-w-[1100px] mx-auto">
      <div className="mb-md flex items-center justify-between gap-sm flex-wrap">
        <div>
          <p className="text-xs text-on-surface-variant">
            Bệnh nhân:{" "}
            <span className="font-semibold text-on-surface">{job.patientName}</span>
          </p>
          <p
            className="text-[11px] font-mono text-on-surface-variant mt-0.5"
            title={job.patientId}
          >
            Job: {job.id} · BN:{" "}
            {job.patientId.length > 16
              ? `${job.patientId.slice(0, 8)}…${job.patientId.slice(-4)}`
              : job.patientId}
          </p>
        </div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Quay lại hàng đợi
        </Link>
      </div>

      <div className="mb-lg">
        <div className="flex justify-between items-center mb-xs">
          <div className="flex items-center gap-xs">
            {isActive && (
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping inline-block" />
            )}
            <h2 className="font-h2 text-h2 text-on-surface font-bold text-base">
              {isFailed
                ? "Không tạo được thực đơn"
                : isDone
                  ? "Đã hoàn tất tạo thực đơn!"
                  : job.status === "queued"
                    ? "Đang chờ trong hàng đợi…"
                    : "AI đang tạo thực đơn 7 ngày kèm món thay thế…"}
            </h2>
          </div>
          <span className="font-mono text-sm font-bold text-primary">{progress}%</span>
        </div>
        <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="py-md px-sm bg-surface-container-low/50 border border-outline-variant/60 rounded-xl mb-lg overflow-x-auto">
        <div className="flex items-center justify-between min-w-[750px] relative px-xs">
          <div className="absolute top-[20px] left-[40px] right-[40px] h-[2px] bg-outline-variant z-0" />
          {PIPELINE_NODES.map((node, idx) => {
            const nodeDone = idx < activeStep || isDone;
            const nodeActive = idx === activeStep && isActive && !isFailed;
            return (
              <div
                key={node.title}
                className="flex flex-col items-center text-center relative z-10 w-[110px]"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    nodeDone
                      ? "bg-primary text-on-primary shadow-xs"
                      : nodeActive
                        ? "bg-primary text-on-primary ring-4 ring-primary/20 scale-110 shadow-md"
                        : "bg-surface-container-lowest border-2 border-outline-variant text-outline"
                  }`}
                >
                  {nodeDone ? (
                    <span className="material-symbols-outlined text-[20px]">check</span>
                  ) : nodeActive ? (
                    <span className="material-symbols-outlined text-[20px] animate-spin">
                      sync
                    </span>
                  ) : (
                    <span className="text-xs font-bold">{idx + 1}</span>
                  )}
                </div>
                <p
                  className={`text-xs mt-xs font-semibold leading-tight ${
                    nodeDone || nodeActive
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

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-inner mb-lg">
        <div className="flex justify-between items-center border-b border-outline-variant/40 pb-xs mb-sm">
          <span className="font-mono text-xs text-on-surface-variant font-bold flex items-center gap-xs">
            <span className="material-symbols-outlined text-[16px] text-primary">
              terminal
            </span>
            Nhật ký tiến trình
          </span>
        </div>
        <div className="max-h-[220px] overflow-y-auto space-y-2 pr-xs font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-on-surface-variant p-sm">Chưa có nhật ký.</p>
          ) : (
            logs.map((log, lIdx) => (
              <div
                key={`${log.time}-${log.text}-${lIdx}`}
                className={`flex items-start gap-sm p-sm rounded-lg border ${
                  lIdx === logs.length - 1
                    ? "bg-primary/5 border-primary/30 text-on-surface font-semibold"
                    : "bg-surface-container-low/40 border-transparent text-on-surface-variant"
                }`}
              >
                <span className="text-[10px] text-on-surface-variant shrink-0 mt-[2px]">
                  [{log.time}]
                </span>
                <p className="flex-1 text-[12px] leading-relaxed">{log.text}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {isFailed && (
        <div className="mb-md p-md bg-error-container/30 border border-error/30 rounded-xl text-sm text-error">
          {job.errorMessage || "Không tạo được thực đơn. Kiểm tra backend / API key."}
        </div>
      )}

      {(isDone || isFailed) && (
        <div className="flex justify-end gap-md pt-sm border-t border-outline-variant flex-wrap">
          <Link
            href={backHref}
            className="px-md py-sm border border-outline-variant text-on-surface-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low transition-colors"
          >
            Về hàng đợi
          </Link>
          {isFailed && (
            <button
              type="button"
              onClick={() => retryJob(job.id)}
              className="px-md py-sm border border-red-200 bg-red-50 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors inline-flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Thử lại
            </button>
          )}
          {isDone && planId && (
            <Link
              href={buildReviewHref(job.patientId, planId)}
              className="bg-emerald-700 text-white font-body-bold px-lg py-sm rounded-lg hover:bg-emerald-800 transition-colors text-xs font-bold flex items-center gap-xs shadow-xs"
            >
              <span>Xem thực đơn & món thay thế</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          )}
          {isDone && !planId && (
            <Link
              href={`/doctor/patients/${job.patientId}/meals`}
              className="bg-emerald-700 text-white font-body-bold px-lg py-sm rounded-lg hover:bg-emerald-800 transition-colors text-xs font-bold flex items-center gap-xs shadow-xs"
            >
              <span>So sánh & Duyệt</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
