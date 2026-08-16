/** Types aligned with contracts/api-v1.md */

export type UserRole = "patient" | "doctor";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string | null;
}

export interface UserMeResponse {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string | null;
  avatar?: string | null;
}

export interface Restrictions {
  carb_per_meal?: number | null;
  sodium_daily?: number | null;
  salt_daily_g?: number | null;
  sugar_daily_g?: number | null;
}

export interface PatientProfile {
  id?: string;
  user_id?: string;
  disease: string[];
  medications: string[];
  allergies: string[];
  bmi?: number | null;
  weight?: number | null;
  height?: number | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  blood_pressure?: string | null;
  blood_glucose?: string | null;
  target_kcal: number;
  restrictions: Restrictions;
  preferences: string[];
  treatment_goals?: string[];
}

export interface ProfileUpsert {
  disease: string[];
  medications: string[];
  allergies: string[];
  bmi?: number | null;
  weight?: number | null;
  height?: number | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  blood_pressure?: string | null;
  blood_glucose?: string | null;
  target_kcal: number;
  restrictions: Restrictions;
  preferences: string[];
  treatment_goals?: string[];
}

export interface Macros {
  carb_g: number;
  protein_g: number;
  fat_g: number;
  sodium_mg: number;
  sugar_g?: number;
}

export interface FoodItem {
  name: string;
  portion: string;
  kcal: number;
  macros: Macros;
  food_id?: string | null;
  citations: string[];
  alternatives?: FoodItem[];
}

export interface GenerateMealPlanRequest {
  notes?: string;
  priorities?: string[];
}

export interface ApplyMealPlanRequest {
  start_date: string;
  replace_active?: boolean;
  slot_key?: "current" | "next" | "empty";
}

export interface Meal {
  slot: string;
  items: FoodItem[];
}

export interface DayTotals {
  kcal: number;
  carb_g: number;
  protein_g: number;
  fat_g: number;
  sodium_mg: number;
}

export interface DayPlan {
  day_index: number;
  date?: string | null;
  meals: Meal[];
  totals: DayTotals;
  warnings: string[];
}

export interface Swap {
  day_index: number;
  slot: string;
  from?: string;
  to: string;
  reason: string;
}

export type MealPlanStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "edited";

export interface MealPlanOutput {
  id: string;
  variant_group_id?: string | null;
  variant_index?: number | null;
  total_variants?: number | null;
  user_id: string;
  profile_snapshot: Record<string, unknown>;
  days: DayPlan[];
  swaps: Swap[];
  citations: string[];
  status: MealPlanStatus | string;
  trust_badge?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  created_at?: string | null;
}

export interface AlertOut {
  id: string;
  user_id: string;
  drug: string;
  food: string;
  mechanism: string;
  severity: string;
  recommendation: string;
  sources: string[];
  meal_plan_id?: string | null;
  created_at: string;
}

export type NotificationType =
  | "meal_reminder"
  | "interaction_followup"
  | "plan_approved"
  | "plan_expiring"
  | "plan_expired"
  | "adherence_checkin"
  | "manual_reminder";

export type NotificationStatus =
  | "pending"
  | "sent"
  | "read"
  | "dismissed"
  | "done"
  | "cancelled";

