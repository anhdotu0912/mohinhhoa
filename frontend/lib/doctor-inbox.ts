import type {
  ClaimQueueItem,
  DoctorPatientSummary,
  MealPlanOutput,
} from "@/lib/types";
import {
  doctorChartHref,
  doctorGenerateHref,
  doctorReviewHref,
  type InboxJobType,
} from "@/lib/doctor-routes";

export type InboxJob = {
  id: string;
  type: InboxJobType;
  patientId: string;
  patientName: string;
  patientAvatar?: string | null;
  patientCondition?: string;
  patientDisease?: string[];
  patientAge?: number | null;
  patientGender?: string | null;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  urgency: "urgent" | "soon" | "normal";
  sortAt: string;
  claimKind?: "unassigned" | "transfer";
  transferId?: string | null;
};

export const INBOX_TYPE_META: Record<
  InboxJobType,
  { label: string; icon: string; chipClass: string; iconWrap: string }
> = {
  plan_review: {
    label: "Chờ duyệt thực đơn",
    icon: "assignment_turned_in",
    chipClass: "bg-amber-50 text-amber-800 border-amber-200/70",
    iconWrap: "bg-amber-500/10 text-amber-700",
  },
  constraints: {
    label: "Chờ xác nhận ràng buộc",
    icon: "clinical_notes",
    chipClass: "bg-sky-50 text-sky-800 border-sky-200/70",
    iconWrap: "bg-sky-500/10 text-sky-700",
  },
  generate_request: {
    label: "Yêu cầu tạo thực đơn",
    icon: "restaurant_menu",
    chipClass: "bg-emerald-50 text-emerald-800 border-emerald-200/70",
    iconWrap: "bg-primary/10 text-primary",
  },
  plan_expiry: {
    label: "Thực đơn hết hạn",
    icon: "event_busy",
    chipClass: "bg-rose-50 text-rose-800 border-rose-200/70",
    iconWrap: "bg-rose-500/10 text-rose-700",
  },
  patient_claim: {
    label: "Chờ nhận",
    icon: "person_add",
    chipClass: "bg-violet-50 text-violet-800 border-violet-200/70",
    iconWrap: "bg-violet-500/10 text-violet-700",
  },
};

function isPendingPlan(status: string | null | undefined): boolean {
  return status === "pending" || status === "pending_review";
}

function planTitle(plan: MealPlanOutput): string {
  const days = plan.days?.length || 7;
  return `Thực đơn ${days} ngày`;
}

