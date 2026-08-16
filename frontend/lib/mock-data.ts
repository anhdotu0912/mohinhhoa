import type { DoctorPatientSummary } from "./types";

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  condition: string;
  disease?: string[];
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
  planExpiry?: "expiring" | "expired" | "ok" | "none";
  planDaysLeft?: number | null;
  planEndDate?: string | null;
  planPending?: number;
  planTotal?: number;
  alertCount?: number;
  targetKcal?: number;
  saltDailyG?: number;
  sugarDailyG?: number;
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
    status: p.status,
    statusColor: statusColorFor(p.status),
    lastUpdate: p.last_update || "—",
    avatar: p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`,
    email: p.email,
    bmi: p.bmi ?? undefined,
    statusKey: p.status_key,
    latestPlanId: p.latest_plan_id,
    latestPlanStatus: p.latest_plan_status,
    planExpiry: p.plan_expiry,
    planDaysLeft: p.plan_days_left,
    planEndDate: p.plan_end_date,
    planPending: p.plan_pending ?? 0,
    planTotal: p.plan_total ?? 0,
    alertCount: p.alert_count,
    targetKcal: p.target_kcal,
    saltDailyG: p.salt_daily_g ?? undefined,
    sugarDailyG: p.sugar_daily_g ?? undefined,
  };
}

export const MOCK_PATIENTS: Patient[] = [
  {
    id: "BN-10293",
    name: "Nguyễn Văn A",
    age: 45,
    gender: "Nam",
    condition: "Tiểu đường type 2, Tăng huyết áp",
    status: "Cần chú ý",
    statusColor: "bg-error-container text-error",
    lastUpdate: "12/10/2023",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC66kEeXEpUoXAUDa-eVjaWGucklXyDHyG0BWkYQcXkH3OQPebxVez4samPvA1fKP_po9Omc23Pxx-vQJR1oIf-YvHPIFCajQyXqRLKUZJksJuhXpCWTPDsKa_fN5bLjnK9ZjAhBFEX84oz_drQgFQHb5WaDGrrCXlMCh3z1GxBRZp8t8mViPN4OeChVWmoVFOaLJ_Gpk0YQdYiE8R0LY9vO7gn5W80SIuwv4lCvSAbRcfYwKzJgC8I9A",
    phone: "0901 234 567",
    email: "nguyenvana@gmail.com",
    address: "Quận 1, TP. Hồ Chí Minh",
    bmi: 24.5,
    weight: 72,
    height: 171,
    bloodSugar: "7.8 mmol/L",
    bloodPressure: "135/85 mmHg",
    targetKcal: 1600,
    saltDailyG: 4.5,
    sugarDailyG: 20,
  },
  {
    id: "BN-10294",
    name: "Trần Thị B",
    age: 52,
    gender: "Nữ",
    condition: "Rối loạn lipid máu, Tăng huyết áp",
    status: "Ổn định",
    statusColor: "bg-primary-container/20 text-primary",
    lastUpdate: "10/10/2023",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCOoxHyn1Iqv8ACjNZKkTjUApup6F086K6cU2r6IGNFxyDq9AcmyAiD77yF9WpmaUJ2wIJJ2WlmKQGVrt0vGO1fMlrzFci8T7vvV3geKq8PLTsOL84j2S1EyMSvffUGDLytcSIFDungXs5Sg4CH5UQondpvHdL8b9F-plA3q761qHESIPJ16AdVSQiIEiIuqeAf6yqvUzm6ZPHpp5Iy2lUBDpyZFeL164OJGSlydQ8taiRP0cAOPKXkUg",
    phone: "0912 345 678",
    email: "tranthib@gmail.com",
    address: "Quận 3, TP. Hồ Chí Minh",
    bmi: 22.1,
    weight: 58,
    height: 162,
    bloodSugar: "5.6 mmol/L",
    bloodPressure: "120/80 mmHg",
    targetKcal: 1700,
    saltDailyG: 3.0,
    sugarDailyG: 15,
  },
  {
    id: "BN-10295",
    name: "Lê Văn C",
    age: 60,
    gender: "Nam",
    condition: "Tăng huyết áp vô căn",
    status: "Cảnh báo",
    statusColor: "bg-tertiary-fixed text-tertiary-fixed-dim",
    lastUpdate: "08/10/2023",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC66kEeXEpUoXAUDa-eVjaWGucklXyDHyG0BWkYQcXkH3OQPebxVez4samPvA1fKP_po9Omc23Pxx-vQJR1oIf-YvHPIFCajQyXqRLKUZJksJuhXpCWTPDsKa_fN5bLjnK9ZjAhBFEX84oz_drQgFQHb5WaDGrrCXlMCh3z1GxBRZp8t8mViPN4OeChVWmoVFOaLJ_Gpk0YQdYiE8R0LY9vO7gn5W80SIuwv4lCvSAbRcfYwKzJgC8I9A",
    phone: "0923 456 789",
    email: "levanc@gmail.com",
    address: "Bình Thạnh, TP. Hồ Chí Minh",
    bmi: 26.8,
    weight: 78,
    height: 170,
    bloodSugar: "6.2 mmol/L",
    bloodPressure: "145/95 mmHg",
    targetKcal: 1800,
    saltDailyG: 5.0,
    sugarDailyG: 25,
  },
];
