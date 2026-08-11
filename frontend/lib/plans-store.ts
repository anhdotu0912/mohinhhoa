import { create } from "zustand";
import { DEFAULT_VARIANTS_PER_JOB, DEFAULT_PLAN_DAYS } from "./config";

export interface MealDishItem {
  name: string;
  calories: number;
  salt: number;
  sugar: number;
}

export interface DayMealPlan {
  dayIndex: number;
  dayName: string;
  breakfast: MealDishItem[];
  lunch: MealDishItem[];
  dinner: MealDishItem[];
  snack?: MealDishItem[];
  totalCalories?: number;
  totalSalt?: number;
  totalSugar?: number;
}

export interface MealPlanItem {
  id: string;
  variantGroupId?: string;
  variantIndex?: number;
  totalVariants?: number;
  patientId: string;
  patientName: string;
  patientCode: string;
  condition: string;
  duration: string;
  daysCount?: number;
  status: "pending" | "approved" | "rejected" | "unselected";
  planTitle: string;
  calories: string;
  salt: string;
  sugar?: string;
  water?: string;
  createdAt: string;
  days: DayMealPlan[];
  breakfast?: MealDishItem[];
  lunch?: MealDishItem[];
  dinner?: MealDishItem[];
  warnings: string[];
  citations: string[];
}

function buildMock7Days(variantType: "standard" | "high_fiber" | "easy_prep"): DayMealPlan[] {
  const days: DayMealPlan[] = [];

  const dishSets = {
    standard: {
      b: [
        { name: "Phở gà ít béo (thịt lườn, nước dùng trong)", calories: 350, salt: 1.2, sugar: 0 },
        { name: "Cháo yến mạch ức gà xé", calories: 300, salt: 0.8, sugar: 0 },
        { name: "Bánh mì nguyên cám kẹp trứng ốp la", calories: 310, salt: 0.6, sugar: 0 },
      ],
      l: [
        { name: "Cơm gạo lứt (1 bát con) + Cá hồi áp chảo măng tây", calories: 470, salt: 0.8, sugar: 0 },
        { name: "Cơm gạo lứt + Thịt lợn thăn luộc + Canh bí đao", calories: 450, salt: 0.6, sugar: 0 },
        { name: "Bún tươi chả cá thát lát hấp", calories: 380, salt: 0.7, sugar: 0 },
      ],
      d: [
        { name: "Ức gà hấp gừng sả + Rau củ luộc thập cẩm", calories: 310, salt: 0.6, sugar: 2 },
        { name: "Cá lóc hấp bầu + Rau củ luộc", calories: 320, salt: 0.4, sugar: 0 },
        { name: "Canh giò heo hầm đu đủ xanh (ít muối)", calories: 290, salt: 0.2, sugar: 0 },
      ],
    },
    high_fiber: {
      b: [
        { name: "Súp yến mạch rau củ + Sữa hạt óc chó không đường", calories: 280, salt: 0.4, sugar: 1 },
        { name: "Bánh mì đen phết bơ bơ quả + Trứng luộc", calories: 320, salt: 0.5, sugar: 0 },
        { name: "Sinh tố xanh (Cần tây, táo, cải kale, chia)", calories: 210, salt: 0.1, sugar: 8 },
      ],
      l: [
        { name: "Salad ức gà xé phay + Cơm gạo lứt hạt đỗ", calories: 430, salt: 0.5, sugar: 1 },
        { name: "Cơm diêm mạch (Quinoa) + Đậu hũ sốt cà chua ít muối", calories: 410, salt: 0.6, sugar: 1 },
        { name: "Cơm gạo lứt red rice + Thịt bò xào bông cải xanh", calories: 460, salt: 0.7, sugar: 0 },
      ],
      d: [
        { name: "Nấm đùi gà kho tộ + Canh rau ngót nấu thịt băm", calories: 290, salt: 0.5, sugar: 0 },
        { name: "Canh bí đỏ nấu nấm kiềm tính + Đậu phụ luộc", calories: 270, salt: 0.4, sugar: 0 },
        { name: "Súp lơ xanh hấp + Tôm nán hấp sả", calories: 300, salt: 0.5, sugar: 0 },
      ],
    },
    easy_prep: {
      b: [
        { name: "Cháo thịt lợn nạc nấu hạt đỗ xanh", calories: 310, salt: 0.7, sugar: 0 },
        { name: "Mì chũ nấu thịt nạc băm + Bắp cải luộc", calories: 340, salt: 0.9, sugar: 0 },
        { name: "Nui lúa mạch nấu thịt gà + Cà rốt", calories: 330, salt: 0.8, sugar: 0 },
      ],
      l: [
        { name: "Cơm trắng (1 bát con) + Trứng đúc thịt hấp thủy", calories: 480, salt: 0.7, sugar: 0 },
        { name: "Cơm trắng + Thịt nạc rim nước mắm loãng + Canh cải", calories: 460, salt: 0.8, sugar: 0 },
        { name: "Cơm trắng + Đậu phụ sốt thịt băm + Rau muống luộc", calories: 470, salt: 0.7, sugar: 0 },
      ],
      d: [
        { name: "Cháo cá chép nấu hành nén", calories: 300, salt: 0.5, sugar: 0 },
        { name: "Canh khoai mỡ nấu thịt băm + Thịt lợn luộc", calories: 320, salt: 0.6, sugar: 0 },
        { name: "Thịt lườn gà luộc + Canh mồng mồng nấu tôm tươi", calories: 310, salt: 0.5, sugar: 0 },
      ],
    },
  };

  const selected = dishSets[variantType];

  for (let i = 1; i <= DEFAULT_PLAN_DAYS; i++) {
    const b = [selected.b[(i - 1) % selected.b.length]];
    const l = [selected.l[(i - 1) % selected.l.length]];
    const d = [selected.d[(i - 1) % selected.d.length]];
    const s = [{ name: "Trái cây ít ngọt (Ổi / Táo)", calories: 80, salt: 0, sugar: 6 }];

    const tCal = b.reduce((sum, item) => sum + item.calories, 0) +
      l.reduce((sum, item) => sum + item.calories, 0) +
      d.reduce((sum, item) => sum + item.calories, 0) +
      s.reduce((sum, item) => sum + item.calories, 0);

    const tSalt = Number((
      b.reduce((sum, item) => sum + item.salt, 0) +
      l.reduce((sum, item) => sum + item.salt, 0) +
      d.reduce((sum, item) => sum + item.salt, 0) +
      s.reduce((sum, item) => sum + item.salt, 0)
    ).toFixed(1));

    const tSugar = Number((
      b.reduce((sum, item) => sum + item.sugar, 0) +
      l.reduce((sum, item) => sum + item.sugar, 0) +
      d.reduce((sum, item) => sum + item.sugar, 0) +
      s.reduce((sum, item) => sum + item.sugar, 0)
    ).toFixed(1));

    days.push({
      dayIndex: i,
      dayName: `Ngày ${i}`,
      breakfast: b,
      lunch: l,
      dinner: d,
      snack: s,
      totalCalories: tCal,
      totalSalt: tSalt,
      totalSugar: tSugar,
    });
  }

  return days;
}

