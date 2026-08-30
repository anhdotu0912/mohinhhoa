/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { ApiError, type AgentRunOutput, type MealPlanOutput } from "@/lib/types";
import { ChatThinkingSteps, ChatTypingDots, type ThinkingStep } from "@/components/patient/ChatThinkingSteps";
import { isWeeklyPlanQuery } from "@/lib/patient-chat-mock-intents";
import { usePatientPanel } from "@/components/patient-chat/PatientPanelProvider";
import {
  usePatientChatHistoryStore,
  type ChatMessage as Message,
} from "@/lib/patient-chat-history-store";

// Generative-UI Cards
import { MealSuggestionCard } from "@/components/patient-chat/cards/MealSuggestionCard";
import { WeeklyComplianceCard } from "@/components/patient-chat/cards/WeeklyComplianceCard";
import { DoctorNoteCard } from "@/components/patient-chat/cards/DoctorNoteCard";
import { WeeklyMealPlanCard } from "@/components/patient-chat/cards/WeeklyMealPlanCard";
import { FormattedMessage } from "@/components/patient/FormattedMessage";
import { AssignedDoctorStatus } from "@/components/patient/AssignedDoctorStatus";
import { CitationDetailModal } from "@/components/patient-chat/panels/CitationDetailModal";
import { APP_NAME } from "@/lib/brand";

export type { Message };

