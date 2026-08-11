"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PatientOnboardingPage() {
  const router = useRouter();

  // Form states
  const [selectedConditions, setSelectedConditions] = useState<string[]>([
    "Tiểu đường type 2",
    "Tăng huyết áp",
  ]);
  const [allergies, setAllergies] = useState<string[]>(["Hải sản"]);
  const [newAllergyInput, setNewAllergyInput] = useState("");
  const [medications, setMedications] = useState<string[]>([
    "Metformin 500mg (1 viên/ngày)",
    "Amlodipine 5mg (1 viên/sáng)",
  ]);
  const [newMedInput, setNewMedInput] = useState("");
  const [weight, setWeight] = useState("68");
  const [height, setHeight] = useState("168");
  const [goal, setGoal] = useState(
    "Kiểm soát đường huyết ổn định, giảm natri trong bữa ăn hàng ngày."
  );

  const conditionOptions = [
    "Tiểu đường type 2",
    "Tăng huyết áp",
    "Suy thận mạn",
    "Gout",
    "Rối loạn lipid máu",
    "Gan nhiễm mỡ",
  ];

  const commonAllergies = ["Hải sản", "Sữa", "Đậu phộng", "Trứng", "Không dị ứng"];

  const toggleCondition = (cond: string) => {
    if (selectedConditions.includes(cond)) {
      setSelectedConditions(selectedConditions.filter((c) => c !== cond));
    } else {
      setSelectedConditions([...selectedConditions, cond]);
    }
  };

  const handleAddAllergy = () => {
    if (!newAllergyInput.trim()) return;
    if (!allergies.includes(newAllergyInput.trim())) {
      setAllergies([...allergies, newAllergyInput.trim()]);
    }
    setNewAllergyInput("");
  };

  const handleRemoveAllergy = (alg: string) => {
    setAllergies(allergies.filter((a) => a !== alg));
  };

  const handleAddMedication = () => {
    if (!newMedInput.trim()) return;
    setMedications([...medications, newMedInput.trim()]);
    setNewMedInput("");
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save state / redirect to patient dashboard
    router.push("/patient");
  };

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col justify-center items-center p-md py-xl font-body">
      {/* Top Brand Logo */}
      <div className="mb-lg text-center">
        <div className="inline-flex items-center gap-xs mb-xs">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold shadow-xs">
            <span className="material-symbols-outlined text-[22px]">vital_signs</span>
          </div>
          <span className="font-h1 text-h1 text-primary font-bold text-2xl tracking-tight">
            VMEC-10
          </span>
        </div>
        <p className="font-caption text-caption text-on-surface-variant text-xs">
          Hệ thống Trợ lý Dinh dưỡng & Sinh hoạt cho Bệnh nhân Mạn tính
        </p>
      </div>

      {/* Main Form Container Card */}
      <div className="w-full max-w-[560px] bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg md:p-xl shadow-md">
        {/* Progress Header */}
        <div className="mb-lg">
          <div className="flex justify-between items-center mb-xs">
            <span className="font-label text-label text-primary font-bold text-xs uppercase tracking-wider">
              Bước 1 / 3: Khai báo hồ sơ sức khỏe
            </span>
            <span className="font-mono text-xs font-semibold text-on-surface-variant">
              33%
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary w-1/3 rounded-full transition-all"></div>
          </div>
        </div>

        {/* Title */}
        <div className="mb-lg">
          <h1 className="font-h1 text-h1 text-on-surface font-bold text-xl mb-xs">
            Thông tin sức khỏe & Chế độ ăn
          </h1>
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            Cung cấp chỉ số chính xác để AI Agent tạo phác đồ dinh dưỡng an toàn và cá nhân hóa cho bạn.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-lg">
          {/* Section 1: Bệnh lý nền */}
          <div>
            <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
              Bệnh lý nền đang điều trị <span className="text-error">*</span>
            </label>
            <div className="flex flex-wrap gap-xs">
              {conditionOptions.map((cond) => {
                const isSelected = selectedConditions.includes(cond);
                return (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => toggleCondition(cond)}
                    className={`px-md py-sm rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary shadow-xs"
                        : "bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary/50"
                    }`}
                  >
                    {isSelected && "✓ "}
                    {cond}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Dị ứng thực phẩm */}
          <div>
            <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
              Dị ứng & Kiêng kỵ thực phẩm
            </label>
            <div className="flex flex-wrap gap-xs mb-sm">
              {allergies.map((alg) => (
                <span
                  key={alg}
                  className="px-md py-xs bg-error-container/30 border border-error/20 text-error rounded-full text-xs font-semibold flex items-center gap-xs"
                >
                  🚫 {alg}
                  <button
                    type="button"
                    onClick={() => handleRemoveAllergy(alg)}
                    className="hover:text-error/80 font-bold ml-xs"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-xs">
              <input
                type="text"
                value={newAllergyInput}
                onChange={(e) => setNewAllergyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAllergy();
                  }
                }}
                placeholder="Nhập thực phẩm dị ứng (vd: Nhộng tôm, Hạt óc chó...)"
                className="flex-1 px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddAllergy}
                className="px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors"
              >
                + Thêm
              </button>
            </div>
          </div>

          {/* Section 3: Thuốc đang sử dụng */}
          <div>
            <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
              Thuốc đang sử dụng hàng ngày
            </label>
            <div className="space-y-xs mb-sm">
              {medications.map((med, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-sm bg-surface-container-low border border-outline-variant/60 rounded-lg text-xs"
                >
                  <span className="font-medium text-on-surface">💊 {med}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMedication(idx)}
                    className="text-on-surface-variant hover:text-error"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      close
                    </span>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-xs">
              <input
                type="text"
                value={newMedInput}
                onChange={(e) => setNewMedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddMedication();
                  }
                }}
                placeholder="Nhập tên thuốc & liều dùng..."
                className="flex-1 px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddMedication}
                className="px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors"
              >
                + Thêm
              </button>
            </div>
          </div>

          {/* Section 4: Cân nặng & Chiều cao (Side by Side) */}
          <div className="grid grid-cols-2 gap-md">
            <div>
              <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                Cân nặng (kg) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
                className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
                Chiều cao (cm) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                required
                className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Section 5: Mục tiêu sức khỏe */}
          <div>
            <label className="font-label text-label text-on-surface block mb-xs font-semibold text-sm">
              Mục tiêu sức khỏe mong muốn
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="Nhập mục tiêu của bạn (vd: Giảm cân nhẹ, ổn định đường huyết...)"
              className="w-full p-md bg-surface-container-lowest border border-outline-variant rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-md border-t border-outline-variant">
            <button
              type="submit"
              className="w-full bg-primary text-on-primary font-body-bold py-md px-lg rounded-xl hover:bg-primary-container transition-colors shadow-xs active:scale-[0.99] flex items-center justify-center gap-xs text-sm font-bold cursor-pointer"
            >
              Tiếp tục
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Footer Link */}
      <div className="mt-md text-center">
        <Link
          href="/patient"
          className="font-caption text-caption text-on-surface-variant hover:text-primary text-xs"
        >
          Bỏ qua thiết lập, tới Trang chủ Bệnh nhân →
        </Link>
      </div>
    </div>
  );
}
