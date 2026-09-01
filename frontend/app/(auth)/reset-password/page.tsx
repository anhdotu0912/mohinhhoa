"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/types";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword(token.trim(), password);
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không đặt lại được mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-md font-body">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl shadow-md max-w-md w-full">
        <h1 className="font-h2 text-h2 text-on-surface mb-sm">Đặt lại mật khẩu</h1>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-md">
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token reset (từ email/log backend)"
            className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu mới"
            className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-sm rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-semibold transition-all cursor-pointer disabled:opacity-60"
          >
            {loading ? "Đang lưu…" : "Đặt lại mật khẩu"}
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
