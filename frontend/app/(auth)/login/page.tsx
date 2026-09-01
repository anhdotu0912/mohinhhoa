"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { homePathForRole, useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/types";
import { BackToHomeLink } from "../BackToHomeLink";
import { APP_NAME } from "@/lib/brand";

interface DemoAccount {
  roleLabel: string;
  roleKey: string;
  email: string;
  password: string;
  icon: string;
  tag: string;
  theme: {
    badge: string;
    borderHover: string;
    activeBg: string;
    iconColor: string;
  };
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    roleLabel: "BÁC SĨ",
    roleKey: "doctor",
    email: "demo_doctor@example.com",
    password: "12345678",
    icon: "stethoscope",
    tag: "Khám & Kê thực đơn",
    theme: {
      badge: "bg-teal-50 text-teal-700 border-teal-200",
      borderHover: "hover:border-teal-500/60 hover:bg-teal-50/40",
      activeBg: "border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20",
      iconColor: "text-teal-600",
    },
  },
  {
    roleLabel: "BỆNH NHÂN",
    roleKey: "patient",
    email: "demo_patient_1@example.com",
    password: "12345678",
    icon: "person",
    tag: "Nhật ký & Thực đơn",
    theme: {
      badge: "bg-sky-50 text-sky-700 border-sky-200",
      borderHover: "hover:border-sky-500/60 hover:bg-sky-50/40",
      activeBg: "border-sky-600 bg-sky-50/70 ring-2 ring-sky-500/20",
      iconColor: "text-sky-600",
    },
  },
];

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeQuickFill, setActiveQuickFill] = useState<string | null>(null);

  const completeLogin = async (loginEmail: string, loginPassword: string) => {
    setError(null);
    setLoading(true);
    try {
      const tokenRes = await api.login(loginEmail, loginPassword);
      setSession({
        token: tokenRes.access_token,
        role: tokenRes.role,
        userId: tokenRes.user_id,
        email: loginEmail.trim().toLowerCase(),
      });
      try {
        const me = await api.getCurrentUser(tokenRes.access_token);
        setUserProfile({
          displayName: me.full_name?.trim() || me.email,
          avatar: me.avatar ?? null,
          assignedDoctor: me.assigned_doctor ?? null,
        });
      } catch {
        /* Sidebar sẽ thử fetch lại sau */
      }
      router.push(homePathForRole(tokenRes.role));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Không kết nối được máy chủ. Kiểm tra backend đang chạy.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Mật khẩu tối thiểu 8 ký tự.");
      return;
    }
    void completeLogin(email, password);
  };

  const handleSelectDemoAccount = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError(null);
    setActiveQuickFill(acc.roleKey);
    setTimeout(() => {
      setActiveQuickFill((prev) => (prev === acc.roleKey ? null : prev));
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md font-body">
      <div className="max-w-md w-full my-6">
        <BackToHomeLink />
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl shadow-md w-full">
          <div className="text-center mb-lg">
            <Link href="/" className="inline-block mb-xs">
              <h1 className="font-h1 text-h1 text-primary font-bold text-2xl tracking-tight">
                {APP_NAME}
              </h1>
            </Link>
            <p className="font-caption text-caption text-on-surface-variant text-xs">
              Đăng nhập hệ thống Trợ lý Dinh dưỡng & Quản lý Y tế AI
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-md">
            <div>
              <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                title="Mật khẩu tối thiểu 8 ký tự"
                className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-error/30 bg-error-container/20 px-md py-sm text-xs text-error font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary hover:bg-primary/90 font-body-bold rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer mt-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          {/* Quick Demo Accounts Selection Box */}
          <div className="mt-5 pt-4 border-t border-dashed border-outline-variant/60">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  bolt
                </span>
                <span>Tài khoản dùng thử (Bấm để điền nhanh)</span>
              </div>
              <span className="text-[10px] text-on-surface-variant/70 font-mono uppercase bg-surface-container-high px-1.5 py-0.5 rounded">
                Demo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = activeQuickFill === acc.roleKey || (email === acc.email && password === acc.password);
                return (
                  <button
                    key={acc.roleKey}
                    type="button"
                    onClick={() => handleSelectDemoAccount(acc)}
                    className={`group relative text-left p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? acc.theme.activeBg
                        : `border-outline-variant/80 bg-surface-container-lowest/70 ${acc.theme.borderHover}`
                    } active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`material-symbols-outlined text-[16px] ${acc.theme.iconColor} transition-transform group-hover:scale-110`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {acc.icon}
                        </span>
                        <span className="text-xs font-bold text-on-surface tracking-tight">
                          {acc.roleLabel}
                        </span>
                      </div>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-600 animate-fadeIn">
                          <span className="material-symbols-outlined text-[12px]">check</span>
                          Đã điền
                        </span>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant/60 group-hover:text-primary transition-colors flex items-center">
                          Điền
                          <span className="material-symbols-outlined text-[12px] ml-0.5 group-hover:translate-x-0.5 transition-transform">
                            chevron_right
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5 font-mono text-[11px] text-on-surface-variant truncate">
                      <div className="truncate text-slate-700 font-medium">{acc.email}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span>MK:</span>
                        <span className="tracking-widest font-semibold">{acc.password}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-lg pt-md border-t border-outline-variant/40 text-center space-y-2">
            <p className="font-caption text-caption text-on-surface-variant text-xs">
              <Link href="/forgot-password" className="text-primary font-bold hover:underline">
                Quên mật khẩu?
              </Link>
            </p>
            <p className="font-caption text-caption text-on-surface-variant text-xs">
              Chưa có tài khoản?{" "}
              <Link href="/register" className="text-primary font-bold hover:underline">
                Đăng ký tài khoản mới
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
