"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dropdown } from "@/components/shared/Dropdown";

export default function RegisterPage() {
  const router = useRouter();

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [condition, setCondition] = useState("Tiểu đường type 2");

  const conditionOptions = [
    {
      value: "Tiểu đường type 2",
      label: "Tiểu đường type 2",
      icon: "bloodtype",
      description: "Cần kiểm soát chỉ số đường huyết & carbohydrate",
    },
    {
      value: "Tăng huyết áp",
      label: "Tăng huyết áp",
      icon: "favorite",
      description: "Cần kiểm soát lượng natri / muối tiêu thụ",
    },
    {
      value: "Suy thận mạn",
      label: "Suy thận mạn",
      icon: "medical_services",
      description: "Giới hạn protein, muối và phốt pho",
    },
    {
      value: "Rối loạn lipid máu",
      label: "Rối loạn lipid máu",
      icon: "monitor_heart",
      description: "Hạn chế chất béo bão hòa & cholesterol",
    },
    {
      value: "Gout",
      label: "Bệnh Gout",
      icon: "health_and_safety",
      description: "Hạn chế thực phẩm chứa purin cao",
    },
  ];

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect new patient to onboarding wizard
    router.push("/patient/onboarding");
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md py-xl font-body">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg md:p-xl shadow-md max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-lg">
          <Link href="/" className="inline-block mb-xs">
            <h1 className="font-h1 text-h1 text-primary font-bold text-2xl tracking-tight">
              VMEC-10
            </h1>
          </Link>
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            Đăng ký tài khoản hệ thống Trợ lý Dinh dưỡng & Y tế AI
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-md">
          <div>
            <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
              Họ và tên <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
              Email / Số điện thoại <span className="text-error">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@vmec.vn"
              className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Reusable Dropdown Component for Pathology Condition */}
          <Dropdown
            label="Bệnh lý nền chính (cần theo dõi)"
            options={conditionOptions}
            value={condition}
            onChange={setCondition}
            placeholder="Chọn bệnh lý nền"
          />

          <div>
            <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
              Mật khẩu <span className="text-error">*</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
              Xác nhận mật khẩu <span className="text-error">*</span>
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-primary text-on-primary hover:bg-primary-container font-body-bold rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer mt-md"
          >
            Đăng ký tài khoản
          </button>
        </form>

        <div className="mt-lg pt-md border-t border-outline-variant/40 text-center">
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            Đã có tài khoản hệ thống?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
