/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { TopBar } from "@/components/shared/TopBar";
import {
  ChatThinkingSteps,
  ChatTypingDots,
  type ThinkingStep,
} from "@/components/patient/ChatThinkingSteps";
import { DishCard, MealSectionHeader } from "@/components/patient/PatientMealPlanUI";
import { api } from "@/lib/api";
import { foodItemToDish } from "@/lib/meal-plan-mappers";
import { ApiError, type AgentRunOutput, type MealPreviewOut } from "@/lib/types";

interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  intent?: string;
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

export default function PatientAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const latestAiMessage = useMemo(
    () => [...messages].reverse().find((msg) => msg.sender === "ai"),
    [messages]
  );

  const activeCitations = latestAiMessage?.citations ?? [];
  const hasConversation = messages.length > 0;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, scrollToBottom]);

  const mapAgentResponse = (response: AgentRunOutput): Omit<Message, "id" | "sender"> => ({
    text: response.message,
    intent: response.intent,
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
              m.id === aiMsgId ? { ...m, intent: event.intent } : m
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
      <TopBar
        title="Trợ lý AI"
        rightSlot={
          <span className="px-sm py-[2px] rounded-full bg-primary/10 text-primary font-label text-xs border border-primary/20 flex items-center gap-xs">
            <span
              className={`w-2 h-2 rounded-full bg-primary ${
                isSending ? "animate-pulse" : ""
              }`}
            />
            {isSending ? "Đang trả lời…" : "Đang hoạt động"}
          </span>
        }
      />
      {(showHistory || showReferences) && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-on-surface/35 lg:hidden"
          onClick={() => {
            setShowHistory(false);
            setShowReferences(false);
          }}
          aria-label="Đóng panel"
        />
      )}

      <div className="relative flex-1 flex items-start w-full bg-background">
        {showHistory && (
          <aside className="flex flex-col bg-surface-container-lowest border-r border-outline-variant max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:h-dvh max-lg:w-[min(280px,88vw)] max-lg:shadow-xl lg:sticky lg:top-16 lg:z-20 lg:h-[calc(100vh-4rem)] lg:w-[240px] lg:shrink-0 lg:self-start">
            <div className="p-md flex items-center justify-between border-b border-outline-variant/40 shrink-0">
              <span className="font-h2 text-h2 text-on-surface font-semibold text-sm">
                Phiên chat
              </span>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-md hover:bg-surface-container-low transition-colors"
                title="Ẩn lịch sử"
              >
                <span className="material-symbols-outlined text-[18px]">first_page</span>
              </button>
            </div>
            <div className="p-md pt-xs shrink-0">
              <button
                type="button"
                onClick={handleNewConversation}
                className="w-full bg-surface-container-lowest border border-primary text-primary font-body-bold rounded-lg py-sm px-md flex items-center justify-center gap-sm hover:bg-surface-container-low transition-colors shadow-xs text-xs"
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
          </aside>
        )}

        <div className="flex-1 min-w-0 bg-background flex flex-col min-h-[calc(100vh-4rem)] relative">
          <div className="sticky top-16 z-30 bg-surface-container-lowest/92 backdrop-blur-md border-b border-outline-variant/60 px-md py-xs flex justify-between items-center shadow-[0_1px_0_rgba(18,28,42,0.04)]">
            <button
              type="button"
              onClick={toggleHistory}
              aria-expanded={showHistory}
              className={`flex items-center gap-1.5 px-sm py-1 rounded-md text-xs font-medium transition-all ${
                showHistory
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low border border-outline-variant"
              }`}
              title={showHistory ? "Ẩn lịch sử trò chuyện" : "Hiện lịch sử trò chuyện"}
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span>{showHistory ? "Ẩn lịch sử" : "Hiện lịch sử"}</span>
            </button>

            <div className="text-xs text-on-surface-variant font-medium hidden sm:block">
              Phân tích y khoa & Tư vấn Dinh dưỡng Cá nhân
            </div>

            <button
              type="button"
              onClick={toggleReferences}
              aria-expanded={showReferences}
              className={`flex items-center gap-1.5 px-sm py-1 rounded-md text-xs font-medium transition-all ${
                showReferences
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low border border-outline-variant"
              }`}
              title={showReferences ? "Ẩn tài liệu tham khảo" : "Hiện tài liệu tham khảo"}
            >
              <span className="material-symbols-outlined text-[16px]">library_books</span>
              <span>{showReferences ? "Ẩn tham khảo" : "Hiện tham khảo"}</span>
              {!showReferences && activeCitations.length > 0 ? (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold leading-none flex items-center justify-center">
                  {activeCitations.length}
                </span>
              ) : null}
            </button>
          </div>

          <div className={`flex-1 p-lg flex flex-col gap-xl ${hasConversation ? "" : "justify-center"}`}>
            {!hasConversation && (
              <div className="flex flex-col items-center justify-center mt-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center mb-md shadow-sm border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[32px] text-on-primary-container">
                    smart_toy
                  </span>
                </div>
                <h3 className="font-h2 text-h2 text-on-surface mb-sm font-bold text-xl">
                  Xin chào, tôi có thể giúp gì cho bạn?
                </h3>
                <p className="font-body text-body text-on-surface-variant text-center max-w-md text-sm">
                  Tôi là Trợ lý AI NutriAI — hỗ trợ lập thực đơn, kiểm tra tương tác thuốc–thực
                  phẩm và trả lời câu hỏi dinh dưỡng có nguồn trích dẫn.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-sm mt-lg w-full max-w-2xl">
                  {SAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q.text}
                      type="button"
                      disabled={isSending}
                      onClick={() => void handleSend(q.text)}
                      className="p-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-left hover:border-primary hover:bg-surface-container-low transition-colors shadow-sm flex items-start gap-sm cursor-pointer disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-primary mt-[2px] text-[18px]">
                        {q.icon}
                      </span>
                      <span className="font-body text-body text-on-surface text-sm">{q.text}</span>
                    </button>
                  ))}
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
                            <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                          )}
                        </p>
                      )}

                      {msg.corrected && (
                        <p className="inline-flex items-center gap-xs text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-sm py-xs mt-sm">
                          <span className="material-symbols-outlined text-[14px]">shield</span>
                          Đã điều chỉnh để đảm bảo an toàn
                        </p>
                      )}

                      {msg.mealPreview && msg.mealPreview.meals.length > 0 && (
                        <div className="mt-md flex flex-col gap-md border-t border-outline-variant/50 pt-md">
                          <div className="flex flex-wrap items-center gap-sm">
                            {msg.mealPreview.plan_status === "pending_review" && (
                              <span className="inline-flex items-center gap-xs px-sm py-xs bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-medium">
                                <span className="material-symbols-outlined text-[14px]">pending</span>
                                Chờ bác sĩ duyệt
                              </span>
                            )}
                            {msg.mealPreview.plan_status === "approved" && (
                              <span className="inline-flex items-center gap-xs px-sm py-xs bg-green-50 border border-green-200 rounded-lg text-green-800 text-xs font-medium">
                                <span className="material-symbols-outlined text-[14px]">verified</span>
                                Đã duyệt
                              </span>
                            )}
                            <Link
                              href="/patient/meals"
                              className="inline-flex items-center gap-xs px-sm py-xs bg-surface-container-low border border-outline-variant rounded-lg hover:border-primary transition-colors text-on-surface-variant hover:text-primary text-xs font-medium"
                            >
                              <span className="material-symbols-outlined text-[14px]">restaurant_menu</span>
                              Xem đầy đủ
                            </Link>
                          </div>

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
                      )}

                      {msg.intent === "meal_plan" && !msg.mealPreview && (
                        <Link
                          href="/patient/meals"
                          className="inline-flex items-center gap-xs px-sm py-xs bg-surface-container-low border border-outline-variant rounded-lg hover:border-primary transition-colors text-on-surface-variant hover:text-primary mt-2 text-xs font-medium"
                        >
                          <span className="material-symbols-outlined text-[14px]">restaurant_menu</span>
                          Mở mục Thực đơn
                        </Link>
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
                      msg.guardrailTriggered ||
                      (msg.thinkingSteps && msg.thinkingSteps.length > 0)) && (
                      <details
                        className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden group"
                        open={msg.isStreaming}
                      >
                        <summary className="p-sm px-md flex items-center justify-between cursor-pointer hover:bg-surface-container-high transition-colors list-none">
                          <div className="flex items-center gap-sm">
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
                            <p className="font-caption text-caption text-on-surface-variant text-xs mt-sm">
                              Intent: <code>{msg.intent}</code>
                              {msg.guardrailTriggered
                                ? " — hệ thống đã áp dụng guardrail an toàn lâm sàng."
                                : ""}
                            </p>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )
            )}

            {error && (
              <div className="mx-auto max-w-lg w-full rounded-lg border border-red-200 bg-red-50 px-md py-sm text-sm text-red-800">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="sticky bottom-0 z-30 p-md bg-background/95 backdrop-blur-md border-t border-outline-variant shadow-[0_-8px_24px_rgba(18,28,42,0.05)]">
            <div className="relative bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all flex items-end p-xs">
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
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none font-body text-body text-on-surface p-sm min-h-[40px] max-h-[120px] focus:outline-none disabled:opacity-60"
                placeholder="Nhập câu hỏi của bạn..."
                rows={1}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending || !inputQuery.trim()}
                className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center hover:bg-primary-container transition-colors shrink-0 mb-[2px] mr-[2px] cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </div>
          </div>
        </div>

        {showReferences && (
          <aside className="flex flex-col bg-surface-container-lowest border-l border-outline-variant max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:h-dvh max-lg:w-[min(320px,88vw)] max-lg:shadow-xl lg:sticky lg:top-16 lg:z-20 lg:h-[calc(100vh-4rem)] lg:w-[320px] lg:shrink-0 lg:self-start">
            <div className="p-md border-b border-outline-variant/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary text-[20px]">library_books</span>
                <h3 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                  Tài liệu tham khảo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReferences(false)}
                className="text-on-surface-variant hover:text-primary p-1 rounded-md hover:bg-surface-container-low transition-colors"
                title="Ẩn tham khảo"
              >
                <span className="material-symbols-outlined text-[18px]">last_page</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-md flex flex-col gap-md bg-surface/50">
              <p className="font-caption text-caption text-on-surface-variant text-xs mb-xs">
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
          </aside>
        )}
      </div>
    </>
  );
}
