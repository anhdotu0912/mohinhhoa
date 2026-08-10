import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";

export default function PatientHistoryPage() {
  const pastMeals = [
    {
      date: "Thứ Hai, 23/10",
      detail: "3 bữa chính, 1 bữa phụ",
      status: "completed",
      statusText: "Hoàn thành",
    },
    {
      date: "Chủ Nhật, 22/10",
      detail: "3 bữa chính, 0 bữa phụ",
      status: "failed",
      statusText: "Chưa đạt",
    },
    {
      date: "Thứ Bảy, 21/10",
      detail: "3 bữa chính, 2 bữa phụ",
      status: "completed",
      statusText: "Hoàn thành",
    },
  ];

  return (
    <>
      <TopBar
        title="Lịch sử & tiến độ"
        rightSlot={
          <div className="relative hidden sm:flex items-center border border-outline-variant rounded-lg px-3 py-1.5 bg-surface-container-lowest cursor-pointer hover:bg-surface-container-low transition-colors text-xs">
            <span className="font-body text-body text-on-surface mr-2 font-medium">
              7 ngày qua
            </span>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
              calendar_today
            </span>
          </div>
        }
      />
    <main className="flex-1 overflow-y-auto p-md md:p-xl w-full flex justify-center">
      <div className="w-full max-w-[900px] flex flex-col gap-section-gap">
        {/* Health Trends Chart Card */}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-subtle p-card-padding">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-outline-variant">
            <h2 className="font-h2 text-h2 text-on-surface font-semibold text-lg">Xu hướng cân nặng</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#2F8F7A]"></div>
                <span className="font-caption text-caption text-on-surface-variant text-xs">Thực tế</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 border-b-2 border-dashed border-surface-dim"></div>
                <span className="font-caption text-caption text-on-surface-variant text-xs">Mục tiêu</span>
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div className="relative w-full h-[300px] flex">
            {/* Y-axis */}
            <div className="flex flex-col justify-between items-end pr-4 text-on-surface-variant font-caption text-xs border-r border-outline-variant h-[260px] pb-[20px]">
              <span>70 kg</span>
              <span>68 kg</span>
              <span>66 kg</span>
              <span>64 kg</span>
              <span>62 kg</span>
            </div>

            {/* Chart Grid & Line */}
            <div className="relative flex-1 h-[260px]">
              {/* Gridlines */}
              <div className="absolute w-full border-b border-outline-variant/30 top-0"></div>
              <div className="absolute w-full border-b border-outline-variant/30 top-[25%]"></div>
              <div className="absolute w-full border-b border-outline-variant/30 top-[50%]"></div>
              <div className="absolute w-full border-b border-outline-variant/30 top-[75%]"></div>
              <div className="absolute w-full border-b border-outline-variant/30 bottom-0"></div>

              {/* Target Line */}
              <div className="absolute w-full border-b-2 border-dashed border-[#d0dbed] top-[60%] z-0"></div>

              {/* SVG Line Chart */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path
                  className="z-10 relative"
                  d="M 0,80 L 16,75 L 33,78 L 50,65 L 66,60 L 83,55 L 100,58"
                  fill="none"
                  stroke="#2F8F7A"
                  strokeWidth="2"
                />
                <circle cx="0" cy="80" fill="#2F8F7A" r="2.5" />
                <circle cx="16" cy="75" fill="#2F8F7A" r="2.5" />
                <circle cx="33" cy="78" fill="#2F8F7A" r="2.5" />
                <circle cx="50" cy="65" fill="#2F8F7A" r="2.5" />
                <circle cx="66" cy="60" fill="#2F8F7A" r="2.5" />
                <circle cx="83" cy="55" fill="#2F8F7A" r="2.5" />
                <circle cx="100" cy="58" fill="#2F8F7A" r="2.5" />
              </svg>
            </div>

            {/* X-axis */}
            <div className="absolute bottom-0 left-[45px] right-0 flex justify-between px-2 text-on-surface-variant font-caption text-xs h-[30px] pt-2">
              <span>17/10</span>
              <span>18/10</span>
              <span>19/10</span>
              <span>20/10</span>
              <span>21/10</span>
              <span>22/10</span>
              <span>23/10</span>
            </div>
          </div>
        </section>

        {/* Past Meals Section */}
        <section>
          <h3 className="font-h2 text-h2 text-on-surface mb-4 font-semibold text-lg">Thực đơn đã dùng</h3>
          <div className="flex flex-col gap-3">
            {pastMeals.map((meal, index) => (
              <Link
                key={index}
                href="/patient/meals"
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding flex justify-between items-center hover:border-[#bdc9c4] transition-colors cursor-pointer group shadow-subtle"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-surface-container flex items-center justify-center rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">event_note</span>
                  </div>
                  <div>
                    <div className="font-body-bold text-body-bold text-on-surface font-semibold">{meal.date}</div>
                    <div className="font-body text-body text-on-surface-variant text-sm">{meal.detail}</div>
                  </div>
                </div>
                {meal.status === "completed" ? (
                  <div className="px-3 py-1 bg-[#2F8F7A]/10 text-[#2F8F7A] rounded-full font-caption text-caption font-semibold flex items-center gap-1 text-xs">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    {meal.statusText}
                  </div>
                ) : (
                  <div className="px-3 py-1 border border-outline-variant text-on-surface-variant rounded-full font-caption text-caption font-semibold flex items-center gap-1 bg-surface-container-low text-xs">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    {meal.statusText}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
    </>
  );
}
