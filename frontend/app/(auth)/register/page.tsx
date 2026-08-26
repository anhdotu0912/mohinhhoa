"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Mật khẩu tối thiểu 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      await api.register({
        email: email.trim(),
        password,
        role: "patient",
        full_name: fullName.trim() || undefined,
      });
      const tokenRes = await api.login(email.trim(), password);
      setSession({
        token: tokenRes.access_token,
        role: tokenRes.role,
        userId: tokenRes.user_id,
        email: email.trim().toLowerCase(),
        displayName: fullName.trim(),
      });
      router.push("/patient/onboarding");
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

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md py-xl font-body">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg md:p-xl shadow-md max-w-md w-full">
        <div className="text-center mb-lg">
          <Link href="/" className="inline-block mb-xs">
            <h1 className="font-h1 text-h1 text-primary font-bold text-2xl tracking-tight">
              VMEC-10
            </h1>
          </Link>
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            Đăng ký tài khoản bệnh nhân — sau đó khai báo hồ sơ sức khỏe (3 bước)
          </p>
        </div>

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
              placeholder="Nhập họ và tên"
              className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
              Email <span className="text-error">*</span>
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập địa chỉ email"
              className="w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-body text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block font-label text-label text-on-surface mb-xs text-xs font-semibold">
              Mật khẩu <span className="text-error">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)"
              title="Mật khẩu tối thiểu 8 ký tự"
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
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
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
            {loading ? "Đang tạo tài khoản..." : "Đăng ký & tiếp tục hồ sơ"}
          </button>
        </form>

        <div className="mt-lg pt-md border-t border-outline-variant/40 text-center">
          <p className="font-caption text-caption text-on-surface-variant text-xs">
            Đã có tài khoản?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
