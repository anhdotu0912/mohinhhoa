import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";
import { WeightTrendsChart } from "@/components/patient/WeightTrendsChart";

export default function PatientHistoryPage() {
  const pastMeals = [
    {
      date: "Thứ Hai, 23/10",
      dayIndex: 2,
      detail: "3 bữa chính, 1 bữa phụ",
      status: "completed",
      statusText: "Hoàn thành",
    },
    {
      date: "Chủ Nhật, 22/10",
      dayIndex: 1,
      detail: "3 bữa chính, 0 bữa phụ",
      status: "failed",
      statusText: "Chưa đạt",
    },
    {
      date: "Thứ Bảy, 21/10",
      dayIndex: 7,
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
        <WeightTrendsChart />

        {/* Past Meals Section */}
        <section>
          <h3 className="font-h2 text-h2 text-on-surface mb-4 font-semibold text-lg">Thực đơn đã dùng</h3>
          <div className="flex flex-col gap-3">
            {pastMeals.map((meal, index) => (
              <Link
                key={index}
                href={`/patient/meals?highlight=${meal.dayIndex}`}
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
