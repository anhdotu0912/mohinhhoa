"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { MOCK_PATIENTS } from "@/lib/mock-data";

interface PlanDetail {
  id: string;
  patientName: string;
  patientCode: string;
  condition: string;
  status: "pending" | "approved" | "rejected";
  breakfast: { name: string; calories: number; salt: number; sugar: number }[];
  lunch: { name: string; calories: number; salt: number; sugar: number }[];
  dinner: { name: string; calories: number; salt: number; sugar: number }[];
  warnings: string[];
  citations: string[];
}

const mockPlanMap: Record<string, PlanDetail> = {
  "PLAN-001": {
    id: "PLAN-001",
    patientName: "Nguyễn Văn A",
    patientCode: "BN-10293",
    condition: "Tiểu đường type 2, Suy thận độ 3",
    status: "pending",
    breakfast: [
      { name: "Phở gà ít béo (thịt lườn, nước dùng trong)", calories: 350, salt: 1.5, sugar: 0 },
      { name: "Nước ép cần tây táo", calories: 80, salt: 0.1, sugar: 12 },
    ],
    lunch: [
      { name: "Cơm gạo lứt (1 bát con)", calories: 150, salt: 0, sugar: 0 },
      { name: "Cá hồi áp chảo măng tây", calories: 320, salt: 0.8, sugar: 0 },
      { name: "Canh bí đao nấu nấm", calories: 45, salt: 0.4, sugar: 0 },
    ],
    dinner: [
      { name: "Ức gà hấp gừng sả", calories: 250, salt: 0.5, sugar: 0 },
      { name: "Rau củ luộc thập cẩm (Cà rốt, súp lơ)", calories: 60, salt: 0.1, sugar: 2 },
    ],
    warnings: [
      "Hàm lượng Muối tổng cộng (2.7g/ngày) vượt nhẹ ngưỡng khuyến nghị cho bệnh nhân Suy thận giai đoạn 3 (2.0g/ngày). Cần điều chỉnh bớt muối ở bữa sáng.",
    ],
    citations: [
      "QĐ 41/2016-BYT (Hướng dẫn Dinh dưỡng Lâm sàng)",
      "KDIGO 2024 Clinical Practice Guideline (CKD)",
      "AHA 2023 Dietary Guidance",
    ],
  },
};

