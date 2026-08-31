"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type {
  ChatMessageOut,
  ChatSessionOut,
  ChatSessionSummaryOut,
  CitationChunk,
  MealPlanOutput,
  MealPreviewOut,
  WeeklyComplianceOut,
  DoctorNoteOut,
} from "@/lib/types";
import type { ThinkingStep } from "@/components/patient/ChatThinkingSteps";

export interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  intent?: string;
  secondaryIntents?: string[];
  citations?: string[];
  citationChunks?: CitationChunk[];
  guardrailTriggered?: boolean;
  mealPlanId?: string | null;
  mealPreview?: MealPreviewOut | null;
  weeklyCompliance?: WeeklyComplianceOut | null;
  doctorNote?: DoctorNoteOut | null;
  mealPlanWeek?: MealPlanOutput | null;
  showWeeklyPlan?: boolean;
  isStreaming?: boolean;
  thinkingSteps?: ThinkingStep[];
  corrected?: boolean;
  correctionReason?: string;
  unmatchedPairs?: { drug: string; food: string }[];
  escalationId?: string | null;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  appliedPlans?: Record<string, boolean>;
  messageCount?: number;
}

function isoToMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Date.now() : ms;
}

function apiMessageToLocal(message: ChatMessageOut): ChatMessage {
  return {
    id: message.id,
    sender: message.sender,
    text: message.text ?? "",
    intent: message.intent ?? undefined,
    secondaryIntents: message.secondary_intents ?? [],
    citations: message.citations ?? [],
    citationChunks: message.citation_chunks ?? [],
    guardrailTriggered: message.guardrail_triggered ?? false,
    mealPlanId: message.meal_plan_id ?? null,
    mealPreview: message.meal_preview ?? null,
    weeklyCompliance: message.weekly_compliance ?? null,
    doctorNote: message.doctor_note ?? null,
    mealPlanWeek: message.meal_plan_week ?? null,
    showWeeklyPlan: message.show_weekly_plan ?? false,
    thinkingSteps: (message.thinking_steps ?? []) as ThinkingStep[],
    corrected: message.corrected ?? false,
    correctionReason: message.correction_reason ?? undefined,
    unmatchedPairs: message.unmatched_pairs ?? [],
    escalationId: message.escalation_id ?? null,
  };
}

function localMessageToApi(message: ChatMessage): ChatMessageOut {
  return {
    id: message.id,
    sender: message.sender,
    text: message.text ?? "",
    intent: message.intent ?? null,
    secondary_intents: message.secondaryIntents ?? [],
    citations: message.citations ?? [],
    citation_chunks: message.citationChunks ?? [],
    guardrail_triggered: message.guardrailTriggered ?? false,
    meal_plan_id: message.mealPlanId ?? null,
    meal_preview: message.mealPreview ?? null,
    weekly_compliance: message.weeklyCompliance ?? null,
    doctor_note: message.doctorNote ?? null,
    meal_plan_week: message.mealPlanWeek ?? null,
    show_weekly_plan: message.showWeeklyPlan ?? false,
    thinking_steps: message.thinkingSteps ?? [],
    corrected: message.corrected ?? false,
    correction_reason: message.correctionReason ?? null,
    unmatched_pairs: message.unmatchedPairs ?? [],
    escalation_id: message.escalationId ?? null,
  };
}

function summaryToSession(summary: ChatSessionSummaryOut): ChatSession {
  return {
    id: summary.id,
    title: summary.title,
    messages: [],
    createdAt: isoToMs(summary.created_at),
    updatedAt: isoToMs(summary.updated_at),
    pinned: summary.pinned,
    appliedPlans: {},
    messageCount: summary.message_count,
  };
}

const sessionSaveQueues = new Map<string, Promise<void>>();

