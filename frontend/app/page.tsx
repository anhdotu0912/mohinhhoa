"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MedicalAmbientBackground } from "@/components/home/MedicalAmbientBackground";
import { ClinicalChatLoopPreview } from "@/components/home/ClinicalChatLoopPreview";
import { APP_NAME } from "@/lib/brand";

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeAudienceTab, setActiveAudienceTab] = useState<"patient" | "doctor">("patient");
  const [mobileHeroTab, setMobileHeroTab] = useState<"overview" | "chat">("overview");

  return (
    <div className="bg-[#f8fafc] text-[#0f172a] font-body antialiased min-h-screen flex flex-col justify-between selection:bg-[#0f766e]/20 selection:text-[#0f766e]">
      {/* 1. TOP NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-colors">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20 h-14 sm:h-16 flex justify-between items-center">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#0f766e] to-[#115e59] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <span className="material-symbols-outlined text-[19px] sm:text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  health_and_safety
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm sm:text-base lg:text-lg tracking-tight text-[#0f766e] group-hover:text-[#115e59] transition-colors leading-none truncate">
                  {APP_NAME}
                </span>
                <span className="text-[8.5px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5 truncate">
                  Dinh dưỡng Lâm sàng AI
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-6 ml-6 pl-6 border-l border-slate-200">
              <a href="#tro-ly" className="text-sm font-medium text-slate-600 hover:text-[#0f766e] transition-colors">
                Trợ lý Dinh dưỡng
              </a>
              <a href="#tinh-nang" className="text-sm font-medium text-slate-600 hover:text-[#0f766e] transition-colors">
                Tính năng Nền tảng
              </a>
              <a href="#doi-tuong" className="text-sm font-medium text-slate-600 hover:text-[#0f766e] transition-colors">
                Bệnh nhân &amp; Bác sĩ
              </a>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-[#0f766e] px-2 sm:px-3 py-1.5 rounded-lg transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="hidden md:flex bg-[#0f766e] hover:bg-[#115e59] text-white text-xs sm:text-sm font-semibold h-8 sm:h-9 px-3 sm:px-4 rounded-lg items-center justify-center shadow-xs hover:shadow transition-all active:scale-[0.98]"
            >
              Bắt đầu ngay
            </Link>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center"
              aria-label="Mở menu điều hướng"
              aria-expanded={mobileMenuOpen}
            >
              <span className="material-symbols-outlined text-[22px]">
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 sm:px-6 py-4 shadow-xl animate-in slide-in-from-top duration-200">
            <div className="flex flex-col space-y-3">
              <a
                href="#tro-ly"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-semibold text-slate-700 hover:text-[#0f766e] py-1 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px] text-[#0f766e]">chat</span>
                <span>Trợ lý Dinh dưỡng</span>
              </a>
              <a
                href="#tinh-nang"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-semibold text-slate-700 hover:text-[#0f766e] py-1 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px] text-[#0f766e]">dataset</span>
                <span>Tính năng Nền tảng</span>
              </a>
              <a
                href="#doi-tuong"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-semibold text-slate-700 hover:text-[#0f766e] py-1 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px] text-[#0f766e]">group</span>
                <span>Bệnh nhân &amp; Bác sĩ</span>
              </a>
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full bg-[#0f766e] text-white font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
                >
                  <span>Bắt đầu miễn phí ngay</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-sm font-medium text-slate-600 hover:text-slate-900 py-1.5"
                >
                  Đã có tài khoản? Đăng nhập
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* MAIN CONTENT CONTAINER */}
      <main className="w-full flex-grow pt-14 sm:pt-16">
        {/* 2. HERO SECTION WITH LOOPING CHAT PREVIEW */}
        <section className="relative w-full py-6 sm:py-8 lg:py-14 border-b border-slate-200/80 overflow-hidden" id="tro-ly">
          <MedicalAmbientBackground />

          <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20">
            {/* Mobile View Switcher Tabs (< lg) */}
            <div className="lg:hidden flex items-center justify-center mb-6">
              <div className="grid grid-cols-2 p-1 bg-slate-200/70 backdrop-blur-xs rounded-xl border border-slate-300/60 w-full max-w-sm">
                <button
                  type="button"
                  onClick={() => setMobileHeroTab("overview")}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mobileHeroTab === "overview"
                      ? "bg-white text-[#0f766e] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  <span>Tổng quan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileHeroTab("chat")}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    mobileHeroTab === "chat"
                      ? "bg-white text-[#0f766e] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                  <span>Xem Trợ lý AI</span>
                </button>
              </div>
            </div>

            {/* Desktop Layout (2 cols) & Mobile Segmented Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-center">

              {/* Left Column: Clinical Value Proposition (Visible on Desktop OR when mobileHeroTab === 'overview') */}
              <div className={`w-full flex flex-col items-start text-left gap-3.5 sm:gap-4 ${
                mobileHeroTab === "overview" ? "flex" : "hidden lg:flex"
              }`}>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-[#0f766e] text-[11px] font-bold">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  <span>Công nghệ Y tế AI Đồng hành cùng Bác sĩ</span>
                </div>

                <h1 className="text-xl sm:text-3xl lg:text-4xl xl:text-[42px] font-extrabold text-slate-900 tracking-tight leading-[1.2] sm:leading-[1.18] animate-hero-slide-up animation-delay-100">
                  Dinh dưỡng chuẩn y khoa cho người bệnh mãn tính
                </h1>

                <p className="text-xs sm:text-sm lg:text-[14.5px] text-slate-600 leading-relaxed animate-hero-slide-up animation-delay-200">
                  Cá nhân hóa thực đơn từng bữa theo chẩn đoán bệnh lý, chỉ số sinh hiệu và đơn thuốc đang điều trị. Kiểm soát đường huyết, huyết áp và mỡ máu an toàn mỗi ngày cùng trợ lý AI và bác sĩ.
                </p>

                {/* Primary Action CTA */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto pt-1 animate-hero-slide-up animation-delay-300">
                  <Link
                    href="/register"
                    className="bg-[#0f766e] hover:bg-[#115e59] text-white font-semibold text-xs sm:text-sm h-10 px-5 sm:px-6 rounded-xl flex items-center justify-center gap-1.5 shadow-xs hover:shadow transition-all active:scale-[0.98]"
                  >
                    <span>Cá nhân hóa thực đơn ngay</span>
                    <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileHeroTab("chat")}
                    className="lg:hidden bg-teal-50 hover:bg-teal-100/70 text-[#0f766e] font-semibold text-xs h-10 px-4 rounded-xl border border-teal-200/80 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                    <span>Thử tương tác Trợ lý AI</span>
                  </button>
                  <Link
                    href="/login"
                    className="hidden sm:flex bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm h-10 px-4 sm:px-5 rounded-xl border border-slate-200 items-center justify-center gap-1.5 shadow-2xs transition-all"
                  >
                    <span>Đăng nhập hệ thống</span>
                  </Link>
                </div>

                {/* Trust Points */}
                <div className="grid grid-cols-3 gap-2 sm:gap-5 pt-3 sm:pt-4 border-t border-slate-200/80 w-full animate-hero-slide-up animation-delay-400">
                  <div className="flex flex-col">
                    <span className="text-base sm:text-xl lg:text-2xl font-extrabold text-[#0f766e]">1.200+</span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">Món ăn Việt phân tích</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-200 pl-2 sm:pl-5">
                    <span className="text-base sm:text-xl lg:text-2xl font-extrabold text-[#0f766e]">100%</span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">Dữ liệu RAG y văn</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-200 pl-2 sm:pl-5">
                    <span className="text-base sm:text-xl lg:text-2xl font-extrabold text-[#0f766e]">100%</span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">Rà soát tương tác thuốc</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Clean Looping Video & Chat Preview (Visible on Desktop OR when mobileHeroTab === 'chat') */}
              <div className={`w-full items-center justify-center lg:justify-end animate-hero-slide-left animation-delay-200 ${
                mobileHeroTab === "chat" ? "flex flex-col" : "hidden lg:flex"
              }`}>
                <div className="w-full max-w-[480px]">
                  <ClinicalChatLoopPreview />
                </div>
                {/* Mobile switch back button */}
                <button
                  type="button"
                  onClick={() => setMobileHeroTab("overview")}
                  className="lg:hidden mt-3 text-xs font-semibold text-[#0f766e] hover:text-[#115e59] inline-flex items-center gap-1 py-1 px-3 rounded-lg bg-white border border-slate-200 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                  <span>Quay lại Xem giới thiệu &amp; Đăng ký</span>
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* 3. BENTO GRID (PLATFORM CAPABILITIES) */}
        <section className="relative w-full py-10 sm:py-14 lg:py-20 bg-[#f8fafc] border-b border-slate-200 overflow-hidden" id="tinh-nang">
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20">
            <div className="max-w-2xl mb-6 animate-hero-slide-up animation-delay-100">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight mb-1.5">
                Công nghệ &amp; Tính năng nền tảng
              </h2>
              <p className="text-xs sm:text-sm lg:text-[14.5px] text-slate-600 leading-relaxed">
                Được xây dựng trên nền tảng RAG y văn, cơ sở dữ liệu món ăn Việt và giám sát y tế liên tục.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">

              {/* Feature 1: Vietnamese Food RAG Database (Span 8) */}
              <div className="md:col-span-8 bg-gradient-to-br from-[#0f172a] via-[#113835] to-[#0f766e] text-white rounded-2xl p-5 sm:p-7 flex flex-col justify-between overflow-hidden relative shadow-sm animate-hero-slide-up animation-delay-200">
                <div className="z-10 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-400/20 text-teal-200 text-[10.5px] sm:text-[11px] font-semibold mb-2.5 border border-teal-400/30">
                    <span className="material-symbols-outlined text-[14px]">database</span>
                    CSDL Món ăn Việt Nam
                  </div>
                  <h3 className="text-base sm:text-xl font-bold text-white mb-1.5">
                    RAG y văn trên 1.200+ món ăn truyền thống
                  </h3>
                  <p className="text-xs text-teal-50/90 leading-relaxed mb-4">
                    Định lượng chi tiết các món ăn quen thuộc hàng ngày: từ phở, bún riêu, canh chua cá lóc đến thịt kho tàu, giúp bệnh nhân ăn ngon mà vẫn an toàn.
                  </p>
                </div>
                <div className="z-10 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 pt-2.5 border-t border-teal-500/30">
                  <div className="bg-white/10 p-2 sm:p-2.5 rounded-xl border border-white/10 flex sm:flex-col justify-between sm:justify-start items-center sm:items-start">
                    <div className="text-xs sm:text-sm font-bold text-teal-300">GI &amp; GL</div>
                    <div className="text-[10px] text-teal-100/80 sm:mt-0.5">Chỉ số đường huyết</div>
                  </div>
                  <div className="bg-white/10 p-2 sm:p-2.5 rounded-xl border border-white/10 flex sm:flex-col justify-between sm:justify-start items-center sm:items-start">
                    <div className="text-xs sm:text-sm font-bold text-teal-300">Natri &amp; Kali</div>
                    <div className="text-[10px] text-teal-100/80 sm:mt-0.5">Bệnh thận &amp; HA</div>
                  </div>
                  <div className="bg-white/10 p-2 sm:p-2.5 rounded-xl border border-white/10 flex sm:flex-col justify-between sm:justify-start items-center sm:items-start">
                    <div className="text-xs sm:text-sm font-bold text-teal-300">Purin mg</div>
                    <div className="text-[10px] text-teal-100/80 sm:mt-0.5">Khắc chế cơn Gút</div>
                  </div>
                </div>
              </div>

              {/* Feature 2: HITL Doctor Approval (Span 4) */}
              <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:border-teal-300 transition-all animate-hero-slide-up animation-delay-300">
                <div>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 text-[#0f766e] flex items-center justify-center mb-3 border border-teal-200/80">
                    <span className="material-symbols-outlined text-[17px] sm:text-[18px]">verified</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1.5">
                    Human-in-the-Loop (HITL)
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    AI không tự ý chẩn đoán. Mọi khuyến nghị thực đơn đều đi qua cổng phê duyệt của bác sĩ điều trị trước khi người bệnh áp dụng.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#0f766e]">
                  <span className="material-symbols-outlined text-[15px]">verified_user</span>
                  An toàn y tế tối đa
                </div>
              </div>

              {/* Feature 3: Drug-Food Interaction Engine (Span 4) */}
              <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:border-rose-200 transition-all animate-hero-slide-up animation-delay-300">
                <div>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mb-3 border border-rose-200/80">
                    <span className="material-symbols-outlined text-[17px] sm:text-[18px]">medication_liquid</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1.5">
                    Cảnh báo tương tác thuốc
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tự động nhận diện xung đột giữa thuốc đang sử dụng (Metformin, Amlodipine, Warfarin...) và các loại gia vị, thảo dược hay thực phẩm.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">shield</span>
                  Phòng ngừa biến chứng sớm
                </div>
              </div>

              {/* Feature 4: Food Log 3-Slot Tracking (Span 4) */}
              <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:border-teal-300 transition-all animate-hero-slide-up animation-delay-400">
                <div>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 text-[#0f766e] flex items-center justify-center mb-3 border border-teal-200/80">
                    <span className="material-symbols-outlined text-[17px] sm:text-[18px]">menu_book</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1.5">
                    Nhật ký ăn uống 3 bữa
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ghi lại món ăn thực tế chỉ với vài chạm. Hệ thống tự động so khớp với thực đơn khuyến nghị và chấm điểm tuân thủ dinh dưỡng.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-semibold text-[#0f766e] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">insights</span>
                  Đo lường tuân thủ thực tế
                </div>
              </div>

              {/* Feature 5: Patient Metrics Time-Series (Span 4) */}
              <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs hover:border-teal-300 transition-all animate-hero-slide-up animation-delay-400">
                <div>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3 border border-slate-200">
                    <span className="material-symbols-outlined text-[17px] sm:text-[18px]">monitoring</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1.5">
                    Theo dõi sinh hiệu
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Theo dõi các chỉ số quan trọng như HbA1c, Huyết áp, Cân nặng và BMI, giúp đánh giá hiệu quả của chế độ ăn uống khoa học.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-[#0f766e]">trending_up</span>
                  Minh bạch kết quả điều trị
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 4. DUAL AUDIENCE PERSPECTIVE */}
        <section className="relative w-full py-10 sm:py-14 lg:py-20 bg-white border-b border-slate-200 overflow-hidden" id="doi-tuong">
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20">
            <div className="text-center max-w-2xl mx-auto mb-6 animate-hero-slide-up animation-delay-100">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight mb-1.5">
                Đồng hành cùng Bệnh nhân &amp; Chuyên gia Y tế
              </h2>
              <p className="text-xs sm:text-sm lg:text-[14.5px] text-slate-600 leading-relaxed">
                Kết nối liền mạch giữa việc tự quản lý tại nhà của người bệnh và sự giám sát chuyên môn từ bác sĩ.
              </p>

              {/* Toggle Audience Tabs - Adaptive Grid on Mobile */}
              <div className="w-full max-w-md mx-auto grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200 mt-4">
                <button
                  type="button"
                  onClick={() => setActiveAudienceTab("patient")}
                  className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center ${activeAudienceTab === "patient"
                      ? "bg-white text-[#0f766e] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Dành cho Người bệnh
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAudienceTab("doctor")}
                  className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center ${activeAudienceTab === "doctor"
                      ? "bg-white text-[#0f766e] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Dành cho Bác sĩ &amp; CSYT
                </button>
              </div>
            </div>

            {/* Audience View: Patient */}
            {activeAudienceTab === "patient" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 animate-in fade-in duration-300">
                <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between animate-hero-slide-up animation-delay-200">
                  <div className="space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0f766e] flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[17px]">restaurant</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Ăn ngon miệng, an toàn</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Thoải mái thưởng thức các món ăn Việt quen thuộc với định lượng an toàn cho đường huyết và huyết áp.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-200/80 text-[10.5px] font-semibold text-[#0f766e]">
                    Trợ lý AI phản hồi 24/7
                  </div>
                </div>

                <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between animate-hero-slide-up animation-delay-300">
                  <div className="space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0f766e] flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[17px]">notification_important</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Cảnh báo thuốc tức thì</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Chỉ cần nhập tên thuốc đang uống, hệ thống sẽ cảnh báo ngay nếu món ăn hoặc đồ uống có nguy cơ gây tương tác có hại.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-200/80 text-[10.5px] font-semibold text-[#0f766e]">
                    Dược thư Quốc gia Việt Nam
                  </div>
                </div>

                <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between animate-hero-slide-up animation-delay-400">
                  <div className="space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0f766e] flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[17px]">show_chart</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Thấy rõ sự cải thiện</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Ghi nhật ký 3 bữa chỉ với 30 giây mỗi ngày và theo dõi trực quan chỉ số HbA1c giảm dần qua từng tuần.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-200/80 text-[10.5px] font-semibold text-[#0f766e]">
                    Đồng hành cùng Bác sĩ điều trị
                  </div>
                </div>
              </div>
            )}

            {/* Audience View: Doctor */}
            {activeAudienceTab === "doctor" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 animate-in fade-in duration-300">
                <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between animate-hero-slide-up animation-delay-200">
                  <div className="space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[17px]">fact_check</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Cổng Clinician HITL</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Phê duyệt hoặc điều chỉnh nhanh các khuyến nghị thực đơn AI tạo cho bệnh nhân trước khi bệnh nhân áp dụng.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-200/80 text-[10.5px] font-semibold text-emerald-800">
                    Bảo đảm an toàn pháp lý y khoa
                  </div>
                </div>

                <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between animate-hero-slide-up animation-delay-300">
                  <div className="space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[17px]">analytics</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Dữ liệu Tuân thủ Khách quan</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Theo dõi chính xác bệnh nhân ăn gì ở nhà giữa 2 kỳ tái khám thay vì chỉ dựa vào lời kể ước chừng của người bệnh.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-200/80 text-[10.5px] font-semibold text-emerald-800">
                    Báo cáo tuân thủ dinh dưỡng tuần
                  </div>
                </div>

                <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col justify-between animate-hero-slide-up animation-delay-400">
                  <div className="space-y-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-[17px]">history_edu</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Gửi Lời dặn &amp; Kê đơn</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Gửi lời dặn dò chuyên môn trực tiếp đến điện thoại người bệnh, gắn kèm với kế hoạch dinh dưỡng từng đợt điều trị.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-200/80 text-[10.5px] font-semibold text-emerald-800">
                    Tiết kiệm 70% thời gian tư vấn
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 5. FOOTER */}
      <footer className="w-full bg-slate-900 text-slate-400 border-t border-slate-800 py-8 lg:py-10 text-xs">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-6 border-b border-slate-800">

            {/* Brand Column */}
            <div className="md:col-span-5 space-y-2.5">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <div className="w-6 h-6 rounded-lg bg-[#0f766e] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    health_and_safety
                  </span>
                </div>
                <span>{APP_NAME} Clinical Nutrition</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm">
                Trợ lý Dinh dưỡng Lâm sàng ứng dụng AI và RAG y văn, đồng hành cùng bệnh nhân mãn tính và chuyên gia y tế tại Việt Nam.
              </p>
              <div className="text-[10px] text-slate-500">
                &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
              </div>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-3 space-y-2">
              <div className="text-[11px] font-bold text-white uppercase tracking-wider">
                Tài khoản &amp; Truy cập
              </div>
              <ul className="space-y-1 text-[11px]">
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    Đăng nhập tài khoản
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-white transition-colors">
                    Đăng ký tài khoản mới
                  </Link>
                </li>
                <li>
                  <a href="#tinh-nang" className="hover:text-white transition-colors">
                    Tính năng nền tảng
                  </a>
                </li>
              </ul>
            </div>

            {/* Medical References */}
            <div className="md:col-span-4 space-y-2">
              <div className="text-[11px] font-bold text-white uppercase tracking-wider">
                Cơ sở Khoa học &amp; Tiêu chuẩn
              </div>
              <ul className="space-y-1 text-[11px] text-slate-400">
                <li>Bảng thành phần thực phẩm Việt Nam (Viện Dinh Dưỡng Quốc Gia)</li>
                <li>Hướng dẫn dinh dưỡng lâm sàng ADA (Hiệp hội Đái tháo đường Hoa Kỳ)</li>
                <li>Dược thư Quốc gia Việt Nam &amp; FDA Drug Interaction Guidelines</li>
                <li>Nguyên tắc an toàn y khoa Human-in-the-Loop (HITL Guardrails)</li>
              </ul>
            </div>

          </div>

          {/* Medical Disclaimer Banner */}
          <div className="pt-4 flex flex-col md:flex-row justify-between items-center gap-2 text-[10.5px] text-slate-400">
            <p className="max-w-3xl leading-relaxed text-center md:text-left">
              <strong>Tuyên bố miễn trừ trách nhiệm y khoa:</strong> {APP_NAME} là hệ thống hỗ trợ ra quyết định dinh dưỡng dựa trên y văn và có sự đồng hành của bác sĩ điều trị. Các khuyến nghị không thay thế chẩn đoán y khoa trực tiếp hay phác đồ cấp cứu tại bệnh viện.
            </p>
            <div className="flex gap-4 shrink-0">
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
