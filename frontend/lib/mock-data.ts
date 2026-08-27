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
  mealPlanRequestStatus?: "none" | "pending";
  mealPlanRequestNote?: string | null;
  mealPlanRequestedAt?: string | null;
}

export function statusColorFor(
  status: Patient["status"]
): string {
  switch (status) {
    case "Cảnh báo":
      return "bg-rose-50 text-rose-700 border-rose-200/70";
    case "Cần chú ý":
      return "bg-amber-50 text-amber-800 border-amber-200/70";
    case "Chờ duyệt":
      return "bg-amber-50 text-amber-800 border-amber-200/70";
    default:
      return "bg-emerald-50 text-emerald-800 border-emerald-200/70";
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
    mealPlanRequestStatus: p.meal_plan_request_status ?? "none",
    mealPlanRequestNote: p.meal_plan_request_note ?? null,
    mealPlanRequestedAt: p.meal_plan_requested_at ?? null,
  };
}

export const MOCK_PATIENTS: Patient[] = [
  {
    id: "demo_patient_1",
    name: "Nguyễn Văn A",
    age: 45,
    gender: "Nam",
    condition: "Tiểu đường type 2",
    disease: ["diabetes_t2"],
    medications: ["Metformin 500mg"],
    allergies: ["Hải sản"],
    treatmentGoals: [
      "Kiểm soát đường huyết ổn định (HbA1c < 7%).",
      "Giảm cân 2kg trong 1 tháng.",
      "Duy trì huyết áp dưới 130/80 mmHg.",
    ],
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
    condition: "Tiểu đường type 2, Thần kinh ĐTĐ",
    disease: ["diabetes_t2", "diabetic_neuropathy"],
    medications: ["Metformin 500mg", "Atorvastatin 10mg", "Alpha-lipoic acid 600mg"],
    allergies: [],
    treatmentGoals: [
      "Cải thiện triệu chứng tê bì bàn chân (QĐ 3510/QĐ-BYT).",
      "Hạ Triglyceride máu xuống dưới 1.7 mmol/L.",
      "Duy trì HbA1c < 6.5%.",
    ],
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
    condition: "Tiểu đường type 2, Thần kinh tiêu hóa (Liệt dạ dày)",
    disease: ["diabetes_t2", "diabetic_neuropathy"],
    medications: ["Glipizide 2mg", "Lisinopril 5mg"],
    allergies: [],
    treatmentGoals: [
      "Giảm khó tiêu/liệt dạ dày do đái tháo đường.",
      "Kiểm soát huyết áp < 130/80 mmHg.",
      "Tránh nguy cơ hạ đường huyết do thuốc Sulfonylurea.",
    ],
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
    targetKcal: 1900,
    saltDailyG: 5.0,
    sugarDailyG: 25,
  },
  {
    id: "demo_patient_4",
    name: "Hoàng Thị Mai",
    age: 29,
    gender: "Nữ",
    condition: "Đái tháo đường thai kỳ (Tuần 26)",
    disease: ["diabetes_gestational"],
    medications: [],
    allergies: [],
    treatmentGoals: [
      "Đường huyết đói thai kỳ ≤ 95 mg/dL, 2h sau ăn ≤ 120 mg/dL (QĐ 1470/QĐ-BYT).",
      "Phân bổ 3 bữa chính + 3 bữa phụ, ăn nhẹ trước khi ngủ chống ceton niệu.",
      "Đảm bảo thai nhi tăng trưởng đạt chuẩn chu vi vòng bụng.",
    ],
    status: "Cần chú ý",
    statusColor: "bg-error-container text-error",
    lastUpdate: "24/08/2026",
    avatar: "",
    phone: "0934 567 890",
    email: "demo_patient_4@example.com",
    address: "Quận Phú Nhuận, TP. Hồ Chí Minh",
    bmi: 23.5,
    weight: 61,
    height: 161,
    bloodSugar: "5.1 mmol/L (92 mg/dL)",
    bloodPressure: "115/75 mmHg",
    targetKcal: 1900,
    saltDailyG: 4.0,
    sugarDailyG: 15,
  },
  {
    id: "demo_patient_5",
    name: "Vũ Minh Khang",
    age: 19,
    gender: "Nam",
    condition: "Tiểu đường type 1 (Insulin MDI)",
    disease: ["diabetes_t1"],
    medications: ["Insulin Glargine 100UI/ml", "Insulin Aspart 100UI/ml"],
    allergies: ["Đậu phộng"],
    treatmentGoals: [
      "Duy trì Time in Range (TIR) > 70%, HbA1c < 7.0% (QĐ 1760/QĐ-BYT).",
      "Thực hành đếm Carbohydrate chính xác theo tỷ lệ I:C cho từng bữa ăn.",
      "Dự phòng hạ đường huyết khi tập luyện thể thao (quy tắc 15-15).",
    ],
    status: "Ổn định",
    statusColor: "bg-primary-container/20 text-primary",
    lastUpdate: "25/08/2026",
    avatar: "",
    phone: "0945 678 901",
    email: "demo_patient_5@example.com",
    address: "Quận Cầu Giấy, Hà Nội",
    bmi: 21.0,
    weight: 63,
    height: 173,
    bloodSugar: "6.5 mmol/L",
    bloodPressure: "118/75 mmHg",
    targetKcal: 2100,
    saltDailyG: 4.5,
    sugarDailyG: 20,
  },
];
