"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MetricsProgressChart } from "@/components/patient/MetricsProgressChart";
import { TopBar } from "@/components/shared/TopBar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError, type FoodLogEntry, type MetricsHistoryPoint } from "@/lib/types";

function formatDayKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function formatTableDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PatientHistoryPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState<MetricsHistoryPoint[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [bpInput, setBpInput] = useState("");
  const [glucoseInput, setGlucoseInput] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metrics, logs] = await Promise.all([
        api.getMetricsHistory(90),
        api.listFoodLogs(),
      ]);
      setHistory(metrics);
      setFoodLogs(logs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tải được dữ liệu lịch sử.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (role === "doctor") {
      router.replace("/doctor");
    }
  }, [hydrated, token, role, router]);

  useEffect(() => {
    if (!hydrated || !token || role === "doctor") return;
    void loadData();
  }, [hydrated, token, role, loadData]);

  const recentTableRows = useMemo(
    () =>
      [...history]
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
        .slice(0, 10),
    [history]
  );

  const pastMeals = useMemo(() => {
    const byDay = new Map<string, FoodLogEntry[]>();
    for (const log of foodLogs) {
      const key = new Date(log.logged_at).toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(log);
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 7)
      .map(([dayKey, logs]) => {
        const asPlanned = logs.filter((l) => l.type === "as_planned").length;
        const custom = logs.length - asPlanned;
        return {
          date: formatDayKey(logs[0].logged_at),
          detail: `${logs.length} bữa (${asPlanned} theo kế hoạch${custom ? `, ${custom} khác` : ""})`,
          status: custom === 0 ? "completed" : "failed",
          statusText: custom === 0 ? "Hoàn thành" : "Có bữa khác",
        };
      });
  }, [foodLogs]);

  const handleRecordMetrics = async () => {
    const payload: {
      weight?: number;
      blood_pressure?: string;
      blood_glucose?: string;
    } = {};
    if (weightInput.trim()) {
      const w = parseFloat(weightInput);
      if (!Number.isFinite(w) || w <= 0) {
        setError("Cân nặng phải là số lớn hơn 0.");
        return;
      }
      payload.weight = w;
    }
    if (bpInput.trim()) payload.blood_pressure = bpInput.trim();
    if (glucoseInput.trim()) payload.blood_glucose = glucoseInput.trim();
    if (!payload.weight && !payload.blood_pressure && !payload.blood_glucose) {
      setError("Nhập ít nhất một chỉ số.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.recordMetrics(payload);
      setWeightInput("");
      setBpInput("");
      setGlucoseInput("");
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không lưu được chỉ số.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMetrics = async (id: string) => {
    if (!window.confirm("Xóa bản ghi chỉ số này?")) return;
    setDeletingId(id);
    setError(null);
    try {
      await api.deleteMetrics(id);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không xóa được bản ghi.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <TopBar title="Cập nhật chỉ số sức khỏe" />
      <main className="flex-1 overflow-y-auto p-md md:p-xl w-full flex justify-center">
        <div className="w-full max-w-[900px] flex flex-col gap-section-gap">
          {error && (
            <div className="bg-error-container/20 border border-error text-error p-card-padding rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md">
            <div>
              <h1 className="font-h2 text-h2 text-on-surface font-semibold text-xl md:text-2xl">
                Theo dõi tiến trình
              </h1>
              <p className="text-sm text-on-surface-variant mt-1">
                Xem lại lịch sử và biểu đồ các chỉ số sức khỏe của bạn.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center justify-center gap-1 shrink-0 px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Ghi nhận chỉ số mới
            </button>
          </div>

          {showForm && (
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-subtle p-card-padding flex flex-col gap-md">
              <h2 className="font-h2 text-h2 text-on-surface font-semibold text-lg">
                Ghi nhận chỉ số hôm nay
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Cân nặng (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full h-10 px-md rounded-lg border border-outline-variant bg-surface-container-lowest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Huyết áp
                  </label>
                  <input
                    type="text"
                    value={bpInput}
                    onChange={(e) => setBpInput(e.target.value)}
                    placeholder="130/80 mmHg"
                    className="w-full h-10 px-md rounded-lg border border-outline-variant bg-surface-container-lowest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Đường huyết
                  </label>
                  <input
                    type="text"
                    value={glucoseInput}
                    onChange={(e) => setGlucoseInput(e.target.value)}
                    placeholder="135 mg/dL"
                    className="w-full h-10 px-md rounded-lg border border-outline-variant bg-surface-container-lowest"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-sm">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-md py-2 border border-outline-variant rounded-lg text-sm"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleRecordMetrics()}
                  className="px-md py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu chỉ số"}
                </button>
              </div>
            </section>
          )}

          {/* Recent entries table */}
          <section className="flex flex-col gap-3">
            <h2 className="font-h2 text-h2 text-on-surface font-semibold text-lg">
              Lịch sử ghi nhận gần đây
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-subtle overflow-hidden">
              {loading ? (
                <p className="text-sm text-on-surface-variant p-card-padding">Đang tải...</p>
              ) : recentTableRows.length === 0 ? (
                <p className="text-sm text-on-surface-variant p-card-padding">
                  Chưa có ghi nhận chỉ số. Bấm «Ghi nhận chỉ số mới» để bắt đầu.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant">
                        <th className="text-left font-semibold text-on-surface px-4 py-3">Ngày</th>
                        <th className="text-left font-semibold text-on-surface px-4 py-3">
                          Cân nặng
                        </th>
                        <th className="text-left font-semibold text-on-surface px-4 py-3">
                          Huyết áp
                        </th>
                        <th className="text-left font-semibold text-on-surface px-4 py-3">
                          Đường huyết
                        </th>
                        <th className="text-left font-semibold text-on-surface px-4 py-3 w-16">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTableRows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-outline-variant/50 last:border-b-0"
                        >
                          <td className="px-4 py-3 text-on-surface">
                            {formatTableDate(row.recorded_at)}
                          </td>
                          <td className="px-4 py-3 text-on-surface">
                            {row.weight != null ? `${row.weight} kg` : "—"}
                          </td>
                          <td className="px-4 py-3 text-on-surface">
                            {row.blood_pressure ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-on-surface">
                            {row.blood_glucose ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              title="Xóa bản ghi"
                              disabled={deletingId === row.id}
                              onClick={() => void handleDeleteMetrics(row.id)}
                              className="text-on-surface-variant hover:text-error transition-colors p-1 rounded hover:bg-error-container/10 disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <MetricsProgressChart history={history} loading={loading} />

          {/* Past Meals Section */}
          <section>
            <h3 className="font-h2 text-h2 text-on-surface mb-4 font-semibold text-lg">
              Thực đơn đã dùng
            </h3>
            <div className="flex flex-col gap-3">
              {pastMeals.length === 0 && !loading && (
                <p className="text-sm text-on-surface-variant">Chưa có ghi nhận bữa ăn.</p>
              )}
              {pastMeals.map((meal, index) => (
                <Link
                  key={index}
                  href="/patient/meals"
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl p-card-padding flex justify-between items-center hover:border-[#bdc9c4] transition-colors cursor-pointer group shadow-subtle"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-surface-container flex items-center justify-center rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined">event_note</span>
                    </div>
                    <div>
                      <div className="font-body-bold text-body-bold text-on-surface font-semibold">
                        {meal.date}
                      </div>
                      <div className="font-body text-body text-on-surface-variant text-sm">
                        {meal.detail}
                      </div>
                    </div>
                  </div>
                  {meal.status === "completed" ? (
                    <div className="px-3 py-1 bg-[#2F8F7A]/10 text-[#2F8F7A] rounded-full font-caption text-caption font-semibold flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      {meal.statusText}
                    </div>
                  ) : (
                    <div className="px-3 py-1 border border-outline-variant text-on-surface-variant rounded-full font-caption text-caption font-semibold flex items-center gap-1 bg-surface-container-low text-xs">
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      {meal.statusText}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
