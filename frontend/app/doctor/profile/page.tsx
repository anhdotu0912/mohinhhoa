"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shared/TopBar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { resolveUserAvatar, userInitials } from "@/lib/avatar";
import {
  ApiError,
  type DoctorProfileResponse,
  type DoctorProfileUpdate,
} from "@/lib/types";

const PRESET_TITLES = [
  "Bác sĩ",
  "BS. CKI",
  "BS. CKII",
  "ThS. BS",
  "TS. BS",
  "PGS. TS",
  "GS. TS",
];

const PRESET_SPECIALTIES = [
  "Dinh dưỡng lâm sàng",
  "Nội tiết & Đái tháo đường",
  "Tim mạch",
  "Tiết chế bệnh viện",
  "Tiêu hóa - Gan mật",
  "Thận học & Lọc máu",
  "Lão khoa",
  "Nhi khoa dinh dưỡng",
];

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
      <label
        htmlFor={id}
        className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
      >
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
          className={`w-full px-3.5 py-2.5 pr-11 bg-white border rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 caret-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 transition-all ${
            error
              ? "border-rose-400 focus-visible:ring-rose-300"
              : "border-outline-variant hover:border-outline"
          }`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg cursor-pointer transition-colors"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          <span className="material-symbols-outlined text-[18px]">
            {visible ? "visibility_off" : "visibility"}
          </span>
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-[11px] text-rose-700 mt-1 font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">error</span>
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
  const [profileData, setProfileData] = useState<DoctorProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"clinical" | "stats" | "security">("clinical");

  // Form states for clinical profile
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialtyInput, setNewSpecialtyInput] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [yearsOfExp, setYearsOfExp] = useState<number | "">("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptingPatients, setAcceptingPatients] = useState(true);
  const [consultationHours, setConsultationHours] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Avatar upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);

  // Password change states
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

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.getDoctorProfile();
      setProfileData(res);
      setFullName(res.full_name ?? "");
      setTitle(res.profile.title ?? "BS. CKI");
      setSpecialties(res.profile.specialties?.length ? res.profile.specialties : ["Dinh dưỡng lâm sàng"]);
      setLicenseNumber(res.profile.license_number ?? "");
      setWorkplace(res.profile.workplace ?? "Khoa Dinh dưỡng & Tiết chế — Bệnh viện Đa khoa Quốc tế Vinmec");
      setYearsOfExp(res.profile.years_of_experience ?? 8);
      setBio(
        res.profile.bio ??
          "Bác sĩ chuyên khoa Dinh dưỡng lâm sàng & Nội tiết với định hướng điều trị cá nhân hoá, kiểm soát đường huyết và phòng ngừa biến chứng tim mạch - thận."
      );
      setPhone(res.profile.phone ?? "");
      setAcceptingPatients(res.profile.accepting_patients ?? true);
      setConsultationHours(res.profile.consultation_hours ?? "08:00 - 17:00 (Thứ 2 - Thứ 6)");
      setEmergencyContact(res.profile.emergency_contact ?? "Hotline Trực ban Dinh dưỡng / Cấp cứu");

      setUserProfile({
        displayName: res.full_name?.trim() || res.email,
        avatar: res.avatar ?? null,
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không tải được dữ liệu hồ sơ. Vui lòng thử lại sau."
      );
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
    void loadData();
  }, [hydrated, token, role, router, loadData]);

  if (!hydrated || !token || role !== "doctor") return null;

  const displayName = profileData?.full_name?.trim() || profileData?.email || "Bác sĩ";
  const avatarSrc = resolveUserAvatar(profileData?.avatar);
  const initials = userInitials(displayName);

  const handleToggleAccepting = async (newVal: boolean) => {
    setAcceptingPatients(newVal);
    try {
      const updated = await api.updateDoctorProfile({ accepting_patients: newVal });
      setProfileData(updated);
      setProfileNotice(
        newVal
          ? "Đã bật tiếp nhận bệnh nhân mới vào danh sách quản lý."
          : "Đã tạm dừng tiếp nhận bệnh nhân mới."
      );
      setTimeout(() => setProfileNotice(null), 4000);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Không đổi được trạng thái nhận bệnh.");
    }
  };

  const handleAddSpecialty = (item: string) => {
    const trimmed = item.trim();
    if (!trimmed || specialties.includes(trimmed)) return;
    setSpecialties([...specialties, trimmed]);
    setNewSpecialtyInput("");
  };

  const handleRemoveSpecialty = (item: string) => {
    setSpecialties(specialties.filter((s) => s !== item));
  };

  const handleSaveClinicalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileNotice(null);
    setSavingProfile(true);

    const payload: DoctorProfileUpdate = {
      full_name: fullName.trim() || null,
      title: title.trim() || null,
      specialties,
      license_number: licenseNumber.trim() || null,
      workplace: workplace.trim() || null,
      years_of_experience: yearsOfExp === "" ? null : Number(yearsOfExp),
      bio: bio.trim() || null,
      phone: phone.trim() || null,
      accepting_patients: acceptingPatients,
      consultation_hours: consultationHours.trim() || null,
      emergency_contact: emergencyContact.trim() || null,
    };

    try {
      const res = await api.updateDoctorProfile(payload);
      setProfileData(res);
      setUserProfile({
        displayName: res.full_name?.trim() || res.email,
        avatar: res.avatar ?? null,
      });
      setProfileNotice("Đã lưu thông tin hồ sơ chuyên môn thành công.");
      setTimeout(() => setProfileNotice(null), 5000);
    } catch (err) {
      setProfileError(
        err instanceof ApiError ? err.message : "Không lưu được thông tin. Vui lòng thử lại sau."
      );
    } finally {
      setSavingProfile(false);
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
      setAvatarError("Chọn tệp ảnh hợp lệ (PNG, JPG, WebP hoặc GIF).");
      return;
    }
    setUploadingAvatar(true);
    try {
      const out = await api.uploadMyAvatar(file);
      setProfileData((prev) => (prev ? { ...prev, avatar: out.avatar } : prev));
      setUserProfile({ avatar: out.avatar });
      setAvatarNotice("Đã cập nhật ảnh đại diện bác sĩ.");
      setTimeout(() => setAvatarNotice(null), 4000);
    } catch (err) {
      setAvatarError(
        err instanceof ApiError ? err.message : "Không tải được ảnh đại diện. Thử lại sau."
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
      setPasswordSuccess(res.message || "Đổi mật khẩu thành công.");
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err) {
      setPasswordFormError(
        err instanceof ApiError ? err.message : "Không đổi được mật khẩu. Vui lòng kiểm tra lại."
      );
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <>
      <TopBar title="Hồ sơ Bác sĩ" />
      <main className="p-4 sm:p-6 md:p-8 w-full max-w-6xl mx-auto flex-1 selection:bg-primary/15">
        {/* Global Error Banner */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 flex items-start justify-between gap-3 shadow-sm"
          >
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-rose-600 text-[22px] mt-0.5">error</span>
              <div>
                <p className="font-semibold">Đã xảy ra lỗi</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="shrink-0 text-xs font-semibold text-rose-800 hover:text-rose-950 px-3 py-1.5 rounded-lg border border-rose-200 bg-white cursor-pointer transition-colors"
            >
              Tải lại
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="h-64 rounded-3xl border border-outline-variant bg-white animate-pulse" />
            <div className="h-96 rounded-3xl border border-outline-variant bg-white animate-pulse" />
          </div>
        ) : profileData ? (
          <div className="space-y-6">
            {/* HERO PROFILE CARD */}
            <section className="bg-white border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-[0_12px_36px_rgba(25,28,28,0.06)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 via-emerald-50/40 to-transparent rounded-bl-full pointer-events-none -z-0" />

              <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
                {/* Avatar with Camera Trigger */}
                <div className="relative shrink-0">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl ring-4 ring-primary/25 p-1 bg-white shadow-md overflow-hidden flex items-center justify-center">
                    <div
                      translate="no"
                      className="absolute inset-1 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 text-primary flex items-center justify-center text-3xl font-bold"
                    >
                      {initials}
                    </div>
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={`Ảnh đại diện ${displayName}`}
                        className="relative z-10 w-full h-full rounded-2xl object-cover"
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
                    className="absolute -bottom-2 -right-2 z-20 w-10 h-10 bg-primary text-on-primary rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer border-2 border-white disabled:opacity-60"
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

                {/* Doctor Identity & Quick Info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mb-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5 shadow-xs">
                      <span className="material-symbols-outlined text-[15px]">verified</span>
                      Bác sĩ xác thực
                    </span>
                    {title ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                        {title}
                      </span>
                    ) : null}
                    {licenseNumber ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface-variant text-on-surface-variant border border-outline-variant">
                        Số CCHN: {licenseNumber}
                      </span>
                    ) : null}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
                    {title ? `${title} ` : ""}
                    {displayName}
                  </h1>

                  <p className="mt-1 text-sm text-on-surface-variant flex items-center justify-center md:justify-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant/80">mail</span>
                    {profileData.email}
                    {phone ? (
                      <>
                        <span className="text-outline-variant">•</span>
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/80">call</span>
                        {phone}
                      </>
                    ) : null}
                  </p>

                  {workplace ? (
                    <p className="mt-2 text-xs text-on-surface-variant/90 flex items-center justify-center md:justify-start gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">apartment</span>
                      <span>{workplace}</span>
                    </p>
                  ) : null}

                  {/* Specialties Pills */}
                  {specialties.length > 0 ? (
                    <div className="mt-3.5 flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                      {specialties.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-0.5 text-[11px] font-medium rounded-lg bg-surface-variant/70 text-on-surface border border-outline-variant/60"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Right Side: Accepting Patients Toggle Card */}
                <div className="shrink-0 flex flex-col items-center md:items-end gap-3 bg-surface-variant/40 border border-outline-variant/70 p-4 rounded-2xl w-full md:w-auto">
                  <div className="text-center md:text-right">
                    <p className="text-xs font-semibold text-on-surface">Tiếp nhận bệnh nhân</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {acceptingPatients
                        ? "Đang sẵn sàng nhận ca mới"
                        : "Tạm dừng tiếp nhận ca mới"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleAccepting(!acceptingPatients)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                      acceptingPatients
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {acceptingPatients ? "check_circle" : "pause_circle"}
                    </span>
                    {acceptingPatients ? "Đang nhận bệnh" : "Tạm ngưng nhận"}
                  </button>
                </div>
              </div>

              {/* Avatar Notices */}
              {avatarError && (
                <p role="alert" className="mt-4 text-xs text-rose-700 font-medium text-center bg-rose-50 py-2 px-3 rounded-xl border border-rose-200">
                  {avatarError}
                </p>
              )}
              {avatarNotice && (
                <p role="status" className="mt-4 text-xs text-emerald-800 font-medium text-center bg-emerald-50 py-2 px-3 rounded-xl border border-emerald-200">
                  {avatarNotice}
                </p>
              )}
            </section>

            {/* TAB CONTROLS */}
            <div className="flex border-b border-outline-variant gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab("clinical")}
                className={`px-5 py-3 text-sm font-semibold rounded-t-2xl flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeTab === "clinical"
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">badge</span>
                Thông tin chuyên môn
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("stats")}
                className={`px-5 py-3 text-sm font-semibold rounded-t-2xl flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeTab === "stats"
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">query_stats</span>
                Tổng quan hoạt động
                <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                  KPI
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={`px-5 py-3 text-sm font-semibold rounded-t-2xl flex items-center gap-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  activeTab === "security"
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                Bảo mật & Cài đặt
              </button>
            </div>

            {/* TAB NOTICES */}
            {profileNotice && (
              <div
                role="status"
                className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center gap-2 shadow-xs"
              >
                <span className="material-symbols-outlined text-emerald-700 text-[20px]">
                  check_circle
                </span>
                <span>{profileNotice}</span>
              </div>
            )}
            {profileError && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 flex items-center gap-2 shadow-xs"
              >
                <span className="material-symbols-outlined text-rose-600 text-[20px]">error</span>
                <span>{profileError}</span>
              </div>
            )}

            {/* TAB 1: CLINICAL CREDENTIALS & PROFILE */}
            {activeTab === "clinical" && (
              <form
                onSubmit={(e) => void handleSaveClinicalProfile(e)}
                className="bg-white border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-[0_8px_28px_rgba(25,28,28,0.04)] space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">clinical_notes</span>
                    Hồ sơ định danh & Chứng chỉ hành nghề
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Thông tin hiển thị với bệnh nhân khi họ hỏi bác sĩ dặn gì và xuất hiện trên phác đồ dinh dưỡng được duyệt.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                  {/* Danh xưng / Học vị */}
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="doctor-title"
                      className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
                    >
                      Danh xưng / Học vị
                    </label>
                    <div className="relative">
                      <select
                        id="doctor-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 cursor-pointer appearance-none pr-10"
                      >
                        {PRESET_TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">
                        arrow_drop_down
                      </span>
                    </div>
                  </div>

                  {/* Tên hiển thị */}
                  <div className="sm:col-span-8">
                    <label
                      htmlFor="doctor-full-name"
                      className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
                    >
                      Họ và tên đầy đủ
                    </label>
                    <input
                      id="doctor-full-name"
                      type="text"
                      maxLength={255}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Văn Bình"
                      className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    />
                  </div>

                  {/* Số CCHN */}
                  <div className="sm:col-span-6">
                    <label
                      htmlFor="doctor-license"
                      className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
                    >
                      Số Chứng chỉ hành nghề (CCHN)
                    </label>
                    <input
                      id="doctor-license"
                      type="text"
                      maxLength={50}
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="Ví dụ: 012345/BYT-CCHN"
                      className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    />
                  </div>

                  {/* Số năm kinh nghiệm */}
                  <div className="sm:col-span-6">
                    <label
                      htmlFor="doctor-exp"
                      className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
                    >
                      Số năm kinh nghiệm lâm sàng
                    </label>
                    <input
                      id="doctor-exp"
                      type="number"
                      min={0}
                      max={70}
                      value={yearsOfExp}
                      onChange={(e) =>
                        setYearsOfExp(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="Ví dụ: 10"
                      className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    />
                  </div>

                  {/* Nơi công tác */}
                  <div className="sm:col-span-8">
                    <label
                      htmlFor="doctor-workplace"
                      className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
                    >
                      Cơ quan / Bệnh viện / Khoa phòng công tác
                    </label>
                    <input
                      id="doctor-workplace"
                      type="text"
                      maxLength={255}
                      value={workplace}
                      onChange={(e) => setWorkplace(e.target.value)}
                      placeholder="Ví dụ: Khoa Dinh dưỡng & Tiết chế — Bệnh viện Vinmec"
                      className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    />
                  </div>

                  {/* Số điện thoại */}
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="doctor-phone"
                      className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
                    >
                      Số điện thoại liên hệ chuyên môn
                    </label>
                    <input
                      id="doctor-phone"
                      type="text"
                      maxLength={32}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912345678"
                      className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    />
                  </div>
                </div>

                {/* Chuyên khoa */}
                <div className="pt-2">
                  <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">
                    Chuyên khoa điều trị & Hướng nghiên cứu
                  </label>
                  
                  {/* Current tags */}
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[36px] p-2 bg-surface-variant/30 rounded-xl border border-outline-variant/60">
                    {specialties.length === 0 ? (
                      <span className="text-xs text-on-surface-variant/60 italic p-1">
                        Chưa chọn chuyên khoa. Hãy chọn gợi ý bên dưới hoặc tự nhập.
                      </span>
                    ) : (
                      specialties.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                        >
                          {s}
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecialty(s)}
                            className="text-primary hover:text-rose-700 cursor-pointer"
                            aria-label={`Xóa chuyên khoa ${s}`}
                          >
                            <span className="material-symbols-outlined text-[15px]">close</span>
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add specialty input & presets */}
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      maxLength={100}
                      value={newSpecialtyInput}
                      onChange={(e) => setNewSpecialtyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSpecialty(newSpecialtyInput);
                        }
                      }}
                      placeholder="Nhập thêm chuyên khoa khác rồi bấm Thêm..."
                      className="flex-1 px-3.5 py-2 bg-white border border-outline-variant rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSpecialty(newSpecialtyInput)}
                      className="px-4 py-2 bg-surface-variant text-on-surface text-xs font-semibold rounded-xl hover:bg-surface-variant/80 cursor-pointer border border-outline-variant transition-colors"
                    >
                      Thêm
                    </button>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[11px] text-on-surface-variant font-medium mr-1">
                      Gợi ý:
                    </span>
                    {PRESET_SPECIALTIES.map((p) => {
                      const isAdded = specialties.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={isAdded}
                          onClick={() => handleAddSpecialty(p)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isAdded
                              ? "bg-slate-100 border-slate-200 text-slate-400"
                              : "bg-white border-outline-variant hover:border-primary/50 text-on-surface-variant hover:text-primary"
                          }`}
                        >
                          + {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tiểu sử chuyên môn (Bio) */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-1.5">
                    <label
                      htmlFor="doctor-bio"
                      className="text-xs font-semibold text-on-surface-variant block"
                    >
                      Tiểu sử & Tóm tắt chuyên môn (Bio)
                    </label>
                    <span className="text-[11px] text-on-surface-variant">
                      {bio.length}/2000 ký tự
                    </span>
                  </div>
                  <textarea
                    id="doctor-bio"
                    rows={4}
                    maxLength={2000}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Mô tả quá trình đào tạo, hướng nghiên cứu lâm sàng và phương châm điều trị..."
                    className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 leading-relaxed resize-y"
                  />
                </div>

                {/* Submit button */}
                <div className="flex justify-end pt-3 border-t border-outline-variant/60">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 bg-primary text-on-primary font-semibold text-sm py-2.5 px-6 rounded-xl hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 shadow-[0_4px_14px_rgba(0,108,73,0.22)]"
                  >
                    {savingProfile ? (
                      <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">
                          progress_activity
                        </span>
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        Lưu thông tin chuyên môn
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: CLINICAL PRACTICE & KPI STATS */}
            {activeTab === "stats" && (
              <div className="space-y-6">
                {/* 4 KPI CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Patients */}
                  <div className="bg-white border border-outline-variant rounded-3xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-on-surface-variant">Bệnh nhân phụ trách</span>
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">groups</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-on-surface tracking-tight">
                        {profileData.stats.total_patients}
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Phân công 1–1 trong danh sách theo dõi
                      </p>
                    </div>
                  </div>

                  {/* Approved Plans */}
                  <div className="bg-white border border-outline-variant rounded-3xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-on-surface-variant">Thực đơn đã duyệt</span>
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">task_alt</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-on-surface tracking-tight">
                        {profileData.stats.approved_plans}
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Thực đơn dinh dưỡng HITL đã thẩm định
                      </p>
                    </div>
                  </div>

                  {/* Confirmed Constraints */}
                  <div className="bg-white border border-outline-variant rounded-3xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-on-surface-variant">Ràng buộc lâm sàng</span>
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-on-surface tracking-tight">
                        {profileData.stats.confirmed_constraints}
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Hồ sơ calo/muối/đường đã xác nhận an toàn
                      </p>
                    </div>
                  </div>

                  {/* Average Compliance */}
                  <div className="bg-white border border-outline-variant rounded-3xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-on-surface-variant">Tuân thủ trung bình</span>
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">monitoring</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-on-surface tracking-tight">
                        {profileData.stats.average_compliance !== null &&
                        profileData.stats.average_compliance !== undefined
                          ? `${profileData.stats.average_compliance}%`
                          : "—"}
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Tổng hợp check-in tuân thủ 14 ngày gần nhất
                      </p>
                    </div>
                  </div>
                </div>

                {/* PRACTICE QUICK ACTIONS */}
                <div className="bg-white border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-sm">
                  <h3 className="text-base font-bold text-on-surface mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">handshake</span>
                    Điều hướng & Tiếp nhận chuyên môn
                  </h3>
                  <p className="text-xs text-on-surface-variant mb-6">
                    Lối tắt nhanh đến các phân vùng làm việc điều trị dinh dưỡng của bạn.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Link
                      href="/doctor/inbox"
                      className="p-4 rounded-2xl border border-outline-variant hover:border-primary/50 bg-surface-variant/20 hover:bg-primary/5 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[20px]">inbox</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface group-hover:text-primary">Hàng việc cần duyệt</p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">Xử lý thực đơn & yêu cầu mới</p>
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/doctor/patients"
                      className="p-4 rounded-2xl border border-outline-variant hover:border-primary/50 bg-surface-variant/20 hover:bg-primary/5 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[20px]">person_search</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface group-hover:text-primary">Danh sách bệnh nhân</p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">Xem chỉ số & phác đồ điều trị</p>
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/doctor/inbox"
                      className="p-4 rounded-2xl border border-outline-variant hover:border-primary/50 bg-surface-variant/20 hover:bg-primary/5 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <span className="material-symbols-outlined text-[20px]">person_add</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface group-hover:text-primary">Hàng chờ nhận bệnh</p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">Tiếp nhận ca đăng ký tự do</p>
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SECURITY & SETTINGS */}
            {activeTab === "security" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* PASSWORD CHANGE FORM */}
                <section className="lg:col-span-7 bg-white border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-[0_8px_28px_rgba(25,28,28,0.04)]">
                  <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">password</span>
                    Đổi mật khẩu tài khoản
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-1 mb-5">
                    Mật khẩu bảo mật phải có tối thiểu 8 ký tự để bảo vệ dữ liệu hồ sơ lâm sàng.
                  </p>

                  {passwordSuccess ? (
                    <div
                      role="status"
                      className="mb-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center gap-2"
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
                      className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 flex items-center gap-2"
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
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={submittingPassword}
                        className="inline-flex items-center gap-2 bg-primary text-on-primary font-semibold text-sm py-2.5 px-6 rounded-xl hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 shadow-[0_4px_14px_rgba(0,108,73,0.22)]"
                      >
                        {submittingPassword ? (
                          <>
                            <span className="material-symbols-outlined text-[18px] animate-spin">
                              progress_activity
                            </span>
                            Đang xử lý...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">key</span>
                            Cập nhật mật khẩu
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </section>

                {/* PRACTICE SCHEDULE & CONTACT SETTINGS */}
                <section className="lg:col-span-5 bg-white border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-[0_8px_28px_rgba(25,28,28,0.04)] space-y-4">
                  <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
                    Cài đặt ca trực & Liên hệ
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Cấu hình khung giờ tư vấn và kênh tiếp nhận trường hợp cảnh báo khẩn cấp.
                  </p>

                  <div className="space-y-4 pt-2">
                    <div>
                      <label
                        htmlFor="doctor-hours"
                        className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
                      >
                        Khung giờ làm việc / Trực tư vấn
                      </label>
                      <input
                        id="doctor-hours"
                        type="text"
                        maxLength={255}
                        value={consultationHours}
                        onChange={(e) => setConsultationHours(e.target.value)}
                        placeholder="08:00 - 17:00 (Thứ 2 - Thứ 6)"
                        className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="doctor-emergency"
                        className="text-xs font-semibold text-on-surface-variant mb-1.5 block"
                      >
                        Kênh hỗ trợ / Liên hệ khẩn cấp
                      </label>
                      <input
                        id="doctor-emergency"
                        type="text"
                        maxLength={255}
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        placeholder="Hotline Khoa Cấp cứu / Trực ban"
                        className="w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={(e) => void handleSaveClinicalProfile(e)}
                        disabled={savingProfile}
                        className="w-full py-2.5 px-4 bg-surface-variant hover:bg-surface-variant/80 text-on-surface text-xs font-semibold rounded-xl border border-outline-variant transition-colors cursor-pointer"
                      >
                        {savingProfile ? "Đang lưu..." : "Lưu cài đặt ca trực"}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </>
  );
}
