/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TOPBAR_PATIENT_AVATAR_SRC } from "@/lib/nav-config";
import {
  ChatThinkingSteps,
  ChatTypingDots,
  type ThinkingStep,
} from "@/components/patient/ChatThinkingSteps";
import {
  FoodLogModal,
  type FoodLogModalContext,
  type FoodLogSlot,
} from "@/components/patient/FoodLogModal";
import { DishCard, MealSectionHeader } from "@/components/patient/PatientMealPlanUI";
import { api } from "@/lib/api";
import { foodItemToDish } from "@/lib/meal-plan-mappers";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError, type AgentRunOutput, type MealPreviewOut } from "@/lib/types";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  intent?: string;
  secondaryIntents?: string[];
  citations?: string[];
  guardrailTriggered?: boolean;
  mealPlanId?: string | null;
  mealPreview?: MealPreviewOut | null;
  isStreaming?: boolean;
  thinkingSteps?: ThinkingStep[];
  corrected?: boolean;
  correctionReason?: string;
}

const INTENT_LABELS: Record<string, string> = {
  meal_plan: "Xem thực đơn",
  interaction_check: "Tương tác thuốc–thực phẩm",
  rag_qa: "Hỏi đáp dinh dưỡng (RAG)",
  refuse: "Từ chối yêu cầu ngoài phạm vi",
  food_log: "Ghi nhận bữa ăn",
  unknown: "Chưa phân loại được",
};

const SAMPLE_QUESTIONS = [
  { text: "Hôm nay ăn gì?", icon: "restaurant" },
  { text: "Trưa nay ăn gì?", icon: "wb_sunny" },
  { text: "Tối nay nên ăn gì?", icon: "bedtime" },
  {
    text: "Tôi uống metformin có ăn rau muống được không?",
    icon: "medical_services",
  },
  { text: "Thực đơn tuần này của tôi có gì?", icon: "calendar_month" },
];

const MEAL_SLOT_ICONS: Record<string, string> = {
  breakfast: "wb_twilight",
  lunch: "wb_sunny",
  dinner: "bedtime",
  snack: "cookie",
};

function formatCitationLabel(citation: string): string {
  const base = citation.split("#")[0] || citation;
  return base.replace(/_/g, " ").replace(/\.md$/i, "");
}

function computeMealPreviewTotals(preview: MealPreviewOut) {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let lipid = 0;

  for (const m of preview.meals) {
    for (const item of m.items) {
      if (item.kcal) calories += item.kcal;
      if (item.macros?.protein_g) protein += item.macros.protein_g;
      if (item.macros?.carb_g) carbs += item.macros.carb_g;
      if (item.macros?.fat_g) lipid += item.macros.fat_g;
    }
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    lipid: Math.round(lipid * 10) / 10,
  };
}

