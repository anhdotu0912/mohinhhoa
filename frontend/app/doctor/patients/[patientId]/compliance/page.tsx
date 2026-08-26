"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { asRouteId } from "@/lib/route-params";
import { ApiError, type PatientComplianceOut } from "@/lib/types";

const COMPLIANCE_DAYS = 14;
const DEFAULT_REMIND =
  "Bác sĩ nhắc bạn ghi nhận tuân thủ thực đơn hôm nay nhé.";

function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
}

function formatShortDate(iso: string): string {
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PatientComplianceTabPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = asRouteId(params?.patientId);
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PatientComplianceOut | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [remindMessage, setRemindMessage] = useState(DEFAULT_REMIND);
  const [remindSending, setRemindSending] = useState(false);
  const [remindFeedback, setRemindFeedback] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  const load = useCallback(async () => {
    if (!token || role !== "doctor" || !patientId) return;
    setLoading(true);
    setError(null);
    try {
      const row = await api.getPatientCompliance(patientId, COMPLIANCE_DAYS);
      setData(row);
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "Không tải được dữ liệu tuân thủ.");
    } finally {
      setLoading(false);
    }
  }, [token, role, patientId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "doctor") {
      router.replace("/login");
      return;
    }
    void load();
  }, [hydrated, token, role, router, load]);

  const handleRemind = async () => {
    if (!patientId) return;
    setRemindSending(true);
    setRemindFeedback(null);
    try {
      await api.remindPatientCompliance(patientId, remindMessage.trim());
      const row = await api.getPatientCompliance(patientId, COMPLIANCE_DAYS);
      setData(row);
      setRemindFeedback("Đã gửi nhắc nhở. Bệnh nhân sẽ thấy trong mục Thông báo.");
    } catch (err) {
      setRemindFeedback(
        err instanceof ApiError ? err.message : "Không gửi được nhắc nhở."
      );
    } finally {
      setRemindSending(false);
    }
  };

  if (!hydrated || !token || role !== "doctor") return null;

  if (loading) {
    return (
      <main className="p-6 md:p-8 text-sm text-on-surface-variant max-w-5xl mx-auto">
        Đang tải tuân thủ…
      </main>
    );
  }

  const series = data?.daily_series ?? [];
  const hasChart = series.some((d) => d.adherence_pct != null);
  const rate = data?.overall_adherence_pct ?? null;

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="font-h1 text-xl font-bold text-on-surface">Tuân thủ dinh dưỡng</h2>
        <p className="text-xs text-on-surface-variant mt-1">
          Check-in, food log và cảnh báo 14 ngày gần nhất
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-bold text-primary">
            Thử lại
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl text-center">
          <p className="text-xs text-on-surface-variant">Tỷ lệ 14 ngày</p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">
            {rate != null ? `${rate}%` : "—"}
          </p>
        </div>
        <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl text-center">
          <p className="text-xs text-on-surface-variant">Check-in đúng kế hoạch</p>
          <p className="text-2xl font-bold text-on-surface mt-1 tabular-nums">
            {data?.checkins_as_planned ?? 0} / {data?.checkins_done ?? 0}
          </p>
        </div>
        <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl text-center">
          <p className="text-xs text-on-surface-variant">Đánh giá</p>
          <p className="text-sm font-bold mt-2">
            {rate == null
              ? "Chưa có dữ liệu"
              : rate >= 85
                ? "Tuân thủ tốt"
                : rate < (data?.low_threshold_pct ?? 50)
                  ? "Cần can thiệp"
                  : "Cần lưu ý"}
          </p>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-on-surface mb-4">Biểu đồ 14 ngày</h3>
        {!hasChart ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[36px] text-outline/40 mb-1">
              bar_chart
            </span>
            <p className="text-sm font-bold">Chưa có dữ liệu tuân thủ</p>
            <p className="text-xs mt-1 text-center max-w-sm">
              Bệnh nhân chưa ghi nhận bữa ăn hoặc check-in trong 14 ngày qua.
            </p>
          </div>
        ) : (
          <div className="flex items-end justify-between gap-1 min-h-[180px] pt-6">
            {series.map((item, idx) => {
              const hasVal = item.adherence_pct != null;
              const value = item.adherence_pct ?? 0;
              const high = hasVal && value >= 80;
              const mid = hasVal && value >= 60 && value < 80;
              const bar = high ? "bg-primary" : mid ? "bg-amber-500" : "bg-rose-500";
              const isToday = idx === series.length - 1;
              return (
                <div
                  key={item.date}
                  className="flex-1 flex flex-col items-center"
                  onMouseEnter={() => setHovered(item.date)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="text-[10px] font-bold tabular-nums mb-1">
                    {hasVal ? `${value}%` : "—"}
                  </span>
                  <div className="w-full h-[120px] flex items-end justify-center">
                    {hasVal ? (
                      <div
                        className={`w-full max-w-[22px] rounded-t-lg ${bar} ${
                          hovered === item.date ? "ring-2 ring-primary/40" : ""
                        }`}
                        style={{ height: `${Math.max(value, 6)}%` }}
                      />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-outline-variant/60 mb-2" />
                    )}
                  </div>
                  <span
                    className={`mt-1 text-[10px] font-semibold ${
                      isToday ? "text-primary" : "text-on-surface-variant"
                    }`}
                  >
                    {weekdayShort(item.date)}
                  </span>
                  <span className="text-[9px] tabular-nums text-outline">
                    {formatShortDate(item.date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-on-surface mb-3">Nhật ký sự kiện</h3>
        {!data?.events?.length ? (
          <p className="text-xs text-on-surface-variant">
            Chưa có sự kiện tuân thủ trong 14 ngày qua.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.events.slice(0, 8).map((ev, idx) => (
              <li
                key={`${ev.at}-${idx}`}
                className="p-3 bg-surface-container-low/40 border border-outline-variant/40 rounded-xl text-xs"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-bold text-on-surface">{ev.title}</p>
                  <span className="text-[11px] text-on-surface-variant shrink-0">
                    {formatEventTime(ev.at)}
                  </span>
                </div>
                <p className="text-on-surface-variant mt-0.5">{ev.severity}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-surface-container-low/40 border border-outline-variant/60 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-on-surface">Gửi nhắc nhở tuân thủ</h3>
        <textarea
          value={remindMessage}
          onChange={(e) => setRemindMessage(e.target.value)}
          rows={3}
          className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-xs focus:outline-none focus:border-primary"
        />
        {remindFeedback && (
          <p className="text-xs font-medium text-on-surface">{remindFeedback}</p>
        )}
        <button
          type="button"
          disabled={remindSending}
          onClick={() => void handleRemind()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[16px]">send</span>
          {remindSending ? "Đang gửi…" : "Gửi nhắc nhở"}
        </button>
      </div>
    </main>
  );
}
