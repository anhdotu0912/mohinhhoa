import { TopBar } from "@/components/shared/TopBar";

export default function DoctorDashboardPage() {
  return (
    <>
      <TopBar title="Dashboard Tổng quan" />
    <main className="p-lg max-w-[1400px]">
      {/* Summary Cards (4 columns) */}
      <section className="grid grid-cols-4 gap-lg mb-section-gap">
        {/* Card 1 */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex items-center gap-md transition-shadow hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              group
            </span>
          </div>
          <div>
            <p className="font-caption text-caption text-on-surface-variant mb-xs">
              Tổng bệnh nhân
            </p>
            <p className="font-h1 text-h1 text-on-surface">124</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex items-center gap-md transition-shadow hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="w-12 h-12 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              pending_actions
            </span>
          </div>
          <div>
            <p className="font-caption text-caption text-on-surface-variant mb-xs">
              Cần duyệt kế hoạch
            </p>
            <p className="font-h1 text-h1 text-on-surface">12</p>
          </div>
          <div className="absolute top-0 right-0 w-1 h-full bg-tertiary-fixed-dim"></div>
        </div>

        {/* Card 3 */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex items-center gap-md transition-shadow hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="w-12 h-12 rounded-lg bg-error-container flex items-center justify-center text-error">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              warning
            </span>
          </div>
          <div>
            <p className="font-caption text-caption text-on-surface-variant mb-xs">
              Cảnh báo lâm sàng
            </p>
            <p className="font-h1 text-h1 text-error">3</p>
          </div>
          <div className="absolute top-0 right-0 w-1 h-full bg-error"></div>
        </div>

        {/* Card 4 */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex items-center gap-md transition-shadow hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="w-12 h-12 rounded-lg bg-primary-container flex items-center justify-center text-primary">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              mail
            </span>
          </div>
          <div>
            <p className="font-caption text-caption text-on-surface-variant mb-xs">
              Tin nhắn mới
            </p>
            <p className="font-h1 text-h1 text-on-surface">8</p>
          </div>
        </div>
      </section>

      {/* Main Section (2 cols, 2:1 ratio) */}
      <section className="grid grid-cols-3 gap-lg mb-section-gap">
        {/* Left Col (2/3 width) */}
        <div className="col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] overflow-hidden flex flex-col">
          <div className="p-card-padding border-b border-outline-variant bg-surface flex justify-between items-center">
            <h3 className="font-h2 text-h2 text-on-surface">
              Danh sách bệnh nhân cần chú ý
            </h3>
            <button className="text-primary font-body-bold hover:underline text-sm cursor-pointer">
              Xem tất cả
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Bệnh nhân
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Chỉ số
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="p-md font-label text-label text-on-surface-variant uppercase tracking-wider text-right">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-body text-body">
                <tr className="hover:bg-surface-bright transition-colors">
                  <td className="p-md">
                    <div className="flex items-center gap-sm">
                      <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant font-body-bold">
                        N
                      </div>
                      <span className="font-body-bold text-on-surface">
                        Nguyễn Văn A
                      </span>
                    </div>
                  </td>
                  <td className="p-md text-on-surface-variant">Đường huyết ↑</td>
                  <td className="p-md">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-error-container text-error font-caption text-[11px] font-bold">
                      Rủi ro
                    </span>
                  </td>
                  <td className="p-md text-right">
                    <button className="h-8 px-md bg-surface-container-lowest border border-primary text-primary font-body-bold rounded-lg hover:bg-surface-container-low transition-colors text-sm cursor-pointer">
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-surface-bright transition-colors">
                  <td className="p-md">
                    <div className="flex items-center gap-sm">
                      <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant font-body-bold">
                        T
                      </div>
                      <span className="font-body-bold text-on-surface">
                        Trần Thị B
                      </span>
                    </div>
                  </td>
                  <td className="p-md text-on-surface-variant">Huyết áp ↑</td>
                  <td className="p-md">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-tertiary-fixed text-tertiary-fixed-dim font-caption text-[11px] font-bold">
                      Cảnh báo
                    </span>
                  </td>
                  <td className="p-md text-right">
                    <button className="h-8 px-md bg-surface-container-lowest border border-primary text-primary font-body-bold rounded-lg hover:bg-surface-container-low transition-colors text-sm cursor-pointer">
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-surface-bright transition-colors">
                  <td className="p-md">
                    <div className="flex items-center gap-sm">
                      <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant font-body-bold">
                        L
                      </div>
                      <span className="font-body-bold text-on-surface">
                        Lê Văn C
                      </span>
                    </div>
                  </td>
                  <td className="p-md text-on-surface-variant">
                    Chưa cập nhật TT
                  </td>
                  <td className="p-md">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-tertiary-fixed text-tertiary-fixed-dim font-caption text-[11px] font-bold">
                      Cảnh báo
                    </span>
                  </td>
                  <td className="p-md text-right">
                    <button className="h-8 px-md bg-surface-container-lowest border border-primary text-primary font-body-bold rounded-lg hover:bg-surface-container-low transition-colors text-sm cursor-pointer">
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col (1/3 width) */}
        <div className="col-span-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] p-card-padding flex flex-col">
          <div className="border-b border-outline-variant pb-md mb-md">
            <h3 className="font-h2 text-h2 text-on-surface">
              Biểu đồ tuân thủ dinh dưỡng
            </h3>
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Xu hướng tuần qua
            </p>
          </div>
          <div className="flex-1 relative flex items-end gap-2 pt-lg min-h-[160px]">
            <div className="w-full h-full flex items-end justify-between px-sm pb-sm z-10">
              <div className="w-[12%] h-[60%] bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"></div>
              <div className="w-[12%] h-[75%] bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"></div>
              <div className="w-[12%] h-[50%] bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"></div>
              <div className="w-[12%] h-[90%] bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"></div>
              <div className="w-[12%] h-[85%] bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"></div>
              <div className="w-[12%] h-[65%] bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"></div>
              <div className="w-[12%] h-[80%] bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"></div>
            </div>
          </div>
          <div className="flex justify-between mt-sm text-caption text-on-surface-variant px-sm">
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
            <span>T7</span>
            <span>CN</span>
          </div>
        </div>
      </section>

      {/* Bottom Section */}
      <section>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
          <div className="p-card-padding border-b border-outline-variant bg-surface flex justify-between items-center rounded-t-xl">
            <h3 className="font-h2 text-h2 text-on-surface flex items-center gap-sm">
              <span className="material-symbols-outlined text-tertiary">
                assignment
              </span>
              Kế hoạch chờ duyệt mới nhất
            </h3>
          </div>
          <div className="p-md space-y-sm">
            {/* List Item 1 */}
            <div className="flex items-center justify-between p-md border border-outline-variant rounded-lg bg-surface hover:bg-surface-bright transition-colors">
              <div className="flex items-center gap-lg">
                <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary font-body-bold">
                  H
                </div>
                <div>
                  <p className="font-body-bold text-on-surface">Hoàng Văn D</p>
                  <div className="flex items-center gap-md font-caption text-on-surface-variant mt-xs">
                    <span className="flex items-center gap-[2px]">
                      <span className="material-symbols-outlined text-[14px]">
                        restaurant_menu
                      </span>{" "}
                      Tiểu đường tuýp 2
                    </span>
                    <span className="flex items-center gap-[2px]">
                      <span className="material-symbols-outlined text-[14px]">
                        calendar_today
                      </span>{" "}
                      10/10/2023
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                <button className="h-8 px-md bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-body-bold rounded-lg hover:bg-surface-container-low hover:text-primary transition-colors text-sm cursor-pointer">
                  Xem trước
                </button>
                <button className="h-8 px-md bg-primary text-on-primary font-body-bold rounded-lg hover:bg-primary-container hover:text-on-primary-container transition-colors text-sm shadow-sm cursor-pointer">
                  Duyệt nhanh
                </button>
              </div>
            </div>

            {/* List Item 2 */}
            <div className="flex items-center justify-between p-md border border-outline-variant rounded-lg bg-surface hover:bg-surface-bright transition-colors">
              <div className="flex items-center gap-lg">
                <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary font-body-bold">
                  P
                </div>
                <div>
                  <p className="font-body-bold text-on-surface">Phạm Thị E</p>
                  <div className="flex items-center gap-md font-caption text-on-surface-variant mt-xs">
                    <span className="flex items-center gap-[2px]">
                      <span className="material-symbols-outlined text-[14px]">
                        restaurant_menu
                      </span>{" "}
                      Giảm mỡ máu
                    </span>
                    <span className="flex items-center gap-[2px]">
                      <span className="material-symbols-outlined text-[14px]">
                        calendar_today
                      </span>{" "}
                      09/10/2023
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                <button className="h-8 px-md bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-body-bold rounded-lg hover:bg-surface-container-low hover:text-primary transition-colors text-sm cursor-pointer">
                  Xem trước
                </button>
                <button className="h-8 px-md bg-primary text-on-primary font-body-bold rounded-lg hover:bg-primary-container hover:text-on-primary-container transition-colors text-sm shadow-sm cursor-pointer">
                  Duyệt nhanh
                </button>
              </div>
            </div>

            {/* List Item 3 */}
            <div className="flex items-center justify-between p-md border border-outline-variant rounded-lg bg-surface hover:bg-surface-bright transition-colors">
              <div className="flex items-center gap-lg">
                <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary font-body-bold">
                  V
                </div>
                <div>
                  <p className="font-body-bold text-on-surface">Vũ Văn F</p>
                  <div className="flex items-center gap-md font-caption text-on-surface-variant mt-xs">
                    <span className="flex items-center gap-[2px]">
                      <span className="material-symbols-outlined text-[14px]">
                        restaurant_menu
                      </span>{" "}
                      Tăng cân (Suy dinh dưỡng)
                    </span>
                    <span className="flex items-center gap-[2px]">
                      <span className="material-symbols-outlined text-[14px]">
                        calendar_today
                      </span>{" "}
                      08/10/2023
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                <button className="h-8 px-md bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-body-bold rounded-lg hover:bg-surface-container-low hover:text-primary transition-colors text-sm cursor-pointer">
                  Xem trước
                </button>
                <button className="h-8 px-md bg-primary text-on-primary font-body-bold rounded-lg hover:bg-primary-container hover:text-on-primary-container transition-colors text-sm shadow-sm cursor-pointer">
                  Duyệt nhanh
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
    </>
  );
}
