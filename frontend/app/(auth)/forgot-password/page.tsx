"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/types";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await api.forgotPassword(email.trim());
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không gửi được yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md font-body">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl shadow-md max-w-md w-full">
        <h1 className="font-h2 text-h2 text-on-surface mb-sm">Quên mật khẩu</h1>
        <p className="font-body text-body text-on-surface-variant mb-lg text-sm">
          Nhập email đã đăng ký. Nếu tài khoản tồn tại, mật khẩu mới sẽ được gửi
          vào hộp thư của bạn (hãy kiểm tra cả thư rác).
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-md">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-sm rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-60"
          >
            {loading ? "Đang gửi…" : "Gửi hướng dẫn"}
          </button>
        </form>
        <p className="mt-lg text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