export function buildInboxJobs(
  patients: DoctorPatientSummary[],
  plans: MealPlanOutput[],
  claimQueue: ClaimQueueItem[] = []
): InboxJob[] {
  const byId = new Map(patients.map((p) => [p.id, p]));
  const jobs: InboxJob[] = [];

  for (const plan of plans) {
    if (!isPendingPlan(String(plan.status))) continue;
    const patient = byId.get(plan.user_id);
    jobs.push({
      id: `plan:${plan.id}`,
      type: "plan_review",
      patientId: plan.user_id,
      patientName: patient?.name || "Bệnh nhân",
      patientAvatar: patient?.avatar || null,
      patientCondition: patient?.condition_label || "",
      patientDisease: patient?.disease || [],
      patientAge: patient?.age,
      patientGender: patient?.gender,
      title: planTitle(plan),
      subtitle: patient?.condition_label
        ? `${patient.condition_label} · chờ bác sĩ duyệt`
        : "AI đã tạo — chờ bác sĩ duyệt",
      href: doctorReviewHref(plan.user_id, plan.id),
      cta: "Duyệt ngay",
      urgency: "soon",
      sortAt: plan.created_at || "",
    });
  }

  for (const patient of patients) {
    if (patient.constraints_status === "pending_doctor_review") {
      jobs.push({
        id: `constraints:${patient.id}`,
        type: "constraints",
        patientId: patient.id,
        patientName: patient.name,
        patientAvatar: patient.avatar || null,
        patientCondition: patient.condition_label || "",
        patientDisease: patient.disease || [],
        patientAge: patient.age,
        patientGender: patient.gender,
        title: "Ràng buộc lâm sàng chưa xác nhận",
        subtitle: [
          patient.target_kcal ? `${patient.target_kcal} kcal` : null,
          patient.salt_daily_g != null ? `muối ≤ ${patient.salt_daily_g}g` : null,
          patient.sugar_daily_g != null ? `đường ≤ ${patient.sugar_daily_g}g` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Cần xác nhận trước khi tạo thực đơn",
        href: doctorChartHref(patient.id, "constraints"),
        cta: "Xác nhận",
        urgency: "soon",
        sortAt: patient.last_update || "",
      });
    }

    if (patient.meal_plan_request_status === "pending") {
      jobs.push({
        id: `request:${patient.id}`,
        type: "generate_request",
        patientId: patient.id,
        patientName: patient.name,
        patientAvatar: patient.avatar || null,
        patientCondition: patient.condition_label || "",
        patientDisease: patient.disease || [],
        patientAge: patient.age,
        patientGender: patient.gender,
        title: "Bệnh nhân yêu cầu tạo thực đơn",
        subtitle: patient.meal_plan_request_note
          ? `“${patient.meal_plan_request_note}”`
          : "Chưa có ghi chú kèm theo",
        href: doctorGenerateHref(patient.id),
        cta: "Tạo thực đơn",
        urgency: "normal",
        sortAt: patient.meal_plan_requested_at || patient.last_update || "",
      });
    }

    if (patient.plan_expiry === "expired" || patient.plan_expiry === "expiring") {
      const expired = patient.plan_expiry === "expired";
      jobs.push({
        id: `expiry:${patient.id}`,
        type: "plan_expiry",
        patientId: patient.id,
        patientName: patient.name,
        patientAvatar: patient.avatar || null,
        patientCondition: patient.condition_label || "",
        patientDisease: patient.disease || [],
        patientAge: patient.age,
        patientGender: patient.gender,
        title: expired ? "Thực đơn đã hết hạn" : "Thực đơn sắp hết hạn",
        subtitle: expired
          ? `Hết hạn ${patient.plan_end_date ?? "—"} — cần tạo thực đơn tiếp`
          : `Còn ${patient.plan_days_left ?? "?"} ngày (đến ${patient.plan_end_date ?? "—"})`,
        href: doctorGenerateHref(patient.id),
        cta: "Tạo thực đơn mới",
        urgency: expired ? "urgent" : "soon",
        sortAt: patient.plan_end_date || patient.last_update || "",
      });
    }
  }

  for (const item of claimQueue) {
    const p = item.patient;
    const isTransfer = item.kind === "transfer";
    const sourceLabel =
      item.source === "self_register"
        ? "Tự đăng ký"
        : item.source === "transfer"
          ? `Chuyển từ ${item.from_doctor_name || "bác sĩ khác"}`
          : "Chưa phân công";
    jobs.push({
      id: isTransfer ? `claim-xfer:${item.transfer_id}` : `claim:${item.patient_id}`,
      type: "patient_claim",
      patientId: item.patient_id,
      patientName: p.name,
      patientAvatar: p.avatar || null,
      patientCondition: p.condition_label || "",
      patientDisease: p.disease || [],
      patientAge: p.age,
      patientGender: p.gender,
      title: isTransfer ? "Đề xuất tiếp nhận bệnh nhân" : "Bệnh nhân chờ nhận",
      subtitle: sourceLabel,
      href: "",
      cta: "Nhận",
      urgency: isTransfer ? "soon" : "normal",
      sortAt: item.created_at || "",
      claimKind: item.kind,
      transferId: item.transfer_id ?? null,
    });
  }

  const urgencyRank = { urgent: 0, soon: 1, normal: 2 };
  return jobs.sort((a, b) => {
    const ur = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (ur !== 0) return ur;
    return (b.sortAt || "").localeCompare(a.sortAt || "");
  });
}
