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

export interface ComplianceData {
  overallPct: number;
  dailyPct: number[];
  days: string[];
}

export const MOCK_COMPLIANCE_DATA: ComplianceData = {
  overallPct: 92,
  dailyPct: [80, 85, 88, 90, 90, 95, 95],
  days: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
};

export interface DoctorNoteData {
  doctorName: string;
  specialty: string;
  timestamp: string;
  avatarSrc: string;
  quote: string;
  tags: { text: string; type: "warning" | "info" | "success" }[];
}

export const MOCK_DOCTOR_NOTE_DATA: DoctorNoteData = {
  doctorName: "BS. Minh Nguyễn",
  specialty: "Khoa Tim mạch & Dinh dưỡng Lâm sàng",
  timestamp: "Hôm nay, 08:15",
  avatarSrc:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBSX_YybfKfT0_-mukPxAmqqyRU53FeqJQTvIQX1gHbQHXiGVFWFCxERy2tYf-lN3IqMV1BZ1mUG6KINhl2tMreNG9LrG-P0RPYcSqMx0bfld15SoeaKlc_THNP66j1x_A1-FdQSN3oD_xNKjRs9vnT48bH7G3VJsTIBEEScHM-ziqK3CTj495lX2pp7jRAlO97T_QBwG2RkBRZtsD4rTPlMB0DsF6yba58qgl3XZ_vOIPO8ZyRIaWqlA",
  quote: "Hãy duy trì việc đi bộ 30 phút mỗi ngày và hạn chế tinh bột trắng để ổn định đường huyết.",
  tags: [
    { text: "Hạn chế muối < 5g/ngày", type: "warning" },
    { text: "Tái khám sau 2 tuần", type: "info" },
    { text: "Uống đủ 2L nước", type: "success" },
  ],
};
