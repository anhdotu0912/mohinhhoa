import { clampClinical } from "./clinical-constraints";

/** UI convention: 1 g muối hiển thị = 1000 mg natri nội bộ. */
export const SODIUM_MG_PER_SALT_G = 1000;

export type NutrientKind = "kcal" | "carb" | "protein" | "fat" | "salt" | "sugar";

export const NUTRIENT_LABEL: Record<NutrientKind, string> = {
  kcal: "Kcal",
  carb: "Carb",
  protein: "Đạm",
  fat: "Béo",
  salt: "Muối",
  sugar: "Đường",
};

export const NUTRIENT_UNIT: Record<NutrientKind, string> = {
  kcal: "kcal",
  carb: "g",
  protein: "g",
  fat: "g",
  salt: "g",
  sugar: "g",
};

/** Tóm tắt ngày / hồ sơ / ràng buộc / tổng card. */
export const SUMMARY_NUTRIENTS: NutrientKind[] = ["kcal", "carb", "salt", "sugar"];

/** Chi tiết món / bữa — Đạm & Béo ẩn khi = 0. */
export const DETAIL_NUTRIENTS: NutrientKind[] = [
  "kcal",
  "carb",
  "protein",
  "fat",
  "salt",
  "sugar",
];

export type NutrientValues = Record<NutrientKind, number>;

export type NutrientSource = {
  kcal?: number;
  carbG?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  saltG?: number | null;
  sodiumMg?: number | null;
  sugarG?: number | null;
};

export function sodiumMgToSaltG(sodiumMg: number): number {
  return Math.round((sodiumMg / SODIUM_MG_PER_SALT_G) * 10) / 10;
}

export function saltGToSodiumMg(saltG: number): number {
  return Math.round(saltG * SODIUM_MG_PER_SALT_G);
}

/** Ưu tiên muối g; nếu thiếu thì quy đổi từ natri mg. */
export function displaySaltG(
  saltG?: number | null,
  sodiumMg?: number | null
): number | null {
  if (saltG != null && Number.isFinite(saltG)) return saltG;
  if (sodiumMg != null && Number.isFinite(sodiumMg)) return sodiumMgToSaltG(sodiumMg);
  return null;
}

export function sodiumDailyFromSaltG(saltG: number): number {
  return clampClinical("sodium_daily", saltGToSodiumMg(saltG));
}

export function formatNutrientValue(kind: NutrientKind, value: number): string {
  if (kind === "kcal") return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function toNutrientValues(src: NutrientSource): NutrientValues {
  const salt =
    src.sodiumMg != null && Number.isFinite(src.sodiumMg)
      ? sodiumMgToSaltG(src.sodiumMg)
      : src.saltG ?? 0;
  return {
    kcal: src.kcal || 0,
    carb: src.carbG ?? 0,
    protein: src.proteinG ?? 0,
    fat: src.fatG ?? 0,
    salt,
    sugar: src.sugarG ?? 0,
  };
}

export function emptyNutrientValues(): NutrientValues {
  return { kcal: 0, carb: 0, protein: 0, fat: 0, salt: 0, sugar: 0 };
}

export function isNutrientValues(
  value: NutrientValues | NutrientSource
): value is NutrientValues {
  return "carb" in value && "protein" in value && "fat" in value && "salt" in value && "sugar" in value;
}

export function kindsForLayer(
  layer: "summary" | "detail",
  values: NutrientValues,
  omit: NutrientKind[] = []
): NutrientKind[] {
  const skip = new Set(omit);
  const kinds = layer === "summary" ? SUMMARY_NUTRIENTS : DETAIL_NUTRIENTS;
  return kinds.filter((kind) => {
    if (skip.has(kind)) return false;
    if (layer === "detail" && (kind === "protein" || kind === "fat")) {
      return values[kind] > 0;
    }
    return true;
  });
}
