/** API client — contracts/api-v1.md */

import {
  ApiError,
  type AgentRunOutput,
  type AlertOut,
  type ApplyMealPlanRequest,
  type CatalogOut,
  type ChatSessionOut,
  type ChatSessionSummaryOut,
  type ChatStreamEvent,
  type ClaimQueueItem,
  type DoctorColleague,
  type EscalationCreatePayload,
  type EscalationListItem,
  type EscalationOut,
  type DoctorPatientSummary,
  type DoctorConstraintsUpdate,
  type DoctorPatientUpdate,
  type DoctorProfileResponse,
  type DoctorProfileUpdate,
  type FoodCatalogOut,
  type FoodLogCreate,
  type FoodLogEntry,
  type GoalsOut,
  type GenerateMealPlanRequest,
  type GuidelineSourceOut,
  type InteractionCheckInput,
  type InteractionCheckOutput,
  type MealPlanOutput,
  type MealPlanRequestOut,
  type MetricsHistoryPoint,
  type MetricsLogCreate,
  type MetricsLogResult,
  type NotificationOut,
  type PatientMetrics,
  type PatientProfile,
  type PatientComplianceOut,
  type PlanExpiryDemoOut,
  type MealPlanScheduleOut,
  type ProfileUpsert,
  type RegisterResponse,
  type ReviewRequest,
  type ReviewResponse,
  type TokenResponse,
  type TransferOut,
  type UserMeResponse,
  type UserRole,
} from "./types";
import { asRouteId } from "./route-params";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

function formatApiDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg?: unknown }).msg ?? "");
        }
        return "";
      })
      .filter(Boolean);
    if (msgs.some((m) => /at least 8 characters/i.test(m))) {
      return "Mật khẩu tối thiểu 8 ký tự.";
    }
    if (msgs.length) return msgs.join(" ");
  }
  return fallback;
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("vmec-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

async function uploadAvatarForm(
  url: string,
  file: File
): Promise<{ avatar: string }> {
  const token = getStoredToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    let detail = res.statusText || "Upload failed";
    let code = "HTTP_ERROR";
    try {
      const data = (await res.json()) as { detail?: unknown; code?: string };
      detail = formatApiDetail(data.detail, detail);
      if (data.code) code = data.code;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code, detail);
  }
  return (await res.json()) as { avatar: string };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const useAuth = options.auth !== false;
  const token = options.token ?? (useAuth ? getStoredToken() : null);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText || "Request failed";
    let code = "HTTP_ERROR";
    try {
      const data = (await res.json()) as { detail?: unknown; code?: string };
      detail = formatApiDetail(data.detail, detail);
      if (data.code) code = data.code;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code, detail);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/** Convert backend relative static path (/static/...) to absolute URL. */
export function assetUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  return pathOrUrl.startsWith("/static/") ? `${API_BASE}${pathOrUrl}` : pathOrUrl;
}

