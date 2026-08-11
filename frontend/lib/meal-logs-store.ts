import { create } from "zustand";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type LogSource = "manual" | "inferred";
export type ComplianceType = "as_planned" | "custom"; // "Ăn đúng" | "Ăn khác"
export type ComparisonStatus = "pass" | "deviated" | "warning" | "missed";

export interface FoodItem {
  name: string;
  amount?: string;
  calories?: number;
  salt?: number;
}

export interface MealLogItem {
  id: string;
  patientId: string;
  date: string; // Format: YYYY-MM-DD
  displayDate: string; // Format: DD/MM/YYYY
  mealType: MealType;
  mealLabel: string; // Bữa sáng / Bữa trưa / Bữa tối / Bữa phụ
  foodItems: FoodItem[];
  loggedAt: string; // e.g. "08:15, 15/10/2023"
  source: LogSource;
  complianceType: ComplianceType; // "as_planned" -> Ăn đúng | "custom" -> Ăn khác
  sourceBadgeText: string; // "Ăn đúng" | "Ăn khác"
  complianceStatus?: ComparisonStatus;
  comparisonNote?: string;
  approvedMenuName?: string;
}

// Full weekly mock data for patients (Week 09/10/2023 - 15/10/2023)
const INITIAL_MEAL_LOGS: MealLogItem[] = [
  // --- BN-10293 (Nguyễn Văn A) ---
  // Thứ 2 (09/10/2023)
  {
    id: "LOG-10293-09-B",
    patientId: "BN-10293",
    date: "2023-10-09",
    displayDate: "09/10/2023",
    mealType: "breakfast",
    mealLabel: "Bữa sáng",
    foodItems: [{ name: "Cháo yến mạch ức gà", calories: 300, salt: 0.8 }],
    loggedAt: "07:30, 09/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10293-09-L",
    patientId: "BN-10293",
    date: "2023-10-09",
    displayDate: "09/10/2023",
    mealType: "lunch",
    mealLabel: "Bữa trưa",
    foodItems: [
      { name: "Cơm gạo lứt (1 bát)", calories: 150 },
      { name: "Thịt lợn thăn luộc + Canh bí đao", calories: 320, salt: 0.6 },
    ],
    loggedAt: "12:15, 09/10/2023",
    source: "inferred",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10293-09-D",
    patientId: "BN-10293",
    date: "2023-10-09",
    displayDate: "09/10/2023",
    mealType: "dinner",
    mealLabel: "Bữa tối",
    foodItems: [{ name: "Cá lóc hấp bầu + Rau luộc", calories: 290, salt: 0.4 }],
    loggedAt: "18:45, 09/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },

  // Thứ 3 (10/10/2023)
  {
    id: "LOG-10293-10-B",
    patientId: "BN-10293",
    date: "2023-10-10",
    displayDate: "10/10/2023",
    mealType: "breakfast",
    mealLabel: "Bữa sáng",
    foodItems: [{ name: "Bánh mì nguyên cám ốp la", calories: 310, salt: 0.6 }],
    loggedAt: "08:00, 10/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10293-10-L",
    patientId: "BN-10293",
    date: "2023-10-10",
    displayDate: "10/10/2023",
    mealType: "lunch",
    mealLabel: "Bữa trưa",
    foodItems: [
      { name: "Cơm gạo lứt + Cá hồi áp chảo", calories: 470, salt: 0.8 },
    ],
    loggedAt: "12:30, 10/10/2023",
    source: "inferred",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },

  // Thứ 4 (11/10/2023)
  {
    id: "LOG-10293-11-B",
    patientId: "BN-10293",
    date: "2023-10-11",
    displayDate: "11/10/2023",
    mealType: "breakfast",
    mealLabel: "Bữa sáng",
    foodItems: [{ name: "Súp yến mạch rau củ", calories: 200, salt: 0.3 }],
    loggedAt: "07:45, 11/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10293-11-D",
    patientId: "BN-10293",
    date: "2023-10-11",
    displayDate: "11/10/2023",
    mealType: "dinner",
    mealLabel: "Bữa tối",
    foodItems: [{ name: "Nấm đùi gà kho + Canh rau ngót", calories: 280, salt: 0.5 }],
    loggedAt: "19:15, 11/10/2023",
    source: "inferred",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },

  // Thứ 5 (12/10/2023)
  {
    id: "LOG-10293-12-B",
    patientId: "BN-10293",
    date: "2023-10-12",
    displayDate: "12/10/2023",
    mealType: "breakfast",
    mealLabel: "Bữa sáng",
    foodItems: [{ name: "Phở gà ít béo (thịt lườn)", calories: 350, salt: 1.2 }],
    loggedAt: "08:10, 12/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10293-12-L",
    patientId: "BN-10293",
    date: "2023-10-12",
    displayDate: "12/10/2023",
    mealType: "lunch",
    mealLabel: "Bữa trưa",
    foodItems: [
      { name: "Cơm diêm mạch + Đậu hũ sốt cà chua", calories: 410, salt: 0.6 },
    ],
    loggedAt: "12:20, 12/10/2023",
    source: "inferred",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },

  // Thứ 6 (13/10/2023)
  {
    id: "LOG-10293-13-B",
    patientId: "BN-10293",
    date: "2023-10-13",
    displayDate: "13/10/2023",
    mealType: "breakfast",
    mealLabel: "Bữa sáng",
    foodItems: [{ name: "Mì chũ nấu thịt nạc băm", calories: 340, salt: 0.9 }],
    loggedAt: "07:50, 13/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },

  // Thứ 7 (14/10/2023)
  {
    id: "LOG-10293-14-B",
    patientId: "BN-10293",
    date: "2023-10-14",
    displayDate: "14/10/2023",
    mealType: "breakfast",
    mealLabel: "Bữa sáng",
    foodItems: [{ name: "Bánh mì đen phết bơ quả", calories: 320, salt: 0.5 }],
    loggedAt: "08:15, 14/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10293-14-L",
    patientId: "BN-10293",
    date: "2023-10-14",
    displayDate: "14/10/2023",
    mealType: "lunch",
    mealLabel: "Bữa trưa",
    foodItems: [{ name: "Salad ức gà xé phay", calories: 350, salt: 0.5 }],
    loggedAt: "12:40, 14/10/2023",
    source: "inferred",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10293-14-D",
    patientId: "BN-10293",
    date: "2023-10-14",
    displayDate: "14/10/2023",
    mealType: "dinner",
    mealLabel: "Bữa tối",
    foodItems: [{ name: "Ức gà hấp gừng sả + Rau củ luộc", calories: 310, salt: 0.6 }],
    loggedAt: "19:00, 14/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },

  // Chủ Nhật (15/10/2023)
  {
    id: "LOG-10293-15-B",
    patientId: "BN-10293",
    date: "2023-10-15",
    displayDate: "15/10/2023",
    mealType: "breakfast",
    mealLabel: "Bữa sáng",
    foodItems: [
      { name: "Phở gà ít béo (thịt lườn)", calories: 350, salt: 1.2 },
      { name: "Nước ép cần tây táo", calories: 80, salt: 0.1 },
    ],
    loggedAt: "08:15, 15/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10293-15-L",
    patientId: "BN-10293",
    date: "2023-10-15",
    displayDate: "15/10/2023",
    mealType: "lunch",
    mealLabel: "Bữa trưa",
    foodItems: [
      { name: "Cơm trắng + Bò xào cần tây (mặn)", calories: 480, salt: 1.8 },
    ],
    loggedAt: "12:30, 15/10/2023",
    source: "inferred",
    complianceType: "custom",
    sourceBadgeText: "Ăn khác",
    complianceStatus: "deviated",
    comparisonNote: "Khác thực đơn chỉ định - Vượt ngưỡng muối 20%",
  },

  // --- BN-10294 (Trần Thị B) ---
  {
    id: "LOG-10294-14-B",
    patientId: "BN-10294",
    date: "2023-10-14",
    displayDate: "14/10/2023",
    mealType: "breakfast",
    mealLabel: "Bữa sáng",
    foodItems: [{ name: "Bánh mì nguyên cám ốp la", calories: 310, salt: 0.6 }],
    loggedAt: "07:45, 14/10/2023",
    source: "manual",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10294-15-L",
    patientId: "BN-10294",
    date: "2023-10-15",
    displayDate: "15/10/2023",
    mealType: "lunch",
    mealLabel: "Bữa trưa",
    foodItems: [{ name: "Bún chả cá thát lát hấp", calories: 380, salt: 0.7 }],
    loggedAt: "12:15, 15/10/2023",
    source: "manual",
    complianceType: "custom",
    sourceBadgeText: "Ăn khác",
    complianceStatus: "pass",
  },
  {
    id: "LOG-10294-15-D",
    patientId: "BN-10294",
    date: "2023-10-15",
    displayDate: "15/10/2023",
    mealType: "dinner",
    mealLabel: "Bữa tối",
    foodItems: [{ name: "Cá lóc hấp bầu (ít muối)", calories: 280, salt: 0.4 }],
    loggedAt: "19:00, 15/10/2023",
    source: "inferred",
    complianceType: "as_planned",
    sourceBadgeText: "Ăn đúng",
    complianceStatus: "pass",
  },
];

interface MealLogsState {
  logs: MealLogItem[];
  getLogsByPatientId: (patientId: string) => MealLogItem[];
  getFilteredLogs: (
    patientId: string,
    startDate?: string,
    endDate?: string
  ) => MealLogItem[];
  addLog: (log: MealLogItem) => void;
}

export const useMealLogsStore = create<MealLogsState>((set, get) => ({
  logs: INITIAL_MEAL_LOGS,

  getLogsByPatientId: (patientId) => {
    return get()
      .logs.filter((log) => log.patientId === patientId)
      .sort((a, b) => (b.loggedAt > a.loggedAt ? 1 : -1));
  },

  getFilteredLogs: (patientId, startDate, endDate) => {
    let patientLogs = get().logs.filter((log) => log.patientId === patientId);

    if (startDate) {
      patientLogs = patientLogs.filter((log) => log.date >= startDate);
    }
    if (endDate) {
      patientLogs = patientLogs.filter((log) => log.date <= endDate);
    }

    return patientLogs.sort((a, b) => (b.loggedAt > a.loggedAt ? 1 : -1));
  },

  addLog: (newLog) => {
    set((state) => ({
      logs: [newLog, ...state.logs],
    }));
  },
}));
