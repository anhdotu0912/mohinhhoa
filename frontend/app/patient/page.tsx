"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { TOPBAR_PATIENT_AVATAR_SRC, DOCTOR_AVATAR_SRC } from "@/lib/nav-config";
import { useMobileMenu } from "@/components/shared/MobileMenuContext";

export default function PatientDashboardPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const displayName = useAuthStore((s) => s.displayName);
  const [hydrated, setHydrated] = useState(false);

  // View states
  const [view, setView] = useState<"home" | "map" | "doctor" | "menu" | "chart">("home");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationDetails, setShowNotificationDetails] = useState(false);
  const [showMealLogModal, setShowMealLogModal] = useState(false);

  const { openMobileMenu } = useMobileMenu();

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

  if (!hydrated) return null;

  const greetingName = displayName?.trim() ? displayName : "bạn";
  const greeting = `Chào buổi sáng, ${greetingName}`;

  return (
    <div className="min-h-screen flex flex-col relative w-full bg-[#F7F9F9] font-body overflow-x-hidden">
      {/* TopBar matching the design */}
      <header className="flex justify-between items-center px-8 py-5 w-full bg-[#F7F9F9] sticky top-0 z-30">
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

      {/* Sub-header Bar */}
      <div className="w-full px-8 py-2.5 bg-white border-y border-outline-variant/30 flex items-center justify-between z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hidden md:flex">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 border border-[#006857] rounded-md text-[13px] text-[#006857] hover:bg-[#E4F2EE] transition-colors font-medium bg-white shadow-sm">
            <span className="material-symbols-outlined text-[16px]">history</span>
            Chat history
          </button>
          <button 
            onClick={() => setView("home")}
            className="flex items-center gap-2 px-3 py-1.5 border border-[#006857] rounded-md text-[13px] text-[#006857] hover:bg-[#E4F2EE] transition-colors font-medium bg-white shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New chat
          </button>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-2 px-3 py-1.5 border border-[#006857] rounded-md text-[13px] text-[#006857] hover:bg-[#E4F2EE] transition-colors font-medium bg-white shadow-sm">
            <span className="material-symbols-outlined text-[16px]">article</span>
            References
          </button>
          
          <div className="flex items-center gap-1.5 text-[#006857] text-[13px] font-medium">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            Medical Analysis & Personalized Nutrition Advice
          </div>
        </div>
      </div>

      <main className="flex-1 w-full flex flex-col items-center justify-center px-4 py-10 relative">
        {view === "home" ? (
          /* ======================= HOME VIEW ======================= */
          <div className="flex flex-col items-center w-full max-w-3xl mx-auto h-full justify-center mt-[-60px]">
            {/* AI Avatar */}
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-green-100 via-blue-50 to-white shadow-lg flex items-center justify-center mb-8 border-[6px] border-white relative">
              <div className="w-24 h-24 bg-[#006857] rounded-full flex items-center justify-center relative overflow-hidden shadow-inner">
                {/* Simple robot face representation */}
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
              {greeting}
            </h1>
            <p className="text-on-surface-variant text-base mb-12 text-center">
              Tôi có thể giúp gì cho sức khỏe của bạn hôm nay?
            </p>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <button onClick={() => setView("menu")} className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#006857] bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group text-left">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-[#2f8f7a] shrink-0 group-hover:bg-[#2f8f7a] group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[24px]">restaurant</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">Hôm nay ăn gì?</h3>
                  <p className="text-on-surface-variant text-sm mt-0.5">Gợi ý thực đơn cá nhân hóa</p>
                </div>
              </button>

              <button onClick={() => setView("chart")} className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#006857] bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group text-left">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[24px]">show_chart</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">Chỉ số của tôi thế nào?</h3>
                  <p className="text-on-surface-variant text-sm mt-0.5">Xem nhịp tim & đường huyết</p>
                </div>
              </button>

              <button onClick={() => setView("doctor")} className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#006857] bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group text-left">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0 group-hover:bg-red-500 group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[24px]">assignment</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">Bác sĩ dặn gì?</h3>
                  <p className="text-on-surface-variant text-sm mt-0.5">Xem lại lời khuyên chuyên môn</p>
                </div>
              </button>

              <button onClick={() => setShowMealLogModal(true)} className="flex items-center gap-4 p-5 rounded-2xl border-2 border-[#006857] bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group text-left">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-[#2f8f7a] shrink-0 group-hover:bg-[#2f8f7a] group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[24px]">playlist_add_check</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">Ghi nhận bữa ăn</h3>
                  <p className="text-on-surface-variant text-sm mt-0.5">Cập nhật calo nhanh chóng</p>
                </div>
              </button>
            </div>

            {/* Spacer for chat input */}
            <div className="flex-1"></div>
          </div>
        ) : view === "map" ? (
          /* ======================= MAP CHAT VIEW ======================= */
          <div className="flex flex-col w-full h-full max-w-4xl mx-auto pb-24 pt-4">
            {/* User Message */}
            <div className="flex justify-end w-full mb-8">
              <div className="bg-[#E4F2EE] text-on-surface py-3 px-5 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm text-[15px]">
                Các điểm để mua nguyên liệu nấu quanh đây?
              </div>
            </div>

            {/* AI Message */}
            <div className="flex flex-col w-full mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-100 to-green-50 flex items-center justify-center shadow-sm border border-white">
                  <span className="material-symbols-outlined text-[18px] text-[#006857]">smart_toy</span>
                </div>
                <span className="font-bold text-[#006857] text-sm tracking-wide">VMEC-10 AI</span>
              </div>

              <div className="pl-11 w-full flex flex-col gap-4">
                <p className="text-on-surface text-[15px]">
                  Dưới đây là các địa điểm mua sắm nguyên liệu tươi sạch gần vị trí của bạn tại Quận 3:
                </p>

                {/* Map Component */}
                <div className="w-full relative h-[320px] rounded-2xl overflow-hidden border border-outline-variant/30 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] bg-[#F0F4F8]">
                  {/* Simulated Map Background */}
                  <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                  <div className="absolute top-[40%] left-[20%] w-[120%] h-8 bg-blue-100/50 -rotate-12 border-y border-blue-200"></div>
                  <div className="absolute top-[60%] left-[10%] w-[120%] h-6 bg-blue-100/50 -rotate-12 border-y border-blue-200"></div>

                  {/* User Location Dot */}
                  <div className="absolute top-[50%] left-[50%] w-4 h-4 bg-blue-600 rounded-full border-[3px] border-white shadow-md z-10 -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute inset-0 bg-blue-600 rounded-full animate-ping opacity-50"></div>
                  </div>

                  {/* Map Pins */}
                  <div className="absolute top-[35%] left-[35%] z-10 flex flex-col items-center">
                    <div className="w-6 h-6 bg-[#006857] text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md">1</div>
                    <div className="w-1 h-3 bg-[#006857]"></div>
                  </div>

                  <div className="absolute top-[45%] left-[65%] z-10 flex flex-col items-center">
                    <div className="w-6 h-6 bg-[#006857] text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md">2</div>
                    <div className="w-1 h-3 bg-[#006857]"></div>
                  </div>

                  {/* Floating Info Card */}
                  <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-outline-variant/20 p-4 z-20 min-w-[200px]">
                    <h4 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Gần bạn nhất</h4>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 bg-[#E4F2EE] text-[#006857] rounded-full flex items-center justify-center text-[10px] font-bold">1</div>
                        <span className="text-[14px] font-bold text-on-surface">Co.opmart</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 bg-[#E4F2EE] text-[#006857] rounded-full flex items-center justify-center text-[10px] font-bold">2</div>
                        <span className="text-[14px] font-bold text-on-surface">Chợ Vườn Chuối</span>
                      </div>
                    </div>
                  </div>

                  {/* View Larger Map Button */}
                  <button className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-full shadow-md border border-outline-variant/20 px-4 py-2 flex items-center gap-2 text-[#006857] hover:bg-[#F7F9F9] transition-colors z-20 text-[13px] font-bold">
                    <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                    Xem bản đồ lớn
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : view === "menu" ? (
          /* ======================= MENU SUGGESTION CHAT VIEW ======================= */
          <div className="flex flex-col w-full h-full max-w-4xl mx-auto pb-24 pt-4 relative">
            {/* User Message */}
            <div className="flex justify-end w-full mb-8 mt-4">
              <div className="bg-[#E4F2EE] text-[#006857] py-3 px-5 rounded-2xl rounded-tr-sm max-w-[80%] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] text-[15px] border border-[#006857]/10">
                Hôm nay tôi nên ăn gì?
              </div>
            </div>

            {/* AI Message */}
            <div className="flex flex-col w-full mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#20B2AA] flex items-center justify-center shadow-sm text-white border border-[#20B2AA]">
                  <span className="material-symbols-outlined text-[14px]">restaurant_menu</span>
                </div>
                <span className="font-bold text-[#20B2AA] text-[13px] tracking-wide">VMEC-10 AI</span>
              </div>

              <div className="pl-10 w-full flex flex-col gap-4">
                <div className="bg-white border border-outline-variant/30 py-3 px-5 rounded-2xl rounded-tl-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] w-fit text-on-surface text-[15px]">
                  Dựa trên chỉ số đường huyết sáng nay, tôi đề xuất thực đơn giàu Omega-3 và ít muối cho bạn.
                </div>

                {/* Food Cards (Horizontal Scroll) */}
                <div className="flex gap-4 overflow-x-auto pb-4 pt-2 -mx-4 px-4 snap-x">
                  {/* Card 1 */}
                  <div className="min-w-[240px] max-w-[240px] bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden snap-start flex flex-col">
                    <div className="relative h-[140px] w-full bg-gray-100">
                      <img src="https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=500&q=80" alt="Bánh mì đen" className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-bold text-on-surface-variant flex items-center gap-1 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div> Sáng
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <h4 className="font-bold text-on-surface text-[15px] mb-2 leading-tight">Bánh mì đen bơ trứng</h4>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="min-w-[240px] max-w-[240px] bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden snap-start flex flex-col">
                    <div className="relative h-[140px] w-full bg-gray-100">
                      <img src="https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=80" alt="Cá hồi" className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-bold text-on-surface-variant flex items-center gap-1 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Trưa
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <h4 className="font-bold text-on-surface text-[15px] mb-2 leading-tight">Cá hồi áp chảo</h4>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="min-w-[240px] max-w-[240px] bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden snap-start flex flex-col">
                    <div className="relative h-[140px] w-full bg-gray-100">
                      <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80" alt="Salad" className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-bold text-on-surface-variant flex items-center gap-1 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div> Tối
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <h4 className="font-bold text-on-surface text-[15px] mb-2 leading-tight">Salad Quinoa</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : view === "chart" ? (
          /* ======================= CHART CHAT VIEW ======================= */
          <div className="flex flex-col w-full h-full max-w-4xl mx-auto pb-24 pt-4 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-white px-3 py-1 rounded-full shadow-sm border border-outline-variant/20">
              Hôm nay
            </div>
            {/* User Message */}
            <div className="flex justify-end w-full mb-8 mt-10">
              <div className="bg-[#E4F2EE] text-[#006857] py-3 px-5 rounded-2xl rounded-tr-sm max-w-[80%] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] text-[15px] border border-[#006857]/10">
                Tuân thủ của tôi tuần này thế nào?
              </div>
            </div>

            {/* AI Message */}
            <div className="flex flex-col w-full mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#20B2AA] flex items-center justify-center shadow-sm text-white border border-[#20B2AA]">
                  <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                </div>
              </div>

              <div className="pl-10 w-full flex flex-col gap-4">
                {/* Chart Card */}
                <div className="bg-white border border-outline-variant/30 rounded-2xl p-6 w-full max-w-[500px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col">
                  <p className="text-on-surface text-[15px] font-medium mb-6">
                    Bạn đang duy trì phong độ rất tốt với tỉ lệ tuân thủ 92%.
                  </p>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-5xl font-bold text-[#006857] tracking-tighter">92%</span>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">TUÂN THỦ TRUNG BÌNH TUẦN</span>
                  </div>

                  {/* Simulated Line Chart */}
                  <div className="w-full h-[180px] relative border-b border-outline-variant/20 mb-4 flex items-end">
                    {/* SVG Line & Area */}
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <path d="M 0 60 C 20 60, 20 65, 33 70 C 45 75, 50 80, 66 80 C 80 80, 80 40, 100 40 L 100 100 L 0 100 Z" fill="url(#gradient-green)" opacity="0.3" />
                      <path d="M 0 60 C 20 60, 20 65, 33 70 C 45 75, 50 80, 66 80 C 80 80, 80 40, 100 40" fill="none" stroke="#006857" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                      <defs>
                        <linearGradient id="gradient-green" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#006857" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#006857" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Data Points & Labels */}
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => (
                      <div key={day} className="flex-1 flex flex-col items-center justify-end h-full relative z-10 pb-2">
                        <div className="absolute font-bold text-[#006857] text-[11px]" style={{ bottom: [62, 67, 72, 82, 82, 42, 42][i] + '%' }}>
                          {[80, 85, 88, 90, 90, 95, 95][i]}%
                        </div>
                        <div className="absolute w-2 h-2 bg-[#006857] rounded-full border-2 border-white shadow-sm" style={{ bottom: [58, 63, 68, 78, 78, 38, 38][i] + '%' }}></div>

                        <span className={`text-[10px] font-medium mt-auto pt-2 ${i === 6 ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>{day}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#006857]"></div><span className="text-[10px] text-on-surface-variant font-medium">Đúng thực đơn</span></div>
                      <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div><span className="text-[10px] text-on-surface-variant font-medium">Thực đơn khác</span></div>
                      <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div><span className="text-[10px] text-on-surface-variant font-medium">Thiếu dữ liệu</span></div>
                    </div>
                    <button className="text-[#006857] font-bold text-[11px] flex items-center gap-1 hover:underline">
                      Xem báo cáo chi tiết <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ======================= DOCTOR NOTE CHAT VIEW ======================= */
          <div className="flex flex-col w-full h-full max-w-4xl mx-auto pb-24 pt-4 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-white px-3 py-1 rounded-full shadow-sm border border-outline-variant/20">
              Hôm nay, 09:42 AM
            </div>
            {/* User Message */}
            <div className="flex justify-end w-full mb-8 mt-10">
              <div className="bg-[#E4F2EE] text-[#006857] py-3 px-5 rounded-2xl rounded-tr-sm max-w-[80%] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] text-[15px] border border-[#006857]/10">
                Bác sĩ có dặn gì không?
              </div>
            </div>

            {/* AI Message */}
            <div className="flex flex-col w-full mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#20B2AA] flex items-center justify-center shadow-sm text-white border border-[#20B2AA]">
                  <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                </div>
                <span className="font-bold text-[#20B2AA] text-[13px] tracking-wide">VMEC-10 AI</span>
              </div>

              <div className="pl-10 w-full flex flex-col gap-4">
                <div className="bg-white border border-outline-variant/30 py-3 px-5 rounded-2xl rounded-tl-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] w-fit text-on-surface text-[15px]">
                  Bác sĩ Minh đã để lại một ghi chú quan trọng cho bạn vào sáng nay.
                </div>

                {/* Doctor Note Card */}
                <div className="bg-[#F8FAFC] border border-outline-variant/30 rounded-2xl p-5 w-full max-w-md shadow-sm flex flex-col gap-4 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={DOCTOR_AVATAR_SRC} alt="Doctor" className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex flex-col">
                        <span className="font-bold text-on-surface text-[15px]">BS. Minh Nguyễn</span>
                        <span className="text-on-surface-variant text-[12px] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">local_hospital</span> Khoa Tim mạch
                        </span>
                      </div>
                    </div>
                    <span className="text-on-surface-variant font-bold text-[10px] bg-white px-2 py-1 rounded-md border border-outline-variant/30 shadow-sm">
                      08:15 AM
                    </span>
                  </div>

                  <div className="bg-white border border-outline-variant/30 rounded-xl p-4 flex gap-3 shadow-sm relative overflow-hidden">
                    <span className="material-symbols-outlined text-[#20B2AA] text-[24px] rotate-180 absolute top-4 left-3 opacity-80">format_quote</span>
                    <p className="text-on-surface font-medium text-[14px] italic pl-8">
                      "Hãy duy trì việc đi bộ 30p mỗi ngày và hạn chế tinh bột trắng."
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="bg-[#FEE2E2] text-[#B91C1C] px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-sm border border-[#FCA5A5]/50">
                      <span className="material-symbols-outlined text-[14px]">warning</span> Hạn chế muối
                    </span>
                    <span className="bg-[#DBEAFE] text-[#1D4ED8] px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-sm border border-[#93C5FD]/50">
                      <span className="material-symbols-outlined text-[14px]">calendar_month</span> Tái khám 2 tuần
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Chat Input Bar */}
      <div className="w-full max-w-3xl mx-auto px-4 mt-auto z-10 sticky bottom-0 bg-[#F7F9F9]/90 backdrop-blur-sm pb-8 pt-4">
        <div className="relative flex items-center w-full bg-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.06)] rounded-full overflow-hidden border-2 border-[#006857]">
          <input
            type="text"
            placeholder={
              view === "doctor" ? "Hỏi thêm về ghi chú này..." :
                view === "menu" ? "Hỏi thêm về thực đơn..." :
                  view === "chart" ? "Hỏi về sức khỏe của bạn..." :
                    "Nhắn tin cho VMEC-10..."
            }
            className="flex-1 bg-transparent py-4 pl-6 pr-16 outline-none text-on-surface text-[15px] placeholder:text-on-surface-variant/50 relative z-0"
          />
          <button className="absolute right-2 w-10 h-10 bg-[#006857] text-white rounded-full flex items-center justify-center hover:bg-[#005142] transition-colors shadow-md z-10">
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>

      {/* Right Floating Bar */}
      <div className="hidden md:flex flex-col items-center gap-4 fixed right-8 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-md rounded-full py-4 px-2 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)] border border-outline-variant/30 z-40">
        {/* Menu Toggle */}
        <button
          onClick={() => setView(view === "menu" ? "home" : "menu")}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${view === "menu"
              ? "bg-[#006857] text-white ring-[6px] ring-[#E4F2EE] shadow-sm"
              : "bg-transparent text-on-surface-variant hover:bg-surface-variant"
            }`}
          title="Xem Gợi ý thực đơn"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        {/* Notifications Toggle */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 z-50 relative ${showNotifications || view === "doctor"
                ? "bg-[#006857] text-white ring-[6px] ring-[#E4F2EE] shadow-sm"
                : "bg-transparent text-on-surface-variant hover:bg-surface-variant"
              }`}
            title="Xem Thông báo"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </button>

          {/* Notifications Overlay */}
          {showNotifications && (
            <div className="absolute right-[76px] top-1/2 -translate-y-1/2 w-[320px] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] border border-outline-variant/20 flex flex-col overflow-hidden z-40">
              <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-white">
                <h3 className="font-semibold text-on-surface text-[14px]">Thông báo</h3>
                <span className="text-[#006857] font-bold text-[10px] tracking-wide">3 MỚI</span>
              </div>

              <div className="flex flex-col max-h-[400px] overflow-y-auto bg-white">
                {/* Item 1 */}
                <div
                  className="p-4 border-b border-outline-variant/10 flex gap-3 hover:bg-surface-variant/30 cursor-pointer transition-colors"
                  onClick={() => { setShowNotificationDetails(true); setShowNotifications(false); }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#006857] mt-1.5 shrink-0"></div>
                  <div className="flex flex-col gap-1">
                    <p className="text-on-surface text-[13px] leading-relaxed">Kế hoạch dinh dưỡng tuần mới đã được bác sĩ duyệt.</p>
                    <span className="text-on-surface-variant text-[11px]">2 phút trước</span>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="p-4 border-b border-outline-variant/10 flex gap-3 hover:bg-surface-variant/30 cursor-pointer transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] mt-1.5 shrink-0"></div>
                  <div className="flex flex-col gap-1">
                    <p className="text-on-surface text-[13px] leading-relaxed">Đừng quên cập nhật chỉ số huyết áp chiều nay.</p>
                    <span className="text-on-surface-variant text-[11px]">1 giờ trước</span>
                  </div>
                </div>

                {/* Item 3 */}
                <div
                  className="p-4 flex gap-3 hover:bg-surface-variant/30 cursor-pointer transition-colors"
                  onClick={() => { setView("doctor"); setShowNotifications(false); }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] mt-1.5 shrink-0"></div>
                  <div className="flex flex-col gap-1">
                    <p className="text-on-surface text-[13px] leading-relaxed">Bác sĩ Minh Nguyễn vừa gửi lời nhắn mới cho bạn.</p>
                    <span className="text-on-surface-variant text-[11px]">3 giờ trước</span>
                  </div>
                </div>
              </div>

              <div className="py-3 text-center border-t border-outline-variant/10 bg-white">
                <button className="text-[#006857] font-semibold text-[13px] hover:underline">
                  Xem tất cả
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Toggle Chart / Meal Log Button */}
        <button
          onClick={() => setShowMealLogModal(!showMealLogModal)}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95 ${showMealLogModal || view === "chart"
              ? "bg-[#006857] text-white ring-[6px] ring-[#E4F2EE] shadow-sm"
              : "bg-transparent text-on-surface-variant hover:bg-surface-variant"
            }`}
          title="Ghi nhận tuân thủ"
        >
          <span className="material-symbols-outlined text-[22px]">bar_chart</span>
        </button>
      </div>

      {/* Modals */}
      {showNotificationDetails && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-4">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-[#E4F2EE] flex items-center justify-center text-[#006857]">
                  <span className="material-symbols-outlined text-[20px]">post_add</span>
                </div>
                <button onClick={() => setShowNotificationDetails(false)} className="text-on-surface-variant hover:text-on-surface p-1">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p className="text-[13px] font-bold text-on-surface mb-1">Chi tiết thông báo</p>
              <h2 className="text-2xl font-bold text-on-surface leading-tight mb-2">Kế hoạch dinh dưỡng tuần mới đã được phê duyệt</h2>
              <div className="flex items-center gap-2 text-[12px] text-on-surface-variant mb-6">
                <span className="font-bold">Hệ thống điều trị VMEC</span>
                <span>•</span>
                <span>Hôm nay, 08:15 AM</span>
              </div>
              <p className="text-[14px] text-on-surface leading-relaxed text-justify mb-2">
                Bác sĩ Minh Nguyễn đã hoàn tất việc xem xét và phê duyệt kế hoạch dinh dưỡng của bạn cho tuần từ 12/10 đến 18/10. Kế hoạch này đã được tối ưu hóa dựa trên các chỉ số huyết áp gần đây của bạn.
              </p>
            </div>
            <div className="p-4 border-t border-outline-variant/20 bg-surface-variant/10 flex justify-end gap-3">
              <button onClick={() => setShowNotificationDetails(false)} className="px-6 py-2.5 rounded-full border border-outline-variant text-on-surface font-semibold text-[14px] hover:bg-surface-variant transition-colors">
                Đóng
              </button>
              <button className="px-6 py-2.5 rounded-full bg-[#006857] text-white font-semibold text-[14px] shadow-sm hover:bg-[#005142] transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">visibility</span> Xem thực đơn tuần mới
              </button>
            </div>
          </div>
        </div>
      )}

      {showMealLogModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-outline-variant/10">
            <div className="p-5 border-b border-outline-variant/20 flex justify-between items-center bg-white z-10 relative">
              <h2 className="text-[18px] font-bold text-on-surface">Ghi nhận tuân thủ</h2>
              <button onClick={() => setShowMealLogModal(false)} className="text-on-surface-variant hover:text-on-surface p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col overflow-y-auto bg-[#F7F9F9] gap-6 max-h-[70vh]">
              {/* Mini Chart */}
              <div className="flex flex-col">
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Mức độ tuân thủ tuần này</p>
                <div className="bg-[#E4F2EE]/50 rounded-xl h-[100px] w-full flex items-end justify-between px-4 pt-4 pb-0 relative overflow-hidden border border-[#006857]/10">
                  {/* Bars */}
                  {[40, 50, 30, 60, 45, 80, 10].map((h, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 h-full justify-end z-10">
                      <div className={`w-[80%] rounded-t-sm transition-all ${i === 5 ? 'bg-[#006857]' : 'bg-[#006857]/20 hover:bg-[#006857]/30'}`} style={{ height: `${h}%` }}></div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between px-4 mt-2">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => (
                    <span key={day} className={`text-[10px] font-bold flex-1 text-center ${i === 5 ? 'text-on-surface' : 'text-on-surface-variant'}`}>{day}</span>
                  ))}
                </div>
              </div>

              {/* Meals List */}
              <div className="flex flex-col gap-3">
                {/* Breakfast (Logged) */}
                <div className="bg-white rounded-2xl p-3 flex items-center justify-between border border-outline-variant/30 shadow-sm">
                  <div className="flex items-center gap-3">
                    <img src="https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=100&q=80" alt="Bữa sáng" className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Bữa sáng</span>
                      <span className="text-[14px] font-bold text-on-surface">Bánh mì đen...</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#006857] font-bold text-[12px] bg-[#E4F2EE] px-3 py-1.5 rounded-full">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span> Đã ghi nhận
                  </div>
                </div>

                {/* Lunch (Pending) */}
                <div className="bg-white rounded-2xl p-3 flex items-center justify-between border border-outline-variant/30 shadow-sm">
                  <div className="flex items-center gap-3">
                    <img src="https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=100&q=80" alt="Bữa trưa" className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Bữa trưa</span>
                      <span className="text-[14px] font-bold text-on-surface">Cá hồi áp chảo</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="bg-[#006857] text-white font-bold text-[11px] px-4 py-2 rounded-full shadow-sm hover:bg-[#005142] transition-colors">Ăn đúng</button>
                    <button className="bg-white text-on-surface-variant font-bold text-[11px] px-3 py-2 rounded-full border border-outline-variant/30 hover:bg-surface-variant transition-colors">Ăn khác</button>
                  </div>
                </div>

                {/* Dinner (Pending) */}
                <div className="bg-white rounded-2xl p-3 flex items-center justify-between border border-outline-variant/30 shadow-sm">
                  <div className="flex items-center gap-3">
                    <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=100&q=80" alt="Bữa tối" className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Bữa tối</span>
                      <span className="text-[14px] font-bold text-on-surface">Salad Quinoa</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="bg-[#006857] text-white font-bold text-[11px] px-4 py-2 rounded-full shadow-sm hover:bg-[#005142] transition-colors">Ăn đúng</button>
                    <button className="bg-white text-on-surface-variant font-bold text-[11px] px-3 py-2 rounded-full border border-outline-variant/30 hover:bg-surface-variant transition-colors">Ăn khác</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
