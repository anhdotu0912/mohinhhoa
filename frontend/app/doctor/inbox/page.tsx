"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  buildInboxJobs,
  INBOX_TYPE_META,
  type InboxJob,
} from "@/lib/doctor-inbox";
import { doctorChartHref, doctorInboxHref, type InboxJobType } from "@/lib/doctor-routes";
import { ApiError, type MealPlanOutput } from "@/lib/types";

const FILTERS: { id: "all" | InboxJobType; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "plan_review", label: "Chờ duyệt" },
  { id: "constraints", label: "Ràng buộc" },
  { id: "generate_request", label: "Yêu cầu tạo TD" },
  { id: "plan_expiry", label: "Hết hạn" },
];

function isInboxType(value: string | null): value is InboxJobType {
  return (
    value === "plan_review" ||
    value === "constraints" ||
    value === "generate_request" ||
    value === "plan_expiry"
  );
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<InboxJob[]>([]);

  const typeParam = searchParams.get("type");
  const activeType: "all" | InboxJobType = isInboxType(typeParam) ? typeParam : "all";

  useEffect(() => {
    setHydrated(true);
  }, []);

  const load = useCallback(async () => {
    if (!token || role !== "doctor") return;
    setLoading(true);
    setError(null);
    try {
      const [patients, plans] = await Promise.all([
        api.listDoctorPatients(),
        api.listDoctorMealPlans("pending_review").catch(() => [] as MealPlanOutput[]),
      ]);
      setJobs(buildInboxJobs(patients, plans));
    } catch (err) {
      setJobs([]);
      setError(
        err instanceof ApiError ? err.message : "Không tải được hàng việc."
      );
    } finally {
      setLoading(false);
    }
  }, [token, role]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  const counts = useMemo(() => {
    const next: Record<"all" | InboxJobType, number> = {
      all: jobs.length,
      plan_review: 0,
      constraints: 0,
      generate_request: 0,
      plan_expiry: 0,
    };
    for (const job of jobs) next[job.type] += 1;
    return next;
  }, [jobs]);

  const visible = activeType === "all" ? jobs : jobs.filter((j) => j.type === activeType);

  if (!hydrated || !token || role !== "doctor") return null;

  return (
    <>
      <TopBar title="Hàng việc" />
      <main className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="font-h1 text-2xl font-bold text-on-surface">Việc cần xử lý</h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Mỗi dòng là một việc lâm sàng — duyệt, xác nhận, hoặc tạo thực đơn. Danh bạ bệnh nhân nằm ở tab Bệnh nhân.
            </p>
          </div>
          <Link
            href="/doctor/patients"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Tạo thực đơn AI
          </Link>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const selected = activeType === filter.id;
            return (
              <Link
                key={filter.id}
                href={doctorInboxHref(filter.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selected
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                {filter.label} ({counts[filter.id]})
              </Link>
            );
          })}
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="font-bold text-primary hover:underline cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-on-surface-variant py-12 text-center">
            Đang tải hàng việc…
          </p>
        ) : visible.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-emerald-500 mb-2">
              task_alt
            </span>
            <p className="font-bold text-sm text-on-surface">Không còn việc chờ xử lý</p>
            <p className="text-xs text-on-surface-variant mt-1">
              {jobs.length === 0
                ? "Mọi thực đơn, ràng buộc và hạn dùng đang ổn."
                : "Không có việc trong nhóm này. Chọn “Tất cả” để xem hàng việc còn lại."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((job) => {
              const meta = INBOX_TYPE_META[job.type];
              return (
                <li key={job.id}>
                  <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition-colors">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.iconWrap}`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {meta.icon}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.chipClass}`}
                        >
                          {meta.label}
                        </span>
                        {job.urgency === "urgent" && (
                          <span className="text-[10px] font-bold text-rose-700">
                            Ưu tiên
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-sm text-on-surface mt-1">{job.title}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        <Link
                          href={doctorChartHref(job.patientId)}
                          className="font-semibold text-on-surface hover:text-primary hover:underline"
                        >
                          {job.patientName}
                        </Link>
                        {" · "}
                        {job.subtitle}
                      </p>
                    </div>
                    <Link
                      href={job.href}
                      className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shrink-0"
                    >
                      {job.cta}
                      <span className="material-symbols-outlined text-[16px]">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

export default function DoctorInboxPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-sm text-on-surface-variant">Đang tải hàng việc…</main>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
