"use client";

import type { AssignedDoctor } from "@/lib/types";

export function AssignedDoctorStatus({
  doctor,
  loaded = true,
}: {
  doctor: AssignedDoctor | null | undefined;
  loaded?: boolean;
}) {
  if (!loaded) return null;
  if (!doctor) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
        <span className="material-symbols-outlined text-[15px]">hourglass_top</span>
        Đang chờ bác sĩ nhận
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-semibold">
      <span className="material-symbols-outlined text-[15px]">stethoscope</span>
      Bác sĩ phụ trách: {doctor.full_name?.trim() || "Bác sĩ điều trị"}
    </span>
  );
}