export default function PlanReviewDetailPage({
  params,
}: {
  params: { planId: string };
}) {
  const router = useRouter();
  const planId = params.planId || "PLAN-001";
  const plan = mockPlanMap[planId] || {
    ...mockPlanMap["PLAN-001"],
    id: planId,
  };

  const [status, setStatus] = useState<"pending" | "approved" | "rejected">(plan.status);
  const [breakfast, setBreakfast] = useState(plan.breakfast);
  const [lunch, setLunch] = useState(plan.lunch);
  const [dinner, setDinner] = useState(plan.dinner);

  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Edit item form state
  const [editingMealType, setEditingMealType] = useState<"breakfast" | "lunch" | "dinner" | null>(null);
  const [newDishName, setNewDishName] = useState("");
  const [newDishCalories, setNewDishCalories] = useState("");
  const [newDishSalt, setNewDishSalt] = useState("");
  const [newDishSugar, setNewDishSugar] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApprove = () => {
    setStatus("approved");
    showToast("Đã duyệt kế hoạch dinh dưỡng thành công!");
    setTimeout(() => {
      router.push("/doctor/reviews");
    }, 1500);
  };

  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) return;
    setStatus("rejected");
    setRejectModalOpen(false);
    showToast("Đã từ chối kế hoạch và gửi phản hồi cho AI!");
    setTimeout(() => {
      router.push("/doctor/reviews");
    }, 1500);
  };

  const handleAddDish = (mealType: "breakfast" | "lunch" | "dinner") => {
    if (!newDishName.trim()) return;
    const newItem = {
      name: newDishName.trim(),
      calories: parseFloat(newDishCalories) || 0,
      salt: parseFloat(newDishSalt) || 0,
      sugar: parseFloat(newDishSugar) || 0,
    };

    if (mealType === "breakfast") setBreakfast((prev) => [...prev, newItem]);
    if (mealType === "lunch") setLunch((prev) => [...prev, newItem]);
    if (mealType === "dinner") setDinner((prev) => [...prev, newItem]);

    setNewDishName("");
    setNewDishCalories("");
    setNewDishSalt("");
    setNewDishSugar("");
    setEditingMealType(null);
    showToast("Đã thêm món mới vào thực đơn!");
  };

  const handleDeleteDish = (mealType: "breakfast" | "lunch" | "dinner", index: number) => {
    if (mealType === "breakfast") setBreakfast((prev) => prev.filter((_, i) => i !== index));
    if (mealType === "lunch") setLunch((prev) => prev.filter((_, i) => i !== index));
    if (mealType === "dinner") setDinner((prev) => prev.filter((_, i) => i !== index));
    showToast("Đã xóa món khỏi thực đơn!");
  };

  return (
    <>
      <TopBar title="Chi tiết kế hoạch" />
      <div className="flex flex-col min-h-[calc(100vh-64px)] bg-background font-body">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-lg py-sm rounded-lg shadow-lg flex items-center gap-sm animate-bounce">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="font-body-bold">{toastMessage}</span>
          </div>
        )}

        {/* Dynamic Action Sub-header */}
        <header className="sticky top-16 z-20 bg-surface border-b border-outline-variant px-lg py-md flex flex-wrap items-center justify-between gap-md shadow-xs">
          <div className="flex items-center gap-md">
            <Link
              href="/doctor/reviews"
              className="p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer active:scale-95 rounded-full hover:bg-surface-container-low"
              title="Quay lại danh sách"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <div>
              <h2 className="font-h2 text-h2 text-on-surface font-bold text-lg">
                Chi tiết kế hoạch - {plan.patientName}
              </h2>
              <p className="font-caption text-caption text-on-surface-variant text-xs">
                Mã BN: {plan.patientCode} • Chẩn đoán: {plan.condition}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-sm">
            {status === "approved" ? (
              <span className="px-md py-sm bg-primary-container/20 text-primary font-body-bold rounded-lg text-sm flex items-center gap-xs font-semibold">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                Đã duyệt
              </span>
            ) : status === "rejected" ? (
              <span className="px-md py-sm bg-error-container/30 text-error font-body-bold rounded-lg text-sm flex items-center gap-xs font-semibold">
                <span className="material-symbols-outlined text-[18px]">cancel</span>
                Đã từ chối
              </span>
            ) : (
              <>
                <button
                  onClick={() => setRejectModalOpen(true)}
                  className="h-10 px-md rounded-lg font-body-bold text-error border border-error bg-surface-container-lowest hover:bg-error-container transition-colors active:scale-95 text-xs font-semibold cursor-pointer"
                >
                  Từ chối
                </button>
                <button
                  onClick={() => {
                    setIsEditingMenu(!isEditingMenu);
                    showToast(
                      isEditingMenu
                        ? "Đã lưu thay đổi thực đơn!"
                        : "Đã bật chế độ chỉnh sửa thực đơn."
                    );
                  }}
                  className={`h-10 px-md rounded-lg font-body-bold transition-all active:scale-95 text-xs font-semibold cursor-pointer flex items-center gap-xs ${
                    isEditingMenu
                      ? "bg-primary text-on-primary"
                      : "text-primary border border-primary bg-surface-container-lowest hover:bg-primary-container/10"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isEditingMenu ? "check" : "edit"}
                  </span>
                  {isEditingMenu ? "Lưu thực đơn" : "Chỉnh sửa"}
                </button>
                <button
                  onClick={handleApprove}
                  className="h-10 px-md rounded-lg font-body-bold text-on-primary bg-primary hover:bg-primary-container transition-colors active:scale-95 text-xs font-semibold shadow-sm cursor-pointer"
                >
                  Duyệt kế hoạch
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-lg max-w-[1400px] mx-auto w-full flex-1 flex flex-col md:flex-row gap-lg">
          {/* Left Column: Daily Menu Details (60%) */}
          <section className="w-full md:w-3/5 flex flex-col gap-md">
            <div className="flex justify-between items-center">
              <h3 className="font-body-bold text-body-bold text-on-surface font-semibold text-base">
                Chi tiết thực đơn hàng ngày
              </h3>
              {isEditingMenu && (
                <span className="text-xs font-caption text-primary bg-primary-container/20 px-sm py-xs rounded-full font-semibold">
                  Chế độ chỉnh sửa đang bật
                </span>
              )}
            </div>

            {/* Breakfast Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-card-padding">
              <div className="flex items-center justify-between mb-md pb-sm border-b border-outline-variant">
                <div className="flex items-center space-x-sm">
                  <span className="material-symbols-outlined text-primary text-xl">
                    wb_twilight
                  </span>
                  <h4 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                    Bữa Sáng
                  </h4>
                </div>
                {isEditingMenu && (
                  <button
                    onClick={() => setEditingMealType("breakfast")}
                    className="text-xs text-primary font-body-bold hover:underline flex items-center gap-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm món
                  </button>
                )}
              </div>
              <div className="space-y-md">
                {breakfast.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center group">
                    <span className="font-body text-body text-on-surface text-sm font-medium">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-xs shrink-0 ml-sm">
                      <span className="px-2 py-0.5 rounded-full bg-primary-container/10 text-primary font-caption text-[11px] font-medium">
                        Calo: {item.calories}kcal
                      </span>
                      {item.salt > 1.0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-error-container text-error font-caption text-[11px] font-medium">
                          Muối: {item.salt}g
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-caption text-[11px]">
                          Muối: {item.salt}g
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-caption text-[11px]">
                        Đường: {item.sugar}g
                      </span>
                      {isEditingMenu && (
                        <button
                          onClick={() => handleDeleteDish("breakfast", idx)}
                          className="text-error hover:text-red-700 p-1 rounded hover:bg-error-container/20 cursor-pointer ml-xs"
                          title="Xóa món"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            delete
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lunch Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-card-padding">
              <div className="flex items-center justify-between mb-md pb-sm border-b border-outline-variant">
                <div className="flex items-center space-x-sm">
                  <span className="material-symbols-outlined text-primary text-xl">
                    light_mode
                  </span>
                  <h4 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                    Bữa Trưa
                  </h4>
                </div>
                {isEditingMenu && (
                  <button
                    onClick={() => setEditingMealType("lunch")}
                    className="text-xs text-primary font-body-bold hover:underline flex items-center gap-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm món
                  </button>
                )}
              </div>
              <div className="space-y-md">
                {lunch.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center group">
                    <span className="font-body text-body text-on-surface text-sm font-medium">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-xs shrink-0 ml-sm">
                      <span className="px-2 py-0.5 rounded-full bg-primary-container/10 text-primary font-caption text-[11px] font-medium">
                        Calo: {item.calories}kcal
                      </span>
                      {item.salt > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-caption text-[11px]">
                          Muối: {item.salt}g
                        </span>
                      )}
                      {isEditingMenu && (
                        <button
                          onClick={() => handleDeleteDish("lunch", idx)}
                          className="text-error hover:text-red-700 p-1 rounded hover:bg-error-container/20 cursor-pointer ml-xs"
                          title="Xóa món"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            delete
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dinner Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-card-padding">
              <div className="flex items-center justify-between mb-md pb-sm border-b border-outline-variant">
                <div className="flex items-center space-x-sm">
                  <span className="material-symbols-outlined text-primary text-xl">
                    dark_mode
                  </span>
                  <h4 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                    Bữa Tối
                  </h4>
                </div>
                {isEditingMenu && (
                  <button
                    onClick={() => setEditingMealType("dinner")}
                    className="text-xs text-primary font-body-bold hover:underline flex items-center gap-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm món
                  </button>
                )}
              </div>
              <div className="space-y-md">
                {dinner.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center group">
                    <span className="font-body text-body text-on-surface text-sm font-medium">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-xs shrink-0 ml-sm">
                      <span className="px-2 py-0.5 rounded-full bg-primary-container/10 text-primary font-caption text-[11px] font-medium">
                        Calo: {item.calories}kcal
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-caption text-[11px]">
                        Muối: {item.salt}g
                      </span>
                      {isEditingMenu && (
                        <button
                          onClick={() => handleDeleteDish("dinner", idx)}
                          className="text-error hover:text-red-700 p-1 rounded hover:bg-error-container/20 cursor-pointer ml-xs"
                          title="Xóa món"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            delete
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right Column: AI Citations & Warnings (40%) */}
          <section className="w-full md:w-2/5 flex flex-col gap-lg">
            <h3 className="font-body-bold text-body-bold text-on-surface font-semibold text-base mb-xs">
              Căn cứ AI & Cảnh báo
            </h3>

            {/* Alert Card */}
            {plan.warnings.map((warn, idx) => (
              <div
                key={idx}
                className="bg-tertiary-fixed/80 rounded-xl border border-tertiary-fixed-dim shadow-xs p-card-padding flex items-start gap-md"
              >
                <span className="material-symbols-outlined text-tertiary mt-0.5 text-xl">
                  warning
                </span>
                <div>
                  <h4 className="font-body-bold text-on-tertiary-fixed font-semibold text-sm mb-xs">
                    Cảnh báo vi phạm ngưỡng
                  </h4>
                  <p className="font-body text-body text-on-tertiary-fixed-variant text-xs leading-relaxed">
                    {warn}
                  </p>
                </div>
              </div>
            ))}

            {/* Citations Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-card-padding">
              <div className="flex items-center space-x-sm mb-md pb-sm border-b border-outline-variant">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">
                  library_books
                </span>
                <h4 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                  Cơ sở khoa học (RAG citations)
                </h4>
              </div>
              <div className="flex flex-col gap-sm">
                {plan.citations.map((cite, idx) => (
                  <div
                    key={idx}
                    className="p-sm border border-outline-variant/60 rounded-lg text-xs font-body-bold text-on-surface bg-surface-container-low flex items-center gap-xs"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      menu_book
                    </span>
                    <span>{cite}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Patient Clinical Context Card */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-card-padding">
              <div className="flex items-center space-x-sm mb-md pb-sm border-b border-outline-variant">
                <span className="material-symbols-outlined text-primary text-xl">
                  clinical_notes
                </span>
                <h4 className="font-h2 text-h2 text-on-surface font-semibold text-base">
                  Ràng buộc lâm sàng áp dụng
                </h4>
              </div>
              <ul className="space-y-xs text-xs text-on-surface-variant font-body">
                <li className="flex items-center gap-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Đường huyết mục tiêu: &lt; 7.0 mmol/L
                </li>
                <li className="flex items-center gap-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Khẩu phần muối tối đa: &lt; 2.0g/ngày
                </li>
                <li className="flex items-center gap-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Giới hạn đạm động vật cho suy thận độ 3
                </li>
              </ul>
            </div>
          </section>
        </main>

        {/* Add Dish Modal */}
        {editingMealType && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-md">
            <div className="bg-surface rounded-xl border border-outline-variant max-w-md w-full p-lg shadow-xl">
              <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-xs">
                <h3 className="font-h2 text-h2 text-on-surface font-bold text-base">
                  Thêm món ăn vào Bữa {editingMealType === "breakfast" ? "Sáng" : editingMealType === "lunch" ? "Trưa" : "Tối"}
                </h3>
                <button
                  onClick={() => setEditingMealType(null)}
                  className="text-on-surface-variant hover:text-on-surface p-1"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="space-y-sm mb-md text-xs">
                <div>
                  <label className="block font-label text-on-surface font-semibold mb-xs">
                    Tên món ăn
                  </label>
                  <input
                    type="text"
                    value={newDishName}
                    onChange={(e) => setNewDishName(e.target.value)}
                    placeholder="Ví dụ: Cháo yến mạch ức gà"
                    className="w-full px-md py-xs bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-3 gap-sm">
                  <div>
                    <label className="block font-label text-on-surface font-semibold mb-xs">
                      Calo (kcal)
                    </label>
                    <input
                      type="number"
                      value={newDishCalories}
                      onChange={(e) => setNewDishCalories(e.target.value)}
                      placeholder="250"
                      className="w-full px-sm py-xs bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block font-label text-on-surface font-semibold mb-xs">
                      Muối (g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newDishSalt}
                      onChange={(e) => setNewDishSalt(e.target.value)}
                      placeholder="0.5"
                      className="w-full px-sm py-xs bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block font-label text-on-surface font-semibold mb-xs">
                      Đường (g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newDishSugar}
                      onChange={(e) => setNewDishSugar(e.target.value)}
                      placeholder="0"
                      className="w-full px-sm py-xs bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-sm">
                <button
                  onClick={() => setEditingMealType(null)}
                  className="px-md py-xs border border-outline-variant text-on-surface-variant rounded-lg text-xs font-body-bold hover:bg-surface-container-low cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleAddDish(editingMealType)}
                  className="px-md py-xs bg-primary text-on-primary rounded-lg text-xs font-body-bold hover:bg-primary-container cursor-pointer shadow-xs"
                >
                  Thêm món
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Reason Modal */}
        {rejectModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-md">
            <div className="bg-surface rounded-xl border border-outline-variant max-w-md w-full p-lg shadow-xl">
              <h3 className="font-h2 text-h2 text-on-surface font-bold text-lg mb-sm">
                Lý do từ chối kế hoạch
              </h3>
              <p className="font-caption text-caption text-on-surface-variant text-xs mb-md">
                Nhập nhận xét hoặc phản hồi để AI học và tạo lại thực đơn phù hợp hơn.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Lượng muối ở bữa sáng còn cao, cần giảm bớt phở gà..."
                rows={4}
                className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary mb-lg"
              />
              <div className="flex justify-end gap-sm">
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="px-md py-sm border border-outline-variant text-on-surface-variant rounded-lg text-xs font-body-bold hover:bg-surface-container-low cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleRejectConfirm}
                  className="px-md py-sm bg-error text-on-error rounded-lg text-xs font-body-bold hover:opacity-90 cursor-pointer shadow-xs"
                >
                  Xác nhận Từ chối
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

