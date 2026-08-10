import { AppShell } from "@/components/shared/AppShell";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell role="doctor">{children}</AppShell>;
}
