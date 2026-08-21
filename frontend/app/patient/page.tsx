"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function PatientDashboardPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const displayName = useAuthStore((s) => s.displayName);
  const [hydrated, setHydrated] = useState(false);

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

  const greetingName = displayName?.trim() ? displayName : "Nguyen Van A";

  return (
    <div className="flex flex-col relative w-full h-full bg-[#F7F8FA] font-body overflow-x-hidden pb-24">
      {/* Top Header */}
      <header className="flex justify-between items-center px-8 py-5 w-full bg-white border-b border-outline-variant/30 sticky top-0 z-30">
        <h1 className="font-h1 text-h1 text-[#006857] font-bold text-xl tracking-tight">Trang chủ</h1>
        <div className="flex items-center gap-4 ml-auto">
          <button className="text-[#006857] hover:bg-[#E4F2EE] p-2 rounded-full transition-colors flex items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <button className="text-[#006857] hover:bg-[#E4F2EE] p-2 rounded-full transition-colors flex items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </header>



      <main className="flex-1 w-full px-8 py-8 flex flex-col gap-6 max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div>
          <h2 className="text-[28px] font-bold text-on-surface tracking-tight mb-1">
            Chào mừng trở lại, {greetingName}.
          </h2>
          <p className="text-on-surface-variant text-[15px]">
            Dưới đây là bảng thông tin cá nhân hóa của bạn hôm nay.
          </p>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          
          {/* Card 1: Today's Progress (col-span-8) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border-2 border-[#006857] shadow-sm flex flex-col justify-between">
            <h3 className="font-bold text-lg text-on-surface mb-6">Tiến độ hôm nay</h3>
            
            <div className="flex flex-col md:flex-row items-center gap-12">
              {/* Donut Chart */}
              <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#E2E8F0" strokeWidth="12" fill="transparent" />
                  <circle cx="50" cy="50" r="40" stroke="#006857" strokeWidth="12" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - 1250/1800)} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-on-surface-variant font-medium">Lượng Calo<br/>Đã nạp / Mục tiêu</span>
                  <span className="text-xl font-bold text-on-surface mt-1">1.250 <span className="text-sm font-normal text-on-surface-variant">/ 1.800<br/>kcal</span></span>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="flex-1 w-full flex flex-col gap-6">
                <div className="text-xs font-medium text-on-surface-variant mb-2">Các chỉ số quan trọng dựa trên hồ sơ y tế:</div>
                
                {/* Sodium */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-bold text-sm text-on-surface">Natri (Muối)</span>
                    <span className="text-xs text-on-surface-variant">Hiện tại / Tối đa</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#2f8f7a]">60%</span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2f8f7a] rounded-full" style={{ width: "60%" }}></div>
                    </div>
                  </div>
                </div>
                
                {/* Sugar */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-bold text-sm text-on-surface">Đường</span>
                    <span className="text-xs text-on-surface-variant">Hiện tại / Tối đa</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#2f8f7a]">40%</span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2f8f7a] rounded-full" style={{ width: "40%" }}></div>
                    </div>
                  </div>
                </div>

                {/* Protein */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-bold text-sm text-on-surface">Đạm (Protein)</span>
                    <span className="text-xs text-red-500 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">warning</span> Hiện tại / Tối đa</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-amber-500 flex items-center"><span className="material-symbols-outlined text-[16px] text-amber-500 mr-1">warning</span></span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden relative">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: "80%" }}></div>
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-white leading-none">80%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Safety & Medical Notes (col-span-4) */}
          <div className="lg:col-span-4 bg-[#FEE2E2] rounded-2xl p-6 border-2 border-[#FCA5A5] shadow-sm flex flex-col justify-center">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-bold text-lg text-red-950">Lưu ý Y tế & An toàn</h3>
              <span className="material-symbols-outlined text-red-600 text-[24px]">warning</span>
            </div>
            
            <div className="flex flex-col gap-5">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-700 text-[18px]">pill</span>
                </div>
                <div className="pt-1 text-sm font-medium text-red-950">
                  <span className="font-bold">Nhắc nhở uống thuốc:</span> Metformin lúc 09:00
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-700 text-[18px]">restaurant</span>
                </div>
                <div className="pt-1 text-sm font-medium text-red-950">
                  <span className="font-bold">Cảnh báo tương tác:</span> Tránh thực phẩm giàu Vitamin K (Warfarin)
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-700 text-[18px]">do_not_disturb</span>
                </div>
                <div className="pt-1 text-sm font-medium text-red-950">
                  <span className="font-bold">Cảnh báo dị ứng:</span> Có chứa đậu phộng (Bữa xế)
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Today's Meal Plan (col-span-12) */}
          <div className="lg:col-span-12 bg-white rounded-2xl p-6 border-2 border-[#006857] shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-on-surface">Thực đơn hôm nay</h3>
              <div className="flex items-center gap-1.5 text-sm font-medium text-[#006857]">
                Trạng thái: <span className="material-symbols-outlined text-[16px] text-[#22c55e] bg-green-100 rounded-sm">check_box</span> Đã duyệt bởi BS. Trần Văn B
              </div>
            </div>
            
            <div className="flex relative mt-4 pb-2">
              {/* Timeline line */}
              <div className="absolute top-[10px] left-[60px] right-[40%] md:right-[20%] h-[2px] bg-gray-200 -z-10"></div>
              
              <div className="grid grid-cols-3 w-full gap-4">
                {/* Breakfast */}
                <div className="flex flex-col border-r border-gray-100 pr-4 relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-bold text-on-surface-variant w-10 text-right">T.gian</span>
                    <div className="w-3.5 h-3.5 rounded-full bg-gray-300 relative z-10 border-[3px] border-white ring-1 ring-gray-200 shrink-0"></div>
                    <span className="font-bold text-base text-on-surface">Bữa sáng</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-bold text-on-surface-variant w-10 text-right mt-1 shrink-0">19:00</span>
                    <div className="flex flex-col border-l-2 border-gray-100 pl-4 pb-2 -ml-[25px] flex-1 translate-x-[25px]">
                      <div className="text-[15px] text-on-surface mb-3">Pho Ga, 350 kcal</div>
                      <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-gray-400">check</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lunch */}
                <div className="flex flex-col border-r border-gray-100 pr-4 relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3.5 h-3.5 rounded-full bg-gray-300 relative z-10 border-[3px] border-white ring-1 ring-gray-200 shrink-0"></div>
                    <span className="font-bold text-base text-on-surface">Bữa trưa</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col border-l-2 border-gray-100 pl-4 pb-2 -ml-[7px] flex-1 translate-x-[7px]">
                      <div className="text-[15px] text-on-surface mb-3">Cơm sườn, 600 kcal</div>
                      <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-gray-400">check</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dinner */}
                <div className="flex flex-col relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3.5 h-3.5 rounded-full bg-gray-300 relative z-10 border-[3px] border-white ring-1 ring-gray-200 shrink-0"></div>
                    <span className="font-bold text-base text-on-surface">Bữa tối</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col border-l-2 border-gray-100 pl-4 pb-2 -ml-[7px] flex-1 translate-x-[7px]">
                      <div className="text-[15px] text-on-surface mb-3 pr-28">Canh cá,<br/>300 kcal</div>
                      <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-gray-400">check</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons for Lunch and Dinner */}
              <div className="absolute right-0 top-10 bottom-0 flex flex-col justify-between py-2 items-end">
                <button className="px-3 py-1 rounded border border-[#006857] text-[#006857] font-semibold text-xs hover:bg-[#E4F2EE] transition-colors bg-white mt-1 cursor-pointer w-[90px]">
                  Đã ăn
                </button>
                <button className="px-3 py-1 rounded border border-[#006857] text-[#006857] font-semibold text-xs hover:bg-[#E4F2EE] transition-colors bg-white mb-2 cursor-pointer w-[90px]">
                  Đã ăn
                </button>
              </div>
            </div>
          </div>



          {/* Card 5: Health Indicators (col-span-12) */}
          <div className="lg:col-span-12 bg-[#F4F9F7] rounded-3xl p-6 md:p-8 border-none shadow-[inset_0_2px_10px_rgba(255,255,255,1),0_4px_20px_rgba(0,104,87,0.05)] relative flex flex-col justify-between">
            
            <div className="flex justify-between items-start mb-12">
              <div>
                <h3 className="font-bold text-[22px] text-on-surface mb-1">Đường huyết theo thời gian</h3>
                <p className="text-[15px] text-on-surface-variant">Tóm tắt các chỉ số đo gần đây.</p>
              </div>
              
              {/* Date Filter Pill */}
              <div className="flex bg-[#E4EAE7] rounded-full p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]">
                <button className="px-4 py-1.5 rounded-full text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">12T</button>
                <button className="px-4 py-1.5 rounded-full text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">30N</button>
                <button className="px-4 py-1.5 rounded-full bg-white text-[#006857] text-[13px] font-bold shadow-sm cursor-pointer">7N</button>
              </div>
            </div>
            
            <div className="flex flex-col w-full relative">
              {/* Large Line Chart Simulation */}
              <div className="w-full h-56 md:h-72 relative flex items-end">
                {/* Y-axis labels and grid lines */}
                <div className="absolute left-10 right-4 top-0 h-0 border-t border-[#006857]/10"></div>
                <div className="absolute left-10 right-4 top-1/2 h-0 border-t border-[#006857]/10"></div>
                <div className="absolute left-10 right-4 bottom-8 h-0 border-t border-[#006857]/10"></div>
                
                <div className="absolute left-0 top-[-8px] text-[13px] font-medium text-on-surface-variant">140</div>
                <div className="absolute left-0 top-[calc(50%-8px)] text-[13px] font-medium text-on-surface-variant">110</div>
                <div className="absolute left-0 bottom-[24px] text-[13px] font-medium text-on-surface-variant">80</div>
                
                {/* SVG Wrapper exactly matching SVG dimension */}
                <div className="w-[calc(100%-56px)] h-[calc(100%-32px)] ml-10 mb-8 relative">
                  
                  {/* HTML Tooltip at 80%, 41.5% */}
                  <div 
                    className="absolute z-10 flex flex-col items-center pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: '80%', top: '41.5%' }}
                  >
                    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-3 min-w-[100px] flex flex-col items-start absolute bottom-full mb-2.5 border border-gray-50">
                      <span className="text-[12px] text-gray-500 font-medium mb-1.5">Thứ 6</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#006857]"></div>
                        <span className="text-base font-bold text-gray-900 leading-none">115 <span className="text-[11px] font-normal text-gray-500">mg/dL</span></span>
                      </div>
                    </div>
                    {/* Circle on line perfectly centered */}
                    <div className="w-4 h-4 rounded-full bg-white border-[3px] border-[#006857] shadow-sm"></div>
                  </div>

                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                    {/* Smooth curve matching the previous data points */}
                    <path d="M0,20 C 10,20 10,23.3 20,23.3 C 30,23.3 30,13.3 40,13.3 C 50,13.3 50,21.3 60,21.3 C 70,21.3 70,16.6 80,16.6 C 90,16.6 90,20 100,20" fill="none" stroke="#2f8f7a" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M0,20 C 10,20 10,23.3 20,23.3 C 30,23.3 30,13.3 40,13.3 C 50,13.3 50,21.3 60,21.3 C 70,21.3 70,16.6 80,16.6 C 90,16.6 90,20 100,20 L100,40 L0,40 Z" fill="url(#gradient)" opacity="0.4" />
                    <defs>
                      <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2f8f7a" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#F4F9F7" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  {/* X-axis labels */}
                  <div className="absolute top-full left-0 right-0 h-8 mt-3">
                    <span className="absolute left-[0%] -translate-x-1/2 text-[13px] text-on-surface-variant font-medium">T2</span>
                    <span className="absolute left-[20%] -translate-x-1/2 text-[13px] text-on-surface-variant font-medium">T3</span>
                    <span className="absolute left-[40%] -translate-x-1/2 text-[13px] text-on-surface-variant font-medium">T4</span>
                    <span className="absolute left-[60%] -translate-x-1/2 text-[13px] text-on-surface-variant font-medium">T5</span>
                    <span className="absolute left-[80%] -translate-x-1/2 text-[13px] text-on-surface-variant font-medium">T6</span>
                    <span className="absolute left-[100%] -translate-x-1/2 text-[13px] text-on-surface-variant font-medium">T7</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 6: Medical Analysis Summary (col-span-12) */}
          <div className="lg:col-span-12 bg-white rounded-2xl p-6 border border-[#006857] shadow-sm flex flex-col justify-center">
            <h3 className="font-bold text-lg text-on-surface mb-4">Tóm tắt Phân tích Y khoa</h3>
            <p className="text-[15px] text-on-surface leading-relaxed">
              <span className="font-bold">Ghi chú từ AI:</span> Dựa trên tiến độ hiện tại, bạn nên cân nhắc bổ sung thêm một chút chất xơ vào bữa tối.
            </p>
          </div>

        </div>
      </main>

      {/* Bottom Floating Search Bar */}
      <div className="fixed bottom-6 left-[240px] right-0 z-40 px-4 pointer-events-none hidden md:flex justify-center">
        <div className="bg-white rounded-full shadow-lg border border-outline-variant/30 flex items-center h-[52px] px-6 w-full max-w-[600px] pointer-events-auto">
          <input 
            type="text" 
            placeholder="Tìm kiếm nhanh thực phẩm hoặc chỉ số..." 
            className="flex-1 bg-transparent border-none outline-none text-[15px] placeholder:text-on-surface-variant font-medium text-on-surface h-full"
          />
        </div>
      </div>
      


    </div>
  );
}
