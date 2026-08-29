"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import { ApiError, type UserMeResponse } from "@/lib/types";

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggleVisible,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  visible: boolean;
  onToggleVisible: () => void;
  error?: string;
  placeholder: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-on-surface-variant mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={8}
          maxLength={128}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full px-3.5 py-2.5 pr-11 bg-white border rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/70 caret-primary selection:bg-primary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 ${
            error
              ? "border-rose-400 focus-visible:ring-rose-300"
              : "border-outline-variant"
          }`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg cursor-pointer"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          <span className="material-symbols-outlined text-[18px]">
            {visible ? "visibility_off" : "visibility"}
          </span>
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-[11px] text-rose-700 mt-1 font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function DoctorProfilePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);
  const fileRef = useRef<HTMLInputElement>(null);

  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameNotice, setNameNotice] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const me = await api.getCurrentUser();
      setUser(me);
      setFullName(me.full_name ?? "");
      setUserProfile({
        displayName: me.full_name?.trim() || me.email,
        avatar: me.avatar ?? null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được hồ sơ. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  }, [setUserProfile]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  if (!hydrated || !token || role !== "doctor") return null;

  const displayName = user?.full_name?.trim() || user?.email || "Bác sĩ";
  const avatarSrc = resolveUserAvatar(user?.avatar);
  const initials = userInitials(displayName);
  const nameDirty = fullName.trim() !== (user?.full_name ?? "").trim();

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameNotice(null);
    setSavingName(true);
    try {
      const updated = await api.updateCurrentUser({ full_name: fullName });
      setUser(updated);
      setFullName(updated.full_name ?? "");
      setUserProfile({
        displayName: updated.full_name?.trim() || updated.email,
        avatar: updated.avatar ?? null,
      });
      setNameNotice("Đã lưu tên hiển thị. Bệnh nhân sẽ thấy tên này khi hỏi lời dặn.");
    } catch (err) {
      setNameError(err instanceof ApiError ? err.message : "Không lưu được tên. Thử lại sau.");
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError(null);
    setAvatarNotice(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Ảnh tối đa 2MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setAvatarError("Chọn tệp ảnh (PNG, JPG, WebP hoặc GIF).");
      return;
    }
    setUploadingAvatar(true);
    try {
      const out = await api.uploadMyAvatar(file);
      setUser((prev) => (prev ? { ...prev, avatar: out.avatar } : prev));
      setUserProfile({ avatar: out.avatar });
      setAvatarNotice("Đã cập nhật ảnh đại diện.");
    } catch (err) {
      setAvatarError(
        err instanceof ApiError ? err.message : "Không tải được ảnh. Thử lại sau."
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFormError(null);
    setPasswordSuccess(null);
    const nextErrors: { current?: string; next?: string; confirm?: string } = {};
    if (!currentPassword) nextErrors.current = "Nhập mật khẩu hiện tại.";
    if (newPassword.length < 8) nextErrors.next = "Mật khẩu mới tối thiểu 8 ký tự.";
    else if (currentPassword && newPassword === currentPassword) {
      nextErrors.next = "Mật khẩu mới phải khác mật khẩu hiện tại.";
    }
    if (!confirmPassword) nextErrors.confirm = "Nhập lại mật khẩu mới.";
    else if (newPassword !== confirmPassword) {
      nextErrors.confirm = "Mật khẩu xác nhận không khớp.";
    }
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmittingPassword(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setPasswordSuccess(res.message);
    } catch (err) {
      setPasswordFormError(
        err instanceof ApiError ? err.message : "Không đổi được mật khẩu. Thử lại sau."
      );
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <>
      <TopBar title="Hồ sơ" />
      <main className="p-4 sm:p-6 md:p-8 w-full max-w-5xl mx-auto flex-1 selection:bg-primary/15">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-on-surface leading-tight">
            Hồ sơ của bạn
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant max-w-xl leading-relaxed">
            Tên và ảnh này hiện với bệnh nhân khi họ hỏi bác sĩ dặn gì — không dùng tên cứng trên giao diện.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-rose-600 text-[22px]">error</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="shrink-0 text-xs font-semibold text-rose-800 hover:text-rose-950 px-2 py-1 rounded-lg cursor-pointer"
            >
              Tải lại
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 h-80 rounded-2xl border border-outline-variant bg-white animate-pulse" />
            <div className="lg:col-span-7 h-80 rounded-2xl border border-outline-variant bg-white animate-pulse" />
          </div>
        ) : user ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-5 bg-white border border-outline-variant rounded-2xl p-6 shadow-[0_8px_24px_rgba(25,28,28,0.06)]">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-28 h-28 rounded-full ring-4 ring-primary/20 p-1 bg-white overflow-hidden">
                    <div
                      translate="no"
                      className="absolute inset-1 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold"
                    >
                      {initials}
                    </div>
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={`Ảnh đại diện ${displayName}`}
                        className="relative z-10 w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    title="Đổi ảnh đại diện"
                    className="absolute bottom-1 right-1 z-20 w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,108,73,0.35)] hover:scale-105 active:scale-95 transition-transform cursor-pointer border-2 border-white disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {uploadingAvatar ? "progress_activity" : "photo_camera"}
                    </span>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => void handleAvatarFile(e)}
                  />
                </div>

                <p className="text-lg font-semibold text-on-surface">{displayName}</p>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate max-w-full">
                  {user.email}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                  <span className="material-symbols-outlined text-[15px]">stethoscope</span>
                  Bác sĩ
                </span>
              </div>

              {avatarError ? (
                <p role="alert" className="mt-4 text-xs text-rose-700 font-medium text-center">
                  {avatarError}
                </p>
              ) : null}
              {avatarNotice ? (
                <p role="status" className="mt-4 text-xs text-emerald-800 font-medium text-center">
                  {avatarNotice}
                </p>
              ) : null}

              <form onSubmit={(e) => void handleSaveName(e)} className="mt-6 space-y-3">
                <div>
                  <label
                    htmlFor="doctor-full-name"
                    className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
                  >
                    Tên hiển thị
                  </label>
                  <input
                    id="doctor-full-name"
                    type="text"
                    maxLength={255}
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setNameError(null);
                      setNameNotice(null);
                    }}
                    placeholder={user.email}
                    className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/70 caret-primary selection:bg-primary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2"
                  />
                  <p className="mt-1.5 text-[11px] text-on-surface-variant leading-snug">
                    Để trống thì hệ thống dùng email. Bệnh nhân không thấy tên bịa.
                  </p>
                </div>
                {nameError ? (
                  <p role="alert" className="text-xs text-rose-700 font-medium">
                    {nameError}
                  </p>
                ) : null}
                {nameNotice ? (
                  <p role="status" className="text-xs text-emerald-800 font-medium">
                    {nameNotice}
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingName || !nameDirty}
                    className="inline-flex items-center gap-2 bg-primary text-on-primary font-semibold text-sm py-2.5 px-5 rounded-xl hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(0,108,73,0.22)]"
                  >
                    {savingName ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">save</span>
                    )}
                    Lưu tên
                  </button>
                </div>
              </form>
            </section>

            <section className="lg:col-span-7 bg-white border border-outline-variant rounded-2xl p-6 shadow-[0_8px_24px_rgba(25,28,28,0.06)]">
              <h2 className="text-lg font-semibold text-on-surface">Bảo mật tài khoản</h2>
              <p className="text-sm text-on-surface-variant mt-1 mb-5">
                Đổi mật khẩu đăng nhập. Mật khẩu mới tối thiểu 8 ký tự.
              </p>

              {passwordSuccess ? (
                <div
                  role="status"
                  className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-emerald-700 text-[18px]">
                    check_circle
                  </span>
                  <span>{passwordSuccess}</span>
                </div>
              ) : null}
              {passwordFormError ? (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">error</span>
                  <span>{passwordFormError}</span>
                </div>
              ) : null}

              <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
                <PasswordField
                  id="doctor-current-password"
                  label="Mật khẩu hiện tại"
                  value={currentPassword}
                  onChange={(v) => {
                    setCurrentPassword(v);
                    setPasswordErrors((p) => ({ ...p, current: undefined }));
                    setPasswordFormError(null);
                    setPasswordSuccess(null);
                  }}
                  autoComplete="current-password"
                  visible={showCurrent}
                  onToggleVisible={() => setShowCurrent((v) => !v)}
                  error={passwordErrors.current}
                  placeholder="Nhập mật khẩu đang dùng"
                />
                <PasswordField
                  id="doctor-new-password"
                  label="Mật khẩu mới"
                  value={newPassword}
                  onChange={(v) => {
                    setNewPassword(v);
                    setPasswordErrors((p) => ({ ...p, next: undefined }));
                    setPasswordFormError(null);
                    setPasswordSuccess(null);
                  }}
                  autoComplete="new-password"
                  visible={showNew}
                  onToggleVisible={() => setShowNew((v) => !v)}
                  error={passwordErrors.next}
                  placeholder="Tối thiểu 8 ký tự"
                />
                <PasswordField
                  id="doctor-confirm-password"
                  label="Xác nhận mật khẩu mới"
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    setPasswordErrors((p) => ({ ...p, confirm: undefined }));
                    setPasswordFormError(null);
                    setPasswordSuccess(null);
                  }}
                  autoComplete="new-password"
                  visible={showConfirm}
                  onToggleVisible={() => setShowConfirm((v) => !v)}
                  error={passwordErrors.confirm}
                  placeholder="Nhập lại mật khẩu mới"
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={submittingPassword}
                    className="inline-flex items-center gap-2 bg-primary text-on-primary font-semibold text-sm py-2.5 px-5 rounded-xl hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 shadow-[0_4px_14px_rgba(0,108,73,0.22)]"
                  >
                    {submittingPassword ? (
                      <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">
                          progress_activity
                        </span>
                        Đang đổi mật khẩu...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">key</span>
                        Đổi mật khẩu
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </main>
    </>
  );
}
