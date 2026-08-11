"use client";

import { useRouter } from "next/navigation";
import { PatientListPage } from "@/components/doctor/PatientListPage";

export default function DoctorHistoryIndexPage() {
  const router = useRouter();

  const handleSelectPatient = (patientId: string) => {
    router.push(`/doctor/history/${patientId}`);
  };

  return (
    <PatientListPage
      topBarTitle="Lịch sử bệnh nhân"
      headerTitle="Lịch sử ăn uống & thực đơn"
      headerSubtitle="Tổng hợp lịch sử ghi nhận ăn uống và các thực đơn dinh dưỡng của bệnh nhân theo dòng thời gian"
      actionLabel="Xem lịch sử"
      onSelectPatient={handleSelectPatient}
    />
  );
}