function enqueueSessionSave(sessionId: string, task: () => Promise<void>): Promise<void> {
  const previous = sessionSaveQueues.get(sessionId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  sessionSaveQueues.set(sessionId, next);
  return next;
}

function sessionOutToLocal(session: ChatSessionOut): ChatSession {
  return {
    id: session.id,
    title: session.title,
    messages: session.messages.map(apiMessageToLocal),
    createdAt: isoToMs(session.created_at),
    updatedAt: isoToMs(session.updated_at),
    pinned: session.pinned,
    appliedPlans: session.applied_plans ?? {},
    messageCount: session.messages.length,
  };
}

export interface PatientChatHistoryState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isSidebarOpen: boolean;
  isHydrated: boolean;
  isLoading: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  hydrateSessions: () => Promise<void>;
  createNewSession: () => Promise<string>;
  selectSession: (id: string) => Promise<void>;
  renameSession: (id: string, newTitle: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  togglePinSession: (id: string) => Promise<void>;
  saveActiveSessionMessages: (
    messages: ChatMessage[],
    appliedPlans?: Record<string, boolean>,
    sessionId?: string | null
  ) => Promise<void>;
  autoUpdateTitleIfFirstMessage: (sessionId: string, firstQuery: string) => Promise<void>;
  clearAllSessions: () => Promise<void>;
}

export const usePatientChatHistoryStore = create<PatientChatHistoryState>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isSidebarOpen: true,
  isHydrated: false,
  isLoading: false,

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ isSidebarOpen: open }),

  hydrateSessions: async () => {
    set({ isLoading: true });
    try {
      const summaries = await api.listChatSessions();
      const activeSessionId =
        summaries.length > 0 ? summaries[0].id : null;
      let sessions = summaries.map(summaryToSession);

      if (activeSessionId) {
        try {
          const remote = await api.getChatSession(activeSessionId);
          const local = sessionOutToLocal(remote);
          sessions = sessions.map((s) => (s.id === activeSessionId ? local : s));
        } catch {
          /* keep summary-only row */
        }
      }

      set({
        sessions,
        isHydrated: true,
        isLoading: false,
        activeSessionId,
      });
    } catch {
      set({ isHydrated: true, isLoading: false });
    }
  },

  createNewSession: async () => {
    const created = await api.createChatSession();
    const local = sessionOutToLocal(created);
    set((state) => ({
      sessions: [local, ...state.sessions],
      activeSessionId: local.id,
    }));
    return local.id;
  },

  selectSession: async (id: string) => {
    set({ activeSessionId: id });
    const existing = get().sessions.find((s) => s.id === id);
    const hasCachedMessages = Boolean(existing && existing.messages.length > 0);
    if (hasCachedMessages) {
      return;
    }
    try {
      const remote = await api.getChatSession(id);
      const local = sessionOutToLocal(remote);
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id
            ? {
                ...local,
                // Keep any messages saved while this fetch was in flight.
                messages: s.messages.length > 0 ? s.messages : local.messages,
                appliedPlans:
                  Object.keys(s.appliedPlans || {}).length > 0
                    ? s.appliedPlans
                    : local.appliedPlans,
                messageCount:
                  s.messages.length > 0 ? s.messages.length : local.messageCount,
              }
            : s
        ),
      }));
    } catch {
      /* keep cached metadata */
    }
  },

  renameSession: async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const updated = await api.patchChatSession(id, { title: trimmed });
    const local = sessionOutToLocal(updated);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? {
              ...local,
              messages: s.messages.length > 0 ? s.messages : local.messages,
            }
          : s
      ),
    }));
  },

  deleteSession: async (id: string) => {
    await api.deleteChatSession(id);
    const previousActiveId = get().activeSessionId;
    let nextActiveId: string | null = null;
    set((state) => {
      const nextSessions = state.sessions.filter((s) => s.id !== id);
      nextActiveId =
        state.activeSessionId === id
          ? nextSessions.length > 0
            ? nextSessions[0].id
            : null
          : state.activeSessionId;
      return {
        sessions: nextSessions,
        activeSessionId: nextActiveId,
      };
    });
    if (nextActiveId && previousActiveId === id) {
      await get().selectSession(nextActiveId);
    }
  },

  togglePinSession: async (id: string) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) return;
    const updated = await api.patchChatSession(id, { pinned: !session.pinned });
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? {
              ...s,
              pinned: updated.pinned,
              updatedAt: isoToMs(updated.updated_at),
            }
          : s
      ),
    }));
  },

  saveActiveSessionMessages: async (
    messages: ChatMessage[],
    appliedPlans?: Record<string, boolean>,
    sessionId?: string | null
  ) => {
    const targetId = sessionId ?? get().activeSessionId;
    if (!targetId) return;

    const persistMessages = messages
      .filter((m) => !m.isStreaming)
      .map(localMessageToApi);

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === targetId
          ? {
              ...s,
              messages,
              appliedPlans: appliedPlans ?? s.appliedPlans,
              messageCount: persistMessages.length,
              updatedAt: Date.now(),
            }
          : s
      ),
    }));

    return enqueueSessionSave(targetId, async () => {
      try {
        const updated = await api.replaceChatSessionMessages(targetId, persistMessages);
        if (appliedPlans) {
          await api.patchChatSession(targetId, { applied_plans: appliedPlans });
        }
        const local = sessionOutToLocal(updated);
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== targetId) return s;
            const messagesToKeep =
              local.messages.length > 0 || persistMessages.length === 0
                ? local.messages
                : s.messages;
            return {
              ...local,
              messages: messagesToKeep,
              appliedPlans: appliedPlans ?? local.appliedPlans ?? s.appliedPlans,
              messageCount: messagesToKeep.length,
            };
          }),
        }));
      } catch {
        /* optimistic UI retained */
      }
    });
  },

  autoUpdateTitleIfFirstMessage: async (sessionId: string, firstQuery: string) => {
    const cleanQuery = firstQuery.trim();
    if (!cleanQuery) return;
    const truncatedTitle =
      cleanQuery.length > 38 ? `${cleanQuery.slice(0, 38)}...` : cleanQuery;

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || (session.title !== "Cuộc trò chuyện mới" && session.title)) {
      return;
    }

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, title: truncatedTitle, updatedAt: Date.now() } : s
      ),
    }));

    try {
      await api.patchChatSession(sessionId, { title: truncatedTitle });
    } catch {
      /* local title retained */
    }
  },

  clearAllSessions: async () => {
    await api.deleteAllChatSessions();
    set({
      sessions: [],
      activeSessionId: null,
    });
  },
}));

export interface GroupedSessions {
  pinned: ChatSession[];
  today: ChatSession[];
  yesterday: ChatSession[];
  last7Days: ChatSession[];
  older: ChatSession[];
}

export function groupSessionsByRecency(sessions: ChatSession[]): GroupedSessions {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const result: GroupedSessions = {
    pinned: [],
    today: [],
    yesterday: [],
    last7Days: [],
    older: [],
  };

  const sorted = [...sessions].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  for (const session of sorted) {
    if (session.pinned) {
      result.pinned.push(session);
      continue;
    }

    const time = session.createdAt || session.updatedAt;
    if (time >= startOfToday) {
      result.today.push(session);
    } else if (time >= startOfYesterday) {
      result.yesterday.push(session);
    } else if (time >= startOf7DaysAgo) {
      result.last7Days.push(session);
    } else {
      result.older.push(session);
    }
  }

  return result;
}
