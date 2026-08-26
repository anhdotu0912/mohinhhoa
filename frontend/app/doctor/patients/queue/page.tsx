"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { useQueueStore } from "@/lib/queue-store";
import { api, assetUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { DoctorPatientSummary } from "@/lib/types";
import { shortCondition } from "@/lib/format";
import { buildReviewHref } from "@/lib/plan-slot-intent";

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

export default function QueuePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const { jobs, retryJob, clearCompletedAndFailed } = useQueueStore();

  const [patientsMap, setPatientsMap] = useState<Record<string, DoctorPatientSummary>>({});
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "completed" | "failed"
  >("all");

  useEffect(() => {
    if (!token || role !== "doctor") return;
    let cancelled = false;
    void api
      .listDoctorPatients()
      .then((list) => {
        if (cancelled) return;
        const map: Record<string, DoctorPatientSummary> = {};
        for (const p of list) {
          map[p.id] = p;
        }
        setPatientsMap(map);
      })
      .catch(() => {
        // Silently fallback to job metadata if patient list fails
      });
    return () => {
      cancelled = true;
    };
  }, [token, role]);

  const getPatientAvatar = (patientId: string, fallbackJobAvatar?: string) => {
    const fromMap = patientsMap[patientId]?.avatar;
    return resolveAvatar(fromMap || fallbackJobAvatar);
  };

  const getPatientCondition = (patientId: string, fallbackJobCondition?: string) => {
    const fromMap = patientsMap[patientId]?.condition_label;
    return fromMap || fallbackJobCondition || "";
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

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Back link */}
        <div>
          <Link
            href="/doctor/patients"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Danh sách bệnh nhân</span>
          </Link>
        </div>

        {/* Page Title & Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-on-surface font-black text-2xl tracking-tight">
              Quản lý Hàng đợi Sinh Thực đơn AI
            </h2>
            <p className="text-on-surface-variant mt-1 text-xs font-medium">
              Theo dõi tiến trình sinh thực đơn tự động đa bước (RAG → Prompting → LLM → HITL Guardrails)
            </p>
          </div>

          {(completedCount > 0 || failedCount > 0) && (
            <button
              onClick={clearCompletedAndFailed}
              className="px-4 py-2 bg-surface-container-lowest border border-outline-variant/60 hover:border-rose-300 hover:bg-rose-50 text-on-surface-variant hover:text-rose-700 font-bold rounded-xl transition-all text-xs cursor-pointer active:scale-95 shadow-2xs shrink-0 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span>Dọn dẹp job đã xong/lỗi ({completedCount + failedCount})</span>
            </button>
          )}
        </div>

        {/* 4 Status KPI Counters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">queue</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Tổng số Job
              </span>
              <span className="text-xl font-black text-on-surface tabular-nums">
                {jobs.length}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Đang xử lý / Chờ
              </span>
              <span className="text-xl font-black text-sky-900 tabular-nums">
                {activeCount}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Hoàn tất
              </span>
              <span className="text-xl font-black text-emerald-900 tabular-nums">
                {completedCount}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">error</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Lỗi cần thử lại
              </span>
              <span className="text-xl font-black text-rose-900 tabular-nums">
                {failedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${statusFilter === "all"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container-low"
              }`}
          >
            Tất cả ({jobs.length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${statusFilter === "active"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container-low"
              }`}
          >
            Đang chờ / Đang xử lý ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${statusFilter === "completed"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container-low"
              }`}
          >
            Hoàn tất ({completedCount})
          </button>
          <button
            onClick={() => setStatusFilter("failed")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${statusFilter === "failed"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container-low"
              }`}
          >
            Lỗi ({failedCount})
          </button>
        </div>

        {/* Queue Table */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-xs overflow-hidden">
          {filteredJobs.length === 0 ? (
            <div className="p-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline-variant mb-2">
                queue_play_next
              </span>
              <p className="font-bold text-on-surface text-sm">Không có công việc nào trong hàng đợi</p>
              <p className="text-xs mt-1 text-on-surface-variant">
                Bạn có thể thêm bệnh nhân vào hàng đợi tại trang Danh sách bệnh nhân.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[860px]">
                <thead>
                  <tr className="bg-surface-container-low/60 border-b border-outline-variant/40">
                    <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">
                      Bệnh nhân
                    </th>
                    <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">
                      Mã BN
                    </th>
                    <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">
                      Thời gian tạo
                    </th>
                    <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">
                      Trạng thái
                    </th>
                    <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">
                      Chi tiết / Kết quả
                    </th>
                    <th className="px-5 py-3.5 font-bold text-on-surface-variant uppercase tracking-wider text-[10px] text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {filteredJobs.map((job) => (
                    <tr
                      key={job.id}
                      className="hover:bg-surface-container-low/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-9 h-9 shrink-0 overflow-hidden rounded-full">
                            <div
                              className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold ring-1 ring-primary/20 ${getAvatarColor(
                                job.patientName
                              )}`}
                            >
                              {initials(job.patientName)}
                            </div>
                            {getPatientAvatar(job.patientId, job.patientAvatar) ? (
                              <img
                                src={getPatientAvatar(job.patientId, job.patientAvatar)}
                                alt={job.patientName}
                                className="absolute inset-0 w-full h-full rounded-full object-cover ring-1 ring-outline-variant/40 bg-surface-container"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-on-surface text-sm truncate">
                              {job.patientName}
                            </p>
                            {getPatientCondition(job.patientId, job.patientCondition) && (
                              <p className="text-[11px] text-on-surface-variant truncate max-w-[200px] font-medium">
                                {shortCondition(
                                  getPatientCondition(job.patientId, job.patientCondition)
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs font-semibold text-primary">
                        {job.patientId}
                      </td>
                      <td className="p-4 text-on-surface-variant text-xs font-medium tabular-nums">
                        {new Date(job.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="p-4">
                        {job.status === "queued" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                            Đang chờ
                          </span>
                        )}
                        {job.status === "processing" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 animate-pulse">
                            <span className="material-symbols-outlined text-[14px] animate-spin">
                              progress_activity
                            </span>
                            Đang tạo...
                          </span>
                        )}
                        {job.status === "completed" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="material-symbols-outlined text-[14px]">
                              check_circle
                            </span>
                            Hoàn tất
                          </span>
                        )}
                        {job.status === "failed" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="material-symbols-outlined text-[14px]">
                              error
                            </span>
                            Lỗi
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm">
                        {job.status === "completed" && (
                          <div className="text-xs">
                            <span className="font-bold text-emerald-800 block">
                              Đã tạo {job.planIds?.length || 1} thực đơn ({job.daysCount || 7} ngày)
                            </span>
                            <span className="font-mono text-on-surface-variant text-[11px]">
                              Mã nhóm: {job.variantGroupId || job.id}
                            </span>
                          </div>
                        )}
                        {job.status === "failed" && (
                          <span className="text-xs text-rose-600 font-semibold">
                            {job.errorMessage || "Không thể tạo thực đơn AI"}
                          </span>
                        )}
                        {(job.status === "queued" || job.status === "processing") && (
                          <div className="flex flex-col items-start gap-2">
                            <span className="text-xs text-on-surface-variant font-medium">
                              {job.status === "processing"
                                ? `Đang tạo thực đơn… ${typeof job.progress === "number" ? job.progress : 0}%`
                                : `Đang chờ trong hàng đợi · ${typeof job.progress === "number" ? job.progress : 0}%`}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right min-w-[160px]">
                        {job.status === "queued" || job.status === "processing" ? (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/doctor/patients/queue/${encodeURIComponent(job.id)}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg transition-all text-xs cursor-pointer active:scale-95 shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-[16px] leading-none">
                              account_tree
                            </span>
                            Xem quy trình
                          </button>
                        ) : null}

                        {job.status === "completed" ? (
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/doctor/patients/queue/${encodeURIComponent(job.id)}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-semibold rounded-lg transition-all text-xs cursor-pointer shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[16px] leading-none">
                                account_tree
                              </span>
                              Xem quy trình
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const planId = job.planIds?.[0];
                                router.push(
                                  planId
                                    ? buildReviewHref(job.patientId, planId)
                                    : `/doctor/patients/${job.patientId}/meals`
                                );
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-lg transition-all text-xs cursor-pointer active:scale-95 shadow-2xs"
                            >
                              So sánh &amp; Duyệt
                              <span className="material-symbols-outlined text-[16px] leading-none">
                                arrow_forward
                              </span>
                            </button>
                          </div>
                        ) : null}

                        {job.status === "failed" ? (
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/doctor/patients/queue/${encodeURIComponent(job.id)}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-semibold rounded-lg transition-all text-xs cursor-pointer shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[16px] leading-none">
                                account_tree
                              </span>
                              Xem quy trình
                            </button>
                            <button
                              type="button"
                              onClick={() => retryJob(job.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold rounded-lg transition-all text-xs cursor-pointer shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[16px] leading-none">
                                refresh
                              </span>
                              Thử lại
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
