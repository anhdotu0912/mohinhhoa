/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { ApiError, type AgentRunOutput, type MealPreviewOut } from "@/lib/types";
import { ChatThinkingSteps, ChatTypingDots, type ThinkingStep } from "@/components/patient/ChatThinkingSteps";
import { detectMockCardIntent, type MockCardIntent } from "@/lib/patient-chat-mock-intents";
import { usePatientPanel } from "@/components/patient-chat/PatientPanelProvider";
import {
  usePatientChatHistoryStore,
  type ChatMessage as Message,
} from "@/lib/patient-chat-history-store";

// Generative-UI Cards
import { MealSuggestionCard } from "@/components/patient-chat/cards/MealSuggestionCard";
import { IngredientMapCard } from "@/components/patient-chat/cards/IngredientMapCard";
import { WeeklyComplianceCard } from "@/components/patient-chat/cards/WeeklyComplianceCard";
import { DoctorNoteCard } from "@/components/patient-chat/cards/DoctorNoteCard";

export type { Message };

const SAMPLE_CHIPS = [
  {
    id: "meal",
    title: "Hôm nay ăn gì?",
    subtitle: "Gợi ý thực đơn cá nhân hóa",
    icon: "restaurant",
    colorClass: "bg-emerald-50 text-[#006857]",
    prompt: "Hôm nay tôi nên ăn gì?",
  },
  {
    id: "metrics",
    title: "Chỉ số của tôi thế nào?",
    subtitle: "Xem nhịp tim & đường huyết",
    icon: "monitoring",
    colorClass: "bg-blue-50 text-blue-600",
    prompt: "Tuân thủ của tôi tuần này thế nào?",
  },
  {
    id: "doctor",
    title: "Bác sĩ dặn gì?",
    subtitle: "Xem lại lời khuyên chuyên môn",
    icon: "clinical_notes",
    colorClass: "bg-amber-50 text-amber-600",
    prompt: "Bác sĩ có dặn gì tôi không?",
  },
  {
    id: "foodlog",
    title: "Ghi nhận bữa ăn",
    subtitle: "Cập nhật calo nhanh chóng",
    icon: "edit_note",
    colorClass: "bg-emerald-50 text-[#006857]",
    prompt: "",
    action: "open_meal_panel",
  },
];

const BOT_VIDEO_SRC = "/video/video_chatbot.mp4";

