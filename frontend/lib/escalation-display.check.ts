import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EscalationThread } from "../components/shared/EscalationThread";
import { escalationContext } from "./escalation-display";
import type { EscalationOut } from "./types";

assert.deepEqual(escalationContext("Câu hỏi mới từ chat:\r\nCâu hỏi nhiều dòng\r\ndòng thứ hai\r\n\r\nCâu trả lời AI:\r\nAI context"), { question: "Câu hỏi nhiều dòng\ndòng thứ hai", answer: "AI context" });
assert.deepEqual(escalationContext("Nội dung cũ không có nhãn"), { question: "Nội dung cũ không có nhãn", answer: "" });

const thread: EscalationOut = {
  id: "fixture-thread", patient_id: "fixture-patient", doctor_id: "fixture-doctor",
  question_text: "Latest forwarded question", answer_text: "AI background", reason: "unknown", patient_note: "",
  status: "waiting_doctor", created_at: "2026-11-17T01:00:00Z", updated_at: "2026-11-17T02:00:00Z",
  messages: [
    { id: "forward-one", sender: "patient", kind: "context", body: "Câu hỏi mới từ chat:\nEarlier forwarded question\n\nCâu trả lời AI:\nEarlier AI background", created_at: "2026-11-17T01:00:00Z" },
    { id: "doctor-reply", sender: "doctor", kind: "reply", body: "Doctor response", created_at: "2026-11-17T01:20:00Z" },
    { id: "forward-two", sender: "patient", kind: "context", body: "Câu hỏi mới từ chat:\nLatest forwarded question\n\nCâu trả lời AI:\nAI background", created_at: "2026-11-17T02:00:00Z" },
  ],
};
const render = (data: EscalationOut, viewer: "doctor" | "patient", compact = true) => renderToStaticMarkup(createElement(EscalationThread, { thread: data, viewer, compact, onSend: async () => {} }));
for (const viewer of ["doctor", "patient"] as const) {
  const html = render(thread, viewer);
  assert.ok(html.includes("Earlier forwarded question"));
  assert.equal(html.split("Latest forwarded question").length - 1, 1, "Latest forwarded question must not be duplicated at the beginning");
  assert.ok(html.indexOf("Earlier forwarded question") < html.indexOf("Doctor response"));
  assert.ok(html.indexOf("Doctor response") < html.indexOf("Latest forwarded question"));
  assert.ok(html.includes("Earlier AI background"));
  assert.ok(!html.includes("Đã chuyển thêm câu hỏi từ chat"));
}
const initial = { ...thread, question_text: "Initial patient question", messages: [] };
assert.ok(render(initial, "doctor").includes("Initial patient question"));
assert.ok(render(initial, "doctor", false).includes("Initial patient question"));
assert.ok(!render(initial, "doctor").includes("Bạn có thể nhắn thêm trong lúc chờ bác sĩ"));
assert.ok(!render({ ...thread, status: "resolved" }, "doctor").includes("<textarea"));
console.log("PASS: initial questions, forwarded question contents and chronology are visible for both roles; AI context is separate; resolved threads stay read-only.");
