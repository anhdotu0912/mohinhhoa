"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { useQueueStore, GenerationJob } from "@/lib/queue-store";
import { MOCK_PATIENTS } from "@/lib/mock-data";

export default function QueuePage() {
  const router = useRouter();
  const { jobs, retryJob, clearCompletedAndFailed } = useQueueStore();

  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "completed" | "failed"
  >("all");

  const getPatientAvatar = (patientId: string) => {
    const patient = MOCK_PATIENTS.find((p) => p.id === patientId);
    return (
      patient?.avatar ||
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC66kEeXEpUoXAUDa-eVjaWGucklXyDHyG0BWkYQcXkH3OQPebxVez4samPvA1fKP_po9Omc23Pxx-vQJR1oIf-YvHPIFCajQyXqRLKUZJksJuhXpCWTPDsKa_fN5bLjnK9ZjAhBFEX84oz_drQgFQHb5WaDGrrCXlMCh3z1GxBRZp8t8mViPN4OeChVWmoVFOaLJ_Gpk0YQdYiE8R0LY9vO7gn5W80SIuwv4lCvSAbRcfYwKzJgC8I9A"
    );
  };

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active")
      return job.status === "queued" || job.status === "processing";
    if (statusFilter === "completed") return job.status === "completed";
    if (statusFilter === "failed") return job.status === "failed";
    return true;
  });

  const activeCount = jobs.filter(
    (j) => j.status === "queued" || j.status === "processing"
  ).length;
  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <>
      <TopBar title="Hàng đợi tạo thực đơn AI" />

      <main className="p-lg max-w-[1400px]">
        {/* Back link */}
        <div className="mb-md">
          <Link
            href="/doctor/patients"
            className="inline-flex items-center gap-xs text-xs font-semibold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Quay lại Danh sách bệnh nhân
          </Link>
        </div>

        {/* Page Title & Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-section-gap">
          <div>
            <h2 className="font-h1 text-h1 text-on-surface font-bold">
              Quản lý hàng đợi sinh thực đơn AI
            </h2>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Theo dõi tiến trình sinh thực đơn tự động theo cơ chế hàng đợi tuần tự (FIFO)
            </p>
          </div>

          {(completedCount > 0 || failedCount > 0) && (
            <button
              onClick={clearCompletedAndFailed}
              className="px-md py-2 bg-surface-container-lowest border border-outline-variant hover:border-red-300 hover:bg-red-50 text-on-surface-variant hover:text-red-700 font-body-bold rounded-lg transition-all text-xs cursor-pointer active:scale-95 shadow-xs shrink-0 flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span>Xoá các job đã hoàn tất/lỗi ({completedCount + failedCount})</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-sm border-b border-outline-variant mb-lg pb-xs">
          <button
            onClick={() => setStatusFilter("all")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer ${
              statusFilter === "all"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Tất cả ({jobs.length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer ${
              statusFilter === "active"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Đang chờ / Đang xử lý ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer ${
              statusFilter === "completed"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Hoàn tất ({completedCount})
          </button>
          <button
            onClick={() => setStatusFilter("failed")}
            className={`font-label text-label px-sm py-xs border-b-2 transition-all cursor-pointer ${
              statusFilter === "failed"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Lỗi ({failedCount})
          </button>
        </div>

        {/* Queue Table */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden">
          {filteredJobs.length === 0 ? (
            <div className="p-xl text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
                queue_play_next
              </span>
              <p className="font-body-bold text-body-bold">Không có công việc nào trong hàng đợi</p>
              <p className="font-caption text-caption text-xs mt-xs">
                Bạn có thể thêm bệnh nhân vào hàng đợi tại trang Danh sách bệnh nhân.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Bệnh nhân
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Mã BN
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Thời gian tạo
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Chi tiết / Kết quả
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-body text-body">
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-surface-bright transition-colors"
                  >
                    <td className="p-md">
                      <div className="flex items-center gap-sm">
                        <img
                          src={getPatientAvatar(job.patientId)}
                          alt={job.patientName}
                          className="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0"
                        />
                        <p className="font-body-bold text-on-surface font-semibold text-sm">
                          {job.patientName}
                        </p>
                      </div>
                    </td>
                    <td className="p-md font-mono text-xs font-medium text-on-surface-variant">
                      {job.patientId}
                    </td>
                    <td className="p-md text-on-surface-variant text-xs">
                      {new Date(job.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="p-md">
                      {job.status === "queued" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="material-symbols-outlined text-[14px]">
                            check_circle
                          </span>
                          Hoàn tất
                        </span>
                      )}
                      {job.status === "failed" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <span className="material-symbols-outlined text-[14px]">
                            error
                          </span>
                          Lỗi
                        </span>
                      )}
                    </td>
                    <td className="p-md text-sm">
                      {job.status === "completed" && (
                        <div className="text-xs">
                          <span className="font-bold text-emerald-800 block">
                            Đã tạo {job.variantsCount || 3} phương án ({job.daysCount || 7} ngày)
                          </span>
                          <span className="font-mono text-on-surface-variant text-[11px]">
                            Mã nhóm: {job.variantGroupId || job.id}
                          </span>
                        </div>
                      )}
                      {job.status === "failed" && (
                        <span className="text-xs text-red-600 font-medium">
                          {job.errorMessage || "Không thể tạo thực đơn AI"}
                        </span>
                      )}
                      {(job.status === "queued" || job.status === "processing") && (
                        <span className="text-xs text-on-surface-variant">
                          Tự động sinh {job.variantsCount || 3} phương án ({job.daysCount || 7} ngày) theo FIFO...
                        </span>
                      )}
                    </td>
                    <td className="p-md text-right">
                      {job.status === "completed" && (
                        <button
                          onClick={() => router.push(`/doctor/reviews/${job.patientId}`)}
                          className="inline-flex items-center gap-xs px-md py-1.5 bg-emerald-700 text-white font-body-bold rounded-lg hover:bg-emerald-800 transition-all text-xs cursor-pointer active:scale-95 shadow-xs font-medium"
                        >
                          <span>So sánh & Duyệt</span>
                          <span className="material-symbols-outlined text-[16px]">
                            arrow_forward
                          </span>
                        </button>
                      )}
                      {job.status === "failed" && (
                        <button
                          onClick={() => retryJob(job.id)}
                          className="inline-flex items-center gap-xs px-md py-1.5 bg-red-50 text-red-700 border border-red-200 font-body-bold rounded-lg hover:bg-red-100 transition-all text-xs cursor-pointer active:scale-95 shadow-xs font-medium"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            refresh
                          </span>
                          <span>Thử lại</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
