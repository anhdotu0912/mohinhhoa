// TODO(phase2): Thay bằng API thật ở Phase 2, dọn ở Phase 3

export interface GroceryStoreItem {
  name: string;
  distance: string;
  address: string;
}

export interface GroceryData {
  area: string;
  items: string[];
  stores: GroceryStoreItem[];
}

export const MOCK_GROCERY_DATA: GroceryData = {
  area: "Quận 3, TP. Hồ Chí Minh",
  items: ["Bánh mì nguyên cám", "Bơ tươi", "Trứng gà ta", "Cá hồi phi lê", "Măng tây", "Hạt quinoa"],
  stores: [
    {
      name: "Co.opmart Nguyễn Đình Chiểu",
      distance: "450m",
      address: "168 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Q.3",
    },
    {
      name: "Chợ Vườn Chuối",
      distance: "800m",
      address: "Vườn Chuối, P.4, Q.3",
    },
  ],
};

export interface DailyComplianceDetail {
  day: string;
  pct: number;
  onPlan: number;   // Số bữa đúng thực đơn
  offPlan: number;  // Số món ngoài thực đơn
  skipped: number;  // Bữa chưa ghi nhận / bỏ lỡ
  target: number;   // Mục tiêu tối thiểu (%)
}

export interface ComplianceData {
  days: string[];
  dailyPct: number[];
  details: DailyComplianceDetail[];
}

export const MOCK_COMPLIANCE_DATA: ComplianceData = {
  days: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  dailyPct: [80, 85, 88, 90, 90, 95, 95],
  details: [
    { day: "T2", pct: 80, onPlan: 2, offPlan: 1, skipped: 0, target: 85 },
    { day: "T3", pct: 85, onPlan: 2, offPlan: 1, skipped: 0, target: 85 },
    { day: "T4", pct: 88, onPlan: 3, offPlan: 0, skipped: 0, target: 85 },
    { day: "T5", pct: 90, onPlan: 3, offPlan: 0, skipped: 0, target: 85 },
    { day: "T6", pct: 90, onPlan: 3, offPlan: 0, skipped: 0, target: 85 },
    { day: "T7", pct: 95, onPlan: 3, offPlan: 0, skipped: 0, target: 85 },
    { day: "CN", pct: 95, onPlan: 3, offPlan: 0, skipped: 0, target: 85 },
  ],
};

export function calculateAverageCompliance(data: ComplianceData = MOCK_COMPLIANCE_DATA): number {
  if (!data.dailyPct || data.dailyPct.length === 0) return 0;
  const sum = data.dailyPct.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / data.dailyPct.length);
}

export interface DoctorNoteData {
  doctorName: string;
  title: string;
  hospital: string;
  specialty: string;
  timestamp: string;
  avatarSrc: string;
  quote: string;
  tags: { text: string; type: "warning" | "info" | "success"; icon?: string }[];
}

export const MOCK_DOCTOR_NOTE_DATA: DoctorNoteData = {
  doctorName: "BS. CKI Minh Nguyễn",
  title: "Bác sĩ phụ trách điều trị",
  hospital: "Khoa Dinh dưỡng Lâm sàng & Tim mạch - BV VMEC-10",
  specialty: "Tim mạch & Chuyển hoá dinh dưỡng",
  timestamp: "Hôm nay, 08:15",
  avatarSrc:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBSX_YybfKfT0_-mukPxAmqqyRU53FeqJQTvIQX1gHbQHXiGVFWFCxERy2tYf-lN3IqMV1BZ1mUG6KINhl2tMreNG9LrG-P0RPYcSqMx0bfld15SoeaKlc_THNP66j1x_A1-FdQSN3oD_xNKjRs9vnT48bH7G3VJsTIBEEScHM-ziqK3CTj495lX2pp7jRAlO97T_QBwG2RkBRZtsD4rTPlMB0DsF6yba58qgl3XZ_vOIPO8ZyRIaWqlA",
  quote: "Hãy duy trì việc đi bộ 30 phút mỗi ngày sau bữa tối và hạn chế tinh bột nhanh để giữ đường huyết ổn định trong ngưỡng an toàn.",
  tags: [
    { text: "Hạn chế muối < 5g/ngày", type: "warning", icon: "warning" },
    { text: "Tái khám sau 2 tuần", type: "info", icon: "event" },
    { text: "Uống đủ 2L nước mỗi ngày", type: "success", icon: "water_drop" },
  ],
};

