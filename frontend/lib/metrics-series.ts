/** Shared metric series for the patient health overlay chart. */

export type MetricSeriesId =
  | "weight"
  | "glucose_fasting"
  | "glucose_postprandial"
  | "systolic"
  | "diastolic"
  | "bmi"
  | "waist"
  | "hba1c";

export type MetricSeriesDef = {
  id: MetricSeriesId;
  label: string;
  unit: string;
  color: string;
  defaultOn: boolean;
  targetMin?: number;
  targetMax?: number;
  targetDesc: string;
  clinicalGuideline: string;
};

export const METRIC_SERIES: MetricSeriesDef[] = [
  {
    id: "weight",
    label: "Cân nặng",
    unit: "kg",
    color: "#0F766E",
    defaultOn: true,
    targetDesc: "BMI 18.5 – 22.9",
    clinicalGuideline: "Kiểm soát cân nặng giúp giảm đề kháng insulin và ổn định đường huyết.",
  },
  {
    id: "glucose_fasting",
    label: "Đường lúc đói",
    unit: "mmol/L",
    color: "#B45309",
    defaultOn: true,
    targetMin: 4.4,
    targetMax: 7.2,
    targetDesc: "4.4 – 7.2 mmol/L",
    clinicalGuideline: "Mục tiêu ADA/Bộ Y Tế: 4.4 – 7.2 mmol/L trước bữa ăn sáng.",
  },
  {
    id: "glucose_postprandial",
    label: "Đường sau ăn",
    unit: "mmol/L",
    color: "#C2410C",
    defaultOn: true,
    targetMax: 10,
    targetDesc: "< 10.0 mmol/L",
    clinicalGuideline: "Đo sau ăn 1–2 giờ, phản ánh trực tiếp hiệu quả kiểm soát của thực đơn.",
  },
  {
    id: "systolic",
    label: "HA tâm thu",
    unit: "mmHg",
    color: "#BE123C",
    defaultOn: true,
    targetMax: 130,
    targetDesc: "< 130 mmHg",
    clinicalGuideline: "Huyết áp tâm thu < 130 mmHg giúp bảo vệ thận và mạch vành.",
  },
  {
    id: "diastolic",
    label: "HA tâm trương",
    unit: "mmHg",
    color: "#9F1239",
    defaultOn: false,
    targetMax: 80,
    targetDesc: "< 80 mmHg",
    clinicalGuideline: "Huyết áp tâm trương < 80 mmHg phòng ngừa biến chứng tim mạch.",
  },
  {
    id: "bmi",
    label: "BMI",
    unit: "",
    color: "#4338CA",
    defaultOn: false,
    targetMin: 18.5,
    targetMax: 22.9,
    targetDesc: "18.5 – 22.9",
    clinicalGuideline: "Chuẩn người châu Á (IDI & WPRO): 18.5 – 22.9.",
  },
  {
    id: "waist",
    label: "Vòng eo",
    unit: "cm",
    color: "#0369A1",
    defaultOn: false,
    targetMax: 90,
    targetDesc: "Nam <90, Nữ <80 cm",
    clinicalGuideline: "Giảm mỡ bụng nội tạng cải thiện rõ rệt độ nhạy insulin.",
  },
  {
    id: "hba1c",
    label: "HbA1c",
    unit: "%",
    color: "#6D28D9",
    defaultOn: false,
    targetMax: 7,
    targetDesc: "< 7.0%",
    clinicalGuideline: "Mục tiêu vàng kiểm soát đường huyết trung bình 3 tháng.",
  },
];

