import { redirect } from "next/navigation";

// Tin nhắn chưa có backend (chưa từng có spec) — ẩn khỏi doctor portal production.
export default function DoctorMessagesPage() {
  redirect("/doctor");
}
