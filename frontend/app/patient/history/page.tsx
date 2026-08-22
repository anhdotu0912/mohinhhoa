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

function formatTableTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${time} - ${date}`;
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

  // Flatten history points into individual metric events to match mockup table
  const flatTableRows = useMemo(() => {
    const rows: { id: string; time: string; metric: string; value: string; note: string; timestamp: number }[] = [];
    
    history.forEach((point) => {
      const t = new Date(point.recorded_at).getTime();
      const timeStr = formatTableTime(point.recorded_at);
      
      if (point.blood_glucose) {
        rows.push({
          id: `${point.id}-glucose`,
          time: timeStr,
          metric: "Đường huyết",
          value: point.blood_glucose,
          note: "Trước bữa ăn",
          timestamp: t,
        });
      }
      if (point.blood_pressure) {
        rows.push({
          id: `${point.id}-bp`,
          time: timeStr,
          metric: "Huyết áp",
          value: point.blood_pressure,
          note: "Ghi nhận hàng ngày",
          timestamp: t,
        });
      }
      if (point.weight) {
        rows.push({
          id: `${point.id}-weight`,
          time: timeStr,
          metric: "Cân nặng",
          value: `${point.weight} kg`,
          note: "Ghi nhận hàng ngày",
          timestamp: t,
        });
      }
    });
    
    return rows.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [history]);

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
        
        // Group meals by period (Sáng, Trưa, Tối) based on time
        const mealsByPeriod = logs.map(l => {
          const hour = new Date(l.logged_at).getHours();
          let period = "Sáng";
          if (hour >= 11 && hour <= 14) period = "Trưa";
          else if (hour >= 17) period = "Tối";
          
          return {
            period,
            date: new Date(l.logged_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
            name: l.note || (l.slot === "morning" ? "Bữa sáng" : l.slot === "noon" ? "Bữa trưa" : "Bữa tối") + (l.type === "custom" ? " tự do" : ""),
            calories: "500 kcal", // Mock calories for now
            status: l.type === "as_planned" ? "completed" : "custom"
          };
        });
        
        return {
          date: formatDayKey(logs[0].logged_at),
          meals: mealsByPeriod,
        };
      });
  }, [foodLogs]);

  const handleRecordMetrics = async () => {
    const payload: any = {};
    if (weightInput.trim()) payload.weight = parseFloat(weightInput);
    if (bpInput.trim()) payload.blood_pressure = bpInput.trim();
    if (glucoseInput.trim()) payload.blood_glucose = glucoseInput.trim();
    
    if (!payload.weight && !payload.blood_pressure && !payload.blood_glucose) {
      setError("Nhập ít nhất một chỉ số.");
      return;
    }

    setSaving(true);
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

  return (
    <>
      <TopBar title="Cập nhật chỉ số sức khỏe" />
      <main className="flex-1 overflow-y-auto p-md md:p-xl w-full flex justify-center pb-24">
        <div className="w-full max-w-[1000px] flex flex-col gap-6">
          {error && (
            <div className="bg-error-container/20 border border-error text-error p-card-padding rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 pb-2 border-b border-gray-100">
            <div>
              <h1 className="text-[32px] font-extrabold text-gray-900 mb-2 tracking-tight">
                Tiến độ & Lịch sử
              </h1>
              <p className="text-[16px] text-gray-500 font-medium">
                Theo dõi sát sao sức khỏe và thực đơn của bạn qua từng ngày.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#006857] text-white rounded-[14px] text-[15px] font-bold hover:bg-[#005749] transition-transform active:scale-95 cursor-pointer shadow-[0_4px_12px_rgba(0,104,87,0.25)]"
            >
              <span className="material-symbols-outlined text-[20px] leading-none">add_circle</span>
              Ghi nhận chỉ số mới
            </button>
          </div>

          {/* Form Recording */}
          {showForm && (
            <section className="bg-white rounded-2xl border border-[#006857]/30 shadow-sm p-6 flex flex-col gap-5">
              <h2 className="font-bold text-lg text-on-surface">
                Ghi nhận chỉ số hôm nay
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">
                    Cân nặng (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-outline-variant bg-[#F4F9F7] focus:border-[#006857] focus:ring-1 focus:ring-[#006857] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">
                    Huyết áp
                  </label>
                  <input
                    type="text"
                    value={bpInput}
                    onChange={(e) => setBpInput(e.target.value)}
                    placeholder="130/80 mmHg"
                    className="w-full h-11 px-4 rounded-xl border border-outline-variant bg-[#F4F9F7] focus:border-[#006857] focus:ring-1 focus:ring-[#006857] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">
                    Đường huyết
                  </label>
                  <input
                    type="text"
                    value={glucoseInput}
                    onChange={(e) => setGlucoseInput(e.target.value)}
                    placeholder="135 mg/dL"
                    className="w-full h-11 px-4 rounded-xl border border-outline-variant bg-[#F4F9F7] focus:border-[#006857] focus:ring-1 focus:ring-[#006857] outline-none transition-all"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 border border-outline-variant rounded-xl text-[15px] font-medium hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleRecordMetrics()}
                  className="px-6 py-2.5 bg-[#006857] text-white rounded-xl text-[15px] font-bold disabled:opacity-60 transition-colors shadow-sm"
                >
                  {saving ? "Đang lưu..." : "Lưu chỉ số"}
                </button>
              </div>
            </section>
          )}

          {/* Table Section */}
          <section className="flex flex-col gap-4 mt-2">
            <h2 className="font-bold text-[20px] text-gray-900 tracking-tight">
              Ghi nhận gần đây
            </h2>
            <div className="bg-white rounded-[24px] border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative overflow-hidden">
              
              {loading ? (
                <div className="p-8 text-center text-gray-400 font-medium">Đang tải dữ liệu...</div>
              ) : flatTableRows.length === 0 ? (
                <div className="p-12 text-center text-gray-400 font-medium flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                    <span className="material-symbols-outlined text-[32px]">assignment</span>
                  </div>
                  Chưa có dữ liệu. Bấm «Ghi nhận chỉ số mới» để bắt đầu.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[15px]">
                    <thead>
                      <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                        <th className="text-left font-semibold text-gray-500 px-6 py-4 text-[13px] uppercase tracking-wider">Thời gian</th>
                        <th className="text-left font-semibold text-gray-500 px-6 py-4 text-[13px] uppercase tracking-wider">Chỉ số</th>
                        <th className="text-left font-semibold text-gray-500 px-6 py-4 text-[13px] uppercase tracking-wider">Giá trị</th>
                        <th className="text-left font-semibold text-gray-500 px-6 py-4 text-[13px] uppercase tracking-wider">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flatTableRows.map((row, idx) => (
                        <tr
                          key={row.id}
                          className="border-b border-gray-50 last:border-b-0 hover:bg-[#F4F9F7]/40 transition-colors group"
                        >
                          <td className="px-6 py-4 text-gray-500 font-medium whitespace-nowrap text-[14px]">
                            {row.time}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${row.metric === 'Đường huyết' ? 'bg-[#8B7355]' : row.metric === 'Huyết áp' ? 'bg-[#4A90D9]' : 'bg-[#2F8F7A]'}`}></span>
                              <span className="font-semibold text-gray-900">{row.metric}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-[#006857] bg-[#E4F2EE] px-3 py-1.5 rounded-lg text-[14px]">
                              {row.value}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400 italic text-[14px]">
                            {row.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Charts Section */}
          <section className="flex flex-col gap-4 mt-6">
            <MetricsProgressChart history={history} loading={loading} />
          </section>

          {/* Past Meals Section */}
          <section className="flex flex-col gap-4 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[20px] text-gray-900 tracking-tight">
                Thực đơn đã dùng
              </h2>
            </div>
            
            <div className="bg-white rounded-[24px] border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 md:p-8 flex flex-col md:flex-row gap-10">
              
              {/* Refined Calendar (Left) */}
              <div className="w-full md:w-[280px] shrink-0 bg-[#F4F9F7]/50 rounded-[20px] p-6 border border-[#006857]/10">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-extrabold text-gray-900 text-[16px] tracking-wide">Tháng 5, 2024</span>
                  <div className="flex gap-1">
                    <button className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-gray-400 hover:text-[#006857] shadow-sm transition-colors"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                    <button className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-gray-400 hover:text-[#006857] shadow-sm transition-colors"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center text-[13px] font-semibold">
                  <div className="text-gray-400 pb-2">Su</div>
                  <div className="text-gray-400 pb-2">Mo</div>
                  <div className="text-gray-400 pb-2">Tu</div>
                  <div className="text-gray-400 pb-2">We</div>
                  <div className="text-gray-400 pb-2">Th</div>
                  <div className="text-gray-400 pb-2">Fr</div>
                  <div className="text-gray-400 pb-2">Sa</div>
                  
                  {/* Empty cells */}
                  <div></div><div></div><div></div>
                  
                  {/* Days */}
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">1</div>
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">2</div>
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">3</div>
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">4</div>
                  
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl bg-[#006857] text-white font-extrabold shadow-[0_4px_10px_rgba(0,104,87,0.3)] cursor-pointer relative z-10 scale-110">
                    15
                  </div>
                  
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">16</div>
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">17</div>
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">18</div>
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">19</div>
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">20</div>
                  <div className="h-9 w-9 mx-auto flex items-center justify-center rounded-xl hover:bg-[#E4F2EE] text-gray-700 font-bold transition-colors cursor-pointer">21</div>
                </div>
              </div>

              {/* Meals List (Right) */}
              <div className="flex-1 flex flex-col pt-2 relative">
                {/* Timeline vertical line */}
                <div className="absolute left-[39px] top-4 bottom-4 w-[2px] bg-gray-100 hidden md:block"></div>
                
                {pastMeals.length === 0 && !loading && (
                  <div className="h-full flex items-center justify-center text-gray-400 font-medium">
                    Chưa có ghi nhận bữa ăn nào cho ngày này.
                  </div>
                )}
                
                {pastMeals.length > 0 && pastMeals[0].meals.map((meal, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center py-5 border-b border-gray-50 last:border-0 relative pl-0 md:pl-20 group hover:bg-gray-50/50 rounded-2xl transition-colors">
                    
                    {/* Timeline dot */}
                    <div className="absolute left-[34px] w-3 h-3 rounded-full bg-[#006857] shadow-[0_0_0_4px_white] hidden md:block group-hover:scale-125 transition-transform"></div>
                    
                    <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full pr-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-extrabold text-[16px] text-gray-900">{meal.period}</span>
                          <span className="text-gray-400 text-[13px] font-medium">{meal.date}</span>
                        </div>
                        <span className="text-[15px] text-gray-600 font-medium">{meal.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-gray-400 font-medium mb-0.5">Lượng Calo</span>
                          <span className="font-bold text-[16px] text-gray-900">{meal.calories}</span>
                        </div>
                        <div className="px-4 py-2 bg-[#F4F9F7] text-[#006857] rounded-xl font-bold flex items-center gap-1.5 text-[13px] whitespace-nowrap group-hover:bg-[#E4F2EE] transition-colors">
                          <span className="material-symbols-outlined text-[16px]">verified</span>
                          Đã ghi
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