export const api = {
  register(payload: {
    email: string;
    password: string;
    role?: UserRole;
    full_name?: string;
  }): Promise<RegisterResponse> {
    return request("/api/v1/auth/register", {
      method: "POST",
      body: {
        email: payload.email,
        password: payload.password,
        role: payload.role ?? "patient",
        full_name: payload.full_name ?? null,
      },
      auth: false,
    });
  },

  login(email: string, password: string): Promise<TokenResponse> {
    return request("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },

  forgotPassword(email: string): Promise<{ message: string }> {
    return request("/api/v1/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    });
  },

  resetPassword(token: string, new_password: string): Promise<{ message: string }> {
    return request("/api/v1/auth/reset-password", {
      method: "POST",
      body: { token, new_password },
      auth: false,
    });
  },

  changePassword(
    current_password: string,
    new_password: string
  ): Promise<{ message: string }> {
    return request("/api/v1/auth/change-password", {
      method: "POST",
      body: { current_password, new_password },
    });
  },

  getCurrentUser(token?: string | null): Promise<UserMeResponse> {
    return request("/api/v1/auth/me", { token });
  },

  updateCurrentUser(payload: { full_name?: string | null }): Promise<UserMeResponse> {
    return request("/api/v1/auth/me", {
      method: "PATCH",
      body: { full_name: payload.full_name ?? null },
    });
  },

  getProfile(token?: string | null): Promise<PatientProfile> {
    return request("/api/v1/profile/me", { token });
  },

  upsertProfile(payload: ProfileUpsert, token?: string | null): Promise<PatientProfile> {
    return request("/api/v1/profile", {
      method: "POST",
      body: payload,
      token,
    });
  },

  createFoodLog(payload: FoodLogCreate): Promise<FoodLogEntry> {
    return request("/api/v1/food-log", {
      method: "POST",
      body: payload,
    });
  },

  listFoodLogs(params?: { date?: string; meal_plan_id?: string }): Promise<FoodLogEntry[]> {
    const search = new URLSearchParams();
    if (params?.date) search.set("date", params.date);
    if (params?.meal_plan_id) search.set("meal_plan_id", params.meal_plan_id);
    const q = search.toString() ? `?${search}` : "";
    return request(`/api/v1/food-log${q}`);
  },

  recordMetrics(payload: MetricsLogCreate): Promise<MetricsLogResult> {
    return request("/api/v1/metrics", {
      method: "POST",
      body: payload,
    });
  },

  getMetricsHistory(days = 90): Promise<MetricsHistoryPoint[]> {
    return request(`/api/v1/metrics/history?days=${days}`);
  },

  deleteMetrics(id: string): Promise<void> {
    return request(`/api/v1/metrics/${id}`, { method: "DELETE" });
  },

  generateMealPlan(payload?: GenerateMealPlanRequest): Promise<MealPlanOutput> {
    return request("/api/v1/meal-plans/generate", {
      method: "POST",
      body: payload ?? {},
    });
  },

  getMyMealPlan(): Promise<MealPlanOutput> {
    return request("/api/v1/meal-plans/me");
  },

  getMyMealPlanSchedule(): Promise<MealPlanScheduleOut> {
    return request("/api/v1/meal-plans/schedule");
  },

  getMealPlan(id: string): Promise<MealPlanOutput> {
    return request(`/api/v1/meal-plans/${id}`);
  },

  getGuidelineSource(sourceId: string): Promise<GuidelineSourceOut> {
    return request(`/api/v1/guidelines/${encodeURIComponent(sourceId)}`);
  },

  getMealPlanRequest(): Promise<MealPlanRequestOut> {
    return request("/api/v1/meal-plans/request");
  },

  requestMealPlan(note?: string): Promise<MealPlanRequestOut> {
    return request("/api/v1/meal-plans/request", {
      method: "POST",
      body: { note: note ?? "" },
    });
  },

  listAlerts(patientId?: string): Promise<AlertOut[]> {
    const q = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
    return request(`/api/v1/alerts${q}`);
  },

  checkInteraction(payload: InteractionCheckInput): Promise<InteractionCheckOutput> {
    return request("/api/v1/interactions/check", {
      method: "POST",
      body: payload,
    });
  },

  listNotifications(params?: {
    status?: string;
    type?: string;
  }): Promise<NotificationOut[]> {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.type) search.set("type", params.type);
    const q = search.toString() ? `?${search}` : "";
    return request(`/api/v1/notifications${q}`);
  },

  markNotificationRead(id: string): Promise<NotificationOut> {
    return request(`/api/v1/notifications/${id}/read`, { method: "POST" });
  },

  markNotificationDismiss(id: string): Promise<NotificationOut> {
    return request(`/api/v1/notifications/${id}/dismiss`, { method: "POST" });
  },

  markNotificationDone(
    id: string,
    adherence?: "yes" | "partial" | "no"
  ): Promise<NotificationOut> {
    return request(`/api/v1/notifications/${id}/done`, {
      method: "POST",
      body: adherence ? { adherence } : {},
    });
  },

  simulateNotifications(): Promise<NotificationOut[]> {
    return request("/api/v1/notifications/demo/simulate", { method: "POST" });
  },

  getDoctorProfile(): Promise<DoctorProfileResponse> {
    return request("/api/v1/doctor/profile");
  },

  updateDoctorProfile(payload: DoctorProfileUpdate): Promise<DoctorProfileResponse> {
    return request("/api/v1/doctor/profile", {
      method: "PUT",
      body: payload,
    });
  },

  listDoctorPatients(params?: {
    q?: string;
    status?: string;
    plan_usage?: string;
    meal_plan_request?: string;
  }): Promise<DoctorPatientSummary[]> {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.status) search.set("status", params.status);
    if (params?.plan_usage) search.set("plan_usage", params.plan_usage);
    if (params?.meal_plan_request) search.set("meal_plan_request", params.meal_plan_request);
    const qs = search.toString() ? `?${search}` : "";
    return request(`/api/v1/doctor/patients${qs}`);
  },

  createDoctorPatient(payload: {
    email: string;
    password: string;
    full_name?: string | null;
  }): Promise<DoctorPatientSummary> {
    return request("/api/v1/doctor/patients", {
      method: "POST",
      body: {
        email: payload.email,
        password: payload.password,
        full_name: payload.full_name ?? null,
      },
    });
  },

  listClaimQueue(): Promise<ClaimQueueItem[]> {
    return request("/api/v1/doctor/claim-queue");
  },

  listDoctorColleagues(): Promise<DoctorColleague[]> {
    return request("/api/v1/doctor/colleagues");
  },

  claimPatient(patientId: string): Promise<DoctorPatientSummary> {
    const id = asRouteId(patientId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PATIENT_ID", "Thiếu mã bệnh nhân."));
    }
    return request(`/api/v1/doctor/patients/${encodeURIComponent(id)}/claim`, {
      method: "POST",
    });
  },

  transferPatient(patientId: string, toDoctorId: string): Promise<TransferOut> {
    const id = asRouteId(patientId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PATIENT_ID", "Thiếu mã bệnh nhân."));
    }
    return request(`/api/v1/doctor/patients/${encodeURIComponent(id)}/transfer`, {
      method: "POST",
      body: { to_doctor_id: toDoctorId },
    });
  },

  acceptTransfer(transferId: string): Promise<DoctorPatientSummary> {
    return request(`/api/v1/doctor/transfers/${encodeURIComponent(transferId)}/accept`, {
      method: "POST",
    });
  },

  getDoctorPatient(patientId: string): Promise<DoctorPatientSummary> {
    const id = asRouteId(patientId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PATIENT_ID", "Thiếu mã bệnh nhân."));
    }
    return request(`/api/v1/doctor/patients/${encodeURIComponent(id)}`);
  },

  listPatientMealPlans(
    patientId: string,
    status = "all"
  ): Promise<MealPlanOutput[]> {
    const id = asRouteId(patientId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PATIENT_ID", "Thiếu mã bệnh nhân."));
    }
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(id)}/meal-plans?status=${encodeURIComponent(status)}`
    );
  },

  getPatientMealPlanSchedule(patientId: string): Promise<MealPlanScheduleOut> {
    const id = asRouteId(patientId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PATIENT_ID", "Thiếu mã bệnh nhân."));
    }
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(id)}/meal-plan-schedule`
    );
  },

  getPatientCompliance(
    patientId: string,
    days = 14
  ): Promise<PatientComplianceOut> {
    const id = asRouteId(patientId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PATIENT_ID", "Thiếu mã bệnh nhân."));
    }
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(id)}/compliance?days=${days}`
    );
  },

  getMyCompliance(days = 7): Promise<PatientComplianceOut> {
    return request(`/api/v1/compliance/me?days=${days}`);
  },

  remindPatientCompliance(
    patientId: string,
    message: string
  ): Promise<NotificationOut> {
    const id = asRouteId(patientId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PATIENT_ID", "Thiếu mã bệnh nhân."));
    }
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(id)}/compliance/remind`,
      { method: "POST", body: { message } }
    );
  },

  updatePatientMetrics(
    patientId: string,
    payload: { weight: number; height: number }
  ): Promise<PatientMetrics> {
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(patientId)}/metrics`,
      { method: "PUT", body: payload }
    );
  },

  getDoctorPatientMetricsHistory(
    patientId: string,
    days = 90
  ): Promise<MetricsHistoryPoint[]> {
    const id = asRouteId(patientId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PATIENT_ID", "Thiếu mã bệnh nhân."));
    }
    return request<MetricsHistoryPoint[]>(
      `/api/v1/doctor/patients/${encodeURIComponent(id)}/metrics/history?days=${days}`
    ).catch(() => [] as MetricsHistoryPoint[]);
  },

  updatePatientGoals(patientId: string, goals: string[]): Promise<GoalsOut> {
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(patientId)}/goals`,
      { method: "PUT", body: { goals } }
    );
  },

  updateDoctorPatientProfile(
    patientId: string,
    payload: DoctorPatientUpdate
  ): Promise<DoctorPatientSummary> {
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(patientId)}/profile`,
      { method: "PUT", body: payload }
    );
  },

  updateDoctorConstraints(
    patientId: string,
    payload: DoctorConstraintsUpdate
  ): Promise<DoctorPatientSummary> {
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(patientId)}/constraints`,
      { method: "PUT", body: payload }
    );
  },

  approveDoctorConstraints(patientId: string): Promise<PatientProfile> {
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(patientId)}/constraints/approve`,
      { method: "POST", body: {} }
    );
  },

  requestMealPlanAdjustment(
    mealPlanId: string,
    adjustment_note: string
  ): Promise<MealPlanOutput> {
    return request(
      `/api/v1/meal-plans/${encodeURIComponent(mealPlanId)}/request-adjustment`,
      { method: "POST", body: { adjustment_note } }
    );
  },

  getCatalog(): Promise<CatalogOut> {
    return request("/api/v1/doctor/catalog");
  },

  searchFoods(params?: { q?: string; limit?: number }): Promise<FoodCatalogOut> {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.limit != null) search.set("limit", String(params.limit));
    const qs = search.toString() ? `?${search}` : "";
    return request(`/api/v1/doctor/foods${qs}`);
  },

  async uploadPatientAvatar(
    patientId: string,
    file: File
  ): Promise<{ avatar: string }> {
    return uploadAvatarForm(
      `${API_BASE}/api/v1/doctor/patients/${encodeURIComponent(patientId)}/avatar`,
      file
    );
  },

  uploadMyAvatar(file: File): Promise<{ avatar: string }> {
    return uploadAvatarForm(`${API_BASE}/api/v1/auth/me/avatar`, file);
  },

  generateMealPlanForPatient(
    patientId: string,
    payload?: GenerateMealPlanRequest
  ): Promise<MealPlanOutput> {
    return request(
      `/api/v1/doctor/patients/${encodeURIComponent(patientId)}/meal-plans/generate`,
      { method: "POST", body: payload ?? {} }
    );
  },

  listDoctorMealPlans(status = "pending_review"): Promise<MealPlanOutput[]> {
    return request(
      `/api/v1/doctor/meal-plans?status=${encodeURIComponent(status)}`
    );
  },

  reviewMealPlan(id: string, payload: ReviewRequest): Promise<ReviewResponse> {
    return request(`/api/v1/doctor/meal-plans/${id}/review`, {
      method: "POST",
      body: payload,
    });
  },

  applyMealPlan(
    planId: string,
    payload: ApplyMealPlanRequest
  ): Promise<MealPlanOutput> {
    return request(`/api/v1/doctor/meal-plans/${encodeURIComponent(planId)}/apply`, {
      method: "POST",
      body: payload,
    });
  },

  deleteDoctorMealPlan(planId: string): Promise<void> {
    const id = asRouteId(planId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PLAN_ID", "Thiếu mã thực đơn."));
    }
    return request(`/api/v1/doctor/meal-plans/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  deleteDoctorPatient(patientId: string): Promise<void> {
    const id = asRouteId(patientId);
    if (!id) {
      return Promise.reject(new ApiError(400, "INVALID_PATIENT_ID", "Thiếu mã bệnh nhân."));
    }
    return request(`/api/v1/doctor/patients/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  demoPlanExpiry(
    mode: "expiring" | "expired"
  ): Promise<PlanExpiryDemoOut> {
    return request("/api/v1/doctor/demo/plan-expiry", {
      method: "POST",
      body: { mode },
    });
  },

  chat(message: string): Promise<AgentRunOutput> {
    return request("/api/v1/chat", {
      method: "POST",
      body: { message },
    });
  },

  listChatSessions(): Promise<ChatSessionSummaryOut[]> {
    return request("/api/v1/chat/sessions");
  },

  createChatSession(title = "Cuộc trò chuyện mới"): Promise<ChatSessionOut> {
    return request("/api/v1/chat/sessions", {
      method: "POST",
      body: { title },
    });
  },

  getChatSession(sessionId: string): Promise<ChatSessionOut> {
    return request(`/api/v1/chat/sessions/${encodeURIComponent(sessionId)}`);
  },

  patchChatSession(
    sessionId: string,
    payload: { title?: string; pinned?: boolean; applied_plans?: Record<string, boolean> }
  ): Promise<ChatSessionOut> {
    return request(`/api/v1/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: payload,
    });
  },

  deleteChatSession(sessionId: string): Promise<void> {
    return request(`/api/v1/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  },

  deleteAllChatSessions(): Promise<void> {
    return request("/api/v1/chat/sessions", {
      method: "DELETE",
    });
  },

  replaceChatSessionMessages(
    sessionId: string,
    messages: ChatSessionOut["messages"]
  ): Promise<ChatSessionOut> {
    return request(`/api/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "PUT",
      body: { messages },
    });
  },

  createChatEscalation(payload: EscalationCreatePayload): Promise<EscalationOut> {
    return request("/api/v1/chat/escalations", {
      method: "POST",
      body: payload,
    });
  },

  getChatEscalation(id: string): Promise<EscalationOut> {
    return request(`/api/v1/chat/escalations/${encodeURIComponent(id)}`);
  },

  replyChatEscalation(id: string, body: string): Promise<EscalationOut> {
    return request(`/api/v1/chat/escalations/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      body: { body },
    });
  },

  listDoctorEscalations(status?: string): Promise<EscalationListItem[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/api/v1/doctor/escalations${q}`);
  },

  getDoctorEscalation(id: string): Promise<EscalationOut> {
    return request(`/api/v1/doctor/escalations/${encodeURIComponent(id)}`);
  },

  replyDoctorEscalation(id: string, body: string): Promise<EscalationOut> {
    return request(`/api/v1/doctor/escalations/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      body: { body },
    });
  },

  resolveDoctorEscalation(id: string): Promise<EscalationOut> {
    return request(`/api/v1/doctor/escalations/${encodeURIComponent(id)}/resolve`, {
      method: "POST",
    });
  },

  chatStream,
};

async function* chatStream(message: string, sessionId?: string | null): AsyncGenerator<ChatStreamEvent> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };
  const token = getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api/v1/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, session_id: sessionId ?? undefined }),
  });

  if (!res.ok) {
    let detail = res.statusText || "Request failed";
    let code = "HTTP_ERROR";
    try {
      const data = (await res.json()) as { detail?: string; code?: string };
      if (data.detail) detail = data.detail;
      if (data.code) code = data.code;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code, detail);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiError(500, "STREAM_ERROR", "Response body is not readable");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        try {
          yield JSON.parse(jsonStr) as ChatStreamEvent;
        } catch {
          /* skip malformed event */
        }
      }
    }

    const trailing = buffer.trim();
    if (trailing.startsWith("data:")) {
      const jsonStr = trailing.slice(5).trim();
      if (jsonStr) {
        try {
          yield JSON.parse(jsonStr) as ChatStreamEvent;
        } catch {
          /* skip */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export { API_BASE };
