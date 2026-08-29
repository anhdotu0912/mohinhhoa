"use client";

import React, { useState, useEffect, useRef } from "react";

interface Scenario {
  id: "meal" | "drug" | "compliance" | "doctor";
  chipLabel: string;
  chipIcon: string;
  userPrompt: string;
  thinking: string;
  aiMessage: string;
  cardType: "meal" | "drug" | "compliance" | "doctor";
}

const SCENARIOS: Scenario[] = [
  {
    id: "meal",
    chipLabel: "Tư vấn món ăn",
    chipIcon: "restaurant",
    userPrompt: "Trưa nay tôi định ăn bún chả hoặc cơm tấm. Nhờ bác sĩ và AI tư vấn món an toàn cho đường huyết?",
    thinking: "Đối soát chỉ số GI/GL bún tươi vs cơm tấm sườn • Khẩu phần mục tiêu: 450-520 kcal",
    aiMessage: "Chào bác A, bác nên **ưu tiên Bún chả nướng điều chỉnh** thay vì Cơm tấm sườn bì (do cơm tấm có GI cao ~80 dễ làm tăng vọt đường huyết). Bác nên giảm 1/2 lượng bún và ăn kèm nhiều rau sống trước.",
    cardType: "meal",
  },
  {
    id: "drug",
    chipLabel: "Tương tác thuốc",
    chipIcon: "medication",
    userPrompt: "Tôi đang uống Amlodipine 5mg và Metformin 500mg thì cần kiêng thực phẩm nào?",
    thinking: "Tra cứu Dược thư Quốc gia & FDA • Kiểm tra chuyển hóa enzym gan CYP3A4",
    aiMessage: "Bác cần đặc biệt lưu ý: **Tuyệt đối không uống nước ép bưởi chùm (Grapefruit)** trong vòng 4 giờ uống Amlodipine vì gây tụt huyết áp đột ngột, và **tránh hoàn toàn rượu bia** khi dùng Metformin.",
    cardType: "drug",
  },
  {
    id: "compliance",
    chipLabel: "Biểu đồ tuân thủ",
    chipIcon: "monitoring",
    userPrompt: "Xem báo cáo tuân thủ dinh dưỡng tuần này và biến thiên đường huyết của tôi",
    thinking: "Tổng hợp 21/21 bữa ăn từ Food Log 3-slot • So khớp mục tiêu năng lượng 1.650 kcal",
    aiMessage: "Chúc mừng bác! Tỷ lệ tuân thủ thực đơn tuần này của bác đạt **85%** (vượt ngưỡng mục tiêu 80% do BS.CKII Nguyễn Thu Trang đề ra). Đường huyết lúc đói duy trì ổn định ở mức **6.5 mmol/L**.",
    cardType: "compliance",
  },
  {
    id: "doctor",
    chipLabel: "Lời dặn bác sĩ",
    chipIcon: "clinical_notes",
    userPrompt: "Bác sĩ phụ trách có dặn dò gì mới cho chế độ ăn của tôi không?",
    thinking: "Truy xuất y lệnh mới nhất từ Hồ sơ bệnh án • Khoa Nội tiết - Dinh dưỡng",
    aiMessage: "Bác sĩ phụ trách **BS.CKII Nguyễn Thu Trang** vừa gửi lời dặn dò chuyên môn mới vào sáng nay:",
    cardType: "doctor",
  },
];

