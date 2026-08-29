"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { homePathForRole, useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/types";
import { BackToHomeLink } from "../BackToHomeLink";
import { APP_NAME } from "@/lib/brand";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md font-body">
      <div className="max-w-md w-full">
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
            className="w-full py-3 bg-primary text-on-primary hover:bg-primary/90 font-body-bold rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer mt-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

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
