"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueueStore, GenerationJob } from "@/lib/queue-store";
import { MOCK_PATIENTS } from "@/lib/mock-data";

export function QueueDrawer() {
  const router = useRouter();
  const { jobs, isDrawerOpen, closeDrawer, retryJob, clearCompletedAndFailed } =
    useQueueStore();

  if (!isDrawerOpen) return null;

  const handleNavigateReview = (patientId?: string, planId?: string) => {
    closeDrawer();
    if (patientId && planId) {
      router.push(`/doctor/reviews/${patientId}/${planId}`);
    } else if (patientId) {
      router.push(`/doctor/reviews/${patientId}`);
    } else {
      router.push("/doctor/reviews");
    }
  };

  const getPatientAvatar = (patientId: string) => {
    const patient = MOCK_PATIENTS.find((p) => p.id === patientId);
    return (
      patient?.avatar ||
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC66kEeXEpUoXAUDa-eVjaWGucklXyDHyG0BWkYQcXkH3OQPebxVez4samPvA1fKP_po9Omc23Pxx-vQJR1oIf-YvHPIFCajQyXqRLKUZJksJuhXpCWTPDsKa_fN5bLjnK9ZjAhBFEX84oz_drQgFQHb5WaDGrrCXlMCh3z1GxBRZp8t8mViPN4OeChVWmoVFOaLJ_Gpk0YQdYiE8R0LY9vO7gn5W80SIuwv4lCvSAbRcfYwKzJgC8I9A"
    );
  };

  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={closeDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-surface-container-lowest shadow-2xl flex flex-col justify-between border-l border-outline-variant animate-slide-left">
          {/* Header */}
          <div className="p-lg border-b border-outline-variant flex items-center justify-between bg-surface-container-low/50">
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
              className="text-on-surface-variant hover:text-primary p-1.5 rounded-lg hover:bg-surface-variant transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Main Job List */}
          <div className="flex-1 overflow-y-auto p-md space-y-sm">
            {jobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-lg text-on-surface-variant">
                <span className="material-symbols-outlined text-[48px] text-outline/60 mb-sm">
                  queue_play_next
                </span>
                <p className="font-body-bold text-body-bold text-sm">Hàng đợi đang trống</p>
                <p className="font-caption text-caption text-xs mt-xs text-on-surface-variant">
                  Chọn bệnh nhân ở trang danh sách để thêm vào hàng đợi tạo hàng loạt.
                </p>
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-md rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary/40 transition-all shadow-xs"
                >
                  <div className="flex items-center justify-between gap-sm mb-xs">
                    <div className="flex items-center gap-sm min-w-0">
                      <img
                        src={getPatientAvatar(job.patientId)}
                        alt={job.patientName}
                        className="w-9 h-9 rounded-full object-cover border border-outline-variant shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-body-bold text-on-surface font-semibold text-sm truncate">
                          {job.patientName}
                        </p>
                        <p className="font-caption text-caption text-on-surface-variant text-xs">
                          Mã BN: {job.patientId}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {job.status === "queued" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                  {job.status === "completed" && (
                    <div className="mt-xs pt-xs border-t border-outline-variant/60 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800">
                        {job.variantsCount || 3} phương án ({job.daysCount || 7} ngày)
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
                    <div className="mt-xs pt-xs border-t border-outline-variant/60">
                      <p className="text-xs text-red-600 mb-xs">
                        {job.errorMessage || "Không thể khởi tạo thực đơn"}
                      </p>
                      <button
                        onClick={() => retryJob(job.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
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
          <div className="p-md border-t border-outline-variant bg-surface-container-low/50 space-y-sm">
            {(completedCount > 0 || failedCount > 0) && (
              <button
                onClick={clearCompletedAndFailed}
                className="w-full text-xs text-on-surface-variant hover:text-red-600 transition-colors py-1 cursor-pointer"
              >
                Xoá các job đã hoàn tất / lỗi ({completedCount + failedCount})
              </button>
            )}
            <Link
              href="/doctor/patients/queue"
              onClick={closeDrawer}
              className="w-full py-2.5 bg-primary text-on-primary font-body-bold rounded-lg hover:bg-primary-container transition-all text-sm font-semibold flex items-center justify-center gap-xs cursor-pointer shadow-xs active:scale-95"
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
