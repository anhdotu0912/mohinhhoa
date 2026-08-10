/* eslint-disable @next/next/no-img-element */
"use client";

import { TopBar } from "@/components/shared/TopBar";

export default function PatientMealsPage() {
  return (
    <>
      <TopBar
        title="Thực đơn hôm nay"
        rightSlot={
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg p-1 shadow-sm">
            <button
              type="button"
              className="p-1 hover:bg-surface-container-low rounded text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <div className="px-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">
                calendar_month
              </span>
              <span className="font-body-bold text-on-surface text-sm">Thứ Hai, 16/10</span>
            </div>
            <button
              type="button"
              className="p-1 hover:bg-surface-container-low rounded text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        }
      />
    <main className="flex-1 w-full p-lg min-h-[calc(100vh-64px)] flex justify-center">
      <div className="w-full max-w-[800px] flex flex-col gap-section-gap py-md">
        {/* Progress / Summary Card */}
        <section className="bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant/60 rounded-xl p-card-padding flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md shadow-subtle">
          <div>
            <h3 className="font-body-bold text-on-surface text-base font-semibold">Tổng quan dinh dưỡng</h3>
            <p className="font-body text-on-surface-variant text-sm mt-1">Mục tiêu hàng ngày cho huyết áp ổn định</p>
          </div>
          <div className="flex gap-lg items-center self-end sm:self-auto">
            <div className="text-center">
              <div className="font-h2 text-primary font-bold text-lg">
                1450 <span className="font-body text-sm text-on-surface-variant font-normal">/ 1800</span>
              </div>
              <div className="font-caption text-on-surface-variant uppercase tracking-wider text-[11px] mt-1">
                Kcal
              </div>
            </div>
            <div className="w-px h-10 bg-outline-variant/50 self-center"></div>
            <div className="text-center">
              <div className="font-h2 text-tertiary font-bold text-lg">
                3.2 <span className="font-body text-sm text-on-surface-variant font-normal">/ 5g</span>
              </div>
              <div className="font-caption text-on-surface-variant uppercase tracking-wider text-[11px] mt-1">
                Muối
              </div>
            </div>
          </div>
        </section>

        {/* Meals Cards List */}
        <div className="flex flex-col gap-4">
          {/* Breakfast Card */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-subtle hover:shadow-hover transition-shadow duration-300">
            <div className="p-card-padding">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary-container text-xl">routine</span>
                  <h3 className="font-body-bold text-on-surface font-semibold">07:00 - Bữa sáng</h3>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-label text-label bg-primary/10 text-primary font-medium text-xs">
                  Đã hoàn thành
                </span>
              </div>
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30 relative">
                  <img
                    className="w-full h-full object-cover"
                    alt="Phở gà ít béo"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVjwNT1KRGkEUs56K56bgRv8DcVYbh-262-Wwn83Hy8By9lD4HqvKDzD6gRapjtRdfmL8oU-zfh8DeDGVdC6h1gQUS9bRk0APT53LOn1dyzHfZvKikKb1GWJJqGwNk4ejVtzDGCJEhDpCRMIhFowjqUwVGNclfguqId8ImdCv1tSXnHc5wqXrWKosUFoAOLBvQPEN2cnoR-IWnz-NOM-zq5GPlmhFWD_-ibobwycG4i4i0eYMYohN64A"
                  />
                </div>
                <div className="flex-grow flex flex-col justify-center">
                  <h4 className="font-h2 text-h2 text-on-surface mb-1 font-semibold text-base">
                    Phở gà ít béo, nhiều rau
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">local_fire_department</span> 350 kcal
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-tertiary-container/10 text-tertiary font-caption text-caption border border-tertiary-container/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">water_drop</span> 1.2g Muối
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">spa</span> 5g Đường
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-outline-variant/30">
                <details className="group">
                  <summary className="flex items-center gap-1 cursor-pointer font-body-bold text-sm text-primary hover:text-primary-container transition-colors list-none font-semibold">
                    <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                      expand_more
                    </span>
                    Vì sao gợi ý món này?
                  </summary>
                  <p className="mt-2 text-sm font-body text-on-surface-variant bg-surface-container-low p-3 rounded-lg border border-outline-variant/20">
                    Nước dùng được ninh từ xương ức gà thay vì xương heo giúp giảm đáng kể lượng cholesterol. Hàm lượng Natri thấp (1.2g) rất phù hợp để kiểm soát huyết áp buổi sáng của bạn.
                  </p>
                </details>
              </div>
            </div>
          </article>

          {/* Lunch Card */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-subtle hover:shadow-hover transition-shadow duration-300">
            <div className="p-card-padding">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary-container text-xl">light_mode</span>
                  <h3 className="font-body-bold text-on-surface font-semibold">12:30 - Bữa trưa</h3>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-label text-label bg-secondary/10 text-secondary font-medium text-xs">
                  Sắp tới
                </span>
              </div>
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30 relative">
                  <img
                    className="w-full h-full object-cover"
                    alt="Cơm gạo lứt cá hồi nướng"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxH3tt8gEYfvie8RIzD30n979-Zlc9hI55BV7wrs-GKJWl8flfLTgEy5syTr-R_GvPIR-cAzkEUoz7Iomaplma_RPh3UAhlgTL-e0k1QcEFwhPSGQ9MY4_SwV_RQLefEm6c92SMtjBu-6EJsYiKlUoFtUCmAG7oY4nGNxZqhwgZCUIN85xN1tnj7A70__hCmjF4OjrdY4R58TY2lkfw7MW-U1VmQLYh70Ww6WW7_Cc9ccNOOWWtWro2A"
                  />
                </div>
                <div className="flex-grow flex flex-col justify-center">
                  <h4 className="font-h2 text-h2 text-on-surface mb-1 font-semibold text-base">
                    Cơm gạo lứt cá hồi nướng
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">local_fire_department</span> 450 kcal
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">water_drop</span> 0.8g Muối
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary-container/20 text-on-secondary-container font-caption text-caption border border-secondary-container/30 text-xs">
                      <span className="material-symbols-outlined text-[14px]">set_meal</span> Omega-3 cao
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-outline-variant/30">
                <details className="group">
                  <summary className="flex items-center gap-1 cursor-pointer font-body-bold text-sm text-primary hover:text-primary-container transition-colors list-none font-semibold">
                    <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                      expand_more
                    </span>
                    Vì sao gợi ý món này?
                  </summary>
                  <p className="mt-2 text-sm font-body text-on-surface-variant bg-surface-container-low p-3 rounded-lg border border-outline-variant/20">
                    Cá hồi cung cấp lượng Omega-3 dồi dào giúp bảo vệ thành mạch máu. Gạo lứt có chỉ số GI thấp, giúp duy trì mức đường huyết ổn định trong suốt buổi chiều.
                  </p>
                </details>
              </div>
            </div>
          </article>

          {/* Snack Card */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-subtle hover:shadow-hover transition-shadow duration-300">
            <div className="p-card-padding">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-xl">local_cafe</span>
                  <h3 className="font-body-bold text-on-surface font-semibold">15:30 - Bữa phụ</h3>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30 flex items-center justify-center bg-surface-container-low">
                  <span className="material-symbols-outlined text-4xl text-outline-variant">nutrition</span>
                </div>
                <div className="flex-grow flex flex-col justify-center">
                  <h4 className="font-h2 text-h2 text-on-surface mb-1 font-semibold text-base">
                    Sữa chua không đường & Hạt óc chó
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">local_fire_department</span> 150 kcal
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">water_drop</span> 0.1g Muối
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-outline-variant/30">
                <details className="group">
                  <summary className="flex items-center gap-1 cursor-pointer font-body-bold text-sm text-primary hover:text-primary-container transition-colors list-none font-semibold">
                    <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                      expand_more
                    </span>
                    Vì sao gợi ý món này?
                  </summary>
                  <p className="mt-2 text-sm font-body text-on-surface-variant bg-surface-container-low p-3 rounded-lg border border-outline-variant/20">
                    Hạt óc chó chứa chất chống oxy hóa tốt cho tim mạch. Sữa chua không đường bổ sung lợi khuẩn, không làm tăng đường huyết đột ngột.
                  </p>
                </details>
              </div>
            </div>
          </article>

          {/* Dinner Card */}
          <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-subtle hover:shadow-hover transition-shadow duration-300">
            <div className="p-card-padding">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-secondary-fixed text-xl">dark_mode</span>
                  <h3 className="font-body-bold text-on-surface font-semibold">19:00 - Bữa tối</h3>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30 relative">
                  <img
                    className="w-full h-full object-cover"
                    alt="Đậu hũ sốt cà chua"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtSRjEDTZvusEmk9emXLf9sEPEV7Uq30u7qoMiyGYlGX8jLyp_3HMVM6tHofFLznplelsAf0gyp5FVC4Odf8sxxIM5DpsmSHHUvVCVcW-sUYS4Z0M34MyzxPB9oWLx1nifg8Q7RaaqGOXqYp9hZGa8GwX599n0B_3qL0wf2B6COppp2iHoReo3Qgya9bAc9GtsVhVyzKRM81G9aF2id4FDTQMXLXAxbqhcNLFJq4hbB7G49PU_OTt8VQ"
                  />
                </div>
                <div className="flex-grow flex flex-col justify-center">
                  <h4 className="font-h2 text-h2 text-on-surface mb-1 font-semibold text-base">
                    Đậu hũ sốt cà chua, Rau muống luộc
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">local_fire_department</span> 280 kcal
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-caption text-caption border border-outline-variant/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">water_drop</span> 1.1g Muối
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary-container/10 text-primary-container font-caption text-caption border border-primary-container/20 text-xs">
                      <span className="material-symbols-outlined text-[14px]">eco</span> Thuần chay
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-outline-variant/30">
                <details className="group">
                  <summary className="flex items-center gap-1 cursor-pointer font-body-bold text-sm text-primary hover:text-primary-container transition-colors list-none font-semibold">
                    <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-180">
                      expand_more
                    </span>
                    Vì sao gợi ý món này?
                  </summary>
                  <p className="mt-2 text-sm font-body text-on-surface-variant bg-surface-container-low p-3 rounded-lg border border-outline-variant/20">
                    Bữa tối nhẹ nhàng với đạm thực vật từ đậu hũ giúp dạ dày dễ tiêu hóa trước khi ngủ. Cà chua giàu kali giúp cân bằng natri trong cơ thể, hỗ trợ hạ huyết áp tự nhiên.
                  </p>
                </details>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
    </>
  );
}
