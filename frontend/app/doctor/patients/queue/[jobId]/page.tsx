"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { GenerationProgressPanel } from "@/components/doctor/GenerationProgressPanel";
import { useQueueStore } from "@/lib/queue-store";
import { asRouteId } from "@/lib/route-params";

export default function QueueJobDetailPage() {
  const params = useParams();
  const jobId = asRouteId(params?.jobId);
  const job = useQueueStore((s) => s.jobs.find((j) => j.id === jobId));

  return (
    <>
      <TopBar title="Chi tiết quy trình tạo thực đơn AI" />

      <main className="p-lg max-w-[1400px]">

        {!jobId || !job ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center max-w-[640px] mx-auto">
            <span className="material-symbols-outlined text-[48px] text-outline mb-sm">
              search_off
            </span>
            <p className="font-body-bold text-on-surface text-sm">
              Không tìm thấy job trong hàng đợi
            </p>
            <p className="text-xs text-on-surface-variant mt-xs mb-md">
              Job có thể đã bị xoá khỏi danh sách, hoặc trang được mở ở phiên khác.
            </p>
            <Link
              href="/doctor/patients/queue"
              className="inline-flex items-center gap-xs px-md py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold"
            >
              Về trang hàng đợi
            </Link>
          </div>
        ) : (
          <GenerationProgressPanel job={job} />
        )}
      </main>
    </>
  );
}
