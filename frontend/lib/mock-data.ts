import type { DoctorPatientSummary } from "./types";

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  condition: string;
  disease?: string[];
  medications?: string[];
  allergies?: string[];
  treatmentGoals?: string[];
  preferences?: string[];
  status: "Cần chú ý" | "Ổn định" | "Cảnh báo" | "Chờ duyệt";
  statusColor: string;
  lastUpdate: string;
  avatar: string;
  phone?: string;
  email?: string;
  address?: string;
  bmi?: number;
  weight?: number; // kg
  height?: number; // cm
  bloodSugar?: string;
  bloodPressure?: string;
  statusKey?: "attention" | "stable" | "warning" | "pending";
  latestPlanId?: string | null;
  latestPlanStatus?: string | null;
  activePlanId?: string | null;
  activePlanStatus?: string | null;
  planStartsOn?: string | null;
  planUsage?: "none" | "active" | "finished";
  planExpiry?: "expiring" | "expired" | "ok" | "none";
  planDaysLeft?: number | null;
  planEndDate?: string | null;
  planPending?: number;
  planTotal?: number;
  alertCount?: number;
  targetKcal?: number;
  saltDailyG?: number;
  sugarDailyG?: number;
  constraintsStatus?: "confirmed" | "pending_doctor_review";
}

export function statusColorFor(
  status: Patient["status"]
): string {
  switch (status) {
    case "Cảnh báo":
      return "bg-tertiary-fixed text-tertiary-fixed-dim";
    case "Cần chú ý":
      return "bg-error-container text-error";
    case "Chờ duyệt":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-primary-container/20 text-primary";
  }
}

export function doctorPatientToUi(p: DoctorPatientSummary): Patient {
  return {
    id: p.id,
    name: p.name,
    age: p.age ?? 0,
    gender: p.gender ?? "—",
    condition: p.condition_label,
    disease: p.disease,
    medications: p.medications,
    allergies: p.allergies,
    treatmentGoals: p.treatment_goals,
    preferences: p.preferences,
    status: p.status,
    statusColor: statusColorFor(p.status),
    lastUpdate: p.last_update || "—",
    avatar:
      p.avatar &&
      !p.avatar.startsWith("https://api.dicebear.com") &&
      !p.avatar.includes("googleusercontent.com")
        ? p.avatar
        : "",
    email: p.email,
    phone: p.phone || undefined,
    address: p.address || undefined,
    bmi: p.bmi ?? undefined,
    weight: p.weight ?? undefined,
    height: p.height ?? undefined,
    bloodSugar: p.blood_glucose || undefined,
    bloodPressure: p.blood_pressure || undefined,
    statusKey: p.status_key,
    latestPlanId: p.latest_plan_id,
    latestPlanStatus: p.latest_plan_status,
    activePlanId: p.active_plan_id,
    activePlanStatus: p.active_plan_status,
    planStartsOn: p.plan_starts_on,
    planUsage: p.plan_usage,
    planExpiry: p.plan_expiry,
    planDaysLeft: p.plan_days_left,
    planEndDate: p.plan_end_date,
    planPending: p.plan_pending ?? 0,
    planTotal: p.plan_total ?? 0,
    alertCount: p.alert_count,
    targetKcal: p.target_kcal,
    saltDailyG: p.salt_daily_g ?? undefined,
    sugarDailyG: p.sugar_daily_g ?? undefined,
    constraintsStatus: p.constraints_status ?? "confirmed",
  };
}

export const MOCK_PATIENTS: Patient[] = [
  {
    id: "demo_patient_1",
    name: "Nguyễn Văn A",
    age: 45,
    gender: "Nam",
    condition: "Tiểu đường type 2, Tăng huyết áp",
    disease: ["diabetes_t2", "hypertension"],
    medications: ["Metformin 500mg"],
    allergies: ["Hải sản"],
    status: "Cần chú ý",
    statusColor: "bg-error-container text-error",
    lastUpdate: "12/10/2023",
    avatar: "",
    phone: "0901 234 567",
    email: "demo_patient_1@example.com",
    address: "Quận 1, TP. Hồ Chí Minh",
    bmi: 24.5,
    weight: 72,
    height: 171,
    bloodSugar: "7.8 mmol/L",
    bloodPressure: "135/85 mmHg",
    targetKcal: 1800,
    saltDailyG: 4.5,
    sugarDailyG: 20,
  },
  {
    id: "demo_patient_2",
    name: "Trần Thị B",
    age: 52,
    gender: "Nữ",
    condition: "Rối loạn lipid máu, Tăng huyết áp",
    disease: ["dyslipidemia", "hypertension"],
    medications: ["Atorvastatin 10mg", "Amlodipine 5mg"],
    allergies: [],
    status: "Ổn định",
    statusColor: "bg-primary-container/20 text-primary",
    lastUpdate: "10/10/2023",
    avatar: "/static/avatars/demo_patient_2.jpg",
    phone: "0912 345 678",
    email: "demo_patient_2@example.com",
    address: "Quận 3, TP. Hồ Chí Minh",
    bmi: 22.1,
    weight: 58,
    height: 162,
    bloodSugar: "5.6 mmol/L",
    bloodPressure: "120/80 mmHg",
    targetKcal: 1600,
    saltDailyG: 3.0,
    sugarDailyG: 15,
  },
  {
    id: "demo_patient_3",
    name: "Lê Văn C",
    age: 60,
    gender: "Nam",
    condition: "Tăng huyết áp vô căn",
    disease: ["hypertension"],
    medications: ["Glipizide 2mg", "Lisinopril 5mg"],
    allergies: [],
    status: "Cảnh báo",
    statusColor: "bg-tertiary-fixed text-tertiary-fixed-dim",
    lastUpdate: "08/10/2023",
    avatar: "",
    phone: "0923 456 789",
    email: "demo_patient_3@example.com",
    address: "Bình Thạnh, TP. Hồ Chí Minh",
    bmi: 26.8,
    weight: 78,
    height: 170,
    bloodSugar: "6.2 mmol/L",
    bloodPressure: "145/95 mmHg",
    targetKcal: 2000,
    saltDailyG: 5.0,
    sugarDailyG: 25,
  },
];
