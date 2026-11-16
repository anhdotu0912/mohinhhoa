import { redirect } from "next/navigation";

export default function LegacyGenerationQueuePage() {
  redirect("/doctor/inbox?type=plan_review");
}