export default function PatientAssistantPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const displayName = useAuthStore((s) => s.displayName);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [logContext, setLogContext] = useState<FoodLogModalContext | null>(null);
  const [isFetchingLogPlan, setIsFetchingLogPlan] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [appliedPlans, setAppliedPlans] = useState<Record<string, boolean>>({});

  const handleApplyMealPlan = useCallback((planId: string) => {
    setAppliedPlans((prev) => ({ ...prev, [planId]: true }));
    setToastMessage("Đã lưu & áp dụng thực đơn vào trang Thực đơn chính!");
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const handleOpenFoodLog = async (msgMealPlanId?: string | null) => {
    setIsFetchingLogPlan(true);
    let planId = msgMealPlanId ?? "";
    if (!planId) {
      try {
        const activePlan = await api.getMyMealPlan();
        if (activePlan?.id) {
          planId = activePlan.id;
        }
      } catch {
        /* fallback if no active meal plan found */
      }
    }

    const hour = new Date().getHours();
    let slot: FoodLogSlot = "morning";
    let slotLabel = "Bữa sáng";
    if (hour >= 11 && hour < 16) {
      slot = "noon";
      slotLabel = "Bữa trưa";
    } else if (hour >= 16) {
      slot = "evening";
      slotLabel = "Bữa tối";
    }

    setLogContext({
      slot,
      slotLabel,
      dayLabel: "Hôm nay",
      mealPlanId: planId || "demo_plan",
      dayIndex: 1,
    });
    setIsFetchingLogPlan(false);
  };

  const handleFoodLogSaved = () => {
    setToastMessage("Đã ghi nhận bữa ăn thành công!");
    setTimeout(() => setToastMessage(null), 4000);
  };

  const latestAiMessage = useMemo(
    () => [...messages].reverse().find((msg) => msg.sender === "ai"),
    [messages]
  );

  const activeCitations = latestAiMessage?.citations ?? [];
  const hasConversation = messages.length > 0;

  const handleScroll = useCallback(() => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceToBottom < 100;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottomBtn(distanceToBottom > 180);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (role === "doctor") {
      router.replace("/doctor");
    }
  }, [hydrated, token, role, router]);

  useEffect(() => {
    if (isNearBottomRef.current || isSending) {
      scrollToBottom("smooth");
    }
  }, [messages, isSending, scrollToBottom]);

  const mapAgentResponse = (response: AgentRunOutput): Omit<Message, "id" | "sender"> => ({
    text: response.message,
    intent: response.intent,
    secondaryIntents: response.secondary_intents ?? [],
    citations: response.citations ?? [],
    guardrailTriggered: response.guardrail_triggered,
    mealPlanId: response.meal_plan_id,
    mealPreview: response.meal_preview ?? null,
    isStreaming: false,
  });

  const upsertThinkingStep = (
    steps: ThinkingStep[],
    node: string,
    message: string
  ): ThinkingStep[] => {
    const next = steps.map((s) =>
      s.status === "active" ? { ...s, status: "done" as const } : s
    );
    const existingIdx = next.findIndex((s) => s.node === node && s.message === message);
    if (existingIdx >= 0) {
      next[existingIdx] = { ...next[existingIdx], status: "active" };
      return next;
    }
    return [...next, { node, message, status: "active" }];
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? inputQuery).trim();
    if (!query || isSending) return;

    setError(null);
    setInputQuery("");
    setLastQuery(query);

    const userMsg: Message = {
      id: `${Date.now()}-user`,
      sender: "user",
      text: query,
    };

    const aiMsgId = `${Date.now()}-ai`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: aiMsgId,
        sender: "ai",
        text: "",
        isStreaming: true,
        thinkingSteps: [],
      },
    ]);
    setIsSending(true);
    isNearBottomRef.current = true;
    setTimeout(() => scrollToBottom("smooth"), 50);

    let streamingText = "";
    let thinkingSteps: ThinkingStep[] = [];

    try {
      for await (const event of api.chatStream(query)) {
        if (event.type === "status") {
          thinkingSteps = upsertThinkingStep(thinkingSteps, event.node, event.message);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, thinkingSteps: [...thinkingSteps] }
                : m
            )
          );
        } else if (event.type === "intent") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    intent: event.intent,
                    secondaryIntents: event.secondary_intents ?? [],
                  }
                : m
            )
          );
        } else if (event.type === "token") {
          streamingText += event.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    text: streamingText,
                  }
                : m
            )
          );
        } else if (event.type === "correction") {
          streamingText = event.message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    text: event.message,
                    corrected: true,
                    correctionReason: event.reason,
                  }
                : m
            )
          );
        } else if (event.type === "done") {
          const finalized = mapAgentResponse(event.data);
          const completedSteps = thinkingSteps.map((s) => ({
            ...s,
            status: "done" as const,
          }));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    ...finalized,
                    text: event.data.message,
                    thinkingSteps: completedSteps,
                    corrected: m.corrected,
                    correctionReason: m.correctionReason,
                  }
                : m
            )
          );
        } else if (event.type === "error") {
          setError(event.message);
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
        }
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Không thể kết nối trợ lý AI. Vui lòng thử lại.";
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
    } finally {
      setIsSending(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setError(null);
    setInputQuery("");
    setShowReferences(false);
    setShowHistory(false);
  };

  const isCompactViewport = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;

  const toggleHistory = () => {
    setShowHistory((open) => {
      const next = !open;
      if (next && isCompactViewport()) setShowReferences(false);
      return next;
    });
  };

  const toggleReferences = () => {
    setShowReferences((open) => {
      const next = !open;
      if (next && isCompactViewport()) setShowHistory(false);
      return next;
    });
  };

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 1023px)").matches;
    if (!compact || (!showHistory && !showReferences)) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showHistory, showReferences]);

  return (
    <>
      <header className="flex justify-between items-center px-8 py-5 w-full bg-[#F7F9F9] sticky top-0 z-30 shrink-0">
        <div className="font-h1 text-h1 text-primary font-bold tracking-tight opacity-0 md:opacity-100">
          VMEC-10
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <span className="material-symbols-outlined text-primary text-[20px]">
            sensors
          </span>
          <img
            src={TOPBAR_PATIENT_AVATAR_SRC}
            alt="User avatar"
            className="w-8 h-8 rounded-full border border-outline-variant object-cover"
          />
        </div>
      </header>
      <div className="flex-1 flex min-h-0 h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] overflow-hidden bg-background relative">
        {showHistory && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-30 lg:hidden animate-fadeIn"
              onClick={() => setShowHistory(false)}
            />
            <div className="w-[280px] lg:w-[240px] fixed lg:relative inset-y-0 left-0 lg:inset-auto flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant flex flex-col h-full max-h-full overflow-hidden sticky top-0 animate-fadeIn transition-all duration-300 z-40 lg:z-20 shadow-xl lg:shadow-none">
              <div className="p-md flex items-center justify-between border-b border-outline-variant/40 shrink-0 bg-surface-container-lowest">
                <span className="font-h2 text-h2 text-on-surface font-semibold text-sm flex items-center gap-xs">
                  <span className="material-symbols-outlined text-primary text-[18px]">history</span>
                  Phiên chat
                </span>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="text-on-surface-variant hover:text-primary p-1 rounded-md hover:bg-surface-container-low transition-colors cursor-pointer"
                  title="Ẩn lịch sử"
                >
                  <span className="material-symbols-outlined text-[18px]">first_page</span>
                </button>
              </div>
              <div className="p-md pt-xs shrink-0">
                <button
                  type="button"
                  onClick={handleNewConversation}
                  className="w-full bg-surface-container-lowest border border-primary text-primary font-body-bold rounded-lg py-sm px-md flex items-center justify-center gap-sm hover:bg-surface-container-low transition-colors shadow-xs text-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Cuộc trò chuyện mới
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-sm pb-md flex flex-col gap-sm">
                {hasConversation ? (
                  <button
                    type="button"
                    className="w-full text-left p-sm rounded-lg bg-primary/10 ring-1 ring-primary/20 group transition-all"
                  >
                    <p className="font-body-bold text-on-surface truncate text-sm font-semibold">
                      {messages.find((m) => m.sender === "user")?.text ?? "Cuộc trò chuyện hiện tại"}
                    </p>
                    <p className="font-caption text-caption text-on-surface-variant truncate mt-xs text-xs">
                      Phiên này · {messages.length} tin nhắn
                    </p>
                  </button>
                ) : (
                  <p className="px-sm py-md font-caption text-caption text-on-surface-variant text-xs">
                    Chưa có hội thoại trong phiên này. Hãy gửi câu hỏi đầu tiên.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex-1 bg-background flex flex-col min-h-0 h-full max-h-full overflow-hidden relative min-w-0">

          <div className="w-full px-8 py-2.5 bg-white border-b border-outline-variant/30 flex items-center justify-between z-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hidden md:flex shrink-0">
            {/* Left Side */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleHistory}
                className="flex items-center gap-2 px-3 py-1.5 border border-[#006857] rounded-md text-[13px] text-[#006857] hover:bg-[#E4F2EE] transition-colors font-medium bg-white shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                {showHistory ? "Hide history" : "Chat history"}
              </button>
              <button
                type="button"
                onClick={handleNewConversation}
                className="flex items-center gap-2 px-3 py-1.5 border border-[#006857] rounded-md text-[13px] text-[#006857] hover:bg-[#E4F2EE] transition-colors font-medium bg-white shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                New chat
              </button>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={toggleReferences}
                className="flex items-center gap-2 px-3 py-1.5 border border-[#006857] rounded-md text-[13px] text-[#006857] hover:bg-[#E4F2EE] transition-colors font-medium bg-white shadow-sm relative cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">article</span>
                References
                {activeCitations.length > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold leading-none flex items-center justify-center border-2 border-white shadow-sm">
                    {activeCitations.length}
                  </span>
                )}
              </button>
              
              <div className="flex items-center gap-1.5 text-[#006857] text-[13px] font-medium">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                Medical Analysis & Personalized Nutrition Advice
              </div>
            </div>
          </div>

          <div
            ref={chatScrollRef}
            onScroll={handleScroll}
            className={`flex-1 min-h-0 overflow-y-auto p-md md:p-lg flex flex-col gap-lg md:gap-xl overscroll-contain ${
              hasConversation ? "" : "justify-center"
            }`}
          >
            {!hasConversation && (
              <div className="flex flex-col items-center w-full max-w-3xl mx-auto h-full justify-center mt-[-60px]">
                {/* AI Avatar */}
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-green-100 via-blue-50 to-white shadow-lg flex items-center justify-center mb-8 border-[6px] border-white relative">
                  <div className="w-24 h-24 bg-[#006857] rounded-full flex items-center justify-center relative overflow-hidden shadow-inner">
                    <div className="w-16 h-16 relative flex flex-col items-center justify-center">
                      <div className="w-12 h-10 bg-[#34d399] rounded-xl flex items-center justify-center gap-2">
                        <div className="w-2.5 h-2.5 bg-[#064e3b] rounded-full"></div>
                        <div className="w-2.5 h-2.5 bg-[#064e3b] rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Greeting */}
                <h1 className="text-4xl font-bold text-on-surface mb-2 text-center tracking-tight">
                  Good morning, {displayName?.trim() ? displayName : "Nguyen Van A"}
                </h1>
                <p className="text-on-surface-variant text-base mb-12 text-center">
                  How can I help your health today?
                </p>

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <button onClick={() => handleSend("What to eat today?")} className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#006857] bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group text-left cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-[#2f8f7a] shrink-0 group-hover:bg-[#2f8f7a] group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[24px]">restaurant</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface text-base">What to eat today?</h3>
                      <p className="text-on-surface-variant text-sm mt-0.5">Personalized menu suggestions</p>
                    </div>
                  </button>

                  <button onClick={() => handleSend("How are my metrics?")} className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#006857] bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group text-left cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[24px]">show_chart</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface text-base">How are my metrics?</h3>
                      <p className="text-on-surface-variant text-sm mt-0.5">See heart rate & blood glucose</p>
                    </div>
                  </button>

                  <button onClick={() => handleSend("What did the doctor say?")} className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#006857] bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group text-left cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0 group-hover:bg-red-500 group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[24px]">assignment</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface text-base">What did the doctor say?</h3>
                      <p className="text-on-surface-variant text-sm mt-0.5">Review expert advice</p>
                    </div>
                  </button>

                  <button onClick={() => handleSend("Meal Recognition")} className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#006857] bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group text-left cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-[#2f8f7a] shrink-0 group-hover:bg-[#2f8f7a] group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[24px]">playlist_add_check</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface text-base">Meal Recognition</h3>
                      <p className="text-on-surface-variant text-sm mt-0.5">Quick calorie updates</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg) =>
              msg.sender === "user" ? (
                <div key={msg.id} className="flex justify-end w-full">
                  <div className="max-w-[75%] bg-primary text-on-primary rounded-2xl rounded-tr-sm p-md shadow-sm">
                    <p className="font-body text-body whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-md w-full max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-primary-container flex-shrink-0 flex items-center justify-center mt-1 border border-outline-variant/30">
                    <span className="material-symbols-outlined text-[18px] text-on-primary-container">
                      smart_toy
                    </span>
                  </div>
                  <div className="flex flex-col gap-sm w-full">
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl rounded-tl-sm p-md shadow-sm">
                      {msg.isStreaming && !msg.text && <ChatTypingDots />}

                      {msg.text && (
                        <p
                          className={`font-body text-body text-on-surface whitespace-pre-wrap ${
                            msg.mealPreview && msg.mealPreview.meals.length > 0 ? "mb-sm" : ""
                          }`}
                        >
                          {msg.text}
                          {msg.isStreaming && (
                            <span className="inline-block w-2 h-4 bg-primary/80 ml-1 animate-caret-blink rounded-xs align-middle shadow-2xs" />
                          )}
                        </p>
                      )}

                      {msg.corrected && (
                        <p className="inline-flex items-center gap-xs text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-sm py-xs mt-sm">
                          <span className="material-symbols-outlined text-[14px]">shield</span>
                          Đã điều chỉnh để đảm bảo an toàn
                        </p>
                      )}

                      {msg.mealPreview && msg.mealPreview.meals.length > 0 && (() => {
                        const totals = computeMealPreviewTotals(msg.mealPreview);
                        const isApplied = Boolean(appliedPlans[msg.mealPreview.meal_plan_id]);
                        return (
                          <div className="mt-md flex flex-col gap-md border-t border-outline-variant/50 pt-md">
                            {/* Card Header: Nutrition Totals & Badges */}
                            <div className="bg-surface-container-low border border-outline-variant/70 rounded-xl p-md flex flex-col gap-sm">
                              <div className="flex flex-wrap items-center justify-between gap-sm">
                                <div className="flex items-center gap-xs text-xs font-semibold text-on-surface">
                                  <span className="material-symbols-outlined text-primary text-[18px]">
                                    auto_awesome
                                  </span>
                                  <span>Thực đơn gợi ý từ Trợ lý AI</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-xs">
                                  {msg.mealPreview.plan_status === "pending_review" && (
                                    <span className="inline-flex items-center gap-xs px-sm py-[2px] bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] font-medium">
                                      <span className="material-symbols-outlined text-[13px]">pending</span>
                                      Chờ bác sĩ duyệt
                                    </span>
                                  )}
                                  {msg.mealPreview.plan_status === "approved" && (
                                    <span className="inline-flex items-center gap-xs px-sm py-[2px] bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-medium">
                                      <span className="material-symbols-outlined text-[13px]">verified</span>
                                      Đã duyệt
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Nutrition Summary Bar */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-xs pt-xs border-t border-outline-variant/40 text-xs">
                                <div className="flex items-center gap-xs text-on-surface-variant bg-surface-container-lowest p-xs rounded-lg border border-outline-variant/40">
                                  <span className="material-symbols-outlined text-amber-600 text-[16px]">local_fire_department</span>
                                  <span>{totals.calories > 0 ? `${totals.calories} kcal` : "Dinh dưỡng chuẩn"}</span>
                                </div>
                                <div className="flex items-center gap-xs text-on-surface-variant bg-surface-container-lowest p-xs rounded-lg border border-outline-variant/40">
                                  <span className="material-symbols-outlined text-rose-500 text-[16px]">egg_alt</span>
                                  <span>{totals.protein > 0 ? `${totals.protein}g đạm` : "Cân bằng đạm"}</span>
                                </div>
                                <div className="flex items-center gap-xs text-on-surface-variant bg-surface-container-lowest p-xs rounded-lg border border-outline-variant/40">
                                  <span className="material-symbols-outlined text-amber-700 text-[16px]">grain</span>
                                  <span>{totals.carbs > 0 ? `${totals.carbs}g bột đường` : "Tốt cho đường huyết"}</span>
                                </div>
                                <div className="flex items-center gap-xs text-on-surface-variant bg-surface-container-lowest p-xs rounded-lg border border-outline-variant/40">
                                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">opacity</span>
                                  <span>{totals.lipid > 0 ? `${totals.lipid}g chất béo` : "Chất béo lành mạnh"}</span>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap items-center gap-sm pt-xs">
                                <button
                                  type="button"
                                  disabled={isApplied}
                                  onClick={() => handleApplyMealPlan(msg.mealPreview!.meal_plan_id)}
                                  className={`inline-flex items-center gap-xs px-md py-xs rounded-lg transition-all text-xs font-semibold shadow-2xs cursor-pointer ${
                                    isApplied
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : "bg-primary hover:bg-primary/90 text-on-primary"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    {isApplied ? "check_circle" : "bookmark_add"}
                                  </span>
                                  {isApplied ? "Đã lưu & áp dụng" : "Lưu / Áp dụng thực đơn này"}
                                </button>
                                <Link
                                  href={`/patient/meals?plan_id=${msg.mealPreview.meal_plan_id}`}
                                  className="inline-flex items-center gap-xs px-md py-xs bg-surface-container-lowest border border-outline-variant hover:border-primary rounded-lg transition-colors text-on-surface-variant hover:text-primary text-xs font-medium"
                                >
                                  <span className="material-symbols-outlined text-[16px]">restaurant_menu</span>
                                  Xem chi tiết tại Thực đơn
                                </Link>
                              </div>
                            </div>

                            {/* Meal Dishes list */}
                            {msg.mealPreview.meals.map((meal) => (
                              <div key={meal.slot} className="flex flex-col gap-sm">
                                <MealSectionHeader
                                  label={meal.label}
                                  icon={MEAL_SLOT_ICONS[meal.slot] ?? "restaurant"}
                                />
                                {meal.items.length === 0 ? (
                                  <p className="text-xs text-on-surface-variant px-1">
                                    Chưa có món cho bữa này.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                                    {meal.items.map((item, idx) => (
                                      <DishCard
                                        key={`${meal.slot}-${item.name}-${idx}`}
                                        item={foodItemToDish(item)}
                                        portion={item.portion}
                                        compact
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {msg.intent === "meal_plan" && !msg.mealPreview && (
                        <Link
                          href="/patient/meals"
                          className="inline-flex items-center gap-xs px-md py-xs bg-surface-container-low border border-outline-variant rounded-lg hover:border-primary transition-colors text-on-surface-variant hover:text-primary mt-2 text-xs font-medium"
                        >
                          <span className="material-symbols-outlined text-[16px]">restaurant_menu</span>
                          Mở mục Thực đơn chính
                        </Link>
                      )}

                      {msg.intent === "food_log" && (
                        <div className="mt-md p-md bg-emerald-50/90 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                          <div className="flex items-center gap-xs text-emerald-900">
                            <span className="material-symbols-outlined text-emerald-700 text-[20px]">
                              restaurant
                            </span>
                            <span className="font-body-bold text-xs font-semibold">
                              Bạn muốn ghi nhận bữa ăn?
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-sm">
                            <button
                              type="button"
                              disabled={isFetchingLogPlan}
                              onClick={() => void handleOpenFoodLog(msg.mealPlanId)}
                              className="inline-flex items-center gap-xs px-md py-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                edit_note
                              </span>
                              {isFetchingLogPlan ? "Đang tải..." : "Ghi nhận ngay"}
                            </button>
                            <Link
                              href="/patient/meals"
                              className="inline-flex items-center gap-xs px-sm py-xs bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 transition-colors rounded-lg text-xs font-medium"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                restaurant_menu
                              </span>
                              Xem thực đơn
                            </Link>
                          </div>
                        </div>
                      )}

                      {msg.intent === "interaction_check" && (
                        <div className="mt-md p-md bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-sm text-rose-900 shadow-xs">
                          <div className="flex items-start gap-sm">
                            <span
                              className="material-symbols-outlined text-rose-600 text-[22px] shrink-0 mt-[1px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              warning
                            </span>
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs text-rose-950 flex items-center gap-xs">
                                Cảnh báo tương tác thuốc – thực phẩm
                              </span>
                              <span className="text-[11px] text-rose-800 font-normal leading-tight mt-[2px]">
                                Cần theo dõi hoặc tham khảo ý kiến bác sĩ khi dùng đồng thời.
                              </span>
                            </div>
                          </div>
                          <Link
                            href="/patient/notifications"
                            className="inline-flex items-center justify-center gap-xs px-md py-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              notifications_active
                            </span>
                            Xem danh sách cảnh báo
                          </Link>
                        </div>
                      )}

                      {msg.citations && msg.citations.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isCompactViewport()) setShowHistory(false);
                            setShowReferences(true);
                          }}
                          className="inline-flex items-center gap-xs px-sm py-xs bg-surface-container-low border border-outline-variant rounded-lg hover:border-primary transition-colors text-on-surface-variant hover:text-primary mt-2 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">description</span>
                          <span className="font-caption text-caption font-medium text-xs">
                            {msg.citations.length} nguồn tham khảo
                          </span>
                        </button>
                      )}
                    </div>

                    {(msg.intent ||
                      (msg.secondaryIntents && msg.secondaryIntents.length > 0) ||
                      msg.guardrailTriggered ||
                      (msg.thinkingSteps && msg.thinkingSteps.length > 0)) && (
                      <details
                        className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden group"
                        open={msg.isStreaming}
                      >
                        <summary className="p-sm px-md flex items-center justify-between cursor-pointer hover:bg-surface-container-high transition-colors list-none">
                          <div className="flex items-center gap-sm flex-wrap">
                            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                              psychology
                            </span>
                            <span className="font-label text-label text-on-surface-variant font-semibold text-xs">
                              Phân loại:{" "}
                              {msg.intent
                                ? INTENT_LABELS[msg.intent] ?? msg.intent
                                : "Đang xử lý…"}
                              {msg.guardrailTriggered ? " · Guardrail" : ""}
                            </span>
                            {msg.secondaryIntents && msg.secondaryIntents.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100/90 text-amber-900 border border-amber-300/70 shadow-2xs">
                                <span className="material-symbols-outlined text-[12px] text-amber-700">
                                  call_split
                                </span>
                                +{msg.secondaryIntents.length} ý định phụ
                              </span>
                            )}
                          </div>
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-open:rotate-180 transition-transform">
                            expand_more
                          </span>
                        </summary>
                        <div className="p-md pt-0 border-t border-outline-variant/50">
                          {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                            <div className="mt-sm">
                              <ChatThinkingSteps steps={msg.thinkingSteps} />
                            </div>
                          )}

                          {msg.intent && (
                            <div className="mt-sm flex flex-wrap items-center gap-xs text-xs">
                              <span className="text-on-surface-variant font-medium shrink-0">
                                Ý định chính:
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                                <span className="material-symbols-outlined text-[14px]">stars</span>
                                {INTENT_LABELS[msg.intent] ?? msg.intent}
                                <code className="text-[10px] opacity-75 font-mono">({msg.intent})</code>
                              </span>
                              {msg.guardrailTriggered && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-100 text-rose-800 border border-rose-200">
                                  Guardrail an toàn
                                </span>
                              )}
                            </div>
                          )}

                          {msg.secondaryIntents && msg.secondaryIntents.length > 0 && (
                            <div className="mt-sm p-sm bg-amber-50/70 rounded-xl border border-amber-200/80 flex flex-col gap-xs">
                              <div className="flex items-center gap-1.5 text-xs text-amber-950 font-semibold">
                                <span className="material-symbols-outlined text-[16px] text-amber-700">
                                  call_split
                                </span>
                                <span>Phát hiện ý định phụ (Câu hỏi kép):</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-xs mt-0.5">
                                {msg.secondaryIntents.map((secIntent) => (
                                  <span
                                    key={secIntent}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-amber-950 border border-amber-300 shadow-2xs"
                                  >
                                    <span className="material-symbols-outlined text-[14px] text-amber-600">
                                      label
                                    </span>
                                    {INTENT_LABELS[secIntent] ?? secIntent}
                                    <code className="text-[10px] text-amber-800 font-mono">
                                      ({secIntent})
                                    </code>
                                  </span>
                                ))}
                              </div>
                              <p className="text-[11px] text-amber-900/80 italic mt-0.5 leading-snug">
                                💡 Ý định phụ đã được ghi nhận. Bạn có thể gửi câu hỏi riêng cho ý định
                                phụ để nhận câu trả lời chi tiết hơn.
                              </p>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )
            )}

            {error && (
              <div className="mx-auto max-w-lg w-full rounded-xl border border-red-200 bg-red-50 p-md text-sm text-red-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md shadow-xs animate-fadeIn">
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-red-600 text-[20px] shrink-0">
                    error
                  </span>
                  <span>{error}</span>
                </div>
                <div className="flex items-center gap-xs shrink-0 flex-wrap">
                  {lastQuery && (
                    <button
                      type="button"
                      onClick={() => void handleSend(lastQuery)}
                      disabled={isSending}
                      className="inline-flex items-center gap-xs px-md py-xs bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      Thử lại
                    </button>
                  )}
                  {error.includes("Authorization") || error.includes("đăng nhập") ? (
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-xs px-md py-xs bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">login</span>
                      Đăng nhập ngay
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Floating scroll-to-bottom button */}
          {showScrollBottomBtn && (
            <button
              type="button"
              onClick={() => {
                isNearBottomRef.current = true;
                scrollToBottom("smooth");
              }}
              className="absolute bottom-24 right-6 z-20 bg-surface-container-lowest text-primary border border-primary/30 hover:border-primary px-3 py-1.5 rounded-full shadow-md flex items-center gap-1 text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer animate-fadeIn"
              title="Cuộn xuống tin nhắn mới nhất"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
              <span>Tin mới nhất</span>
            </button>
          )}

          <div className="w-full max-w-3xl mx-auto px-4 mt-auto z-10 sticky bottom-0 bg-[#F7F9F9]/90 backdrop-blur-sm pb-8 pt-4">
            <div className="relative flex items-center w-full bg-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.06)] rounded-full overflow-hidden border-2 border-[#006857]">
              <textarea
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                disabled={isSending}
                className="flex-1 bg-transparent py-4 pl-6 pr-16 outline-none text-on-surface text-[15px] placeholder:text-on-surface-variant/50 relative z-0 resize-none h-[56px] min-h-[56px] leading-[24px]"
                placeholder="Text VMEC-10..."
                rows={1}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending || !inputQuery.trim()}
                className="absolute right-2 w-10 h-10 bg-[#006857] text-white rounded-full flex items-center justify-center hover:bg-[#005142] transition-colors shadow-md z-10 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </div>
          </div>
        </div>

        {showReferences && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-30 lg:hidden animate-fadeIn"
              onClick={() => setShowReferences(false)}
            />
            <div className="w-[320px] max-w-[85vw] fixed lg:relative inset-y-0 right-0 lg:inset-auto flex-shrink-0 bg-surface-container-lowest border-l border-outline-variant flex flex-col h-full max-h-full overflow-hidden sticky top-0 animate-fadeIn transition-all duration-300 z-40 lg:z-20 shadow-xl lg:shadow-none">
              <div className="p-md border-b border-outline-variant/50 flex items-center justify-between shrink-0 bg-surface-container-lowest z-10">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary text-[20px]">library_books</span>
                  <h3 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                    Tài liệu tham khảo
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReferences(false)}
                  className="text-on-surface-variant hover:text-primary p-1 rounded-md hover:bg-surface-container-low transition-colors cursor-pointer"
                  title="Ẩn tham khảo"
                >
                  <span className="material-symbols-outlined text-[18px]">last_page</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-md flex flex-col gap-md bg-surface/50">
                <p className="font-caption text-caption text-on-surface-variant text-xs mb-xs shrink-0">
                  Nguồn từ câu trả lời AI gần nhất.
                </p>

                {activeCitations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-outline-variant p-md text-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-[28px]">
                      menu_book
                    </span>
                    <p className="font-caption text-caption text-on-surface-variant text-xs mt-sm">
                      Chưa có nguồn trích dẫn cho tin nhắn này.
                    </p>
                  </div>
                ) : (
                  activeCitations.map((cite, idx) => (
                    <div
                      key={`${cite}-${idx}`}
                      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-sm">
                        <div className="flex items-center gap-xs text-primary bg-primary/10 px-xs py-[2px] rounded text-[10px] font-bold">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          NGUỒN #{idx + 1}
                        </div>
                      </div>
                      <h4 className="font-body-bold text-body-bold text-on-surface mb-xs flex items-start gap-xs font-semibold text-sm">
                        <span className="material-symbols-outlined text-[18px] text-primary mt-[2px] shrink-0">
                          article
                        </span>
                        {formatCitationLabel(cite)}
                      </h4>
                      <p className="font-caption text-caption text-on-surface-variant text-xs break-all">
                        {cite}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
        {toastMessage && (
          <div className="fixed bottom-20 right-6 z-50 bg-emerald-700 text-white px-md py-sm rounded-xl shadow-lg flex items-center gap-sm animate-fadeIn text-xs font-medium">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {toastMessage}
          </div>
        )}

        <FoodLogModal
          open={logContext !== null}
          context={logContext}
          onClose={() => setLogContext(null)}
          onSaved={handleFoodLogSaved}
        />
      </div>
    </>
  );
}
