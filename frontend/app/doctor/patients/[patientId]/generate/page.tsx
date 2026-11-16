import { redirect } from "next/navigation";

export default async function LegacyDoctorGeneratePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  redirect(`/doctor/patients/${encodeURIComponent(patientId)}/meals`);
}
