"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPageItems } from "@/components/shared/Pagination";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  buildInboxJobs,
  type InboxJob,
} from "@/lib/doctor-inbox";
import { doctorChartHref, doctorInboxHref, type InboxJobType } from "@/lib/doctor-routes";
import { ApiError, type MealPlanOutput } from "@/lib/types";
import { CompactInbox } from "@/components/doctor/CompactInbox";
import { EscalationThreadPanel } from "@/components/doctor/EscalationThreadPanel";

const PAGE_SIZE = 10;

function isInboxType(value: string | null): value is InboxJobType {
  return (
    value === "plan_review" ||
    value === "constraints" ||
    value === "generate_request" ||
    value === "plan_expiry" ||
    value === "patient_claim" ||
    value === "chat_escalation"
  );
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<InboxJob[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const typeParam = searchParams.get("type");
  const urgencyFilter = searchParams.get("urgency") === "soon";
  const activeType: "all" | InboxJobType = isInboxType(typeParam) ? typeParam : "all";
  const openEscalationId = searchParams.get("escalation");

  useEffect(() => {
    setHydrated(true);
  }, []);

  const load = useCallback(
    async (isManualRefresh = false) => {
      if (!token || role !== "doctor") return;
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [patients, plans, claimQueue, escalations] = await Promise.all([
          api.listDoctorPatients(),
          api.listDoctorMealPlans("pending_review").catch(() => [] as MealPlanOutput[]),
          api.listClaimQueue().catch(() => []),
          api.listDoctorEscalations("open").catch(() => []),
        ]);
        setJobs(buildInboxJobs(patients, plans, claimQueue, escalations));
      } catch (err) {
        setJobs([]);
        setError(
          err instanceof ApiError ? err.message : "Không tải được hàng việc y khoa."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, role]
  );

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const handleClaim = useCallback(
    async (job: InboxJob) => {
      if (claimingId) return;
      setClaimingId(job.id);
      try {
        if (job.claimKind === "transfer" && job.transferId) {
          await api.acceptTransfer(job.transferId);
        } else {
          await api.claimPatient(job.patientId);
        }
        showToast(`Đã nhận ${job.patientName}`);
        router.push(doctorChartHref(job.patientId));
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Không nhận được bệnh nhân. Tải lại hàng việc.";
        showToast(message);
        void load(true);
      } finally {
        setClaimingId(null);
      }
    },
    [claimingId, load, router, showToast]
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  // Reset về trang 1 khi đổi bộ lọc hoặc từ khóa tìm kiếm
  useEffect(() => {
    setPage(1);
  }, [activeType, searchQuery, urgencyFilter]);

  const counts = useMemo(() => {
    const next: Record<"all" | InboxJobType, number> = {
      all: jobs.length,
      plan_review: 0,
      constraints: 0,
      generate_request: 0,
      plan_expiry: 0,
      patient_claim: 0,
      chat_escalation: 0,
    };
    for (const job of jobs) next[job.type] += 1;
    return next;
  }, [jobs]);

  const urgentCount = useMemo(
    () => jobs.filter((j) => j.urgency === "urgent" || j.urgency === "soon").length,
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    let list = activeType === "all" ? jobs : jobs.filter((j) => j.type === activeType);
    if (urgencyFilter) {
      list = list.filter((j) => j.urgency === "urgent" || j.urgency === "soon");
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((j) => {
        return (
          j.patientName.toLowerCase().includes(q) ||
          j.patientId.toLowerCase().includes(q) ||
          j.title.toLowerCase().includes(q) ||
          j.subtitle.toLowerCase().includes(q) ||
          (j.patientCondition || "").toLowerCase().includes(q) ||
          (j.patientDisease || []).some((d) => d.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }, [jobs, activeType, searchQuery, urgencyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedJobs = getPageItems(filteredJobs, safePage, PAGE_SIZE);

  if (!hydrated || !token || role !== "doctor") return null;

  return (
    <>
      {toastMessage && (
        <div className="fixed top-[calc(var(--doctor-nav-height,64px)+1rem)] right-6 z-50 bg-emerald-800 text-white px-4 py-2.5 rounded-lg shadow-xl border border-emerald-600 flex items-center gap-2 font-medium text-sm">
          <span className="material-symbols-outlined text-[20px] text-emerald-300">info</span>
          <span>{toastMessage}</span>
        </div>
      )}
      <CompactInbox
        jobs={pagedJobs}
        counts={counts}
        urgentCount={urgentCount}
        total={filteredJobs.length}
        page={safePage}
        pageSize={PAGE_SIZE}
        activeType={activeType}
        urgencyFilter={urgencyFilter}
        searchQuery={searchQuery}
        loading={loading}
        refreshing={refreshing}
        error={error}
        claimingId={claimingId}
        onSearch={setSearchQuery}
        onRefresh={() => void load(true)}
        onClaim={(job) => void handleClaim(job)}
        onPage={setPage}
      />
      {openEscalationId ? (
        <EscalationThreadPanel
          escalationId={openEscalationId}
          onClose={() => router.push(doctorInboxHref(activeType, urgencyFilter ? { urgency: "soon" } : undefined))}
          onResolved={() => {
            void load(true);
            router.push(doctorInboxHref(activeType, urgencyFilter ? { urgency: "soon" } : undefined));
          }}
        />
      ) : null}
    </>
  );
}

export default function DoctorInboxPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-sm text-on-surface-variant flex items-center justify-center">
          Đang tải hàng việc y khoa…
        </main>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
