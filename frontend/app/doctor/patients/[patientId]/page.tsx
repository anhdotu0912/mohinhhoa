/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/shared/TopBar";

import { MOCK_PATIENTS, Patient } from "@/lib/mock-data";

interface PatientDetailData extends Patient {
  patientCode: string;
  doctorInCharge: string;
  diagnoses: string[];
  vitals: {
    weight: number;
    height: number;
    bmi: number;
    bmiCategory: string;
    bloodGlucose: string;
    bloodPressure: string;
    updatedAt: string;
  };
  medications: {
    name: string;
    dosage: string;
  }[];
  allergies: {
    mild: string[];
    severe: string[];
  };
  treatmentGoals: string[];
}

const detailedPatients: Record<string, PatientDetailData> = {
  "BN-10293": {
    ...MOCK_PATIENTS[0],
    patientCode: "BN-10293",
    doctorInCharge: "BS. Minh",
    diagnoses: ["Tiểu đường type 2", "Tăng huyết áp"],
    vitals: {
      weight: 72,
      height: 170,
      bmi: 24.9,
      bmiCategory: "Thừa cân nhẹ",
      bloodGlucose: "135 mg/dL",
      bloodPressure: "130/80 mmHg",
      updatedAt: "12/10/2023",
    },
    medications: [
      { name: "Metformin 500mg", dosage: "1 viên x 2 lần/ngày, sau ăn" },
      { name: "Amlodipine 5mg", dosage: "1 viên/ngày, buổi sáng" },
    ],
    allergies: {
      mild: [
        "Phát ban nhẹ với thời tiết lạnh.",
        "Đau bụng nhẹ khi dùng sữa tươi chưa tiệt trùng.",
      ],
      severe: ["Hải sản"],
    },
    treatmentGoals: [
      "Kiểm soát đường huyết ổn định (HbA1c < 7%).",
      "Giảm cân 2kg trong 1 tháng thông qua chế độ ăn và tập thể dục.",
      "Duy trì huyết áp dưới 130/80 mmHg.",
    ],
  },
  "BN-10294": {
    ...MOCK_PATIENTS[1],
    patientCode: "BN-10294",
    doctorInCharge: "BS. Minh",
    diagnoses: ["Rối loạn lipid máu", "Suy thận độ 2"],
    vitals: {
      weight: 58,
      height: 162,
      bmi: 22.1,
      bmiCategory: "Bình thường",
      bloodGlucose: "105 mg/dL",
      bloodPressure: "120/80 mmHg",
      updatedAt: "10/10/2023",
    },
    medications: [
      { name: "Atorvastatin 10mg", dosage: "1 viên/ngày, buổi tối" },
      { name: "Losartan 50mg", dosage: "1 viên/ngày, buổi sáng" },
    ],
    allergies: {
      mild: ["Dị ứng bụi mịn"],
      severe: ["Sulfonamides"],
    },
    treatmentGoals: [
      "Hạ Triglyceride máu xuống dưới 1.7 mmol/L.",
      "Giảm natri trong khẩu phần ăn dưới 2000mg/ngày.",
      "Duy trì chỉ số Creatinine máu ở mức an toàn.",
    ],
  },
};

