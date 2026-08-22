"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MealPreviewOut } from "@/lib/types";
import type { ThinkingStep } from "@/components/patient/ChatThinkingSteps";
import type { MockCardIntent } from "@/lib/patient-chat-mock-intents";

export interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  intent?: string;
  secondaryIntents?: string[];
  citations?: string[];
  guardrailTriggered?: boolean;
  mealPlanId?: string | null;
  mealPreview?: MealPreviewOut | null;
  mockCard?: MockCardIntent;
  isStreaming?: boolean;
  thinkingSteps?: ThinkingStep[];
  corrected?: boolean;
  correctionReason?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number; // timestamp ms
  updatedAt: number; // timestamp ms
  pinned?: boolean;
  appliedPlans?: Record<string, boolean>;
}

// Initial Mock Sessions for Demo / First-time user experience
const INITIAL_DEMO_SESSIONS: ChatSession[] = [
  {
    id: "session-demo-today-1",
    title: "Tư vấn thực đơn kiểm soát đường huyết",
    createdAt: Date.now() - 1000 * 60 * 45, // 45 phút trước
    updatedAt: Date.now() - 1000 * 60 * 45,
    pinned: false,
    appliedPlans: {},
    messages: [
      {
        id: "user-1",
        sender: "user",
        text: "Hôm nay tôi nên ăn gì để kiểm soát đường huyết và hạn chế muối?",
      },
      {
        id: "ai-1",
        sender: "ai",
        text: "Dựa trên tiền sử Đái tháo đường Type 2 và Tăng huyết áp của bạn, tôi đã thiết kế thực đơn cân đối chỉ số đường huyết (GI thấp) và kiểm soát lượng muối nghiêm ngặt (< 2g/ngày):",
        intent: "meal_plan",
        thinkingSteps: [
          { node: "patient_profile", message: "Phân tích hồ sơ bệnh nhân (Tiểu đường Type 2, Tăng huyết áp)", status: "done" },
          { node: "safety_guardrail", message: "Kiểm tra giới hạn natri (< 2000mg/ngày) & chỉ số GI thực phẩm", status: "done" },
          { node: "rag_guideline", message: "Tổng hợp thực đơn cá nhân hóa từ cơ sở dữ liệu y văn", status: "done" },
        ],
        citations: ["dinh_duong_dai_thao_duong.md", "kiem_soat_natri_tang_huyet_ap.md"],
        mealPreview: {
          meal_plan_id: "demo-plan-today",
          date: new Date().toISOString().split("T")[0],
          day_index: 0,
          plan_status: "approved",
          meals: [
            {
              slot: "breakfast",
              label: "Bữa sáng",
              items: [
                {
                  name: "Yến mạch nấu sữa hạt hạnh nhân & dâu tây",
                  portion: "1 bát vừa (250g)",
                  kcal: 380,
                  macros: { carb_g: 45, protein_g: 14, fat_g: 12, sodium_mg: 80 },
                  citations: ["dinh_duong_dai_thao_duong.md"],
                },
              ],
            },
            {
              slot: "lunch",
              label: "Bữa trưa",
              items: [
                {
                  name: "Ức gà áp chảo dầu ô liu, cơm gạo lứt & bông cải xanh",
                  portion: "1 suất (350g)",
                  kcal: 620,
                  macros: { carb_g: 65, protein_g: 42, fat_g: 18, sodium_mg: 350 },
                  citations: ["dinh_duong_dai_thao_duong.md", "kiem_soat_natri_tang_huyet_ap.md"],
                },
              ],
            },
            {
              slot: "dinner",
              label: "Bữa tối",
              items: [
                {
                  name: "Canh cá hồi nấu ngót & đậu phụ non ít muối",
                  portion: "1 tô canh (300g)",
                  kcal: 550,
                  macros: { carb_g: 40, protein_g: 36, fat_g: 22, sodium_mg: 280 },
                  citations: ["kiem_soat_natri_tang_huyet_ap.md"],
                },
              ],
            },
          ],
        },
      },
    ],
  },
  {
    id: "session-demo-today-2",
    title: "Kiểm tra mức độ tuân thủ dinh dưỡng tuần này",
    createdAt: Date.now() - 1000 * 60 * 180, // 3 tiếng trước
    updatedAt: Date.now() - 1000 * 60 * 180,
    pinned: true,
    appliedPlans: {},
    messages: [
      {
        id: "user-2",
        sender: "user",
        text: "Tuân thủ của tôi tuần này thế nào?",
      },
      {
        id: "ai-2",
        sender: "ai",
        text: "Bạn đang duy trì phong độ rất tốt với tỉ lệ tuân thủ đạt 92% tuần này.",
        mockCard: "weekly_compliance",
      },
    ],
  },
  {
    id: "session-demo-yesterday-1",
    title: "Tra cứu tương tác Metformin và bưởi da xanh",
    createdAt: Date.now() - 1000 * 60 * 60 * 28, // Hôm qua (~28h trước)
    updatedAt: Date.now() - 1000 * 60 * 60 * 28,
    pinned: false,
    appliedPlans: {},
    messages: [
      {
        id: "user-3",
        sender: "user",
        text: "Tôi đang uống Metformin 500mg, ăn bưởi tráng miệng có sao không?",
      },
      {
        id: "ai-3",
        sender: "ai",
        text: "Bưởi chứa furanocoumarin có thể ức chế enzyme chuyển hóa ở ruột. Với Metformin, tương tác không nguy hiểm như nhóm Statin (hạ mỡ máu), nhưng uống nước ép bưởi đậm đặc quá nhiều có thể làm tăng nhẹ nguy cơ tích tụ axit lactic.\n\nLời khuyên: Bạn có thể ăn 2-3 múi bưởi tươi cách giờ uống thuốc khoảng 2 tiếng, tránh uống nước ép bưởi cô đặc số lượng lớn.",
        intent: "interaction_check",
        citations: ["tuong_tac_thuoc_va_thuc_pham_y_van.md", "metformin_clinical_guidelines.md"],
      },
    ],
  },
  {
    id: "session-demo-older-1",
    title: "Địa điểm mua nguyên liệu tươi sạch Q3",
    createdAt: Date.now() - 1000 * 60 * 60 * 72, // 3 ngày trước
    updatedAt: Date.now() - 1000 * 60 * 60 * 72,
    pinned: false,
    appliedPlans: {},
    messages: [
      {
        id: "user-4",
        sender: "user",
        text: "Tìm chỗ mua nguyên liệu tươi sạch gần Quận 3",
      },
      {
        id: "ai-4",
        sender: "ai",
        text: "Dưới đây là các địa điểm mua sắm nguyên liệu tươi sạch gần vị trí của bạn tại Quận 3:",
        mockCard: "grocery_list",
      },
    ],
  },
  {
    id: "session-demo-older-2",
    title: "Lời dặn của Bác sĩ Minh Nguyễn",
    createdAt: Date.now() - 1000 * 60 * 60 * 120, // 5 ngày trước
    updatedAt: Date.now() - 1000 * 60 * 60 * 120,
    pinned: false,
    appliedPlans: {},
    messages: [
      {
        id: "user-5",
        sender: "user",
        text: "Bác sĩ có dặn gì tôi không?",
      },
      {
        id: "ai-5",
        sender: "ai",
        text: "Bác sĩ Minh Nguyễn đã để lại một lời nhắc quan trọng dành cho bạn:",
        mockCard: "doctor_note",
      },
    ],
  },
];

