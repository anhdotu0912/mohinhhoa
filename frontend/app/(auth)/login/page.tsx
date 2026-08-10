"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"doctor" | "patient">("doctor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "doctor") {
      router.push("/doctor");
    } else {
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
            Hệ thống Trợ lý Dinh dưỡng & Quản lý Y tế AI
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex bg-surface-container-low p-1 rounded-xl mb-lg border border-outline-variant/40">
          <button
            type="button"
            onClick={() => setRole("doctor")}
            className={`flex-1 py-2 rounded-lg font-body-bold text-xs font-semibold transition-all cursor-pointer ${
              role === "doctor"
                ? "bg-surface-container-lowest text-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Bác sĩ Chuyên khoa
          </button>
          <button
            type="button"
            onClick={() => setRole("patient")}
            className={`flex-1 py-2 rounded-lg font-body-bold text-xs font-semibold transition-all cursor-pointer ${
              role === "patient"
                ? "bg-surface-container-lowest text-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Bệnh nhân
          </button>
        </div>

        {/* Form */}
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
              placeholder={role === "doctor" ? "bacsi.minh@vmec.vn" : "BN-10293 hoặc Email"}
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
            Đăng nhập với vai trò {role === "doctor" ? "Bác sĩ" : "Bệnh nhân"}
          </button>
        </form>

        <div className="mt-lg pt-md border-t border-outline-variant/40 text-center">
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            Chưa có tài khoản?{" "}
            <a href="#" className="text-primary font-bold hover:underline">
              Đăng ký thông tin y tế
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
