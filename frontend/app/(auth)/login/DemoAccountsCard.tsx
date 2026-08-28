/** DEMO ONLY — xóa file này và import trong page.tsx khi hết demo. */
const ACCOUNTS = [
  { role: "Bệnh nhân", email: "demo_patient_1@example.com", password: "demo1234" },
  { role: "Bác sĩ", email: "demo_doctor@example.com", password: "demo1234" },
  { role: "Bác sĩ 2", email: "demo_doctor_2@example.com", password: "demo1234" },
];

export function DemoAccountsCard({
  onPick,
}: {
  onPick: (email: string, password: string) => void;
}) {
  return (
    <div className="mt-md rounded-xl border border-dashed border-outline-variant bg-surface-container px-md py-sm text-xs text-on-surface-variant">
      <p className="mb-xs font-semibold text-on-surface">Tài khoản demo</p>
      {ACCOUNTS.map((a) => (
        <button
          key={a.email}
          type="button"
          onClick={() => onPick(a.email, a.password)}
          className="block w-full text-left py-0.5 hover:text-primary cursor-pointer"
        >
          {a.role}: {a.email} / {a.password}
        </button>
      ))}
    </div>
  );
}