export interface PatientChatHistoryState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isSidebarOpen: boolean; // Desktop & Mobile collapse state

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  createNewSession: () => string;
  selectSession: (id: string) => void;
  renameSession: (id: string, newTitle: string) => void;
  deleteSession: (id: string) => void;
  togglePinSession: (id: string) => void;
  saveActiveSessionMessages: (messages: ChatMessage[], appliedPlans?: Record<string, boolean>) => void;
  autoUpdateTitleIfFirstMessage: (sessionId: string, firstQuery: string) => void;
  clearAllSessions: () => void;
}

export const usePatientChatHistoryStore = create<PatientChatHistoryState>()(
  persist(
    (set, get) => ({
      sessions: INITIAL_DEMO_SESSIONS,
      activeSessionId: "session-demo-today-1",
      isSidebarOpen: true,

      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
      setSidebarOpen: (open: boolean) => set({ isSidebarOpen: open }),

      createNewSession: () => {
        const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newSession: ChatSession = {
          id: newId,
          title: "Cuộc trò chuyện mới",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pinned: false,
          appliedPlans: {},
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: newId,
        }));

        return newId;
      },

      selectSession: (id: string) => {
        set({ activeSessionId: id });
      },

      renameSession: (id: string, newTitle: string) => {
        const trimmed = newTitle.trim();
        if (!trimmed) return;
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, title: trimmed, updatedAt: Date.now() } : s
          ),
        }));
      },

      deleteSession: (id: string) => {
        set((state) => {
          const nextSessions = state.sessions.filter((s) => s.id !== id);
          let nextActiveId = state.activeSessionId;

          // If deleting the currently active session, switch to the first available or null
          if (state.activeSessionId === id) {
            nextActiveId = nextSessions.length > 0 ? nextSessions[0].id : null;
          }

          return {
            sessions: nextSessions,
            activeSessionId: nextActiveId,
          };
        });
      },

      togglePinSession: (id: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, pinned: !s.pinned, updatedAt: Date.now() } : s
          ),
        }));
      },

      saveActiveSessionMessages: (messages: ChatMessage[], appliedPlans?: Record<string, boolean>) => {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId) return;

        set({
          sessions: sessions.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  messages,
                  appliedPlans: appliedPlans ?? s.appliedPlans,
                  updatedAt: Date.now(),
                }
              : s
          ),
        });
      },

      autoUpdateTitleIfFirstMessage: (sessionId: string, firstQuery: string) => {
        const cleanQuery = firstQuery.trim();
        if (!cleanQuery) return;
        const truncatedTitle =
          cleanQuery.length > 38 ? `${cleanQuery.slice(0, 38)}...` : cleanQuery;

        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id === sessionId && (s.title === "Cuộc trò chuyện mới" || !s.title)) {
              return { ...s, title: truncatedTitle, updatedAt: Date.now() };
            }
            return s;
          }),
        }));
      },

      clearAllSessions: () => {
        set({
          sessions: [],
          activeSessionId: null,
        });
      },
    }),
    {
      name: "vmec-patient-chat-history-v2",
      version: 2,
    }
  )
);

// Helper for grouping chat sessions by date
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

  // Sort sessions with latest updated first
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
