export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="doctor-layout">
      <nav>Doctor Navigation</nav>
      {children}
    </div>
  );
}
