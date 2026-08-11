"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    // Auto-detect role based on email/identifier or default to doctor/patient
    if (
      cleanEmail.includes("doctor") ||
      cleanEmail.includes("bacsi") ||
      cleanEmail.startsWith("bs")
    ) {
      router.push("/doctor");
    } else {
      router.push("/patient");
    }
  };

  const handleDemoLogin = (targetRole: "doctor" | "patient") => {
    if (targetRole === "doctor") {
      setEmail("bacsi.minh@vmec.vn");
      setPassword("12345678");
      router.push("/doctor");
    } else {
      setEmail("nguyenvana@gmail.com");
      setPassword("12345678");
      router.push("/patient");
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md font-body">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl shadow-md max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-lg">
          <Link href="/" className="inline-block mb-xs">
            <h1 className="font-h1 text-h1 text-primary font-bold text-2xl tracking-tight">
              VMEC-10
            </h1>
          </Link>
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            Đăng nhập hệ thống Trợ lý Dinh dưỡng & Quản lý Y tế AI
          </p>
        </div>

        {/* Unified Login Form */}
        <form onSubmit={handleLogin} className="space-y-md">
          <div>
            <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
              Email / Mã định danh
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập email hoặc mã định danh của bạn..."
              className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-xs">
              <label className="font-label text-label text-on-surface text-xs font-semibold">
                Mật khẩu
              </label>
              <a href="#" className="font-caption text-caption text-primary hover:underline text-xs">
                Quên mật khẩu?
              </a>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-primary text-on-primary hover:bg-primary-container font-body-bold rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer mt-md"
          >
            Đăng nhập
          </button>
        </form>

        {/* Demo Quick Access */}
        <div className="mt-md p-sm bg-surface-container-low rounded-xl border border-outline-variant/40">
          <p className="text-[11px] text-on-surface-variant font-semibold mb-xs text-center">
            💡 TRUY CẬP NHANH DEMO (ĐÃ CÓ TÀI KHOẢN):
          </p>
          <div className="flex gap-xs">
            <button
              type="button"
              onClick={() => handleDemoLogin("doctor")}
              className="flex-1 py-1.5 px-xs bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-semibold text-primary hover:border-primary transition-colors text-center cursor-pointer"
            >
              👨‍⚕️ Demo Bác sĩ
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin("patient")}
              className="flex-1 py-1.5 px-xs bg-surface-container-lowest border border-outline-variant rounded-lg text-xs font-semibold text-primary hover:border-primary transition-colors text-center cursor-pointer"
            >
              🧑‍🤝‍🧑 Demo Bệnh nhân
            </button>
          </div>
        </div>

        <div className="mt-lg pt-md border-t border-outline-variant/40 text-center">
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="text-primary font-bold hover:underline">
              Đăng ký tài khoản mới
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