const INITIAL_PLANS: MealPlanItem[] = [
  // Group 1: BN-10293 (Nguyễn Văn A) - 3 Variants generated in same run
  {
    id: "PLAN-10293-V1",
    variantGroupId: "GRP-BN-10293-01",
    variantIndex: 1,
    totalVariants: 3,
    patientId: "BN-10293",
    patientName: "Nguyễn Văn A",
    patientCode: "BN-10293",
    condition: "Tiểu đường type 2, Suy thận độ 3",
    duration: `${DEFAULT_PLAN_DAYS} ngày`,
    daysCount: DEFAULT_PLAN_DAYS,
    status: "pending",
    planTitle: "Phương án 1: Thực đơn Chuẩn y khoa DASH (Kiểm soát Na & Đường)",
    calories: "1780 kcal/ngày",
    salt: "1.8g/ngày",
    sugar: "8g/ngày",
    createdAt: "12/10/2023 08:30",
    days: buildMock7Days("standard"),
    breakfast: [
      { name: "Phở gà ít béo (thịt lườn, nước dùng trong)", calories: 350, salt: 1.2, sugar: 0 },
      { name: "Nước ép cần tây táo", calories: 80, salt: 0.1, sugar: 6 },
    ],
    lunch: [
      { name: "Cơm gạo lứt (1 bát con)", calories: 150, salt: 0, sugar: 0 },
      { name: "Cá hồi áp chảo măng tây", calories: 320, salt: 0.8, sugar: 0 },
      { name: "Canh bí đao nấu nấm", calories: 45, salt: 0.4, sugar: 0 },
    ],
    dinner: [
      { name: "Ức gà hấp gừng sả", calories: 250, salt: 0.5, sugar: 0 },
      { name: "Rau củ luộc thập cẩm (Cà rốt, súp lơ)", calories: 60, salt: 0.1, sugar: 2 },
    ],
    warnings: [
      "Kiểm soát muối nghiêm ngặt < 2.0g/ngày phù hợp với Suy thận độ 3.",
    ],
    citations: [
      "QĐ 41/2016-BYT (Hướng dẫn Dinh dưỡng Lâm sàng)",
      "KDIGO 2024 Clinical Practice Guideline (CKD)",
      "AHA 2023 Dietary Guidance",
    ],
  },
  {
    id: "PLAN-10293-V2",
    variantGroupId: "GRP-BN-10293-01",
    variantIndex: 2,
    totalVariants: 3,
    patientId: "BN-10293",
    patientName: "Nguyễn Văn A",
    patientCode: "BN-10293",
    condition: "Tiểu đường type 2, Suy thận độ 3",
    duration: `${DEFAULT_PLAN_DAYS} ngày`,
    daysCount: DEFAULT_PLAN_DAYS,
    status: "pending",
    planTitle: "Phương án 2: Thực đơn Tăng cường chất xơ & Đạm thực vật kiềm tính",
    calories: "1720 kcal/ngày",
    salt: "1.5g/ngày",
    sugar: "7g/ngày",
    createdAt: "12/10/2023 08:30",
    days: buildMock7Days("high_fiber"),
    breakfast: [
      { name: "Súp yến mạch rau củ", calories: 200, salt: 0.3, sugar: 0 },
      { name: "Sữa hạt óc chó không đường", calories: 80, salt: 0.1, sugar: 1 },
    ],
    lunch: [
      { name: "Cơm diêm mạch Quinoa", calories: 160, salt: 0, sugar: 0 },
      { name: "Đậu hũ sốt cà chua ít muối", calories: 250, salt: 0.6, sugar: 1 },
    ],
    dinner: [
      { name: "Nấm đùi gà kho tộ", calories: 180, salt: 0.4, sugar: 0 },
      { name: "Canh bí đỏ nấu nấm", calories: 90, salt: 0.3, sugar: 0 },
    ],
    warnings: [],
    citations: [
      "QĐ 41/2016-BYT (Hướng dẫn Dinh dưỡng Lâm sàng)",
      "ADA 2024 Standards of Care",
    ],
  },
  {
    id: "PLAN-10293-V3",
    variantGroupId: "GRP-BN-10293-01",
    variantIndex: 3,
    totalVariants: 3,
    patientId: "BN-10293",
    patientName: "Nguyễn Văn A",
    patientCode: "BN-10293",
    condition: "Tiểu đường type 2, Suy thận độ 3",
    duration: `${DEFAULT_PLAN_DAYS} ngày`,
    daysCount: DEFAULT_PLAN_DAYS,
    status: "pending",
    planTitle: "Phương án 3: Thực đơn Mềm dễ chế biến & Tiêu hóa nhanh",
    calories: "1750 kcal/ngày",
    salt: "1.6g/ngày",
    sugar: "8g/ngày",
    createdAt: "12/10/2023 08:30",
    days: buildMock7Days("easy_prep"),
    breakfast: [
      { name: "Cháo yến mạch ức gà xé", calories: 300, salt: 0.8, sugar: 0 },
    ],
    lunch: [
      { name: "Cơm trắng mềm (1 bát con)", calories: 160, salt: 0, sugar: 0 },
      { name: "Trứng đúc thịt hấp thủy", calories: 280, salt: 0.5, sugar: 0 },
    ],
    dinner: [
      { name: "Cháo cá chép nấu hành nén", calories: 300, salt: 0.5, sugar: 0 },
    ],
    warnings: [],
    citations: [
      "QĐ 41/2016-BYT (Hướng dẫn Dinh dưỡng Lâm sàng)",
    ],
  },

  // Group 2: BN-10294 (Trần Thị B) - 3 Variants
  {
    id: "PLAN-10294-V1",
    variantGroupId: "GRP-BN-10294-01",
    variantIndex: 1,
    totalVariants: 3,
    patientId: "BN-10294",
    patientName: "Trần Thị B",
    patientCode: "BN-10294",
    condition: "Tăng huyết áp, Rối loạn lipid",
    duration: `${DEFAULT_PLAN_DAYS} ngày`,
    daysCount: DEFAULT_PLAN_DAYS,
    status: "pending",
    planTitle: "Phương án 1: Kế hoạch dinh dưỡng DASH bảo vệ tim mạch",
    calories: "1600 kcal/ngày",
    salt: "1.5g/ngày",
    sugar: "5g/ngày",
    createdAt: "12/10/2023 07:15",
    days: buildMock7Days("standard"),
    breakfast: [
      { name: "Bánh mì nguyên cám kẹp trứng ốp la", calories: 310, salt: 0.6, sugar: 0 },
    ],
    lunch: [
      { name: "Bún tươi chả cá thát lát hấp", calories: 380, salt: 0.7, sugar: 0 },
    ],
    dinner: [
      { name: "Canh giò heo hầm đu đủ xanh (ít muối)", calories: 290, salt: 0.2, sugar: 0 },
    ],
    warnings: ["Cần đảm bảo đủ 2L nước lọc hàng ngày."],
    citations: ["AHA 2023 Dietary Guidance"],
  },
  {
    id: "PLAN-10294-V2",
    variantGroupId: "GRP-BN-10294-01",
    variantIndex: 2,
    totalVariants: 3,
    patientId: "BN-10294",
    patientName: "Trần Thị B",
    patientCode: "BN-10294",
    condition: "Tăng huyết áp, Rối loạn lipid",
    duration: `${DEFAULT_PLAN_DAYS} ngày`,
    daysCount: DEFAULT_PLAN_DAYS,
    status: "pending",
    planTitle: "Phương án 2: Thực đơn Giảm mỡ máu Mediterranean style",
    calories: "1550 kcal/ngày",
    salt: "1.3g/ngày",
    sugar: "4g/ngày",
    createdAt: "12/10/2023 07:15",
    days: buildMock7Days("high_fiber"),
    breakfast: [
      { name: "Sữa chua không đường + Hạt hạnh nhân", calories: 180, salt: 0.1, sugar: 2 },
    ],
    lunch: [
      { name: "Salad ức gà xé phay sốt chanh leo", calories: 350, salt: 0.5, sugar: 0 },
    ],
    dinner: [
      { name: "Cá lóc hấp bầu + Canh mồng tơi", calories: 280, salt: 0.4, sugar: 0 },
    ],
    warnings: [],
    citations: ["AHA 2023 Dietary Guidance", "ESC 2023 Cardio Guidelines"],
  },
  {
    id: "PLAN-10294-V3",
    variantGroupId: "GRP-BN-10294-01",
    variantIndex: 3,
    totalVariants: 3,
    patientId: "BN-10294",
    patientName: "Trần Thị B",
    patientCode: "BN-10294",
    condition: "Tăng huyết áp, Rối loạn lipid",
    duration: `${DEFAULT_PLAN_DAYS} ngày`,
    daysCount: DEFAULT_PLAN_DAYS,
    status: "pending",
    planTitle: "Phương án 3: Thực đơn Thuần Việt thanh nhiệt giảm áp",
    calories: "1580 kcal/ngày",
    salt: "1.4g/ngày",
    sugar: "5g/ngày",
    createdAt: "12/10/2023 07:15",
    days: buildMock7Days("easy_prep"),
    breakfast: [
      { name: "Cháo yến mạch bí đỏ", calories: 250, salt: 0.3, sugar: 0 },
    ],
    lunch: [
      { name: "Cơm gạo lứt + Thịt lợn luộc + Canh rau ngót", calories: 450, salt: 0.6, sugar: 0 },
    ],
    dinner: [
      { name: "Súp nấm hải sản nhẹ", calories: 220, salt: 0.5, sugar: 0 },
    ],
    warnings: [],
    citations: ["QĐ 41/2016-BYT"],
  },
];