export interface NotificationOut {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  scheduled_at?: string | null;
  status: NotificationStatus | string;
  related_ids: Record<string, unknown>;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReviewRequest {
  action: "approve" | "reject" | "edit";
  notes?: string;
  edited_plan?: MealPlanOutput | Record<string, unknown> | null;
}

export interface ReviewResponse {
  meal_plan_id: string;
  status: string;
  trust_badge?: string | null;
  reviewed_at: string;
  reviewer_id: string;
}

export type DoctorPatientStatus =
  | "Cần chú ý"
  | "Ổn định"
  | "Cảnh báo"
  | "Chờ duyệt";

export type DoctorPatientStatusKey =
  | "attention"
  | "stable"
  | "warning"
  | "pending";

export interface DoctorPatientSummary {
  id: string;
  email: string;
  name: string;
  age?: number | null;
  gender?: string | null;
  disease: string[];
  condition_label: string;
  medications: string[];
  allergies: string[];
  bmi?: number | null;
  weight?: number | null;
  height?: number | null;
  phone?: string | null;
  address?: string | null;
  blood_pressure?: string | null;
  blood_glucose?: string | null;
  treatment_goals?: string[];
  target_kcal: number;
  salt_daily_g?: number | null;
  sugar_daily_g?: number | null;
  preferences: string[];
  status: DoctorPatientStatus;
  status_key: DoctorPatientStatusKey;
  latest_plan_id?: string | null;
  latest_plan_status?: string | null;
  active_plan_id?: string | null;
  active_plan_status?: string | null;
  plan_starts_on?: string | null;
  plan_pending: number;
  plan_total: number;
  alert_count: number;
  last_update: string;
  avatar: string;
  /** Hạn thực đơn (có nghĩa khi latest_plan_status ∈ {approved, edited}) */
  plan_end_date?: string | null;
  plan_days_left?: number | null;
  plan_expiry?: "expiring" | "expired" | "ok" | "none";
  plan_usage?: "none" | "active" | "finished";
}

export interface PlanExpiryDemoOut {
  updated: string[];
  skipped: string[];
}

export type ScheduleSlotKey = "current" | "next" | "empty";
export type ScheduleOccupancy = "empty" | "active" | "upcoming" | "past";
export type ScheduleAction = "add" | "replace" | "view";

export interface MealPlanScheduleSlot {
  slot_key: ScheduleSlotKey;
  starts_on: string;
  ends_on: string;
  occupancy: ScheduleOccupancy;
  plan: MealPlanOutput | null;
  actions: ScheduleAction[];
}

export interface MealPlanScheduleOut {
  patient_id: string;
  today: string;
  active_plan_id: string | null;
  active_plan: MealPlanOutput | null;
  unassigned_plans: MealPlanOutput[];
  slots: MealPlanScheduleSlot[];
}

export interface ComplianceDayPoint {
  date: string;
  adherence_pct: number | null;
}

export interface ComplianceEvent {
  type: "alert";
  severity: string;
  title: string;
  at: string;
}

export interface PatientComplianceOut {
  patient_id: string;
  days: number;
  low_threshold_pct: number;
  overall_adherence_pct: number | null;
  checkins_done: number;
  checkins_as_planned: number;
  daily_series: ComplianceDayPoint[];
  events: ComplianceEvent[];
}

export interface PatientMetrics {
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bmi_category: string;
  updated_at: string;
}

export interface GoalsOut {
  goals: string[];
}

export interface DoctorPatientUpdate {
  full_name?: string | null;
  email?: string | null;
  avatar?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  blood_pressure?: string | null;
  blood_glucose?: string | null;
  disease?: string[];
  medications?: string[];
  allergies?: string[];
  preferences?: string[];
  treatment_goals?: string[];
}

export interface DoctorConstraintsUpdate {
  target_kcal?: number;
  salt_daily_g?: number | null;
  sugar_daily_g?: number | null;
}

export interface CatalogItem {
  id: string;
  name: string;
}

export interface DiagnosisItem {
  code: string;
  name: string;
}

export interface CatalogOut {
  medicines: CatalogItem[];
  allergies: CatalogItem[];
  diagnoses: DiagnosisItem[];
}

export interface FoodCatalogMacros {
  carb_g: number;
  protein_g: number;
  fat_g: number;
  sodium_mg: number;
  sugar_g?: number;
}

export interface FoodCatalogItem {
  id: string;
  name: string;
  portion: string;
  kcal: number;
  macros: FoodCatalogMacros;
  category: string;
  source: string;
}

export interface FoodCatalogOut {
  items: FoodCatalogItem[];
  total: number;
}

export interface AgentRunOutput {
  intent: string;
  message: string;
  meal_plan_id?: string | null;
  food_log_id?: string | null;
  alert_ids: string[];
  citations: string[];
  guardrail_triggered: boolean;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