export default function PatientDetailPage({
  params,
}: {
  params: { patientId: string };
}) {
  const patientId = params.patientId || "BN-10293";
  const defaultData = detailedPatients["BN-10293"];
  const patient = detailedPatients[patientId] || {
    ...defaultData,
    id: patientId,
    name: `Bệnh nhân ${patientId}`,
    patientCode: patientId.toUpperCase(),
  };

  // State management
  const [vitals, setVitals] = useState(patient.vitals);
  const [goals, setGoals] = useState(patient.treatmentGoals);
  const [isEditingVitals, setIsEditingVitals] = useState(false);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [newGoalInput, setNewGoalInput] = useState("");

  const [weightInput, setWeightInput] = useState(vitals.weight.toString());
  const [heightInput, setHeightInput] = useState(vitals.height.toString());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveVitals = () => {
    const w = parseFloat(weightInput) || vitals.weight;
    const h = parseFloat(heightInput) || vitals.height;
    const heightInM = h / 100;
    const newBmi = parseFloat((w / (heightInM * heightInM)).toFixed(1));

    let category = "Bình thường";
    if (newBmi < 18.5) category = "Thiếu cân";
    else if (newBmi >= 23 && newBmi < 25) category = "Thừa cân nhẹ";
    else if (newBmi >= 25) category = "Béo phì";

    setVitals((prev) => ({
      ...prev,
      weight: w,
      height: h,
      bmi: newBmi,
      bmiCategory: category,
      updatedAt: new Date().toLocaleDateString("vi-VN"),
    }));

    setIsEditingVitals(false);
    showToast("Cập nhật chỉ số cơ thể thành công!");
  };

  const handleAddGoal = () => {
    if (!newGoalInput.trim()) return;
    setGoals((prev) => [...prev, newGoalInput.trim()]);
    setNewGoalInput("");
    showToast("Đã thêm mục tiêu điều trị mới!");
  };

  const handleDeleteGoal = (index: number) => {
    setGoals((prev) => prev.filter((_, i) => i !== index));
    showToast("Đã xóa mục tiêu!");
  };

  return (
    <>
      <TopBar title="Chi tiết bệnh nhân" />
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-background font-body">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-lg py-sm rounded-lg shadow-lg flex items-center gap-sm animate-bounce">
          <span className="material-symbols-outlined">check_circle</span>
          <span className="font-body-bold">{toastMessage}</span>
        </div>
      )}

      {/* Dynamic Sub-header / Navigation Header */}
      <header className="bg-surface border-b border-outline-variant px-lg py-md flex justify-between items-center sticky top-16 z-10 shadow-subtle">
        <div className="flex items-center gap-md">
          <Link
            href="/doctor/patients"
            className="flex items-center gap-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer active:scale-95"
            title="Quay lại danh sách"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-caption text-caption text-xs uppercase tracking-wider hidden sm:inline">
              Danh sách bệnh nhân
            </span>
          </Link>
          <div className="h-4 w-px bg-outline-variant"></div>
          <h2 className="font-h2 text-h2 text-primary font-bold text-xl">
            {patient.name}
          </h2>
          <span className="bg-surface-container-high text-on-surface-variant font-caption text-caption px-sm py-xs rounded-full border border-outline-variant text-xs">
            {patient.patientCode}
          </span>
        </div>

        <div className="flex items-center gap-md">
          <button
            onClick={() => setIsEditingVitals(true)}
            className="bg-primary text-on-primary px-md py-sm rounded-lg font-body-bold text-body-bold hover:bg-primary-container hover:text-on-primary-container transition-all shadow-sm flex items-center gap-xs cursor-pointer active:scale-95 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Chỉnh sửa chỉ số
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-lg flex-1">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row gap-section-gap">
          {/* Left Column: Patient Profile (30%) */}
          <div className="w-full md:w-[30%] flex flex-col gap-section-gap">
            {/* Profile Card */}
            <div className="bg-surface rounded-xl border border-outline-variant p-card-padding flex flex-col items-center text-center shadow-subtle hover:shadow-hover transition-shadow">
              <div className="relative mb-md">
                <img
                  alt={`${patient.name} Avatar`}
                  className="w-24 h-24 rounded-full object-cover shadow-sm border-2 border-primary-fixed-dim"
                  src={patient.avatar}
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
              </div>
              <h3 className="font-h2 text-h2 text-on-surface mb-xs font-bold text-lg">
                {patient.name}
              </h3>
              <p className="font-body text-body text-on-surface-variant mb-md text-sm">
                {patient.age} tuổi • {patient.gender} • {patient.patientCode}
              </p>

              <div className="w-full text-left pt-sm border-t border-outline-variant">
                <p className="font-label text-label text-outline mb-sm uppercase tracking-wider text-xs font-semibold">
                  Chẩn đoán hiện tại
                </p>
                <div className="flex flex-wrap gap-xs justify-start">
                  {patient.diagnoses.map((diag, index) => (
                    <span
                      key={index}
                      className="bg-tertiary-container/20 text-tertiary px-sm py-xs rounded-full font-caption text-caption border border-tertiary-container/30 text-xs font-medium"
                    >
                      {diag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact & Extra Info Card */}
            <div className="bg-surface rounded-xl border border-outline-variant p-card-padding shadow-subtle">
              <h4 className="font-body-bold text-body-bold text-on-surface mb-md pb-sm border-b border-outline-variant font-semibold flex items-center justify-between">
                <span>Thông tin liên hệ</span>
                <span className="material-symbols-outlined text-outline text-lg">
                  badge
                </span>
              </h4>
              <ul className="space-y-md text-on-surface-variant font-body text-body text-sm">
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-outline text-lg">
                    phone
                  </span>
                  <span>{patient.phone}</span>
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-outline text-lg">
                    mail
                  </span>
                  <span className="truncate">{patient.email}</span>
                </li>
                <li className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-outline text-lg">
                    home
                  </span>
                  <span>{patient.address}</span>
                </li>
                <li className="flex items-center gap-sm pt-xs border-t border-outline-variant/40">
                  <span className="material-symbols-outlined text-primary text-lg">
                    stethoscope
                  </span>
                  <span className="font-body-bold text-on-surface text-xs">
                    {patient.doctorInCharge}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Stacked Cards (70%) */}
          <div className="w-full md:w-[70%] flex flex-col gap-section-gap">
            {/* Card 1: Body Vitals (Chỉ số cơ thể) */}
            <div className="bg-surface rounded-xl border border-outline-variant shadow-subtle overflow-hidden">
              <div className="p-card-padding border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h4 className="font-body-bold text-body-bold text-on-surface flex items-center gap-sm font-semibold text-base">
                  <span className="material-symbols-outlined text-primary">
                    monitor_weight
                  </span>
                  Chỉ số cơ thể
                </h4>
                <div className="flex items-center gap-md">
                  <span className="font-caption text-caption text-outline text-xs">
                    Cập nhật: {vitals.updatedAt}
                  </span>
                  <button
                    onClick={() => setIsEditingVitals(true)}
                    className="text-primary hover:text-primary-container transition-colors text-xs font-body-bold flex items-center gap-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      edit_note
                    </span>
                    Cập nhật
                  </button>
                </div>
              </div>

              <div className="p-card-padding grid grid-cols-2 md:grid-cols-4 gap-md justify-between items-center text-center divide-x-0 md:divide-x divide-outline-variant">
                <div className="px-sm py-xs">
                  <p className="font-label text-label text-outline mb-xs uppercase tracking-wider text-xs">
                    Cân nặng
                  </p>
                  <p className="font-h1 text-h1 text-on-surface text-2xl font-bold">
                    {vitals.weight}{" "}
                    <span className="font-body text-body text-on-surface-variant text-sm font-normal">
                      kg
                    </span>
                  </p>
                </div>

                <div className="px-sm py-xs">
                  <p className="font-label text-label text-outline mb-xs uppercase tracking-wider text-xs">
                    Chiều cao
                  </p>
                  <p className="font-h1 text-h1 text-on-surface text-2xl font-bold">
                    {vitals.height}{" "}
                    <span className="font-body text-body text-on-surface-variant text-sm font-normal">
                      cm
                    </span>
                  </p>
                </div>

                <div className="px-sm py-xs">
                  <p className="font-label text-label text-outline mb-xs uppercase tracking-wider text-xs">
                    BMI
                  </p>
                  <p className="font-h1 text-h1 text-tertiary-container text-2xl font-bold">
                    {vitals.bmi}
                  </p>
                  <p className="font-caption text-caption text-tertiary mt-xs text-xs font-medium">
                    {vitals.bmiCategory}
                  </p>
                </div>

                <div className="px-sm py-xs">
                  <p className="font-label text-label text-outline mb-xs uppercase tracking-wider text-xs">
                    Huyết áp / Đường huyết
                  </p>
                  <p className="font-body-bold text-on-surface font-semibold text-sm">
                    {vitals.bloodPressure}
                  </p>
                  <p className="font-caption text-caption text-on-surface-variant text-xs mt-1">
                    {vitals.bloodGlucose}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Medications & Allergies (Thuốc đang dùng & Dị ứng) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-section-gap">
              {/* Left Sub-card: Thuốc đang dùng */}
              <div className="bg-surface rounded-xl border border-outline-variant shadow-subtle flex flex-col">
                <div className="p-card-padding border-b border-outline-variant bg-surface-container-lowest">
                  <h4 className="font-body-bold text-body-bold text-on-surface flex items-center gap-sm font-semibold text-base">
                    <span className="material-symbols-outlined text-primary">
                      medication
                    </span>
                    Thuốc đang dùng
                  </h4>
                </div>
                <div className="p-card-padding flex-1">
                  <ul className="space-y-md">
                    {patient.medications.map((med, idx) => (
                      <li key={idx} className="flex items-start gap-sm">
                        <span className="material-symbols-outlined text-primary mt-xs">
                          pill
                        </span>
                        <div>
                          <p className="font-body-bold text-body-bold text-on-surface font-semibold text-sm">
                            {med.name}
                          </p>
                          <p className="font-caption text-caption text-on-surface-variant text-xs mt-0.5">
                            {med.dosage}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right Sub-card: Dị ứng */}
              <div className="bg-surface rounded-xl border border-outline-variant shadow-subtle flex flex-col">
                <div className="p-card-padding border-b border-outline-variant bg-surface-container-lowest">
                  <h4 className="font-body-bold text-body-bold text-on-surface flex items-center gap-sm font-semibold text-base">
                    <span className="material-symbols-outlined text-error">
                      warning
                    </span>
                    Dị ứng & Phản ứng phụ
                  </h4>
                </div>
                <div className="p-card-padding flex-1 flex flex-col justify-between">
                  <ul className="list-disc list-inside space-y-sm font-body text-body text-on-surface-variant text-sm mb-md">
                    {patient.allergies.mild.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                  <div className="pt-sm border-t border-outline-variant/40">
                    <p className="font-label text-label text-outline mb-xs text-xs uppercase tracking-wider font-semibold">
                      Nghiêm trọng:
                    </p>
                    <div className="flex flex-wrap gap-xs">
                      {patient.allergies.severe.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-block bg-error-container/50 text-error px-md py-xs rounded-full font-body-bold text-body-bold border border-error/20 text-xs font-semibold"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Treatment Goals (Mục tiêu điều trị) */}
            <div className="bg-surface rounded-xl border border-outline-variant shadow-subtle flex flex-col">
              <div className="p-card-padding border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h4 className="font-body-bold text-body-bold text-on-surface flex items-center gap-sm font-semibold text-base">
                  <span className="material-symbols-outlined text-primary">
                    flag
                  </span>
                  Mục tiêu điều trị & Dinh dưỡng
                </h4>
                <button
                  onClick={() => setIsEditingGoals(!isEditingGoals)}
                  className="text-primary hover:text-primary-container transition-colors text-xs font-body-bold flex items-center gap-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isEditingGoals ? "check_circle" : "edit_note"}
                  </span>
                  {isEditingGoals ? "Xong" : "Quản lý mục tiêu"}
                </button>
              </div>

              <div className="p-card-padding flex-1">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md min-h-[120px]">
                  <ul className="space-y-sm font-body text-body text-on-surface">
                    {goals.map((goal, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between group"
                      >
                        <div className="flex items-start gap-xs">
                          <span className="material-symbols-outlined text-primary text-sm mt-1">
                            check_circle
                          </span>
                          <span className="text-sm font-medium">{goal}</span>
                        </div>
                        {isEditingGoals && (
                          <button
                            onClick={() => handleDeleteGoal(idx)}
                            className="text-error hover:text-red-700 transition-colors p-1 rounded hover:bg-error-container/20 cursor-pointer"
                            title="Xóa mục tiêu"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              delete
                            </span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Add New Goal Form */}
                  {isEditingGoals && (
                    <div className="mt-md pt-md border-t border-outline-variant flex gap-sm">
                      <input
                        type="text"
                        value={newGoalInput}
                        onChange={(e) => setNewGoalInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddGoal();
                        }}
                        placeholder="Nhập mục tiêu mới..."
                        className="flex-1 px-md py-xs bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={handleAddGoal}
                        className="bg-primary text-on-primary px-md py-xs rounded-lg text-xs font-body-bold hover:bg-primary-container transition-colors cursor-pointer"
                      >
                        Thêm
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Vitals Modal */}
      {isEditingVitals && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-md animate-fadeIn">
          <div className="bg-surface rounded-xl border border-outline-variant max-w-md w-full p-lg shadow-xl">
            <div className="flex justify-between items-center mb-md pb-sm border-b border-outline-variant">
              <h3 className="font-h2 text-h2 text-on-surface font-bold text-lg flex items-center gap-xs">
                <span className="material-symbols-outlined text-primary">
                  monitor_weight
                </span>
                Cập nhật chỉ số cơ thể
              </h3>
              <button
                onClick={() => setIsEditingVitals(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-md mb-lg">
              <div>
                <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
                  Cân nặng (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
                  Chiều cao (cm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-sm font-body text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-sm">
              <button
                onClick={() => setIsEditingVitals(false)}
                className="px-md py-sm border border-outline-variant text-on-surface-variant rounded-lg text-sm font-body-bold hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveVitals}
                className="px-md py-sm bg-primary text-on-primary rounded-lg text-sm font-body-bold hover:bg-primary-container transition-colors cursor-pointer shadow-sm"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
