"use client";

import React, { useState } from "react";
import Link from "next/link";

/**
 * <!--
 * THESIS: Clinical-grade AI nutrition assistant (VMEC-10) with verified Human-in-the-Loop doctor approval and Vietnamese RAG database, replacing generic diet apps with medical precision and deep patient empathy.
 * OWN-WORLD: Crisp clinical palette (Deep Teal #0f766e, Slate Navy #0f172a, Soft Mint #f0fdfa, Medical Amber & Rose accents), structured glass-cards, high-contrast typography, authentic medical badges.
 * STORY: Patients with chronic conditions (diabetes, hypertension, renal) discover safe, doctor-verified eating plans, explore interactive AI-RAG meal consultations, and register for personalized care.
 * FIRST VIEWPORT: Clear medical value proposition with dual CTAs on the left; live interactive Clinical AI consultation mockup with Doctor Approval stamp and Macro breakdown on the right.
 * FORM: Persuade-mode clinical landing page with interactive showcase, problem empathy matrix, Bento Grid 2.0, HITL 3-step workflow, and dual patient/doctor portal paths.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
 * -->
 */

export default function HomePage() {
  const [activeDemoTab, setActiveDemoTab] = useState<"chat" | "interaction" | "menu">("chat");

  return (
    <div className="bg-[#f8fafc] text-[#0f172a] font-body antialiased min-h-screen flex flex-col justify-between selection:bg-[#0f766e]/20 selection:text-[#0f766e]">
      {/* 1. TOP NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 w-full z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex justify-between items-center">
          {/* Logo & Clinical Badge */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0f766e] to-[#115e59] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  health_and_safety
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight text-[#0f766e] group-hover:text-[#115e59] transition-colors leading-none">
                  VMEC-10
                </span>
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                  Dinh dưỡng Lâm sàng AI
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-8 ml-8 pl-8 border-l border-slate-200">
              <a href="#giai-phap" className="text-sm font-medium text-slate-600 hover:text-[#0f766e] transition-colors">
                Giải pháp y khoa
              </a>
              <a href="#cach-hoat-dong" className="text-sm font-medium text-slate-600 hover:text-[#0f766e] transition-colors">
                Quy trình 3 bước
              </a>
              <a href="#tinh-nang" className="text-sm font-medium text-slate-600 hover:text-[#0f766e] transition-colors">
                Tính năng nền tảng
              </a>
              <a href="#doi-tuong" className="text-sm font-medium text-slate-600 hover:text-[#0f766e] transition-colors">
                Dành cho ai
              </a>
              <a href="#bac-si" className="text-sm font-medium text-slate-600 hover:text-[#0f766e] transition-colors">
                Bác sĩ & Chuyên gia
              </a>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 hover:text-[#0f766e] px-3.5 py-2 rounded-lg transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="bg-[#0f766e] hover:bg-[#115e59] text-white text-sm font-semibold h-10 px-5 rounded-lg flex items-center justify-center shadow-sm hover:shadow transition-all active:scale-[0.98]"
            >
              Bắt đầu miễn phí
            </Link>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT CONTAINER */}
      <main className="w-full flex-grow pt-20">
        {/* 2. HERO SECTION (PERSUADE & INTERACTIVE DEMO) */}
        <section className="w-full py-12 md:py-20 lg:py-24 border-b border-slate-200/70 bg-gradient-to-b from-teal-50/40 via-white to-[#f8fafc]">
          <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
              
              {/* Left Column: Clinical Value Proposition */}
              <div className="lg:col-span-6 flex flex-col items-start gap-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-100/70 border border-teal-200 text-[#0f766e] text-xs font-semibold">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                  Mô hình Human-in-the-Loop: Bác sĩ chuyên khoa đồng hành
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight leading-[1.18]">
                  Dinh dưỡng chuẩn y khoa cho người bệnh mãn tính
                </h1>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                  Cá nhân hóa thực đơn từng bữa theo chẩn đoán bệnh lý, chỉ số sinh hiệu và đơn thuốc đang điều trị. Kiểm soát đường huyết, huyết áp và mỡ máu an toàn mỗi ngày.
                </p>

                {/* Primary & Secondary CTAs */}
                <div className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto">
                  <Link
                    href="/register"
                    className="w-full sm:w-auto bg-[#0f766e] hover:bg-[#115e59] text-white font-semibold text-base h-12 px-7 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                  >
                    <span>Cá nhân hóa thực đơn ngay</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </Link>
                  <Link
                    href="/patient"
                    className="w-full sm:w-auto bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-base h-12 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#0f766e]">play_circle</span>
                    <span>Xem Demo ứng dụng</span>
                  </Link>
                </div>

                {/* Trust Points / Proof Badges */}
                <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-200/80 w-full">
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-bold text-[#0f766e]">1.200+</span>
                    <span className="text-xs text-slate-500 font-medium">Món ăn Việt phân tích</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-bold text-[#0f766e]">100%</span>
                    <span className="text-xs text-slate-500 font-medium">Dữ liệu RAG y văn</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-bold text-[#0f766e]">0%</span>
                    <span className="text-xs text-slate-500 font-medium">Xung đột thuốc nguy hiểm</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Interactive Clinical Preview Card */}
              <div className="lg:col-span-6 w-full">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                  
                  {/* Mockup Window Header */}
                  <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="ml-2 text-xs font-medium text-slate-300">
                        VMEC-10 Clinical Assistant Demo
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-700/50 px-2.5 py-1 rounded-full text-emerald-400 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Trực tiếp chuẩn Y khoa
                    </div>
                  </div>

                  {/* Interactive Demo Tabs */}
                  <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 pt-2">
                    <button
                      onClick={() => setActiveDemoTab("chat")}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                        activeDemoTab === "chat"
                          ? "border-[#0f766e] text-[#0f766e] bg-white rounded-t-lg"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">chat</span>
                      Tư vấn món ăn RAG
                    </button>
                    <button
                      onClick={() => setActiveDemoTab("interaction")}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                        activeDemoTab === "interaction"
                          ? "border-[#0f766e] text-[#0f766e] bg-white rounded-t-lg"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">medication</span>
                      Kiểm tra tương tác thuốc
                    </button>
                    <button
                      onClick={() => setActiveDemoTab("menu")}
                      className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                        activeDemoTab === "menu"
                          ? "border-[#0f766e] text-[#0f766e] bg-white rounded-t-lg"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">restaurant_menu</span>
                      Thực đơn mẫu 3 bữa
                    </button>
                  </div>

                  {/* Tab 1 Content: AI Clinical RAG Consultation */}
                  {activeDemoTab === "chat" && (
                    <div className="p-5 sm:p-6 space-y-4">
                      {/* Patient Case Context */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                            A
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">Bệnh nhân: Nguyễn Văn A (58 tuổi)</div>
                            <div className="text-slate-500">Đái tháo đường Type 2 • Đang dùng Metformin 500mg</div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-teal-50 text-[#0f766e] font-semibold border border-teal-200">
                          HbA1c: 7.2%
                        </span>
                      </div>

                      {/* User Message */}
                      <div className="flex items-start gap-2.5 justify-end">
                        <div className="bg-[#0f766e] text-white rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] text-sm">
                          Trưa nay tôi định ăn Bún chả nướng hoặc Cơm tấm sườn bì. Món nào an toàn hơn cho đường huyết của tôi?
                        </div>
                      </div>

                      {/* AI Clinical Response Card */}
                      <div className="bg-teal-50/50 border border-teal-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
                        <div className="flex items-center justify-between border-b border-teal-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-[#0f766e] text-white flex items-center justify-center">
                              <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                            </div>
                            <span className="text-xs font-bold text-[#0f766e]">Phân tích Y văn Dinh dưỡng (RAG)</span>
                          </div>
                          <span className="text-[11px] font-semibold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                            Viện Dinh Dưỡng QG (2024)
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                          Khuyến nghị: <strong>Nên ưu tiên Bún chả nướng điều chỉnh</strong> thay vì Cơm tấm sườn bì (có lượng mỡ bão hòa và chỉ số GI cao hơn).
                        </p>

                        {/* Nutrition Quantitative Box */}
                        <div className="grid grid-cols-4 gap-2 bg-white rounded-lg p-2.5 border border-teal-100 text-center">
                          <div>
                            <div className="text-xs font-bold text-slate-800">460 kcal</div>
                            <div className="text-[10px] text-slate-500">Năng lượng</div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-teal-700">48g</div>
                            <div className="text-[10px] text-slate-500">Carbs (GI thấp)</div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">32g</div>
                            <div className="text-[10px] text-slate-500">Protein</div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-emerald-700">6.5g</div>
                            <div className="text-[10px] text-slate-500">Chất xơ</div>
                          </div>
                        </div>

                        {/* Actionable Clinical Note */}
                        <div className="text-xs text-slate-600 bg-white/70 p-2.5 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-800">Hướng dẫn ăn đúng:</span> Giảm 1/3 lượng bún trắng (khoảng 100g), ăn kèm tối thiểu 1 bát rau sống (xà lách, tía tô) trước khi ăn bún để làm chậm hấp thu đường.
                        </div>

                        {/* Doctor Verification Stamp (HITL) */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              verified_user
                            </span>
                            <span>Đã duyệt bởi BS.CKII Nguyễn Thu Trang</span>
                          </div>
                          <span className="text-[11px] text-slate-400">10:45 AM</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2 Content: Drug-Food Interaction */}
                  {activeDemoTab === "interaction" && (
                    <div className="p-5 sm:p-6 space-y-4">
                      <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                          <span className="material-symbols-outlined text-[20px] text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                            warning
                          </span>
                          Cảnh báo tương tác Thuốc - Thực phẩm
                        </div>
                        <div className="text-xs text-slate-700 space-y-2">
                          <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-amber-100">
                            <span className="font-bold text-rose-600 min-w-[70px]">Amlodipine:</span>
                            <span>Không uống nước bưởi chùm (Grapefruit) trong vòng 4 giờ trước/sau uống thuốc do ức chế enzym CYP3A4 gây hạ huyết áp quá mức.</span>
                          </div>
                          <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-amber-100">
                            <span className="font-bold text-teal-700 min-w-[70px]">Metformin:</span>
                            <span>Tránh dùng chung với đồ uống có cồn (rượu, bia) để ngăn ngừa nguy cơ nhiễm toan lactic.</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-500 text-[18px]">info</span>
                        Hệ thống tự động tra cứu Dược thư Quốc gia Việt Nam & FDA Guidelines khi tạo thực đơn.
                      </div>
                    </div>
                  )}

                  {/* Tab 3 Content: 3-Meal Sample Plan */}
                  {activeDemoTab === "menu" && (
                    <div className="p-5 sm:p-6 space-y-3">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Thực đơn mẫu 1 ngày • Mục tiêu 1.650 Kcal
                      </div>
                      
                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-lg border border-slate-200 bg-white flex justify-between items-center">
                          <div>
                            <span className="font-bold text-teal-800 block">Bữa Sáng (07:00)</span>
                            <span className="text-slate-600">Cháo yến mạch ức gà + 1 quả trứng luộc</span>
                          </div>
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">380 kcal</span>
                        </div>

                        <div className="p-3 rounded-lg border border-teal-200 bg-teal-50/40 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-[#0f766e] block">Bữa Trưa (12:00)</span>
                            <span className="text-slate-700">1 bát cơm gạo lứt + Cá hồi áp chảo + Canh cải xanh</span>
                          </div>
                          <span className="font-semibold text-teal-800 bg-teal-100 px-2 py-1 rounded">580 kcal</span>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-white flex justify-between items-center">
                          <div>
                            <span className="font-bold text-teal-800 block">Bữa Tối (18:30)</span>
                            <span className="text-slate-600">Ức gà xào ớt chuông nấm + Canh bí đỏ thịt bằm</span>
                          </div>
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">460 kcal</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Footer CTA */}
                  <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Trải nghiệm trên mọi thiết bị (Web & Mobile)</span>
                    <Link href="/patient" className="text-[#0f766e] font-bold hover:underline flex items-center gap-1">
                      Xem giao diện đầy đủ
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 3. PROBLEM & EMPATHY MATRIX */}
        <section className="w-full py-16 lg:py-24 bg-white border-b border-slate-200" id="giai-phap">
          <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight mb-4">
                Ăn kiêng bệnh lý không nhất thiết phải là nỗi sợ hãi
              </h2>
              <p className="text-base sm:text-lg text-slate-600">
                Phần lớn bệnh nhân mãn tính rơi vào bẫy kiêng khem quá mức gây suy kiệt hoặc ăn sai cách làm bệnh trầm trọng hơn.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Problem 1 */}
              <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-7 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-5">
                    <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      no_food
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Không biết ăn gì cho đúng
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Thông tin trôi nổi trên mạng gây hoang mang, kiêng khem cực đoan dẫn đến thiếu chất và suy nhược cơ thể.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-semibold text-[#0f766e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  VMEC-10 cá nhân hóa khẩu phần chuẩn calo & macros
                </div>
              </div>

              {/* Problem 2 */}
              <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-7 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-5">
                    <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      warning
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Xung đột thuốc nguy hiểm
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Nhiều thực phẩm phổ biến (rau muống, bưởi chùm, đậu tương) tương tác tiêu cực với thuốc tim mạch, huyết áp, tiểu đường.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-semibold text-[#0f766e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Tự động rà soát tương tác thuốc theo Dược thư y khoa
                </div>
              </div>

              {/* Problem 3 */}
              <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-7 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-teal-100 text-[#0f766e] flex items-center justify-center mb-5">
                    <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      clinical_notes
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Thiếu sự đồng hành của bác sĩ
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Khám định kỳ mỗi tháng chỉ gặp bác sĩ vài phút; không có công cụ ghi chép và đánh giá mức độ tuân thủ dinh dưỡng tại nhà.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-semibold text-[#0f766e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Mô hình HITL giúp bác sĩ giám sát và duyệt phác đồ từ xa
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. HOW IT WORKS (3-STEP CLINICAL WORKFLOW) */}
        <section className="w-full py-16 lg:py-24 bg-[#f8fafc] border-b border-slate-200" id="cach-hoat-dong">
          <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight mb-4">
                Quy trình 3 bước khép kín chuẩn y khoa
              </h2>
              <p className="text-base sm:text-lg text-slate-600">
                Kết hợp trí tuệ nhân tạo hiện đại với sự kiểm chứng chuyên môn của đội ngũ y bác sĩ lâm sàng.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Step 1 */}
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-[#0f766e] text-white flex items-center justify-center font-bold text-lg mb-6 shadow-sm">
                  1
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Khai báo hồ sơ & Thuốc
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Nhập chẩn đoán bệnh lý (Tiểu đường, Gút, Tăng HA...), đơn thuốc đang điều trị, tiền sử dị ứng thực phẩm và các chỉ số sinh hiệu gần nhất.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white rounded-2xl p-8 border border-teal-200 shadow-sm relative flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-[#0f766e] text-white flex items-center justify-center font-bold text-lg mb-6 shadow-sm">
                  2
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  AI RAG đề xuất thực đơn
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Mô hình AI đối soát cơ sở dữ liệu Viện Dinh Dưỡng và Dược thư, tính toán chính xác khẩu phần Calo, Carbs, Đạm, Chất béo cho 3 bữa/ngày.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-[#0f766e] text-white flex items-center justify-center font-bold text-lg mb-6 shadow-sm">
                  3
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Bác sĩ duyệt & Đồng hành
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Bác sĩ chuyên khoa thẩm định và phê duyệt thực đơn. Người bệnh ghi nhận nhật ký ăn uống hàng ngày để theo dõi mức độ tuân thủ điều trị.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. BENTO GRID 2.0 (CORE PLATFORM CAPABILITIES) */}
        <section className="w-full py-16 lg:py-24 bg-white border-b border-slate-200" id="tinh-nang">
          <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight mb-4">
                Công nghệ & Tính năng đột phá
              </h2>
              <p className="text-base sm:text-lg text-slate-600">
                Được xây dựng trên nền tảng RAG y văn, cơ sở dữ liệu món ăn Việt và giám sát y tế liên tục.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Feature 1: Vietnamese Food RAG Database (Span 8) */}
              <div className="md:col-span-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-8 sm:p-10 flex flex-col justify-between overflow-hidden relative">
                <div className="z-10 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold mb-4 border border-teal-500/30">
                    <span className="material-symbols-outlined text-[16px]">database</span>
                    CSDL Món ăn Việt Nam
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                    RAG y văn trên 1.200+ món ăn truyền thống
                  </h3>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
                    Không áp dụng các công thức xa lạ của phương Tây. VMEC-10 định lượng chi tiết các món ăn quen thuộc hàng ngày: từ phở, bún riêu, canh chua cá lóc đến thịt kho tàu, giúp bệnh nhân ăn ngon mà vẫn an toàn.
                  </p>
                </div>
                <div className="z-10 grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
                  <div>
                    <div className="text-lg font-bold text-teal-400">GI & GL</div>
                    <div className="text-xs text-slate-400">Chỉ số đường huyết chuẩn</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-teal-400">Natri & Kali</div>
                    <div className="text-xs text-slate-400">Kiểm soát bệnh thận & HA</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-teal-400">Purin mg</div>
                    <div className="text-xs text-slate-400">Khắc chế cơn đau Gút</div>
                  </div>
                </div>
              </div>

              {/* Feature 2: HITL Doctor Approval (Span 4) */}
              <div className="md:col-span-4 bg-teal-50 border border-teal-200 rounded-3xl p-8 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#0f766e] text-white flex items-center justify-center mb-6 shadow-sm">
                    <span className="material-symbols-outlined text-[24px]">verified</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Human-in-the-Loop (HITL)
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    AI không tự ý chẩn đoán. Mọi khuyến nghị thực đơn đều đi qua cổng phê duyệt của bác sĩ điều trị trước khi người bệnh áp dụng.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-teal-200/80 flex items-center gap-2 text-xs font-bold text-[#0f766e]">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  An toàn y tế tối đa
                </div>
              </div>

              {/* Feature 3: Drug-Food Interaction Engine (Span 4) */}
              <div className="md:col-span-4 bg-[#f8fafc] border border-slate-200 rounded-3xl p-8 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[24px]">medication_liquid</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Cảnh báo tương tác thuốc
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Tự động nhận diện xung đột giữa thuốc đang sử dụng (Metformin, Amlodipine, Warfarin...) và các loại gia vị, thảo dược hay thực phẩm.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">shield</span>
                  Phòng ngừa biến chứng sớm
                </div>
              </div>

              {/* Feature 4: Food Log 3-Slot Tracking (Span 4) */}
              <div className="md:col-span-4 bg-[#f8fafc] border border-slate-200 rounded-3xl p-8 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[24px]">menu_book</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Nhật ký ăn uống 3 bữa
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Ghi lại món ăn thực tế chỉ với vài chạm. Hệ thống tự động so khớp với thực đơn khuyến nghị và chấm điểm tuân thủ dinh dưỡng.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">insights</span>
                  Đo lường tuân thủ thực tế
                </div>
              </div>

              {/* Feature 5: Patient Metrics Time-Series (Span 4) */}
              <div className="md:col-span-4 bg-[#f8fafc] border border-slate-200 rounded-3xl p-8 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[24px]">monitoring</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Chuỗi thời gian sinh hiệu
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Theo dõi biến thiên HbA1c, Huyết áp tâm thu/tâm trương, Cân nặng và BMI qua biểu đồ trực quan, giúp thấy rõ hiệu quả của chế độ ăn.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-semibold text-sky-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  Minh bạch kết quả điều trị
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 6. DUAL AUDIENCE PORTALS (PATIENTS & CLINICIANS) */}
        <section className="w-full py-16 lg:py-24 bg-[#f8fafc] border-b border-slate-200" id="doi-tuong">
          <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Patient Portal Card */}
              <div className="bg-white rounded-3xl p-8 sm:p-10 border border-teal-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-teal-100 text-[#0f766e] flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      person
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    Dành cho Bệnh nhân & Gia đình
                  </h3>
                  <p className="text-base text-slate-600 leading-relaxed mb-6">
                    Chủ động kiểm soát sức khỏe thông qua dinh dưỡng chính xác. Nhận thực đơn ngon miệng mỗi tuần, không lo biến chứng và luôn có bác sĩ đồng hành.
                  </p>
                  <ul className="space-y-3 text-sm text-slate-700 mb-8">
                    <li className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#0f766e] text-[20px]">check_circle</span>
                      Chat hỏi đáp dinh dưỡng thông minh 24/7
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#0f766e] text-[20px]">check_circle</span>
                      Thực đơn 7 ngày phân chia Calo & Macros rõ ràng
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#0f766e] text-[20px]">check_circle</span>
                      Theo dõi tiến độ sức khỏe qua biểu đồ trực quan
                    </li>
                  </ul>
                </div>
                <Link
                  href="/patient"
                  className="bg-[#0f766e] hover:bg-[#115e59] text-white font-semibold text-base h-12 px-6 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all self-start"
                >
                  <span>Truy cập Cổng Bệnh nhân</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>

              {/* Doctor Portal Card */}
              <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow" id="bac-si">
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      medical_services
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    Dành cho Bác sĩ & Chuyên gia
                  </h3>
                  <p className="text-base text-slate-600 leading-relaxed mb-6">
                    Công cụ hỗ trợ ra quyết định lâm sàng (CDSS) mạnh mẽ. Giám sát hàng trăm bệnh nhân từ xa với dữ liệu nhật ký ăn uống và chỉ số sinh hiệu có cấu trúc.
                  </p>
                  <ul className="space-y-3 text-sm text-slate-700 mb-8">
                    <li className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#0f766e] text-[20px]">check_circle</span>
                      Hàng đợi duyệt thực đơn nhanh (Review Queue)
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#0f766e] text-[20px]">check_circle</span>
                      Cảnh báo vi phạm tuân thủ (Compliance Alert)
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#0f766e] text-[20px]">check_circle</span>
                      Tùy chỉnh ràng buộc lâm sàng (Clinical Constraints)
                    </li>
                  </ul>
                </div>
                <Link
                  href="/doctor"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base h-12 px-6 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all self-start"
                >
                  <span>Truy cập Cổng Bác sĩ</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* 7. FINAL MEDICAL CTA BANNER */}
        <section className="w-full py-16 lg:py-20 bg-gradient-to-br from-[#0f766e] to-[#115e59] text-white">
          <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Sẵn sàng nâng cao hiệu quả điều trị cùng VMEC-10?
              </h2>
              <p className="text-base sm:text-lg text-teal-100 leading-relaxed">
                Đăng ký ngay hôm nay để nhận gợi ý thực đơn chuẩn lâm sàng đầu tiên được thiết kế riêng cho bệnh lý của bạn.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <Link
                  href="/register"
                  className="bg-white hover:bg-teal-50 text-[#0f766e] font-bold text-base h-12 px-8 rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-[0.98]"
                >
                  Bắt đầu miễn phí ngay
                </Link>
                <Link
                  href="/patient"
                  className="bg-teal-800/80 hover:bg-teal-800 text-white border border-teal-400/40 font-semibold text-base h-12 px-7 rounded-xl flex items-center justify-center transition-colors"
                >
                  Xem demo trước
                </Link>
              </div>
              <p className="text-xs text-teal-200 pt-2">
                Không yêu cầu thẻ tín dụng • Hoàn toàn bảo mật thông tin y tế theo chuẩn HIPAA
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 8. FOOTER WITH CLINICAL DISCLAIMER */}
      <footer className="w-full bg-slate-900 text-slate-400 border-t border-slate-800 py-12 lg:py-16 text-sm">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b border-slate-800">
            
            {/* Brand Column */}
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5 text-white font-bold text-xl">
                <div className="w-8 h-8 rounded-lg bg-[#0f766e] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    health_and_safety
                  </span>
                </div>
                <span>VMEC-10 Clinical Nutrition</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
                Trợ lý Dinh dưỡng Lâm sàng ứng dụng AI và RAG y văn, đồng hành cùng bệnh nhân mãn tính và chuyên gia y tế tại Việt Nam.
              </p>
              <div className="text-xs text-slate-500">
                © {new Date().getFullYear()} VMEC-10. All rights reserved.
              </div>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-3 space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider">
                Giải pháp & Cổng truy cập
              </div>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <Link href="/patient" className="hover:text-white transition-colors">
                    Cổng Bệnh nhân (Patient Portal)
                  </Link>
                </li>
                <li>
                  <Link href="/doctor" className="hover:text-white transition-colors">
                    Cổng Bác sĩ (Clinician Portal)
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    Đăng nhập tài khoản
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-white transition-colors">
                    Đăng ký bệnh nhân mới
                  </Link>
                </li>
              </ul>
            </div>

            {/* Medical References */}
            <div className="md:col-span-4 space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider">
                Cơ sở Khoa học & Tiêu chuẩn
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                <li>Bảng thành phần thực phẩm Việt Nam (Viện Dinh Dưỡng Quốc Gia)</li>
                <li>Hướng dẫn dinh dưỡng lâm sàng ADA (Hiệp hội Đái tháo đường Hoa Kỳ)</li>
                <li>Dược thư Quốc gia Việt Nam & FDA Drug Interaction Guidelines</li>
                <li>Nguyên tắc an toàn y khoa Human-in-the-Loop (HITL Guardrails)</li>
              </ul>
            </div>

          </div>

          {/* Medical Disclaimer Banner */}
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
            <p className="max-w-3xl leading-relaxed text-center md:text-left">
              <strong>Tuyên bố miễn trừ trách nhiệm y khoa:</strong> VMEC-10 là hệ thống hỗ trợ ra quyết định dinh dưỡng dựa trên y văn và có sự đồng hành của bác sĩ điều trị. Các khuyến nghị không thay thế chẩn đoán y khoa trực tiếp hay phác đồ cấp cứu tại bệnh viện.
            </p>
            <div className="flex gap-6 shrink-0">
              <a href="#" className="hover:text-white transition-colors">Điều khoản</a>
              <a href="#" className="hover:text-white transition-colors">Bảo mật</a>
              <a href="#" className="hover:text-white transition-colors">Liên hệ</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

