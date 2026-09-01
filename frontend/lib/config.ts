export const DEFAULT_VARIANTS_PER_JOB = 3;
export const DEFAULT_PLAN_DAYS = 7;

export const DURATION_OPTIONS = [
  { label: "3 ngày", value: 3 },
  { label: "7 ngày (Khuyến nghị)", value: 7 },
  { label: "14 ngày", value: 14 },
] as const;

export type DurationOptionValue = (typeof DURATION_OPTIONS)[number]["value"];
