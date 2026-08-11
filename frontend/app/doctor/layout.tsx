import { AppShell } from "@/components/shared/AppShell";
import { QueueDrawer } from "@/components/doctor/QueueDrawer";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell role="doctor">
      {children}
      <QueueDrawer />
    </AppShell>
  );
}