function CitationsAccordion({ citations }: { citations: string[] }) {
  const [open, setOpen] = useState(false);
  if (!citations || citations.length === 0) return null;

  return (
    <div className="pt-1.5 text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-xs font-medium py-1 px-2 rounded-md hover:bg-slate-200/50 transition-colors cursor-pointer group"
      >
        <span className="material-symbols-outlined text-[15px] text-emerald-600 group-hover:scale-110 transition-transform">
          menu_book
        </span>
        <span>Nguồn trích dẫn ({citations.length})</span>
        <span
          className={`material-symbols-outlined text-[15px] text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 pl-1 animate-in fade-in duration-200">
          {citations.map((c, i) => (
            <span
              key={i}
              className="bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 px-2.5 py-0.5 rounded-md text-[11px] text-slate-700 font-medium transition-colors shadow-2xs"
            >
              {c.replace(/_/g, " ").replace(/\.md$/i, "")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const emptySubscribe = () => () => {};

export default function PatientChatHomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const displayName = useAuthStore((s) => s.displayName);

  const { openPanel } = usePatientPanel();

  const sessions = usePatientChatHistoryStore((s) => s.sessions);
  const activeSessionId = usePatientChatHistoryStore((s) => s.activeSessionId);
  const createNewSession = usePatientChatHistoryStore((s) => s.createNewSession);
  const saveActiveSessionMessages = usePatientChatHistoryStore((s) => s.saveActiveSessionMessages);
  const autoUpdateTitleIfFirstMessage = usePatientChatHistoryStore((s) => s.autoUpdateTitleIfFirstMessage);

  const hydrated = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [appliedPlans, setAppliedPlans] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messageIdCounter = useRef(0);
  const getNextMessageId = useCallback((prefix: string) => {
    messageIdCounter.current += 1;
    return `${prefix}-${messageIdCounter.current}`;
  }, []);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Synchronize active session messages into local component state
  useEffect(() => {
    if (!hydrated) return;
    const currentSession = sessions.find((s) => s.id === activeSessionId);
    if (currentSession) {
      setMessages(currentSession.messages || []);
      setAppliedPlans(currentSession.appliedPlans || {});
    } else if (!activeSessionId) {
      setMessages([]);
      setAppliedPlans({});
    }
  }, [activeSessionId, hydrated, sessions]);

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

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages, scrollToBottom]);

  const handleApplyMealPlan = useCallback((planId: string) => {
    setAppliedPlans((prev) => {
      const updated = { ...prev, [planId]: true };
      saveActiveSessionMessages(messages, updated);
      return updated;
    });
    setToastMessage("Đã lưu và áp dụng thực đơn!");
    setTimeout(() => setToastMessage(null), 4000);
  }, [messages, saveActiveSessionMessages]);

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

    let curSessionId = activeSessionId;
    if (!curSessionId) {
      curSessionId = createNewSession();
    }
    autoUpdateTitleIfFirstMessage(curSessionId, query);

    setInputQuery("");

    const userMsg: Message = {
      id: getNextMessageId("user"),
      sender: "user",
      text: query,
    };

    const aiMsgId = getNextMessageId("ai");
    const mockIntent = detectMockCardIntent(query);

    // Xử lý mock card intent (Giai đoạn 1)
    if (mockIntent) {
      const initialMessages: Message[] = [
        ...messages,
        userMsg,
        {
          id: aiMsgId,
          sender: "ai",
          text: "",
          isStreaming: true,
          thinkingSteps: [],
        },
      ];
      setMessages(initialMessages);
      saveActiveSessionMessages(initialMessages);
      setIsSending(true);

      setTimeout(() => {
        let aiText = "";
        if (mockIntent === "grocery_list") {
          aiText = "Dưới đây là các địa điểm mua sắm nguyên liệu tươi sạch gần vị trí của bạn tại Quận 3:";
        } else if (mockIntent === "weekly_compliance") {
          aiText = "Bạn đang duy trì phong độ rất tốt với tỉ lệ tuân thủ đạt 92% tuần này.";
        } else if (mockIntent === "doctor_note") {
          aiText = "Bác sĩ Minh Nguyễn đã để lại một lời nhắc quan trọng dành cho bạn:";
        }

        const finalMessages: Message[] = initialMessages.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                text: aiText,
                isStreaming: false,
                mockCard: mockIntent,
              }
            : m
        );
        setMessages(finalMessages);
        saveActiveSessionMessages(finalMessages);
        setIsSending(false);
      }, 400);

      return;
    }

    // Luồng stream thật từ Backend (meal_plan, interaction_check, food_log, rag_qa)
    const initialMessages: Message[] = [
      ...messages,
      userMsg,
      {
        id: aiMsgId,
        sender: "ai",
        text: "",
        isStreaming: true,
        thinkingSteps: [],
      },
    ];
    setMessages(initialMessages);
    saveActiveSessionMessages(initialMessages);
    setIsSending(true);

    let streamingText = "";
    let thinkingSteps: ThinkingStep[] = [];

    try {
      for await (const event of api.chatStream(query)) {
        if (event.type === "status") {
          thinkingSteps = upsertThinkingStep(thinkingSteps, event.node, event.message);
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === aiMsgId ? { ...m, thinkingSteps: [...thinkingSteps] } : m
            );
            saveActiveSessionMessages(next);
            return next;
          });
        } else if (event.type === "intent") {
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    intent: event.intent,
                    secondaryIntents: event.secondary_intents ?? [],
                  }
                : m
            );
            saveActiveSessionMessages(next);
            return next;
          });
        } else if (event.type === "token") {
          streamingText += event.content;
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === aiMsgId ? { ...m, text: streamingText } : m
            );
            return next;
          });
        } else if (event.type === "correction") {
          streamingText = event.message;
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    text: event.message,
                    corrected: true,
                    correctionReason: event.reason,
                  }
                : m
            );
            saveActiveSessionMessages(next);
            return next;
          });
        } else if (event.type === "done") {
          const finalized = mapAgentResponse(event.data);
          const completedSteps = thinkingSteps.map((s) => ({
            ...s,
            status: "done" as const,
          }));
          setMessages((prev) => {
            const next = prev.map((m) =>
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
            );
            saveActiveSessionMessages(next);
            return next;
          });
        } else if (event.type === "error") {
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    text: event.message || "Đã xảy ra lỗi khi xử lý câu hỏi.",
                    isStreaming: false,
                  }
                : m
            );
            saveActiveSessionMessages(next);
            return next;
          });
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof ApiError
          ? err.message
          : "Không thể kết nối trợ lý AI. Vui lòng thử lại sau.";
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === aiMsgId ? { ...m, text: errorMsg, isStreaming: false } : m
        );
        saveActiveSessionMessages(next);
        return next;
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleChipClick = (chip: (typeof SAMPLE_CHIPS)[0]) => {
    if (chip.action === "open_meal_panel") {
      openPanel("menu");
      return;
    }
    if (chip.prompt) {
      void handleSend(chip.prompt);
    }
  };

  const hasConversation = messages.length > 0;
  const userName = displayName?.trim() ? displayName : "Bạn";

  const getGreeting = (name: string) => {
    const hour = new Date().getHours();
    if (hour < 12) return `Chào buổi sáng, ${name}`;
    if (hour < 18) return `Chào buổi chiều, ${name}`;
    return `Chào buổi tối, ${name}`;
  };

  if (!hydrated) return null;

  return (
    <div className="flex-1 w-full h-full min-h-0 flex flex-col relative overflow-hidden bg-[#f8fafc]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#006857] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 border border-emerald-400/40">
          <span className="material-symbols-outlined text-[18px] text-emerald-300">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Messages Scroll Area - Full width scroll container so scrollbar is at the natural right edge */}
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        className="w-full flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar"
      >
        {/* Centered Chat Stream Column */}
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 md:px-8 pt-4 pb-36 flex flex-col gap-6">
          {/* Welcome State when no messages */}
          {!hasConversation && (
            <div className="flex flex-col items-center text-center space-y-6 w-full my-auto animate-in fade-in duration-500 max-w-2xl mx-auto pt-6">
              {/* Robot Avatar with Glow */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full blur-md opacity-30 group-hover:opacity-50 transition-opacity" />
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white shadow-xl relative bg-slate-900">
                  <video
                    src={BOT_VIDEO_SRC}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Greeting */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                  <span className="material-symbols-outlined text-[15px] text-[#006857]">verified_user</span>
                  <span>Trợ lý Dinh dưỡng Lâm sàng Cá nhân hoá</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {getGreeting(userName)}
                </h1>
                <p className="text-sm md:text-base text-slate-600 max-w-md mx-auto leading-relaxed">
                  Tôi có thể hỗ trợ gì cho bữa ăn &amp; kế hoạch sức khỏe của bạn hôm nay?
                </p>
              </div>

              {/* Recommendation Chips Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full mt-2">
                {SAMPLE_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="bg-white/90 backdrop-blur-md p-3.5 rounded-xl flex items-center gap-3 hover:bg-white hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group text-left border border-slate-200/80 shadow-2xs cursor-pointer active:scale-[0.99]"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${chip.colorClass} group-hover:scale-105 transition-transform shadow-2xs`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {chip.icon}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-[#006857] transition-colors truncate">
                        {chip.title}
                      </span>
                      <span className="text-xs text-slate-500 truncate">
                        {chip.subtitle}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-slate-400 ml-auto group-hover:text-[#006857] group-hover:translate-x-0.5 transition-all">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages List */}
          {hasConversation &&
            messages.map((msg) =>
              msg.sender === "user" ? (
                <div key={msg.id} className="flex justify-end w-full animate-in fade-in duration-200">
                  <div className="max-w-[80%] sm:max-w-[68%] md:max-w-[62%] ml-auto bg-[#006857] text-white rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-2xs break-words">
                    <p className="text-sm md:text-[15px] whitespace-pre-wrap leading-relaxed break-words">
                      {msg.text}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex items-start gap-3 md:gap-3.5 w-full animate-in fade-in duration-200">
                  {/* Bot Video Avatar */}
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden border border-emerald-500/30 shrink-0 mt-0.5 bg-slate-900 shadow-2xs">
                    <video
                      src={BOT_VIDEO_SRC}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Bot Content (Flat, clean, content-first Gemini style) */}
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    {/* Thinking Steps (Gemini Minimalist Reasoning Trigger) */}
                    {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                      <ChatThinkingSteps steps={msg.thinkingSteps} />
                    )}

                    {/* Typing indicator */}
                    {msg.isStreaming && !msg.text && (
                      <div className="py-0.5">
                        <ChatTypingDots />
                      </div>
                    )}

                    {/* AI Message Text */}
                    {msg.text && (
                      <div className="text-[15px] leading-relaxed text-slate-800 break-words font-normal">
                        {msg.text}
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-4 bg-[#006857] ml-1 animate-pulse rounded-xs align-middle" />
                        )}
                      </div>
                    )}

                    {/* Safety Correction Badge */}
                    {msg.corrected && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-amber-900 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2.5 py-1 w-fit shadow-2xs mt-1">
                        <span className="material-symbols-outlined text-[15px] text-amber-600 shrink-0">shield</span>
                        <span>Đã điều chỉnh theo hướng dẫn an toàn y khoa (HITL)</span>
                      </div>
                    )}

                    {/* Sub-Cards (Clean, independent with generous breathing room) */}
                    {msg.mealPreview && msg.mealPreview.meals.length > 0 && (
                      <MealSuggestionCard
                        preview={msg.mealPreview}
                        onApplyPlan={handleApplyMealPlan}
                        isApplied={Boolean(appliedPlans[msg.mealPreview.meal_plan_id])}
                      />
                    )}

                    {msg.mockCard === "grocery_list" && <IngredientMapCard />}
                    {msg.mockCard === "weekly_compliance" && <WeeklyComplianceCard />}
                    {msg.mockCard === "doctor_note" && <DoctorNoteCard />}

                    {/* Citations (Gemini Dropdown Accordion) */}
                    {msg.citations && msg.citations.length > 0 && (
                      <CitationsAccordion citations={msg.citations} />
                    )}
                  </div>
                </div>
              )
            )}
          {/* Bottom clearance cushion */}
          <div className="h-4 shrink-0" />
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 md:p-6 pb-16 md:pb-6 z-30 pointer-events-none flex justify-center bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/95 to-transparent pt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="w-full max-w-3xl bg-white/95 backdrop-blur-2xl rounded-full flex items-center p-1.5 shadow-[0_12px_36px_rgba(0,104,87,0.12)] pointer-events-auto border border-slate-200/90 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/15 transition-all duration-300"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Hỏi trợ lý VMEC-10 về thực đơn, dinh dưỡng, tương tác thuốc..."
            disabled={isSending}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-[15px] text-slate-900 placeholder:text-slate-400 py-2.5 px-4 outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputQuery.trim() || isSending}
            className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-tr from-[#006857] to-emerald-600 hover:from-[#005245] hover:to-emerald-700 text-white flex items-center justify-center shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 shrink-0"
            title="Gửi tin nhắn"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
