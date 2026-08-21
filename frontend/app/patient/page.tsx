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
        <h1 className="font-h1 text-h1 text-[#006857] font-bold text-xl tracking-tight">Home</h1>
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
            Welcome Back, {greetingName}.
          </h2>
          <p className="text-on-surface-variant text-[15px]">
            Here is your personalized daily dashboard.
          </p>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          
          {/* Card 1: Today's Progress (col-span-8) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border-2 border-[#006857] shadow-sm flex flex-col justify-between">
            <h3 className="font-bold text-lg text-on-surface mb-6">Today's Progress</h3>
            
            <div className="flex flex-col md:flex-row items-center gap-12">
              {/* Donut Chart */}
              <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#E2E8F0" strokeWidth="12" fill="transparent" />
                  <circle cx="50" cy="50" r="40" stroke="#006857" strokeWidth="12" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - 1250/1800)} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-on-surface-variant font-medium">Calories<br/>Consumed / Target</span>
                  <span className="text-xl font-bold text-on-surface mt-1">1,250 <span className="text-sm font-normal text-on-surface-variant">/ 1,800<br/>kcal</span></span>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="flex-1 w-full flex flex-col gap-6">
                <div className="text-xs font-medium text-on-surface-variant mb-2">Key key metrics based on you medical profile:</div>
                
                {/* Sodium */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-bold text-sm text-on-surface">Sodium (Salt)</span>
                    <span className="text-xs text-on-surface-variant">Current / Max</span>
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
                    <span className="font-bold text-sm text-on-surface">Sugar</span>
                    <span className="text-xs text-on-surface-variant">Current / Max</span>
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
                    <span className="font-bold text-sm text-on-surface">Protein</span>
                    <span className="text-xs text-red-500 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">warning</span> Current / Max</span>
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
              <h3 className="font-bold text-lg text-red-950">Safety & Medical Notes</h3>
              <span className="material-symbols-outlined text-red-600 text-[24px]">warning</span>
            </div>
            
            <div className="flex flex-col gap-5">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-700 text-[18px]">pill</span>
                </div>
                <div className="pt-1 text-sm font-medium text-red-950">
                  <span className="font-bold">Medication Reminder:</span> Metformin @ 9:00 AM
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-700 text-[18px]">restaurant</span>
                </div>
                <div className="pt-1 text-sm font-medium text-red-950">
                  <span className="font-bold">Interaction Alert:</span> Avoid High-Vitamin K foods (Warfarin)
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-700 text-[18px]">do_not_disturb</span>
                </div>
                <div className="pt-1 text-sm font-medium text-red-950">
                  <span className="font-bold">Allergy Warning:</span> Contains Peanut (Evening Snack)
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Today's Meal Plan (col-span-8) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border-2 border-[#006857] shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-on-surface">Today's Meal Plan</h3>
              <div className="flex items-center gap-1.5 text-sm font-medium text-[#006857]">
                Status: <span className="material-symbols-outlined text-[16px] text-[#22c55e] bg-green-100 rounded-sm">check_box</span> Approved by Dr. Tran Van B
              </div>
            </div>
            
            <div className="flex relative mt-4 pb-2">
              {/* Timeline line */}
              <div className="absolute top-[10px] left-[60px] right-[40%] md:right-[20%] h-[2px] bg-gray-200 -z-10"></div>
              
              <div className="grid grid-cols-3 w-full gap-4">
                {/* Breakfast */}
                <div className="flex flex-col border-r border-gray-100 pr-4 relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-bold text-on-surface-variant w-10 text-right">Time</span>
                    <div className="w-3.5 h-3.5 rounded-full bg-gray-300 relative z-10 border-[3px] border-white ring-1 ring-gray-200 shrink-0"></div>
                    <span className="font-bold text-base text-on-surface">Breakfast</span>
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
                    <span className="font-bold text-base text-on-surface">Lunch</span>
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
                    <span className="font-bold text-base text-on-surface">Dinner</span>
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
                <button className="px-3 py-1 rounded border border-[#006857] text-[#006857] font-semibold text-xs hover:bg-[#E4F2EE] transition-colors bg-white mt-1 cursor-pointer">
                  Mark as Eaten
                </button>
                <button className="px-3 py-1 rounded border border-[#006857] text-[#006857] font-semibold text-xs hover:bg-[#E4F2EE] transition-colors bg-white mb-2 cursor-pointer">
                  Mark as Eaten
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: Quick AI Actions (col-span-4) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <h3 className="font-bold text-lg text-on-surface mb-1">Quick AI Actions</h3>
            
            <button className="bg-white rounded-2xl p-4 border border-[#006857] shadow-sm flex items-start gap-4 hover:bg-[#F8FAFC] transition-colors text-left group cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-[#E4F2EE] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#006857]">smart_toy</span>
              </div>
              <div>
                <h4 className="font-bold text-base text-on-surface group-hover:text-[#006857] transition-colors">Ask AI Assistant</h4>
                <p className="text-sm text-on-surface-variant mt-1 leading-snug">Opens chat in a side-panel, retaining some chat UI familiarity but not central</p>
              </div>
            </button>
            
            <button className="bg-white rounded-2xl p-4 border border-[#006857] shadow-sm flex items-start gap-4 hover:bg-[#F8FAFC] transition-colors text-left group cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-[#E4F2EE] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#006857]">photo_camera</span>
              </div>
              <div>
                <h4 className="font-bold text-base text-on-surface group-hover:text-[#006857] transition-colors">Recognize Meal</h4>
                <p className="text-sm text-on-surface-variant mt-1 leading-snug">Uses camera/upload for quick logging</p>
              </div>
            </button>
          </div>

          {/* Card 5: Health Indicators (col-span-6) */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-outline-variant/60 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg text-on-surface mb-1">Health Indicators</h3>
              <p className="text-sm text-on-surface-variant mb-6">Recently recorded stats summary.</p>
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <div className="text-sm text-on-surface-variant font-medium">Last Blood Glucose:</div>
                <div className="text-2xl font-bold text-on-surface mt-1">110 <span className="text-sm font-normal text-on-surface-variant">mg/dL</span></div>
              </div>
              
              {/* Small Sparkline Chart Simulation */}
              <div className="w-48 h-12 relative flex items-end">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 text-[10px] text-gray-400">120</div>
                <div className="absolute left-0 bottom-0 text-[10px] text-gray-400">110</div>
                
                {/* Chart SVG */}
                <svg className="w-full h-full ml-6" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <path d="M0,20 L20,30 L40,10 L60,25 L80,15 L100,20" fill="none" stroke="#2f8f7a" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M0,20 L20,30 L40,10 L60,25 L80,15 L100,20 L100,40 L0,40 Z" fill="url(#gradient)" opacity="0.2" />
                  <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2f8f7a" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Data points */}
                  <circle cx="0" cy="20" r="2" fill="#006857" />
                  <circle cx="20" cy="30" r="2" fill="#006857" />
                  <circle cx="40" cy="10" r="2" fill="#006857" />
                  <circle cx="60" cy="25" r="2" fill="#006857" />
                  <circle cx="80" cy="15" r="2" fill="#006857" />
                  <circle cx="100" cy="20" r="2" fill="#006857" />
                </svg>
                
                {/* Dashed lines */}
                <div className="absolute left-6 right-0 top-[20%] border-t border-dashed border-gray-200"></div>
                <div className="absolute left-6 right-0 bottom-0 border-t border-dashed border-gray-200"></div>
              </div>
            </div>
          </div>

          {/* Card 6: Medical Analysis Summary (col-span-6) */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-[#006857] shadow-sm flex flex-col justify-center">
            <h3 className="font-bold text-lg text-on-surface mb-4">Medical Analysis Summary</h3>
            <p className="text-[15px] text-on-surface leading-relaxed">
              <span className="font-bold">AI Note:</span> Based on your current progress, consider slightly more fiber for dinner.
            </p>
          </div>

        </div>
      </main>

      {/* Bottom Floating Search Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 pointer-events-none hidden md:flex justify-center w-full">
        <div className="bg-white rounded-full shadow-lg border border-outline-variant/30 flex items-center h-[52px] px-6 w-full max-w-[600px] pointer-events-auto">
          <input 
            type="text" 
            placeholder="Quick search for foods or metrics..." 
            className="flex-1 bg-transparent border-none outline-none text-[15px] placeholder:text-on-surface-variant font-medium text-on-surface h-full"
          />
        </div>
      </div>
      
      {/* Floating Action Button (Simulating the right floating bar) */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 bg-white rounded-full shadow-lg border border-outline-variant/30 flex flex-col items-center py-4 gap-6 z-40 pointer-events-auto">
        <button className="text-on-surface-variant hover:text-[#006857] transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
        <button className="text-on-surface-variant hover:text-[#006857] transition-colors relative cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button className="text-on-surface-variant hover:text-[#006857] transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">bar_chart</span>
        </button>
      </div>

    </div>
  );
}
