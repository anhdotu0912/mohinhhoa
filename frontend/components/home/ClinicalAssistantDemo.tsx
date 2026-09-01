"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

interface Scenario {
  id: "meal_plan" | "drug_interaction" | "compliance" | "doctor_note";
  tabLabel: string;
  tabIcon: string;
  userPrompt: string;
  thinkingSteps: Array<{
    title: string;
    description: string;
  }>;
  aiMessage: string;
  guardrailText?: string;
  cardType: "meal" | "drug" | "compliance" | "doctor";
  citations: string[];
}

const SCENARIOS: Record<Scenario["id"], Scenario> = {
  meal_plan: {
    id: "meal_plan",
    tabLabel: "Tư vấn món ăn RAG",
    tabIcon: "restaurant_menu",
    userPrompt: "Trưa nay tôi định ăn Bún chả nướng hoặc Cơm tấm sườn bì. Món nào an toàn hơn cho đường huyết HbA1c 7.2% của tôi?",
    thinkingSteps: [
      {
        title: "Tải hồ sơ bệnh nhân",
        description: "Nguyễn Văn A (58T) • Đái tháo đường Type 2 • Đang dùng Metformin 500mg • HbA1c: 7.2%",
      },
      {
        title: "Tra cứu RAG Y văn Viện Dinh Dưỡng QG",
        description: "Đối soát chỉ số Glycemic Index (GI), Glycemic Load (GL) của bún trắng vs. gạo tấm sườn mỡ",
      },
      {
        title: "Kiểm tra an toàn dược lý & HITL",
        description: "Không phát hiện xung đột nguy hiểm với Metformin 500mg",
      },
      {
        title: "Tính toán khẩu phần & thứ tự ăn chuẩn",
        description: "Mục tiêu bữa trưa ~520 kcal • Tỷ lệ Carbs kiểm soát dưới 45g",
      },
    ],
    aiMessage:
      "Chào bác Nguyễn Văn A, dựa trên hồ sơ bệnh lý **Đái tháo đường Type 2** và mục tiêu kiểm soát đường huyết sau ăn, tôi khuyến nghị bác **nên ưu tiên Bún chả nướng điều chỉnh** thay vì Cơm tấm sườn bì.\n\n* **Cơm tấm sườn bì**: Cơm tấm có chỉ số GI rất cao (GI ~ 80), kèm sườn nướng mỡ và bì heo làm tăng gánh nặng chuyển hóa lipid và đề kháng insulin.\n* **Bún chả nướng (điều chỉnh)**: Bác có thể chủ động giảm 1/2 lượng bún, tăng tối đa rau sống (xà lách, tía tô, kinh giới) để bổ sung chất xơ hòa tan làm chậm hấp thu glucose.",
    guardrailText: "Đã điều chỉnh khẩu phần theo hướng dẫn an toàn y khoa (HITL)",
    cardType: "meal",
    citations: [
      "Huong_dan_dieu_tri_DTD_Bo_Y_Te_2020.md",
      "Vien_Dinh_Duong_Quoc_Gia_2024.md",
      "ADA_Standards_of_Care_2024.pdf",
    ],
  },
  drug_interaction: {
    id: "drug_interaction",
    tabLabel: "Kiểm tra tương tác thuốc",
    tabIcon: "medication",
    userPrompt: "Tôi đang uống thuốc Amlodipine 5mg và Metformin 500mg thì cần kiêng những loại đồ ăn, thức uống nào?",
    thinkingSteps: [
      {
        title: "Phân tích phác đồ điều trị",
        description: "Amlodipine (chẹn kênh Canxi) + Metformin (Biguanide hạ đường huyết)",
      },
      {
        title: "Tra cứu Dược thư Quốc gia Việt Nam & FDA",
        description: "Quét cơ sở dữ liệu tương tác dược động học qua enzym gan CYP3A4 và chuyển hóa Acid Lactic",
      },
      {
        title: "Kích hoạt HITL Guardrails",
        description: "Cảnh báo mức độ nghiêm trọng: Nghiêm cấm nước ép bưởi chùm & Rượu bia",
      },
      {
        title: "Đề xuất giải pháp thay thế an toàn",
        description: "Nước lọc, trà hoa cúc ấm hoặc nước ép dưa leo nguyên chất",
      },
    ],
    aiMessage:
      "Bác A cần đặc biệt chú ý **2 tương tác thuốc - thực phẩm nghiêm ngặt** sau đây đối với đơn thuốc đang sử dụng:\n\n* **Amlodipine 5mg (Thuốc huyết áp)**: Tuyệt đối **không uống nước ép bưởi chùm (Grapefruit)** trong vòng 4 giờ. Hợp chất *Furanocoumarin* ức chế men CYP3A4 ruột non, làm tăng nồng độ thuốc trong máu gấp 2-3 lần gây tụt huyết áp đột ngột và choáng váng.\n* **Metformin 500mg (Thuốc tiểu đường)**: **Tuyệt đối tránh xa rượu bia và thức uống có cồn**. Cồn ức chế tân tạo đường ở gan, phối hợp Metformin làm tăng nguy cơ biến chứng *nhiễm toan lactic* nguy hiểm.",
    guardrailText: "Cảnh báo an toàn Dược thư Y khoa (HITL Guardrails)",
    cardType: "drug",
    citations: [
      "Duoc_thu_quoc_gia_Viet_Nam_2023.md",
      "FDA_Drug_Food_Interaction_Table.pdf",
      "Bo_Y_Te_Tuong_tac_thuoc_lam_sang.md",
    ],
  },
  compliance: {
    id: "compliance",
    tabLabel: "Theo dõi tuân thủ tuần",
    tabIcon: "monitoring",
    userPrompt: "Xem báo cáo tuân thủ dinh dưỡng tuần này và ảnh hưởng tới đường huyết của tôi",
    thinkingSteps: [
      {
        title: "Truy xuất dữ liệu Food Log 7 ngày",
        description: "Tổng hợp 21/21 bữa ăn thực tế đã ghi nhận trong tuần",
      },
      {
        title: "Đối soát với phác đồ 1.650 kcal của Bác sĩ",
        description: "Tính toán sai số Calo, Carbs, Protein và Natri từng ngày",
      },
      {
        title: "Phân tích chuỗi thời gian sinh hiệu",
        description: "Tương quan tỷ lệ tuân thủ với biến thiên đường huyết đói (Fasting Glucose)",
      },
      {
        title: "Tổng hợp Adherence Score",
        description: "Điểm tuân thủ trung bình đạt 85% (Vượt ngưỡng mục tiêu 80%)",
      },
    ],
    aiMessage:
      "Chúc mừng bác A! Trong tuần này, tỷ lệ tuân thủ dinh dưỡng của bác đạt **85%**, xuất sắc vượt mức mục tiêu 80% do **BS.CKII Nguyễn Thu Trang** đề ra.\n\nNhờ kiểm soát tốt tinh bột nhanh buổi tối và duy trì ăn rau xanh trước mỗi bữa, chỉ số đường huyết mao mạch lúc đói của bác duy trì rất ổn định ở mức **6.5 - 7.0 mmol/L**.",
    guardrailText: "Dữ liệu được đối soát tự động từ Nhật ký ăn uống 3-slot",
    cardType: "compliance",
    citations: [
      "ADA_Standards_of_Care_2024.pdf",
      "Vien_Dinh_Duong_Theo_doi_tuan_thu_benh_nhan.md",
    ],
  },
  doctor_note: {
    id: "doctor_note",
    tabLabel: "Lời dặn bác sĩ điều trị",
    tabIcon: "clinical_notes",
    userPrompt: "Bác sĩ chuyên khoa điều trị có dặn dò gì mới cho tôi không?",
    thinkingSteps: [
      {
        title: "Kiểm tra hòm thư chỉ định y khoa",
        description: "Bác sĩ phụ trách: BS.CKII Nguyễn Thu Trang (Khoa Nội tiết - Dinh dưỡng)",
      },
      {
        title: "Tải chỉ định lâm sàng mới nhất",
        description: "Đã thẩm định dữ liệu đường huyết & nhật ký ăn uống 14 ngày qua",
      },
      {
        title: "Tổng hợp lời dặn thực đơn & thuốc",
        description: "Duy trì phác đồ trưa, uống đủ 2L nước, hẹn tái khám ngày 15/09",
      },
    ],
    aiMessage:
      "Bác sĩ phụ trách của bác là **BS.CKII Nguyễn Thu Trang** (Khoa Nội tiết - Dinh dưỡng Lâm sàng) vừa gửi lời dặn dò chuyên môn cho bác vào sáng nay:",
    guardrailText: "Thông điệp trực tiếp từ Bác sĩ điều trị qua Cổng Clinician Portal",
    cardType: "doctor",
    citations: [
      "Phac_do_dieu_tri_Noi_tiet_Benh_vien_2024.md",
      "Ho_so_benh_an_dinh_duong_Nguyen_Van_A.pdf",
    ],
  },
};

