import { AppShell } from "@/components/shared/AppShell";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell role="patient">{children}</AppShell>;
}
