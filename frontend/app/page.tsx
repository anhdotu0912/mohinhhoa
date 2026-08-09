import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h1>P-014 Nutrition Agent</h1>
      <p>Please select your role:</p>
      <Link href="/patient/dashboard" style={{ color: "blue", textDecoration: "underline" }}>
        Login as Patient
      </Link>
      <Link href="/doctor/dashboard" style={{ color: "blue", textDecoration: "underline" }}>
        Login as Doctor (Expert)
      </Link>
    </div>
  );
}