interface PlansState {
  plans: MealPlanItem[];
  getPlansByPatientId: (patientId: string) => MealPlanItem[];
  getPlanById: (planId: string) => MealPlanItem | undefined;
  getPendingCountByPatientId: (patientId: string) => number;
  getVariantsByGroupId: (groupId: string) => MealPlanItem[];
  updatePlanStatus: (
    patientId: string,
    planId: string,
    status: "pending" | "approved" | "rejected" | "unselected"
  ) => void;
  addPlan: (newPlan: MealPlanItem) => void;
  addPlanGroup: (newPlans: MealPlanItem[]) => void;
}

export const usePlansStore = create<PlansState>((set, get) => ({
  plans: INITIAL_PLANS,

  getPlansByPatientId: (patientId) => {
    return get().plans.filter((p) => p.patientId === patientId);
  },

  getPlanById: (planId) => {
    return get().plans.find((p) => p.id === planId);
  },

  getPendingCountByPatientId: (patientId) => {
    return get().plans.filter(
      (p) => p.patientId === patientId && p.status === "pending"
    ).length;
  },

  getVariantsByGroupId: (groupId) => {
    return get().plans.filter((p) => p.variantGroupId === groupId);
  },

  updatePlanStatus: (patientId, planId, status) => {
    const targetPlan = get().plans.find((p) => p.id === planId);

    set((state) => ({
      plans: state.plans.map((p) => {
        // Dynamic status cascade rule: If approving 1 variant in a group, automatically mark sibling variants as "unselected"
        if (status === "approved" && targetPlan?.variantGroupId && p.variantGroupId === targetPlan.variantGroupId && p.id !== planId) {
          return { ...p, status: "unselected" };
        }

        if (p.id === planId) {
          return { ...p, status };
        }
        return p;
      }),
    }));
  },

  addPlan: (newPlan) => {
    set((state) => ({
      plans: [newPlan, ...state.plans],
    }));
  },

  addPlanGroup: (newPlans) => {
    set((state) => ({
      plans: [...newPlans, ...state.plans],
    }));
  },
}));