export function ClinicalAssistantDemo() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<Scenario["id"]>("meal_plan");
  const [isThinkingOpen, setIsThinkingOpen] = useState(true);
  const [isCitationsOpen, setIsCitationsOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [inputQuery, setInputQuery] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[selectedScenarioId];

  const handleSelectScenario = (id: Scenario["id"]) => {
    if (id === selectedScenarioId && !isSimulating) return;
    setIsSimulating(true);
    setIsThinkingOpen(true);
    setIsCitationsOpen(false);
    setSelectedScenarioId(id);

    // Short simulated thinking transition for realism
    setTimeout(() => {
      setIsSimulating(false);
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = 0;
      }
    }, 450);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputQuery.trim().toLowerCase();
    if (!query) return;

    if (query.includes("thuốc") || query.includes("kiêng") || query.includes("uống") || query.includes("tương tác")) {
      handleSelectScenario("drug_interaction");
    } else if (query.includes("tuân thủ") || query.includes("biểu đồ") || query.includes("chỉ số") || query.includes("tuần")) {
      handleSelectScenario("compliance");
    } else if (query.includes("bác sĩ") || query.includes("lời dặn") || query.includes("khám") || query.includes("dặn")) {
      handleSelectScenario("doctor_note");
    } else {
      handleSelectScenario("meal_plan");
    }
    setInputQuery("");
  };

  return (
    <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col transition-all">
      {/* 1. MOCKUP WINDOW HEADER (Exact Clinical App Style) */}
      <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          {/* OS Window Dots */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
            <span className="font-extrabold text-sm text-white tracking-tight">{APP_NAME}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              AI CLINICAL
            </span>
          </div>
        </div>

        {/* Live Clinical Status Badge */}
        <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-600/40 px-3 py-1 rounded-full text-emerald-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="hidden sm:inline">Trực tiếp chuẩn Y khoa</span>
          <span className="text-[10px] text-emerald-400/80 font-mono hidden md:inline">• HITL v2.4</span>
        </div>
      </div>

      {/* 2. PATIENT CONTEXT BANNER (Visual Grounding) */}
      <div className="bg-slate-50/90 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#006857] text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
            A
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-bold text-slate-800">Nguyễn Văn A (58T)</span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-600">Đái tháo đường Type 2 (Metformin 500mg, Amlodipine 5mg)</span>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-900 font-bold text-[11px] border border-emerald-200/80 shrink-0">
          HbA1c: 7.2%
        </span>
      </div>

      {/* 3. INTERACTIVE SCENARIO SELECTOR TABS */}
      <div className="flex overflow-x-auto custom-scrollbar border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1.5 shrink-0">
        {(Object.keys(SCENARIOS) as Array<Scenario["id"]>).map((key) => {
          const item = SCENARIOS[key];
          const isSelected = selectedScenarioId === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelectScenario(key)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? "bg-white text-[#006857] shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[17px] ${
                  isSelected ? "text-[#006857]" : "text-slate-500"
                }`}
              >
                {item.tabIcon}
              </span>
              <span>{item.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* 4. CHAT STREAM VIEWPORT (Exact 1:1 Match with Real Chatbot) */}
      <div
        ref={chatContainerRef}
        className="p-4 sm:p-6 space-y-5 max-h-[520px] overflow-y-auto custom-scrollbar bg-[#f8fafc]/50 flex-grow"
      >
        {/* User Message Bubble */}
        <div className="flex justify-end w-full animate-message-fade">
          <div className="max-w-[85%] sm:max-w-[78%] bg-[#006857] text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-2xs">
            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{scenario.userPrompt}</p>
          </div>
        </div>

        {/* AI Response Block */}
        <div className="flex items-start gap-3 w-full animate-message-fade">
          {/* Bot Video Avatar */}
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-emerald-500/40 shrink-0 mt-0.5 bg-slate-900 shadow-2xs relative">
            <video
              src="/video/video_chatbot.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* Bot Content Stream */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* Thinking Steps Accordion (Gemini Minimalist Reasoning Trigger) */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setIsThinkingOpen(!isThinkingOpen)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#006857]">
                    psychology
                  </span>
                  <span>
                    {isSimulating
                      ? "Đang phân tích dữ liệu lâm sàng & tra cứu y văn..."
                      : `Quá trình suy nghĩ (${scenario.thinkingSteps.length}/${scenario.thinkingSteps.length} bước)`}
                  </span>
                </div>
                <span
                  className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-200 ${
                    isThinkingOpen ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {isThinkingOpen && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2 text-xs animate-in fade-in duration-200">
                  {scenario.thinkingSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-600">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 mr-1.5">{step.title}:</span>
                        <span className="text-slate-600">{step.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Text Message */}
            {!isSimulating ? (
              <div className="text-xs sm:text-sm text-slate-800 leading-relaxed space-y-2 bg-white/70 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                {scenario.aiMessage.split("\n\n").map((para, pIdx) => {
                  const lines = para.split("\n");
                  const hasBullets = lines.some((l) => l.startsWith("* "));

                  if (hasBullets) {
                    return (
                      <div key={pIdx} className="space-y-1.5 my-2">
                        {lines.map((l, lIdx) => {
                          if (l.startsWith("* ")) {
                            const raw = l.substring(2);
                            return (
                              <div key={lIdx} className="flex items-start gap-2 pl-1">
                                <span className="text-[#006857] font-bold text-sm shrink-0">•</span>
                                <div
                                  className="flex-1 min-w-0"
                                  dangerouslySetInnerHTML={{
                                    __html: raw.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                                  }}
                                />
                              </div>
                            );
                          }
                          return (
                            <p
                              key={lIdx}
                              dangerouslySetInnerHTML={{
                                __html: l.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  }

                  return (
                    <p
                      key={pIdx}
                      dangerouslySetInnerHTML={{
                        __html: para.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-3 px-4 bg-white/70 rounded-2xl border border-slate-200 text-xs text-slate-500 italic">
                <span className="w-2 h-2 rounded-full bg-[#006857] animate-pulse"></span>
                <span className="w-2 h-2 rounded-full bg-[#006857] animate-pulse delay-150"></span>
                <span className="w-2 h-2 rounded-full bg-[#006857] animate-pulse delay-300"></span>
                <span className="ml-1">Đang hoàn tất đề xuất y khoa...</span>
              </div>
            )}

            {/* Safety HITL Guardrail Badge */}
            {scenario.guardrailText && !isSimulating && (
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-900 bg-amber-50 border border-amber-200/90 rounded-lg px-3 py-1.5 w-fit shadow-2xs">
                <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0">
                  shield
                </span>
                <span className="font-semibold">{scenario.guardrailText}</span>
              </div>
            )}

            {/* 5. GENERATIVE UI CARDS (Authentic Components) */}
            {!isSimulating && (
              <div className="w-full animate-card-reveal space-y-3">
                {/* Scenario 1: Meal Plan Suggestion Card */}
                {scenario.cardType === "meal" && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200/80 shrink-0">
                          <span className="material-symbols-outlined text-[18px]">restaurant_menu</span>
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-slate-900">
                            Thực đơn Bữa trưa Khuyến nghị
                          </div>
                          <div className="text-[11px] text-slate-500">Cá nhân hóa cho ĐTĐ Type 2</div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[11px] font-bold">
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        Bác sĩ đã duyệt
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 text-xs">
                      <span className="font-bold text-slate-800">Tổng năng lượng bữa trưa:</span>
                      <span className="font-extrabold text-[#006857] bg-white px-2.5 py-0.5 rounded-md border border-emerald-200">
                        520 kcal • Carbs 42g • Protein 32g
                      </span>
                    </div>

                    {/* Meal Food Rows */}
                    <div className="space-y-1.5 text-xs">
                      <div className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 block">Bún sợi tươi (100g ~ 1/2 bát)</span>
                          <span className="text-[11px] text-slate-500">Carbs 25g • Giảm 50% tinh bột so với quán</span>
                        </div>
                        <span className="font-semibold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                          110 kcal
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl border border-teal-200/80 bg-teal-50/40 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#006857] block">Chả thịt nạc nướng không mỡ (120g)</span>
                          <span className="text-[11px] text-slate-600">Protein 24g • Giàu đạm, ít chất béo bão hòa</span>
                        </div>
                        <span className="font-semibold text-teal-800 bg-white px-2 py-1 rounded border border-teal-200">
                          220 kcal
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 block">Rau sống các loại (xà lách, tía tô 150g)</span>
                          <span className="text-[11px] text-slate-500">Chất xơ 4.5g • Làm chậm hấp thu đường</span>
                        </div>
                        <span className="font-semibold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                          35 kcal
                        </span>
                      </div>
                    </div>

                    {/* Actionable Clinical Tip */}
                    <div className="text-xs text-teal-950 bg-teal-50/80 p-3 rounded-xl border border-teal-200 leading-relaxed">
                      <span className="font-bold text-[#006857]">💡 Thứ tự ăn chuẩn Y khoa:</span> Ăn hết đĩa rau sống trước ➔ Ăn chả thịt nạc ➔ Cuối cùng mới ăn phần bún. Giúp giảm tới 40% đỉnh tăng đường huyết sau ăn.
                    </div>
                  </div>
                )}

                {/* Scenario 2: Drug-Food Interaction Warning Card */}
                {scenario.cardType === "drug" && (
                  <div className="bg-white border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between border-b border-rose-100 pb-2.5">
                      <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm">
                        <span className="material-symbols-outlined text-[20px] text-rose-600">
                          warning
                        </span>
                        <span>Cảnh báo Dược thư Y khoa (HITL)</span>
                      </div>
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Mức độ nghiêm trọng: Cao
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1">
                        <div className="flex items-center gap-1.5 text-rose-900 font-bold">
                          <span className="material-symbols-outlined text-[16px] text-rose-600">block</span>
                          <span>Amlodipine 5mg + Bưởi chùm (Grapefruit)</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed pl-5">
                          Ức chế enzym CYP3A4 ruột non, làm tăng nồng độ thuốc trong máu quá mức, gây tụt huyết áp kịch phát, hoa mắt và chóng mặt.
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                          <span className="material-symbols-outlined text-[16px] text-amber-600">no_drinks</span>
                          <span>Metformin 500mg + Rượu bia & Cồn</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed pl-5">
                          Cồn ức chế tân tạo đường tại gan, phối hợp với Metformin làm tăng nguy cơ nhiễm toan lactic và hạ đường huyết ban đêm.
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-500 text-[18px]">verified</span>
                      <span>Tra cứu trực tiếp từ Dược thư Quốc gia Việt Nam & FDA Guidelines.</span>
                    </div>
                  </div>
                )}

                {/* Scenario 3: Weekly Compliance Scorecard */}
                {scenario.cardType === "compliance" && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#006857] flex items-center justify-center border border-emerald-200 shrink-0">
                          <span className="material-symbols-outlined text-[18px]">insights</span>
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-slate-900">
                            Tuân thủ dinh dưỡng tuần này
                          </div>
                          <div className="text-[11px] text-slate-500">Mục tiêu Bác sĩ đề ra: &ge; 80%</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold border border-emerald-300">
                        Đạt 85% • Xuất sắc
                      </span>
                    </div>

                    {/* 7-Day Adherence Visual Progress */}
                    <div className="grid grid-cols-7 gap-1.5 text-center">
                      {[
                        { day: "T2", pct: 90, ok: true },
                        { day: "T3", pct: 85, ok: true },
                        { day: "T4", pct: 80, ok: true },
                        { day: "T5", pct: 75, ok: false },
                        { day: "T6", pct: 95, ok: true },
                        { day: "T7", pct: 85, ok: true },
                        { day: "CN", pct: 85, ok: true },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded-xl border flex flex-col items-center gap-1 ${
                            item.ok
                              ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                              : "bg-amber-50/70 border-amber-200 text-amber-900"
                          }`}
                        >
                          <span className="text-[11px] font-bold text-slate-600">{item.day}</span>
                          <span className="text-xs font-extrabold">{item.pct}%</span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.ok ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          ></span>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">Đường huyết mao mạch lúc đói:</span>
                        <span className="ml-1 text-slate-600">Duy trì an toàn 6.5 - 7.0 mmol/L</span>
                      </div>
                      <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">trending_down</span>
                        Ổn định
                      </span>
                    </div>
                  </div>
                )}

                {/* Scenario 4: Doctor Note Card */}
                {scenario.cardType === "doctor" && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#006857] flex items-center justify-center font-bold text-sm border border-emerald-300 shrink-0">
                          TT
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-slate-900">
                            BS.CKII Nguyễn Thu Trang
                          </div>
                          <div className="text-[11px] text-slate-500">Chuyên khoa Dinh dưỡng &amp; Nội tiết</div>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Hôm nay · 08:30
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 text-xs text-teal-950 leading-relaxed italic space-y-2">
                      <p>
                        “Chào bác A, tôi đã xem biểu đồ đường huyết và nhật ký ăn uống 2 tuần qua. Chỉ số HbA1c của bác có xu hướng giảm rất tích cực (từ 7.6% về 7.2%). Bác hãy tiếp tục duy trì khẩu phần ăn trưa hiện tại.”
                      </p>
                      <p>
                        “Lưu ý: Uống Amlodipine đều đặn vào 8:00 sáng sau ăn, uống đủ 2 lít nước/ngày và hạn chế ăn mặn. Hẹn gặp lại bác vào ngày tái khám 15/09 tới.”
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        Đã xác nhận y lệnh điều trị
                      </span>
                      <span className="text-[11px] text-slate-400">{APP_NAME} Clinician Portal</span>
                    </div>
                  </div>
                )}

                {/* Citations Accordion (Gemini Dropdown Accordion) */}
                {scenario.citations && scenario.citations.length > 0 && (
                  <div className="pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsCitationsOpen(!isCitationsOpen)}
                      className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-xs font-medium py-1 px-2 rounded-md hover:bg-slate-100 transition-colors cursor-pointer group"
                    >
                      <span className="material-symbols-outlined text-[16px] text-emerald-600 group-hover:scale-110 transition-transform">
                        menu_book
                      </span>
                      <span>Nguồn trích dẫn ({scenario.citations.length})</span>
                      <span
                        className={`material-symbols-outlined text-[16px] text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
                          isCitationsOpen ? "rotate-180" : ""
                        }`}
                      >
                        expand_more
                      </span>
                    </button>

                    {isCitationsOpen && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 pl-1 animate-in fade-in duration-200">
                        {scenario.citations.map((c, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-2.5 py-0.5 rounded-md text-[11px] text-slate-700 font-medium transition-colors shadow-2xs"
                          >
                            {c.replace(/_/g, " ").replace(/\.(md|pdf)$/i, "")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. BOTTOM INTERACTIVE CHAT INPUT (Full Fidelity Pill Input) */}
      <div className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0">
        <form
          onSubmit={handleFormSubmit}
          className="w-full bg-slate-50 rounded-full flex items-center p-1 border border-slate-200 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Thử gõ: tương tác thuốc, tuân thủ tuần, lời dặn bác sĩ..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 py-2 px-3.5 outline-none"
          />
          <button
            type="submit"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#006857] hover:bg-[#005245] text-white flex items-center justify-center shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
            title="Gửi câu hỏi thử nghiệm"
          >
            <span className="material-symbols-outlined text-[17px]">send</span>
          </button>
        </form>

        {/* Footer Link & Clinical Disclaimer */}
        <div className="flex items-center justify-between pt-2.5 px-1 text-[11px] text-slate-400">
          <span className="truncate">Tuân thủ mô hình giám sát y khoa Human-in-the-Loop (HITL).</span>
          <Link
            href="/patient"
            className="text-[#006857] font-bold hover:underline flex items-center gap-0.5 shrink-0 ml-2"
          >
            <span>Mở Cổng Bệnh nhân</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
