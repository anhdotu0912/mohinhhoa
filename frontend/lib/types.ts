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

export interface AssignedDoctor {
  id: string;
  full_name?: string | null;
  avatar?: string | null;
}

export interface UserMeResponse {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string | null;
  avatar?: string | null;
  assigned_doctor?: AssignedDoctor | null;
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
  constraints_status?: "confirmed" | "pending_doctor_review";
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

export type ApplyMode = "from_today" | "after_current";

export interface ApplyMealPlanRequest {
  /** Legacy: explicit start date. Prefer apply_mode on new clients. */
  start_date?: string;
  replace_active?: boolean;
  slot_key?: "current" | "next" | "empty";
  apply_mode?: ApplyMode;
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
  adjustment_note?: string | null;
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

export interface InteractionCheckInput {
  medications: string[];
  foods: string[];
  profile_user_id?: string | null;
}

export interface InteractionItem {
  drug: string;
  food: string;
  mechanism: string;
  severity: string;
  recommendation: string;
  sources: string[];
  drug_class?: string | null;
  meal_timing?: string | null;
  hypoglycemia_risk?: string | null;
  ai_warning?: string | null;
}

export interface UnmatchedPair {
  drug: string;
  food: string;
}

export interface InteractionCheckOutput {
  interactions: InteractionItem[];
  unmatched_pairs?: UnmatchedPair[];
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
  constraints_status?: "confirmed" | "pending_doctor_review";
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
  meal_plan_request_status?: "none" | "pending";
  meal_plan_request_note?: string | null;
  meal_plan_requested_at?: string | null;
  pending_transfer?: PendingTransferOut | null;
}

export interface PendingTransferOut {
  id: string;
  to_doctor_id: string;
  to_doctor_name?: string | null;
  created_at: string;
}

export interface DoctorColleague {
  id: string;
  full_name?: string | null;
  email: string;
  avatar?: string | null;
}

export interface TransferOut {
  id: string;
  patient_id: string;
  from_doctor_id: string;
  to_doctor_id: string;
  status: "pending" | "accepted" | "cancelled";
  to_doctor_name?: string | null;
  created_at: string;
}

export type ClaimQueueKind = "unassigned" | "transfer";
export type ClaimQueueSource = "self_register" | "unassigned_pool" | "transfer";

export interface ClaimQueueItem {
  kind: ClaimQueueKind;
  source: ClaimQueueSource;
  patient_id: string;
  patient: DoctorPatientSummary;
  transfer_id?: string | null;
  from_doctor_id?: string | null;
  from_doctor_name?: string | null;
  created_at: string;
}

export interface MealPlanRequestOut {
  status: "none" | "pending";
  note?: string | null;
  requested_at?: string | null;
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
  type: "alert" | "food_log" | "checkin" | "reminder";
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

export interface DoctorProfile {
  title?: string | null;
  specialties: string[];
  license_number?: string | null;
  workplace?: string | null;
  years_of_experience?: number | null;
  bio?: string | null;
  phone?: string | null;
  accepting_patients: boolean;
  consultation_hours?: string | null;
  emergency_contact?: string | null;
}

export interface DoctorProfileUpdate {
  full_name?: string | null;
  title?: string | null;
  specialties?: string[] | null;
  license_number?: string | null;
  workplace?: string | null;
  years_of_experience?: number | null;
  bio?: string | null;
  phone?: string | null;
  accepting_patients?: boolean | null;
  consultation_hours?: string | null;
  emergency_contact?: string | null;
}

export interface DoctorStats {
  total_patients: number;
  approved_plans: number;
  confirmed_constraints: number;
  average_compliance?: number | null;
}

export interface DoctorProfileResponse {
  user_id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  avatar?: string | null;
  profile: DoctorProfile;
  stats: DoctorStats;
}

export interface PatientMetrics {
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bmi_category: string;
  updated_at: string;
}

export interface FoodLogEntry {
  id: string;
  user_id: string;
  meal_plan_id?: string | null;
  day_index?: number | null;
  slot: "morning" | "noon" | "evening" | "snack";
  type: "as_planned" | "custom";
  note?: string;
  status: string;
  alert_ids: string[];
  logged_at: string;
}

export interface FoodLogCreate {
  meal_plan_id?: string | null;
  day_index?: number | null;
  slot: "morning" | "noon" | "evening" | "snack";
  type: "as_planned" | "custom";
  note?: string;
}

export interface MetricsHistoryPoint {
  id: string;
  user_id: string;
  weight?: number | null;
  height?: number | null;
  bmi?: number | null;
  waist_cm?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  glucose_fasting?: number | null;
  glucose_postprandial?: number | null;
  hba1c?: number | null;
  blood_pressure?: string | null;
  blood_glucose?: string | null;
  note?: string;
  recorded_by: "patient" | "doctor";
  recorded_at: string;
}

export interface MetricsDeltaAdviceOut {
  message: string;
  changed_fields: string[];
  citations: string[];
  ask_doctor: boolean;
}

export interface MetricsLogCreate {
  weight?: number | null;
  height?: number | null;
  waist_cm?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  glucose_fasting?: number | null;
  glucose_postprandial?: number | null;
  hba1c?: number | null;
  blood_pressure?: string | null;
  blood_glucose?: string | null;
  note?: string;
}

export interface MetricsLogResult extends MetricsHistoryPoint {
  delta_advice?: MetricsDeltaAdviceOut | null;
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

export interface MealPreviewMeal {
  slot: string;
  label: string;
  items: FoodItem[];
}

export interface MealPreviewOut {
  date: string;
  day_index: number;
  meal_plan_id: string;
  plan_status: string;
  meals: MealPreviewMeal[];
}

export interface WeeklyComplianceOut {
  overall_adherence_pct?: number | null;
  daily_series?: { date: string; adherence_pct: number | null }[];
}

export interface DoctorNoteItem {
  id: string;
  title?: string;
  note: string;
  created_at: string;
  tags?: string[];
}

export interface DoctorNoteOut {
  doctor_name: string;
  doctor_avatar?: string | null;
  note: string;
  created_at: string;
  tags?: string[];
  has_more?: boolean;
  notes?: DoctorNoteItem[];
}

export interface AgentRunOutput {
  intent: string;
  secondary_intents?: string[];
  message: string;
  meal_plan_id?: string | null;
  meal_preview?: MealPreviewOut | null;
  food_log_id?: string | null;
  alert_ids: string[];
  citations: string[];
  guardrail_triggered: boolean;
  weekly_compliance?: WeeklyComplianceOut | null;
  doctor_note?: DoctorNoteOut | null;
  metrics_delta_advice?: MetricsDeltaAdviceOut | null;
}

export type ChatStreamEvent =
  | { type: "status"; node: string; message: string }
  | { type: "intent"; intent: string; secondary_intents?: string[] }
  | { type: "token"; content: string }
  | { type: "correction"; message: string; reason?: string }
  | { type: "done"; data: AgentRunOutput }
  | { type: "error"; message: string };

export interface ChatThinkingStepOut {
  node: string;
  message: string;
  status: string;
}

export interface ChatMessageOut {
  id: string;
  sender: "user" | "ai";
  text: string;
  intent?: string | null;
  secondary_intents?: string[];
  citations?: string[];
  guardrail_triggered?: boolean;
  meal_plan_id?: string | null;
  meal_preview?: MealPreviewOut | null;
  weekly_compliance?: WeeklyComplianceOut | null;
  doctor_note?: DoctorNoteOut | null;
  metrics_delta_advice?: MetricsDeltaAdviceOut | null;
  meal_plan_week?: MealPlanOutput | null;
  show_weekly_plan?: boolean;
  thinking_steps?: ChatThinkingStepOut[];
  corrected?: boolean;
  correction_reason?: string | null;
}

export interface ChatSessionSummaryOut {
  id: string;
  title: string;
  pinned: boolean;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionOut {
  id: string;
  title: string;
  pinned: boolean;
  applied_plans: Record<string, boolean>;
  messages: ChatMessageOut[];
  created_at: string;
  updated_at: string;
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
