"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore } from "../../../store/useProfileStore";

const DISEASES = [
  { id: "diabetes_t2", label: "Đái tháo đường type 2" },
  { id: "hypertension", label: "Tăng huyết áp" },
  { id: "gout", label: "Gout" },
  { id: "hyperlipidemia", label: "Rối loạn lipid" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { token, profile, hydrate, loadProfile, saveProfile, loading, error } = useProfileStore();
  const [disease, setDisease] = useState<string[]>(["diabetes_t2", "hypertension"]);
  const [medications, setMedications] = useState("metformin, amlodipine");
  const [allergies, setAllergies] = useState("hải sản");
  const [preferences, setPreferences] = useState("thích ăn cơm, không ăn thịt bò");
  const [age, setAge] = useState(55);
  const [sex, setSex] = useState("male");
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(75);
  const [carb, setCarb] = useState(45);
  const [sodium, setSodium] = useState(1500);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token) loadProfile();
  }, [token, loadProfile]);

  useEffect(() => {
    if (!profile) return;
    setDisease(profile.disease || []);
    setMedications((profile.medications || []).join(", "));
    setAllergies((profile.allergies || []).join(", "));
    setPreferences((profile.preferences || []).join(", "));
    if (profile.age) setAge(profile.age);
    if (profile.sex) setSex(profile.sex);
    if (profile.height_cm) setHeight(profile.height_cm);
    if (profile.weight_kg) setWeight(profile.weight_kg);
    if (profile.restrictions?.carb_per_meal) setCarb(Number(profile.restrictions.carb_per_meal));
    if (profile.restrictions?.sodium_daily) setSodium(Number(profile.restrictions.sodium_daily));
  }, [profile]);

  function toggleDisease(id: string) {
    setDisease((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setMsg("Hãy đăng nhập từ trang Home trước.");
      return;
    }
    await saveProfile({
      disease,
      medications: medications.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
      allergies: allergies.split(",").map((s) => s.trim()).filter(Boolean),
      preferences: preferences.split(",").map((s) => s.trim()).filter(Boolean),
      age,
      sex,
      height_cm: height,
      weight_kg: weight,
      restrictions: { carb_per_meal: carb, sodium_daily: sodium },
    });
    setMsg("Đã lưu hồ sơ.");
    router.push("/meal-plan");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Onboarding — Hồ sơ bệnh nhân</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
        <fieldset>
          <legend className="mb-2 font-medium">Bệnh lý</legend>
          <div className="flex flex-wrap gap-3">
            {DISEASES.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={disease.includes(d.id)}
                  onChange={() => toggleDisease(d.id)}
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          Thuốc đang dùng (phẩy tách)
          <input className="mt-1 w-full rounded border px-3 py-2" value={medications} onChange={(e) => setMedications(e.target.value)} />
        </label>
        <label className="block text-sm">
          Dị ứng
          <input className="mt-1 w-full rounded border px-3 py-2" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
        </label>
        <label className="block text-sm">
          Sở thích ăn uống
          <input className="mt-1 w-full rounded border px-3 py-2" value={preferences} onChange={(e) => setPreferences(e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="text-sm">Tuổi<input type="number" className="mt-1 w-full rounded border px-2 py-2" value={age} onChange={(e) => setAge(+e.target.value)} /></label>
          <label className="text-sm">Giới
            <select className="mt-1 w-full rounded border px-2 py-2" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </label>
          <label className="text-sm">Cao (cm)<input type="number" className="mt-1 w-full rounded border px-2 py-2" value={height} onChange={(e) => setHeight(+e.target.value)} /></label>
          <label className="text-sm">Nặng (kg)<input type="number" className="mt-1 w-full rounded border px-2 py-2" value={weight} onChange={(e) => setWeight(+e.target.value)} /></label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Carb/bữa (g)<input type="number" className="mt-1 w-full rounded border px-2 py-2" value={carb} onChange={(e) => setCarb(+e.target.value)} /></label>
          <label className="text-sm">Natri/ngày (mg)<input type="number" className="mt-1 w-full rounded border px-2 py-2" value={sodium} onChange={(e) => setSodium(+e.target.value)} /></label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-brand-700">{msg}</p>}

        <button disabled={loading} className="rounded bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50">
          Lưu & tạo thực đơn
        </button>
      </form>
    </div>
  );
}
