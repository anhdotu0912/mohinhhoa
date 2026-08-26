"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueueStore } from "@/lib/queue-store";
import { saveSlotIntent, buildReviewHref } from "@/lib/plan-slot-intent";
import { assetUrl } from "@/lib/api";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function resolveAvatar(raw?: string | null): string {
  if (
    !raw ||
    raw.startsWith("https://api.dicebear.com") ||
    raw.includes("googleusercontent.com")
  ) {
    return "";
  }
  return assetUrl(raw) || "";
}

export function QueueDrawer() {
  const router = useRouter();
  const { jobs, isDrawerOpen, closeDrawer, retryJob, clearCompletedAndFailed } =
    useQueueStore();

  if (!isDrawerOpen) return null;

  const handleNavigateReview = (patientId?: string, planId?: string) => {
    const job =
      patientId && planId
        ? jobs.find((j) => j.patientId === patientId && j.planIds?.includes(planId))
        : jobs.find((j) => j.patientId === patientId && j.slotIntent);
    if (job?.slotIntent) {
      saveSlotIntent(job.slotIntent);
    }
    closeDrawer();
    if (patientId && planId) {
      router.push(buildReviewHref(patientId, planId, job?.slotIntent));
    } else if (patientId) {
      router.push(`/doctor/patients/${patientId}/meals`);
    } else {
      router.push("/doctor/inbox?type=plan_review");
    }
  };

  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={closeDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-surface-container-lowest shadow-2xl flex flex-col justify-between border-l border-outline-variant/60 rounded-l-3xl animate-slide-left overflow-hidden">
          {/* Header */}
          <div className="p-lg border-b border-outline-variant/40 flex items-center justify-between bg-surface-container-low/40 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  auto_awesome
                </span>
                <h3 className="font-h2 text-h2 font-bold text-on-surface text-base">
                  Hàng đợi tạo thực đơn AI
                </h3>
              </div>
              <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                {jobs.length === 0
                  ? "Không có công việc nào trong hàng đợi"
                  : `${jobs.length} thực đơn trong danh sách`}
              </p>
            </div>
            <button
              onClick={closeDrawer}
              className="text-on-surface-variant hover:text-primary p-1.5 rounded-xl hover:bg-surface-variant transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Main Job List */}
          <div className="flex-1 overflow-y-auto p-md space-y-sm bg-background/50">
            {jobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-lg text-on-surface-variant">
                <span className="material-symbols-outlined text-[48px] text-outline/40 mb-sm">
                  queue_play_next
                </span>
                <p className="font-body-bold text-body-bold text-sm font-bold">Hàng đợi đang trống</p>
                <p className="font-caption text-caption text-xs mt-xs text-on-surface-variant">
                  Chọn bệnh nhân ở trang danh sách để thêm vào hàng đợi tạo hàng loạt.
                </p>
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-md rounded-2xl border border-outline-variant/60 bg-surface-container-lowest hover:border-primary/50 transition-all shadow-subtle"
                >
                  <div className="flex items-center justify-between gap-sm mb-xs">
                    <div className="flex items-center gap-sm min-w-0">
                      <div className="relative w-9 h-9 shrink-0">
                        <div
                          className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold ${getAvatarColor(
                            job.patientName
                          )}`}
                        >
                          {initials(job.patientName)}
                        </div>
                        {resolveAvatar(job.patientAvatar) ? (
                          <img
                            src={resolveAvatar(job.patientAvatar)}
                            alt={job.patientName}
                            className="absolute inset-0 w-9 h-9 rounded-full object-cover border border-outline-variant bg-surface-container"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="font-body-bold text-on-surface font-bold text-sm truncate">
                          {job.patientName}
                        </p>
                        <p className="font-caption text-caption text-on-surface-variant text-xs truncate">
                          {job.patientCondition ? `${job.patientCondition} • ` : ""}Mã BN: {job.patientId}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {job.status === "queued" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant border border-outline-variant/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                          Đang chờ
                        </span>
                      )}
                      {job.status === "processing" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                          <span className="material-symbols-outlined text-[14px] animate-spin">
                            progress_activity
                          </span>
                          Đang tạo...
                        </span>
                      )}
                      {job.status === "completed" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="material-symbols-outlined text-[14px]">
                            check_circle
                          </span>
                          Hoàn tất
                        </span>
                      )}
                      {job.status === "failed" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <span className="material-symbols-outlined text-[14px]">
                            error
                          </span>
                          Lỗi
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions / Errors per Job */}
                  {(job.status === "queued" || job.status === "processing") && (
                    <div className="mt-xs pt-xs border-t border-outline-variant/40 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        {job.progress ?? 0}%
                      </span>
                      <button
                        onClick={() => {
                          closeDrawer();
                          router.push(
                            `/doctor/patients/queue/${encodeURIComponent(job.id)}`
                          );
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-all cursor-pointer shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          account_tree
                        </span>
                        <span>Xem quy trình</span>
                      </button>
                    </div>
                  )}

                  {job.status === "completed" && (
                    <div className="mt-xs pt-xs border-t border-outline-variant/40 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800">
                        {job.planIds?.length || 1} thực đơn ({job.daysCount || 7} ngày)
                      </span>
                      <button
                        onClick={() => handleNavigateReview(job.patientId)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-container transition-colors cursor-pointer"
                      >
                        <span>So sánh & Duyệt</span>
                        <span className="material-symbols-outlined text-[16px]">
                          arrow_forward
                        </span>
                      </button>
                    </div>
                  )}

                  {job.status === "failed" && (
                    <div className="mt-xs pt-xs border-t border-outline-variant/40">
                      <p className="text-xs text-red-600 mb-xs">
                        {job.errorMessage || "Không thể khởi tạo thực đơn"}
                      </p>
                      <button
                        onClick={() => retryJob(job.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          refresh
                        </span>
                        Thử lại
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-md border-t border-outline-variant/40 bg-surface-container-low/40 space-y-sm">
            {(completedCount > 0 || failedCount > 0) && (
              <button
                onClick={clearCompletedAndFailed}
                className="w-full text-xs text-on-surface-variant hover:text-red-600 transition-colors py-1 cursor-pointer font-medium"
              >
                Xoá các job đã hoàn tất / lỗi ({completedCount + failedCount})
              </button>
            )}
            <Link
              href="/doctor/patients/queue"
              onClick={closeDrawer}
              className="w-full py-3 bg-primary text-on-primary font-body-bold rounded-xl hover:bg-primary/90 transition-all text-sm font-semibold flex items-center justify-center gap-xs cursor-pointer shadow-xs active:scale-95"
            >
              <span>Xem trang đầy đủ</span>
              <span className="material-symbols-outlined text-[18px]">
                open_in_new
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