export function ClinicalChatLoopPreview() {
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
  const [phase, setPhase] = useState<"user" | "thinking" | "streaming" | "card_reveal">("user");
  const [streamedWordsCount, setStreamedWordsCount] = useState(0);
  const [showCard, setShowCard] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[activeScenarioIdx];

  // Auto-scroll to bottom whenever phase, scenario, or stream progresses
  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [phase, streamedWordsCount, showCard, activeScenarioIdx]);

  // Main Scenario Lifecycle Cycle
  useEffect(() => {
    // Step 1: User message appears
    setPhase("user");
    setStreamedWordsCount(0);
    setShowCard(false);

    // Step 2: Show thinking box after 650ms
    const t1 = setTimeout(() => {
      setPhase("thinking");

      // Step 3: Start streaming AI text after 1200ms
      const t2 = setTimeout(() => {
        setPhase("streaming");
      }, 1200);

      return () => clearTimeout(t2);
    }, 650);

    return () => {
      clearTimeout(t1);
    };
  }, [activeScenarioIdx]);

  // Streaming Text Word-by-Word Animation
  useEffect(() => {
    if (phase !== "streaming") return;

    const words = scenario.aiMessage.split(" ");
    let currentWord = 0;

    const interval = setInterval(() => {
      currentWord += 1;
      setStreamedWordsCount(currentWord);

      // When text generation completes
      if (currentWord >= words.length) {
        clearInterval(interval);
        setPhase("card_reveal");

        // Reveal Generative UI Card after a brief natural pause (300ms)
        const tCard = setTimeout(() => {
          setShowCard(true);

          // Hold complete response + card for 4.2 seconds before advancing
          const tNext = setTimeout(() => {
            setActiveScenarioIdx((prev) => (prev + 1) % SCENARIOS.length);
          }, 4200);

          return () => clearTimeout(tNext);
        }, 300);

        return () => clearTimeout(tCard);
      }
    }, 38);

    return () => clearInterval(interval);
  }, [phase, scenario.aiMessage]);

  const handleManualSelect = (idx: number) => {
    setActiveScenarioIdx(idx);
  };

  // Helper to format streaming text with bold markdown safely
  const renderStreamingText = () => {
    const words = scenario.aiMessage.split(" ");
    const isCurrentlyStreaming = phase === "streaming" && streamedWordsCount < words.length;
    let raw = isCurrentlyStreaming ? words.slice(0, streamedWordsCount).join(" ") : scenario.aiMessage;

    // Fix unmatched bold asterisks during streaming
    const asteriskCount = (raw.match(/\*\*/g) || []).length;
    if (asteriskCount % 2 !== 0) {
      raw += "**";
    }

    return (
      <>
        <span
          dangerouslySetInnerHTML={{
            __html: raw.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
          }}
        />
        {isCurrentlyStreaming && (
          <span className="inline-block w-1.5 h-3.5 bg-teal-600 animate-pulse ml-0.5 align-middle rounded-xs" />
        )}
      </>
    );
  };

  return (
    <div className="w-full max-w-[480px] mx-auto lg:mr-0 lg:ml-auto bg-white rounded-xl border border-slate-200/90 shadow-md overflow-hidden flex flex-col text-slate-800 text-xs">
      {/* 1. Chatbot Top Header Bar */}
      <div className="bg-gradient-to-r from-[#0f766e] to-[#115e59] text-white px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between border-b border-teal-700/50 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-2xs shrink-0">
            <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              health_and_safety
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-white leading-tight flex items-center gap-1.5 truncate">
              <span>Trợ lý Dinh dưỡng VMEC-10</span>
            </div>
            <div className="text-[10px] text-teal-100/80 font-normal mt-0.5 truncate">
              Hỗ trợ cá nhân hóa 24/7
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-teal-900/40 border border-teal-300/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-teal-100 text-[10px] sm:text-[10.5px] font-medium shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
          <span>Trực tuyến</span>
        </div>
      </div>

      {/* Interactive Scenario Tabs */}
      <div className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-slate-100/70 border-b border-slate-200 overflow-x-auto touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
        {SCENARIOS.map((item, idx) => {
          const isActive = idx === activeScenarioIdx;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleManualSelect(idx)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0 ${isActive
                ? "bg-white text-[#0f766e] shadow-2xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                }`}
            >
              <span className="material-symbols-outlined text-[14px]">{item.chipIcon}</span>
              <span>{item.chipLabel}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Locked-Height Chat Viewport with Auto-Scroll */}
      <div
        ref={chatScrollRef}
        className="h-[340px] sm:h-[390px] md:h-[430px] p-3 sm:p-4 space-y-3 overflow-y-auto custom-scrollbar bg-slate-50/40 flex-grow"
      >
        {/* User Message */}
        <div className="flex justify-end animate-message-fade">
          <div className="bg-[#0f766e] text-white rounded-xl rounded-tr-xs px-3.5 py-2.5 max-w-[85%] leading-relaxed shadow-2xs font-normal text-xs">
            {scenario.userPrompt}
          </div>
        </div>

        {/* AI Assistant Stream */}
        <div className="flex items-start gap-2.5 animate-message-fade">
          {/* Bot Video Avatar */}
          <div className="w-7 h-7 rounded-full overflow-hidden border border-teal-500/40 shrink-0 mt-0.5 bg-slate-900 relative shadow-2xs">
            <video
              src="/video/video_chatbot.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 space-y-2.5 min-w-0">
            {/* Thinking Step Box */}
            {(phase === "thinking" || phase === "streaming" || phase === "card_reveal") && (
              <div className="bg-white border border-slate-200 rounded-lg p-2 text-[11px] text-slate-600 shadow-2xs flex items-center gap-2 animate-message-fade">
                <span className="material-symbols-outlined text-[15px] text-[#0f766e] shrink-0">
                  psychology
                </span>
                <span className="truncate">{scenario.thinking}</span>
                {phase === "thinking" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-ping ml-auto shrink-0"></span>
                )}
              </div>
            )}

            {/* AI Text Response with Live Streaming */}
            {(phase === "streaming" || phase === "card_reveal") && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-700 leading-relaxed text-xs shadow-2xs animate-message-fade space-y-1">
                <div>
                  {renderStreamingText()}
                </div>
              </div>
            )}

            {/* Generative UI Cards - Reveals gradually after text generation finishes */}
            {showCard && (
              <div className="animate-card-reveal">
                {/* 1. Meal Suggestion Card */}
                {scenario.cardType === "meal" && (
                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#0f766e]">
                          restaurant_menu
                        </span>
                        <span className="font-bold text-slate-900 text-xs">
                          Thực đơn Bữa trưa Đề xuất
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        Bác sĩ đã duyệt
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between py-1 px-2 rounded bg-slate-50">
                        <span className="text-slate-700">Bún tươi (100g ~ 1/2 bát)</span>
                        <span className="font-semibold text-slate-900">110 kcal • GI 53</span>
                      </div>
                      <div className="flex items-center justify-between py-1 px-2 rounded bg-teal-50/60">
                        <span className="text-teal-900 font-medium">Chả nạc nướng không mỡ (120g)</span>
                        <span className="font-semibold text-teal-800">220 kcal • Đạm 24g</span>
                      </div>
                      <div className="flex items-center justify-between py-1 px-2 rounded bg-slate-50">
                        <span className="text-slate-700">Rau sống các loại (150g)</span>
                        <span className="font-semibold text-slate-900">35 kcal • Giàu chất xơ</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                      <span>Khẩu phần: <strong>365 kcal</strong></span>
                      <span className="text-teal-700 font-medium">Thứ tự ăn: Rau ➔ Thịt ➔ Bún</span>
                    </div>
                  </div>
                )}

                {/* 2. Drug Interaction Card */}
                {scenario.cardType === "drug" && (
                  <div className="bg-white rounded-xl border border-rose-200 p-3 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between border-b border-rose-100 pb-1.5">
                      <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                        <span className="material-symbols-outlined text-[16px]">warning</span>
                        <span>Cảnh báo Dược thư Quốc gia</span>
                      </div>
                      <span className="text-[9.5px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        Mức độ nghiêm ngặt
                      </span>
                    </div>

                    <div className="p-2 rounded bg-rose-50/70 border border-rose-100 text-[11px] space-y-1">
                      <div className="font-bold text-rose-900">Amlodipine 5mg × Bưởi chùm (Grapefruit)</div>
                      <p className="text-slate-600 text-[10.5px]">
                        Ức chế enzym CYP3A4 ruột non, làm tăng nồng độ thuốc gây tụt huyết áp quá mức.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[10.5px] font-medium text-teal-800 bg-teal-50 p-1.5 rounded border border-teal-100">
                      <span className="material-symbols-outlined text-[13px] text-[#0f766e]">check_circle</span>
                      <span>Giải pháp thay thế an toàn: Cam sành, táo, nước lọc</span>
                    </div>
                  </div>
                )}

                {/* 3. Weekly Compliance Chart Card */}
                {scenario.cardType === "compliance" && (
                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#0f766e]">
                          insights
                        </span>
                        <span className="font-bold text-slate-900 text-xs">
                          Điểm Tuân thủ 7 ngày qua
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        Đạt 85% • Xuất sắc
                      </span>
                    </div>

                    {/* 7-Day Mini Bar Chart */}
                    <div className="grid grid-cols-7 gap-1 text-center py-1">
                      {[
                        { day: "T2", pct: 90, ok: true },
                        { day: "T3", pct: 85, ok: true },
                        { day: "T4", pct: 80, ok: true },
                        { day: "T5", pct: 95, ok: true },
                        { day: "T6", pct: 75, ok: false },
                        { day: "T7", pct: 85, ok: true },
                        { day: "CN", pct: 85, ok: true },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className={`p-1 rounded flex flex-col items-center gap-0.5 border ${item.ok
                            ? "bg-teal-50/80 border-teal-200 text-teal-900"
                            : "bg-amber-50/80 border-amber-200 text-amber-900"
                            }`}
                        >
                          <span className="text-[10px] text-slate-500">{item.day}</span>
                          <span className="text-[11px] font-bold">{item.pct}%</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1 border-t border-slate-100">
                      <span>Đường huyết mao mạch lúc đói:</span>
                      <span className="font-bold text-teal-700">6.5 mmol/L (Ổn định)</span>
                    </div>
                  </div>
                )}

                {/* 4. Doctor Note Card */}
                {scenario.cardType === "doctor" && (
                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-teal-100 text-[#0f766e] flex items-center justify-center font-bold text-[10px] border border-teal-300 shrink-0">
                          TT
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900">
                            BS.CKII Nguyễn Thu Trang
                          </div>
                          <div className="text-[10px] text-slate-500">Khoa Dinh dưỡng &amp; Nội tiết</div>
                        </div>
                      </div>
                      <span className="text-[9.5px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        08:30 hôm nay
                      </span>
                    </div>

                    <div className="p-2 rounded bg-teal-50/60 border border-teal-200/80 text-[11px] text-teal-950 italic leading-relaxed">
                      “Chỉ số HbA1c của bác giảm rất tốt (từ 7.6% xuống 7.2%). Tiếp tục duy trì phác đồ ăn trưa hiện tại và nhớ uống thuốc Amlodipine đều đặn vào 8h sáng.”
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-teal-700 pt-0.5 font-medium">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        <span>Đã xác nhận y lệnh điều trị</span>
                      </span>
                      <span className="text-slate-400">Hệ thống Y tế VMEC</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Chat Input Bar Mockup */}
      <div className="bg-white border-t border-slate-200 p-2 px-3.5 flex items-center gap-2 shrink-0">
        <div className="flex-1 bg-slate-100/90 rounded-lg px-3 py-1.5 flex items-center gap-2 text-slate-400 text-xs border border-slate-200/80">
          <span className="material-symbols-outlined text-[16px] text-slate-400">chat</span>
          <span className="truncate">Hỏi về món ăn, đơn thuốc, chỉ số sinh hiệu...</span>
        </div>
        <div className="w-7 h-7 rounded-lg bg-[#0f766e] text-white flex items-center justify-center shadow-2xs shrink-0 opacity-90">
          <span className="material-symbols-outlined text-[15px]">send</span>
        </div>
      </div>
    </div>
  );
}