export function parseLeadingNumber(value?: string | null): number | null {
  if (!value) return null;
  const match = value.replace(",", ".").match(/[\d.]+/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function parseGlucoseMmol(raw?: string | null): number | null {
  const n = parseLeadingNumber(raw);
  if (n == null) return null;
  if (/mmol/i.test(raw ?? "") || n < 40) return Math.round(n * 10) / 10;
  return Math.round((n / 18.018) * 10) / 10;
}

export function parseBpPair(raw?: string | null): { sys: number | null; dia: number | null } {
  if (!raw) return { sys: null, dia: null };
  const match = raw.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return { sys: null, dia: null };
  return { sys: Number(match[1]), dia: Number(match[2]) };
}

export function calcBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export interface MetricClinicalStatus {
  status: "optimal" | "in_target" | "near_target" | "attention" | "warning";
  label: string;
  shortLabel: string;
  badgeClass: string;
  textClass: string;
  icon: string;
}

export function getMetricClinicalStatus(
  id: MetricSeriesId,
  value: number | null
): MetricClinicalStatus | null {
  if (value == null) return null;

  switch (id) {
    case "glucose_fasting":
      if (value < 3.9) {
        return {
          status: "warning",
          label: "Hạ đường huyết",
          shortLabel: "Hạ đường",
          badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
          textClass: "text-rose-600",
          icon: "warning",
        };
      }
      if (value <= 7.2) {
        return {
          status: "optimal",
          label: "Đạt chuẩn ADA",
          shortLabel: "Đạt chuẩn",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          textClass: "text-emerald-600",
          icon: "check_circle",
        };
      }
      if (value <= 8.5) {
        return {
          status: "near_target",
          label: "Hơi cao",
          shortLabel: "Hơi cao",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          textClass: "text-amber-600",
          icon: "info",
        };
      }
      return {
        status: "attention",
        label: "Cần kiểm soát",
        shortLabel: "Cao",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        textClass: "text-rose-600",
        icon: "priority_high",
      };

    case "glucose_postprandial":
      if (value <= 10.0) {
        return {
          status: "optimal",
          label: "Sau ăn đạt chuẩn",
          shortLabel: "Đạt chuẩn",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          textClass: "text-emerald-600",
          icon: "check_circle",
        };
      }
      if (value <= 11.5) {
        return {
          status: "near_target",
          label: "Sau ăn hơi cao",
          shortLabel: "Hơi cao",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          textClass: "text-amber-600",
          icon: "info",
        };
      }
      return {
        status: "attention",
        label: "Đỉnh đường cao",
        shortLabel: "Cao",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        textClass: "text-rose-600",
        icon: "priority_high",
      };

    case "hba1c":
      if (value < 7.0) {
        return {
          status: "optimal",
          label: "Kiểm soát tốt",
          shortLabel: "Mục tiêu đạt",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          textClass: "text-emerald-600",
          icon: "verified",
        };
      }
      if (value <= 8.0) {
        return {
          status: "near_target",
          label: "Cần tối ưu thêm",
          shortLabel: "Khá",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          textClass: "text-amber-600",
          icon: "trending_up",
        };
      }
      return {
        status: "attention",
        label: "Nguy cơ biến chứng",
        shortLabel: "Cần hạ",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        textClass: "text-rose-600",
        icon: "warning",
      };

    case "systolic":
      if (value < 120) {
        return {
          status: "optimal",
          label: "Huyết áp tối ưu",
          shortLabel: "Tối ưu",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          textClass: "text-emerald-600",
          icon: "favorite",
        };
      }
      if (value <= 130) {
        return {
          status: "in_target",
          label: "Đạt chuẩn ĐTĐ",
          shortLabel: "Bình thường",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          textClass: "text-emerald-600",
          icon: "check",
        };
      }
      if (value <= 139) {
        return {
          status: "near_target",
          label: "Tiền tăng HA",
          shortLabel: "Hơi cao",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          textClass: "text-amber-600",
          icon: "info",
        };
      }
      return {
        status: "attention",
        label: "Tăng huyết áp",
        shortLabel: "Cao",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        textClass: "text-rose-600",
        icon: "priority_high",
      };

    case "diastolic":
      if (value <= 80) {
        return {
          status: "optimal",
          label: "HA tâm trương tốt",
          shortLabel: "Tốt",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          textClass: "text-emerald-600",
          icon: "check",
        };
      }
      if (value <= 89) {
        return {
          status: "near_target",
          label: "Bình thường cao",
          shortLabel: "Hơi cao",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          textClass: "text-amber-600",
          icon: "info",
        };
      }
      return {
        status: "attention",
        label: "Cần kiểm soát",
        shortLabel: "Cao",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        textClass: "text-rose-600",
        icon: "priority_high",
      };

    case "bmi":
      if (value >= 18.5 && value <= 22.9) {
        return {
          status: "optimal",
          label: "Thể trạng chuẩn",
          shortLabel: "Chuẩn",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          textClass: "text-emerald-600",
          icon: "fitness_center",
        };
      }
      if (value >= 23.0 && value <= 24.9) {
        return {
          status: "near_target",
          label: "Tiền béo phì",
          shortLabel: "Thừa cân",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          textClass: "text-amber-600",
          icon: "info",
        };
      }
      if (value >= 25.0) {
        return {
          status: "attention",
          label: "Thừa cân/Béo phì",
          shortLabel: "Cần giảm",
          badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
          textClass: "text-rose-600",
          icon: "trending_down",
        };
      }
      return {
        status: "near_target",
        label: "Thiếu cân",
        shortLabel: "Nhẹ cân",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
        textClass: "text-blue-600",
        icon: "info",
      };

    case "waist":
      if (value <= 85) {
        return {
          status: "optimal",
          label: "Vòng eo chuẩn",
          shortLabel: "Tốt",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          textClass: "text-emerald-600",
          icon: "check",
        };
      }
      return {
        status: "attention",
        label: "Mỡ bụng cao",
        shortLabel: "Cần giảm",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        textClass: "text-amber-600",
        icon: "priority_high",
      };

    default:
      return null;
  }
}

export interface MetricDeltaCalculation {
  delta: number;
  formattedDelta: string;
  isImproved: boolean;
  isNeutral: boolean;
  label: string;
  badgeClass: string;
}

export function calculateMetricDelta(
  id: MetricSeriesId,
  currentVal: number | null,
  baselineVal: number | null,
  unit = ""
): MetricDeltaCalculation | null {
  if (currentVal == null || baselineVal == null) return null;
  const diff = currentVal - baselineVal;
  const absDiff = Math.abs(diff);

  if (absDiff < 0.05) {
    return {
      delta: 0,
      formattedDelta: "Ổn định",
      isImproved: true,
      isNeutral: true,
      label: "Duy trì ổn định",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }

  const rounded = Math.round(absDiff * 10) / 10;
  const sign = diff > 0 ? "+" : "−";
  const formatted = `${sign}${rounded}${unit ? ` ${unit}` : ""}`;

  // For diabetes: lower fasting glucose, lower postprandial glucose, lower HbA1c, lower high BP, lower overweight BMI are improvements
  let isImproved = false;
  if (
    id === "glucose_fasting" ||
    id === "glucose_postprandial" ||
    id === "hba1c" ||
    id === "systolic" ||
    id === "diastolic" ||
    id === "waist"
  ) {
    isImproved = diff < 0;
  } else if (id === "weight" || id === "bmi") {
    // If baseline was overweight (>23), decrease is good.
    isImproved = diff < 0;
  }

  return {
    delta: diff,
    formattedDelta: formatted,
    isImproved,
    isNeutral: false,
    label: isImproved ? `Giảm ${rounded}${unit ? ` ${unit}` : ""}` : `Tăng ${rounded}${unit ? ` ${unit}` : ""}`,
    badgeClass: isImproved
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-800 border-amber-200",
  };
}

