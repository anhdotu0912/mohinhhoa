"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function RightFloatingBar() {
  const pathname = usePathname();
  
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 bg-white rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-outline-variant/30 flex flex-col items-center py-6 gap-6 z-40 pointer-events-auto w-[72px]">
      
      {/* Base Nav Items */}
      <button className="w-14 h-14 flex items-center justify-center text-on-surface-variant hover:text-[#006857] hover:bg-[#F4F9F7] rounded-full transition-colors cursor-pointer group relative">
        <span className="material-symbols-outlined text-[32px] leading-none">menu</span>
        {/* Tooltip */}
        <span className="absolute right-full mr-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm font-medium">Menu</span>
      </button>

      <button className="w-14 h-14 flex items-center justify-center text-on-surface-variant hover:text-[#006857] hover:bg-[#F4F9F7] rounded-full transition-colors relative cursor-pointer group">
        <span className="material-symbols-outlined text-[30px] leading-none">notifications</span>
        <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full border-[2.5px] border-white"></span>
        <span className="absolute right-full mr-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm font-medium">Thông báo</span>
      </button>

      <button className="w-14 h-14 flex items-center justify-center text-on-surface-variant hover:text-[#006857] hover:bg-[#F4F9F7] rounded-full transition-colors cursor-pointer group relative">
        <span className="material-symbols-outlined text-[32px] leading-none">bar_chart</span>
        <span className="absolute right-full mr-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm font-medium">Báo cáo</span>
      </button>

      {/* Divider */}
      <div className="w-10 h-[2px] bg-gray-100 my-1 rounded-full"></div>

      {/* AI Assistant features */}
      <Link href="/patient/assistant" className="w-14 h-14 flex items-center justify-center text-[#006857] bg-[#E4F2EE] hover:bg-[#D1EBE3] rounded-full transition-colors cursor-pointer group relative">
        <span className="material-symbols-outlined text-[30px] leading-none">smart_toy</span>
        <span className="absolute right-full mr-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm font-medium">Hỏi Trợ lý AI</span>
      </Link>

      <button className="w-14 h-14 flex items-center justify-center text-white bg-[#006857] hover:bg-[#005749] rounded-full transition-transform active:scale-95 cursor-pointer group relative shadow-lg shadow-[#006857]/30">
        <span className="material-symbols-outlined text-[28px] leading-none">photo_camera</span>
        <span className="absolute right-full mr-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm font-medium">Nhận diện bữa ăn bằng AI</span>
      </button>

    </div>
  );
}