const SAMPLE_CHIPS = [
  {
    id: "weekly_meal",
    title: "Thực đơn tuần này",
    subtitle: "Xem kế hoạch dinh dưỡng 7 ngày",
    icon: "calendar_month",
    colorClass: "bg-emerald-50 text-[#006857]",
    prompt: "Xem thực đơn tuần này của tôi",
  },
  {
    id: "meal",
    title: "Hôm nay ăn gì?",
    subtitle: "Gợi ý thực đơn cá nhân hóa",
    icon: "restaurant",
    colorClass: "bg-teal-50 text-teal-700",
    prompt: "Hôm nay tôi nên ăn gì?",
  },
  {
    id: "metrics",
    title: "Chỉ số của tôi thế nào?",
    subtitle: "Cân nặng, đường huyết, huyết áp",
    icon: "monitoring",
    colorClass: "bg-blue-50 text-blue-600",
    prompt: "Chỉ số sức khỏe của tôi đang thế nào?",
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
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);

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
        <span>Nguồn trích dẫn y khoa ({citations.length})</span>
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
            <button
              key={i}
              type="button"
              onClick={() => setSelectedCitation(c)}
              className="bg-white hover:bg-emerald-50/80 border border-slate-200/90 hover:border-emerald-300 px-2.5 py-1 rounded-lg text-[11px] text-slate-700 hover:text-[#006857] font-semibold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 group/btn"
              title="Click để xem chi tiết tài liệu chuyên môn"
            >
              <span className="material-symbols-outlined text-[13px] text-emerald-600 group-hover/btn:scale-110 transition-transform">
                description
              </span>
              <span>{c.replace(/_/g, " ").replace(/\.md$/i, "")}</span>
              <span className="material-symbols-outlined text-[12px] text-slate-400 group-hover/btn:text-emerald-700">
                open_in_new
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedCitation && (
        <CitationDetailModal
          citation={selectedCitation}
          onClose={() => setSelectedCitation(null)}
        />
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
  const assignedDoctor = useAuthStore((s) => s.assignedDoctor);

  const { openPanel } = usePatientPanel();

  const sessions = usePatientChatHistoryStore((s) => s.sessions);
  const activeSessionId = usePatientChatHistoryStore((s) => s.activeSessionId);
  const isHydrated = usePatientChatHistoryStore((s) => s.isHydrated);
  const createNewSession = usePatientChatHistoryStore((s) => s.createNewSession);
  const saveActiveSessionMessages = usePatientChatHistoryStore((s) => s.saveActiveSessionMessages);
  const autoUpdateTitleIfFirstMessage = usePatientChatHistoryStore((s) => s.autoUpdateTitleIfFirstMessage);

  const hydrated = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [appliedPlans, setAppliedPlans] = useState<Record<string, boolean>>({});

  const getNextMessageId = useCallback((prefix: string) => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const rafScrollIdRef = useRef<number | null>(null);
  const prevActiveSessionIdRef = useRef<string | null>(null);
  const skipSessionSyncRef = useRef(false);
  const messagesRef = useRef(messages);
  const appliedPlansRef = useRef(appliedPlans);
  messagesRef.current = messages;
  appliedPlansRef.current = appliedPlans;

  // Keep the visible thread in sync with the selected session, including async fetches.
  useEffect(() => {
    if (!hydrated) return;

    if (skipSessionSyncRef.current) {
      prevActiveSessionIdRef.current = activeSessionId;
      return;
    }

    const prevId = prevActiveSessionIdRef.current;
    if (prevId !== activeSessionId) {
      if (prevId) {
        const pending = messagesRef.current.filter((m) => !m.isStreaming);
        if (pending.length > 0) {
          void saveActiveSessionMessages(pending, appliedPlansRef.current, prevId);
        }
      }

      prevActiveSessionIdRef.current = activeSessionId;
      const currentSession = sessions.find((s) => s.id === activeSessionId);
      if (currentSession) {
        setMessages(currentSession.messages || []);
        setAppliedPlans(currentSession.appliedPlans || {});
      } else if (!activeSessionId) {
        setMessages([]);
        setAppliedPlans({});
      }
      return;
    }

    if (isSending) return;

    const currentSession = sessions.find((s) => s.id === activeSessionId);
    if (!currentSession) return;

    setMessages((prev) => {
      if (prev.some((m) => m.isStreaming)) return prev;
      const stored = currentSession.messages || [];
      if (stored.length === 0) return prev;
      if (prev.length === 0 || stored.length > prev.length) return stored;
      return prev;
    });
    setAppliedPlans((prev) => {
      const stored = currentSession.appliedPlans || {};
      if (Object.keys(prev).length === 0 && Object.keys(stored).length > 0) {
        return stored;
      }
      return prev;
    });
  }, [activeSessionId, hydrated, sessions, isSending, saveActiveSessionMessages]);

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

  // Jitter-Free Auto-Scroll:
  // During high-frequency SSE token streaming, use requestAnimationFrame instant pinning (0 jitter).
  // When streaming ends or a new turn begins, use smooth scroll to settle naturally.
  useEffect(() => {
    if (!isNearBottomRef.current || !chatScrollRef.current) return;

    if (isSending) {
      if (rafScrollIdRef.current) cancelAnimationFrame(rafScrollIdRef.current);
      rafScrollIdRef.current = requestAnimationFrame(() => {
        if (chatScrollRef.current && isNearBottomRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      });
    } else {
      scrollToBottom("smooth");
    }

    return () => {
      if (rafScrollIdRef.current) cancelAnimationFrame(rafScrollIdRef.current);
    };
  }, [messages, isSending, scrollToBottom]);

  const handleApplyMealPlan = useCallback((planId: string) => {
    const updated = { ...appliedPlans, [planId]: true };
    setAppliedPlans(updated);
    void saveActiveSessionMessages(messages, updated, activeSessionId);
  }, [appliedPlans, messages, saveActiveSessionMessages, activeSessionId]);

  const mapAgentResponse = (
    response: AgentRunOutput,
    extras?: {
      showWeeklyPlan?: boolean;
      mealPlanWeek?: MealPlanOutput | null;
    }
  ): Omit<Message, "id" | "sender"> => ({
    text: response.message,
    intent: response.intent,
    secondaryIntents: response.secondary_intents ?? [],
    citations: response.citations ?? [],
    guardrailTriggered: response.guardrail_triggered,
    mealPlanId: response.meal_plan_id,
    mealPreview: response.meal_preview ?? null,
    weeklyCompliance: response.weekly_compliance ?? null,
    doctorNote: response.doctor_note ?? null,
    showWeeklyPlan: extras?.showWeeklyPlan ?? false,
    mealPlanWeek: extras?.mealPlanWeek ?? null,
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

    setInputQuery("");
    isNearBottomRef.current = true;

    const userMsg: Message = {
      id: getNextMessageId("user"),
      sender: "user",
      text: query,
    };

    const aiMsgId = getNextMessageId("ai");

    // Hiển thị bong bóng chat và trạng thái suy nghĩ tức thì 0ms
    const initialMessages: Message[] = [
      ...messages,
      userMsg,
      {
        id: aiMsgId,
        sender: "ai",
        text: "",
        isStreaming: true,
        thinkingSteps: [
          {
            node: "profile_loader",
            message: "Đang tải hồ sơ bệnh nhân...",
            status: "active",
          },
        ],
      },
    ];
    setMessages(initialMessages);
    setIsSending(true);

    // Đảm bảo session tồn tại mà không block render UI ban đầu
    let curSessionId = activeSessionId;
    if (!curSessionId) {
      try {
        skipSessionSyncRef.current = true;
        curSessionId = await createNewSession();
        prevActiveSessionIdRef.current = curSessionId;
      } catch {
        /* fallback */
      } finally {
        skipSessionSyncRef.current = false;
      }
    }
    if (curSessionId) {
      void autoUpdateTitleIfFirstMessage(curSessionId, query);
    }

    const stillOnSession = () =>
      usePatientChatHistoryStore.getState().activeSessionId === curSessionId;

    let streamingText = "";
    let thinkingSteps: ThinkingStep[] = [
      {
        node: "profile_loader",
        message: "Đang tải hồ sơ bệnh nhân...",
        status: "active",
      },
    ];

    const persistIfNeeded = (finalMessages: Message[]) => {
      if (curSessionId) {
        void saveActiveSessionMessages(finalMessages, undefined, curSessionId);
      }
    };
    const showIfCurrent = (next: Message[] | ((prev: Message[]) => Message[])) => {
      if (!stillOnSession()) return;
      setMessages(next);
    };

    try {
      for await (const event of api.chatStream(query)) {
        if (event.type === "status") {
          thinkingSteps = upsertThinkingStep(thinkingSteps, event.node, event.message);
          showIfCurrent((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, thinkingSteps: [...thinkingSteps] } : m
            )
          );
        } else if (event.type === "intent") {
          showIfCurrent((prev) =>
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
          showIfCurrent((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, text: streamingText } : m
            )
          );
        } else if (event.type === "correction") {
          streamingText = event.message;
          showIfCurrent((prev) =>
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
          const isMealPlanIntent = event.data.intent === "meal_plan";
          const showWeeklyPlan = isMealPlanIntent && isWeeklyPlanQuery(query);
          let mealPlanWeek: MealPlanOutput | null = null;
          if (showWeeklyPlan) {
            try {
              mealPlanWeek = await api.getMyMealPlan();
            } catch {
              mealPlanWeek = null;
            }
          }

          const finalized = mapAgentResponse(event.data, {
            showWeeklyPlan,
            mealPlanWeek,
          });
          const completedSteps = thinkingSteps.map((s) => ({
            ...s,
            status: "done" as const,
          }));
          const finalMessages: Message[] = initialMessages.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  ...finalized,
                  text: event.data.message,
                  thinkingSteps: completedSteps,
                  isStreaming: false,
                }
              : m
          );
          showIfCurrent(finalMessages);
          persistIfNeeded(finalMessages);
        } else if (event.type === "error") {
          const finalMessages: Message[] = initialMessages.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  text: event.message || "Đã xảy ra lỗi khi xử lý câu hỏi.",
                  isStreaming: false,
                }
              : m
          );
          showIfCurrent(finalMessages);
          persistIfNeeded(finalMessages);
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof ApiError
          ? err.message
          : "Không thể kết nối trợ lý AI. Vui lòng thử lại sau.";
      const finalMessages: Message[] = initialMessages.map((m) =>
        m.id === aiMsgId
          ? {
              ...m,
              text: errorMsg,
              isStreaming: false,
            }
          : m
      );
      showIfCurrent(finalMessages);
      persistIfNeeded(finalMessages);
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

  if (!hydrated || !isHydrated) return null;

  return (
    <div className="flex-1 w-full h-full min-h-0 flex flex-col relative overflow-hidden bg-[#f8fafc]">
      {/* Messages Scroll Area - Full width scroll container so scrollbar is at the natural right edge */}
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        className="w-full flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar"
      >
        {/* Centered Chat Stream Column */}
        <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 md:px-8 pt-3 sm:pt-4 pb-28 sm:pb-32 flex flex-col gap-5 sm:gap-6">
          {/* Welcome State when no messages */}
          {!hasConversation && (
            <div className="flex flex-col items-center text-center space-y-6 w-full my-auto animate-in fade-in duration-300 max-w-2xl mx-auto pt-6">
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
                {role === "patient" ? (
                  <div className="pt-1">
                    <AssignedDoctorStatus doctor={assignedDoctor} />
                  </div>
                ) : null}
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
                    className="bg-white/90 backdrop-blur-md p-3.5 rounded-xl flex items-center gap-3 hover:bg-white hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 group text-left border border-slate-200/80 shadow-2xs cursor-pointer"
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

          {/* Messages List with smooth transition */}
          {hasConversation && (
            <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
              {messages.map((msg) =>
                msg.sender === "user" ? (
                  <div key={msg.id} className="flex justify-end w-full animate-in fade-in slide-in-from-bottom-1 duration-200">
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
                        <ChatThinkingSteps
                          steps={msg.thinkingSteps}
                          isStreaming={msg.isStreaming}
                        />
                      )}

                      {/* Typing indicator */}
                      {msg.isStreaming && !msg.text && (!msg.thinkingSteps || msg.thinkingSteps.length === 0) && (
                        <div className="py-0.5">
                          <ChatTypingDots />
                        </div>
                      )}

                      {/* AI Message Text */}
                      {msg.text && (
                        <FormattedMessage
                          text={msg.text}
                          isStreaming={msg.isStreaming}
                        />
                      )}

                      {/* Safety Correction Badge */}
                      {msg.corrected && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-amber-900 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2.5 py-1 w-fit shadow-2xs mt-1 animate-in fade-in duration-200">
                          <span className="material-symbols-outlined text-[15px] text-amber-600 shrink-0">shield</span>
                          <span>Đã điều chỉnh theo hướng dẫn an toàn y khoa (HITL)</span>
                        </div>
                      )}

                      {/* Sub-Cards & Citations: CHỈ hiển thị sau khi text AI đã chạy xong hoàn toàn, từ từ trượt lên êm ái */}
                      {!msg.isStreaming && (
                        <div className="flex flex-col gap-3 animate-card-reveal">
                          {msg.intent === "meal_plan" && !msg.showWeeklyPlan && (
                            <MealSuggestionCard preview={msg.mealPreview ?? null} />
                          )}

                          {msg.showWeeklyPlan && (
                            <WeeklyMealPlanCard plan={msg.mealPlanWeek} />
                          )}
                          {msg.weeklyCompliance && (
                            <WeeklyComplianceCard data={msg.weeklyCompliance} />
                          )}
                          {msg.doctorNote && (
                            <DoctorNoteCard data={msg.doctorNote} />
                          )}

                          {/* Citations (Gemini Dropdown Accordion) */}
                          {msg.citations && msg.citations.length > 0 && (
                            <CitationsAccordion citations={msg.citations} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
          {/* Bottom clearance cushion */}
          <div className="h-4 shrink-0" />
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-4 md:p-6 pb-2.5 sm:pb-3 md:pb-4 z-30 pointer-events-none flex flex-col items-center justify-center bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/95 to-transparent pt-6 sm:pt-8">
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
            placeholder={`Hỏi trợ lý ${APP_NAME} về thực đơn, dinh dưỡng, tương tác thuốc...`}
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

        {/* Medical AI Disclaimer */}
        <p className="text-[10.5px] sm:text-xs text-slate-400 text-center mt-1.5 sm:mt-2 px-3 font-medium pointer-events-auto leading-tight select-none">
          Thông tin từ trợ lý AI chỉ mang tính tham khảo dinh dưỡng, không thay thế cho chẩn đoán và chỉ định trực tiếp từ bác sĩ điều trị.
        </p>
      </div>
    </div>
  );
}
