import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";

export default function PatientNotificationsPage() {
  return (
    <>
      <TopBar title="Thông báo" />
    <main className="flex-1 w-full p-4 md:p-8 pb-12">
      <div className="max-w-[800px] mx-auto w-full">
        <div className="flex flex-col gap-4">
          {/* Unread Notification 1 (Warning) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-subtle flex p-card-padding relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2F8F7A]"></div>
            <div className="flex items-start gap-4 w-full pl-2">
              <div className="flex-shrink-0 mt-1">
                <span
                  className="material-symbols-outlined text-amber-500"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-body-bold text-on-background font-semibold">
                    Vượt ngưỡng muối hôm nay
                  </h3>
                  <span className="font-caption text-caption text-on-surface-variant whitespace-nowrap ml-4">
                    10:30, Hôm nay
                  </span>
                </div>
                <p className="font-body text-body text-on-surface-variant mb-2">
                  Hàm lượng muối trong bữa trưa đã vượt mức khuyến nghị cho người cao huyết áp. Hãy giảm muối trong bữa tối.
                </p>
                <Link
                  className="font-body-bold text-body-bold text-[#2F8F7A] hover:underline inline-flex items-center gap-1 font-semibold"
                  href="/patient/meals"
                >
                  Xem gợi ý điều chỉnh
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Read Notification (Success) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-subtle flex p-card-padding">
            <div className="flex items-start gap-4 w-full">
              <div className="flex-shrink-0 mt-1">
                <span
                  className="material-symbols-outlined text-green-600"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-body-bold text-on-background font-semibold">
                    Hoàn thành mục tiêu tuần
                  </h3>
                  <span className="font-caption text-caption text-on-surface-variant whitespace-nowrap ml-4">
                    Hôm qua
                  </span>
                </div>
                <p className="font-body text-body text-on-surface-variant">
                  Chúc mừng! Bạn đã tuân thủ 100% kế hoạch ăn uống trong 7 ngày qua.
                </p>
              </div>
            </div>
          </div>

          {/* Unread Notification 2 (Alert) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-subtle flex p-card-padding relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2F8F7A]"></div>
            <div className="flex items-start gap-4 w-full pl-2">
              <div className="flex-shrink-0 mt-1">
                <span
                  className="material-symbols-outlined text-amber-500"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-body-bold text-on-background font-semibold">
                    Nhắc nhở uống thuốc
                  </h3>
                  <span className="font-caption text-caption text-on-surface-variant whitespace-nowrap ml-4">
                    08:15, Hôm nay
                  </span>
                </div>
                <p className="font-body text-body text-on-surface-variant">
                  Đừng quên dùng thuốc huyết áp sau bữa sáng 30 phút.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
