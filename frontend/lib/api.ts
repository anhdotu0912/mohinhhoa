/** API client — contracts/api-v1.md */

import {
  ApiError,
  type AgentRunOutput,
  type AlertOut,
  type CatalogOut,
  type DoctorPatientSummary,
  type DoctorConstraintsUpdate,
  type DoctorPatientUpdate,
  type FoodCatalogOut,
  type GoalsOut,
  type GenerateMealPlanRequest,
  type MealPlanOutput,
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
      const data = (await res.json()) as { detail?: string; code?: string };
      if (data.detail) detail = data.detail;
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

  getCurrentUser(token?: string | null): Promise<UserMeResponse> {
    return request("/api/v1/auth/me", { token });
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

  generateMealPlan(payload?: GenerateMealPlanRequest): Promise<MealPlanOutput> {
    return request("/api/v1/meal-plans/generate", {
      method: "POST",
      body: payload ?? {},
    });
  },

  getMyMealPlan(): Promise<MealPlanOutput> {
    return request("/api/v1/meal-plans/me");
  },

  getMealPlan(id: string): Promise<MealPlanOutput> {
    return request(`/api/v1/meal-plans/${id}`);
  },

  listAlerts(patientId?: string): Promise<AlertOut[]> {
    const q = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
    return request(`/api/v1/alerts${q}`);
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

  listDoctorPatients(params?: {
    q?: string;
    status?: string;
    plan_usage?: string;
  }): Promise<DoctorPatientSummary[]> {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.status) search.set("status", params.status);
    if (params?.plan_usage) search.set("plan_usage", params.plan_usage);
    const qs = search.toString() ? `?${search}` : "";
    return request(`/api/v1/doctor/patients${qs}`);
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
    const token = getStoredToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `${API_BASE}/api/v1/doctor/patients/${encodeURIComponent(patientId)}/avatar`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }
    );
    if (!res.ok) {
      let detail = res.statusText || "Upload failed";
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
    return (await res.json()) as { avatar: string };
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
    payload: {
      start_date: string;
      replace_active?: boolean;
      slot_key?: "current" | "next" | "empty";
    }
  ): Promise<MealPlanOutput> {
    return request(`/api/v1/doctor/meal-plans/${encodeURIComponent(planId)}/apply`, {
      method: "POST",
      body: payload,
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
};

export { API_BASE };
