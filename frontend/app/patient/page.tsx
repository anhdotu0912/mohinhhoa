/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export default function PatientDashboardPage() {
  return (
    <main className="flex-1 p-md md:p-lg lg:p-xl flex flex-col gap-section-gap max-w-container-max-width mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        {/* Left Column (65%) - Today's Meal Plan */}
        <div className="lg:col-span-8 flex flex-col gap-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] overflow-hidden hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] transition-shadow duration-300">
            {/* Card Header */}
            <div className="p-card-padding border-b border-outline-variant flex justify-between items-center bg-surface-bright">
              <h2 className="font-h2 text-h2 text-on-surface">Kế hoạch hôm nay</h2>
              <button className="text-primary font-label text-label hover:underline">Xem tất cả</button>
            </div>
            {/* Meal Rows */}
            <div className="p-card-padding flex flex-col gap-0 divide-y divide-outline-variant/50">
              {/* Sáng */}
              <div className="py-md first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-md group">
                <div className="flex items-start gap-md">
                  <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">wb_sunny</span>
                  </div>
                  <div>
                    <div className="font-caption text-caption text-on-surface-variant mb-xs">Sáng (07:00)</div>
                    <div className="font-body-bold text-body-bold text-on-surface">Phở gà ít béo</div>
                    <div className="font-caption text-caption text-on-surface-variant mt-xs line-clamp-1">
                      Nước dùng hầm xương, bánh phở, lườn gà xé.
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-sm items-center sm:justify-end shrink-0 pl-16 sm:pl-0">
                  <span className="px-2 py-1 rounded-full bg-surface-variant text-on-surface font-caption text-caption whitespace-nowrap">
                    350 kcal
                  </span>
                  <span className="px-2 py-1 rounded-full bg-error-container text-on-error-container font-caption text-caption whitespace-nowrap">
                    1.5g Muối
                  </span>
                </div>
              </div>
              {/* Trưa */}
              <div className="py-md first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-md group">
                <div className="flex items-start gap-md">
                  <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">wb_twilight</span>
                  </div>
                  <div>
                    <div className="font-caption text-caption text-on-surface-variant mb-xs">Trưa (12:00)</div>
                    <div className="font-body-bold text-body-bold text-on-surface">Cơm gạo lứt cá hồi</div>
                    <div className="font-caption text-caption text-on-surface-variant mt-xs line-clamp-1">
                      1 chén cơm, 150g cá hồi áp chảo, rau luộc.
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-sm items-center sm:justify-end shrink-0 pl-16 sm:pl-0">
                  <span className="px-2 py-1 rounded-full bg-surface-variant text-on-surface font-caption text-caption whitespace-nowrap">
                    450 kcal
                  </span>
                  <span className="px-2 py-1 rounded-full bg-[#E5F4EC] text-[#006857] font-caption text-caption whitespace-nowrap">
                    0.8g Muối
                  </span>
                </div>
              </div>
              {/* Tối */}
              <div className="py-md first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-md group">
                <div className="flex items-start gap-md">
                  <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">mode_night</span>
                  </div>
                  <div>
                    <div className="font-caption text-caption text-on-surface-variant mb-xs">Tối (18:30)</div>
                    <div className="font-body-bold text-body-bold text-on-surface">Salad ức gà nướng</div>
                    <div className="font-caption text-caption text-on-surface-variant mt-xs line-clamp-1">
                      Xà lách, cà chua bi, 100g ức gà, sốt dầu giấm.
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-sm items-center sm:justify-end shrink-0 pl-16 sm:pl-0">
                  <span className="px-2 py-1 rounded-full bg-surface-variant text-on-surface font-caption text-caption whitespace-nowrap">
                    280 kcal
                  </span>
                  <span className="px-2 py-1 rounded-full bg-[#E5F4EC] text-[#006857] font-caption text-caption whitespace-nowrap">
                    0.5g Muối
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (35%) - Stacked Cards */}
        <div className="lg:col-span-4 flex flex-col gap-lg">
          {/* Progress Card */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-card-padding flex flex-col items-center justify-center relative overflow-hidden">
            <h3 className="font-body-bold text-body-bold text-on-surface mb-lg text-center w-full">
              Tiến độ tuân thủ tuần này
            </h3>
            <div className="relative w-40 h-40 flex items-center justify-center mb-md">
              {/* SVG Circle Chart */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Circle */}
                <circle
                  className="stroke-surface-container-high"
                  cx="50"
                  cy="50"
                  fill="none"
                  r="40"
                  strokeWidth="8"
                />
                {/* Progress Circle (85%) */}
                <circle
                  className="stroke-[#2F8F7A] transition-all duration-1000 ease-in-out"
                  cx="50"
                  cy="50"
                  fill="none"
                  r="40"
                  strokeDasharray="251.2"
                  strokeDashoffset="37.68"
                  strokeLinecap="round"
                  strokeWidth="8"
                />
              </svg>
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-h1 text-h1 text-on-surface">85%</span>
                <span className="font-caption text-caption text-on-surface-variant">Khá tốt</span>
              </div>
            </div>
            <p className="font-caption text-caption text-on-surface-variant text-center">
              Tiếp tục duy trì chế độ ăn ít muối.
            </p>
          </div>

          {/* Alert Card */}
          <div className="bg-[#FFF8E1] rounded-xl border border-[#FFE082] shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-card-padding flex flex-col gap-sm">
            <div className="flex items-start gap-sm">
              <span className="material-symbols-outlined text-[#F57F17]">warning</span>
              <div className="flex-1">
                <h3 className="font-body-bold text-body-bold text-[#F57F17] mb-xs">Cảnh báo</h3>
                <p className="font-body text-body text-on-surface mb-md">
                  Hàm lượng Muối ngày hôm qua vượt ngưỡng (2.7g).
                </p>
                <Link className="font-label text-label text-primary hover:underline flex items-center gap-xs" href="#">
                  Xem chi tiết
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
