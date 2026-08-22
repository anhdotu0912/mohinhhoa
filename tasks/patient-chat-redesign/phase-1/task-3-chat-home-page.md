# Task 1.5 & 1.6 — Màn hình Chat Home `/patient` & Redirect Assistant

> **Thư mục:** [`tasks/patient-chat-redesign/phase-1/`](README.md)  
> **Phụ thuộc:** Hoàn thành [`task-2-chat-shell-and-appshell.md`](task-2-chat-shell-and-appshell.md).

---

## Phần 1: T1.5 — Xây dựng Trang chủ Chat Home mới tại `/patient`

### 1. Mục tiêu
Thay thế toàn bộ nội dung dashboard cũ tại [frontend/app/patient/page.tsx](file:///d:/vinAI/P-014/frontend/app/patient/page.tsx) bằng **Chat Home**:
1. Di chuyển toàn bộ engine chat streaming hiện có từ [frontend/app/patient/assistant/page.tsx](file:///d:/vinAI/P-014/frontend/app/patient/assistant/page.tsx) (`api.chatStream`, xử lý thinking steps, citations, guardrails alert, `mealPreview`).
2. Tái tạo giao diện chuẩn theo mockup `ui/stitch_vmec_10_health_assistant/chat-home/code.html`:
   - **Khi chưa chat (`messages.length === 0`):**
     - Avatar AI Robot lơ lửng với animation nổi (`avatar-float`).
     - Tiêu đề: "Chào buổi sáng, {displayName}" + "Tôi có thể giúp gì cho sức khỏe của bạn hôm nay?".
     - **4 Chip gợi ý chuẩn theo mockup:**
       1. "Hôm nay ăn gì?" -> "Gợi ý thực đơn cá nhân hóa" (icon `restaurant`)
       2. "Chỉ số của tôi thế nào?" -> "Xem nhịp tim & đường huyết" (icon `vital_signs` / `monitoring`)
       3. "Bác sĩ dặn gì?" -> "Xem lại lời khuyên chuyên môn" (icon `prescriptions` / `clinical_notes`)
       4. "Ghi nhận bữa ăn" -> "Cập nhật calo nhanh chóng" (icon `edit_note`)
   - **Khi có hội thoại (`messages.length > 0`):**
     - Bong bóng user bên phải (`bg-emerald-500/10` border `border-emerald-500/20`).
     - Bong bóng AI bên trái kèm avatar robot nhỏ.
     - Tích hợp 4 loại card Generative-UI (sẽ xây dựng ở `task-4`).
   - **Input chat cố định đáy màn hình:**
     - Thanh input dạng pill bo tròn `rounded-full` bọc kính mờ (`backdrop-blur-xl bg-white/80`).
     - Nút gửi tròn màu xanh chính `bg-[#006857] text-white shadow-md`.

### 2. File tác động
- [frontend/app/patient/page.tsx](file:///d:/vinAI/P-014/frontend/app/patient/page.tsx) (Ghi đè nội dung dashboard cũ)
- **Tham chiếu mockup:** `ui/stitch_vmec_10_health_assistant/chat-home/code.html`

### 3. Hướng dẫn chi tiết triển khai

Cấu trúc cốt lõi của [frontend/app/patient/page.tsx](file:///d:/vinAI/P-014/frontend/app/patient/page.tsx):

```tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { ApiError, type MealPreviewOut } from "@/lib/types";
import { ChatThinkingSteps, ChatTypingDots, type ThinkingStep } from "@/components/patient/ChatThinkingSteps";
import { detectMockCardIntent, type MockCardIntent } from "@/lib/patient-chat-mock-intents";
import { usePatientPanel } from "@/components/patient-chat/PatientPanelProvider";

// Import các Card Generative-UI
import { MealSuggestionCard } from "@/components/patient-chat/cards/MealSuggestionCard";
import { IngredientMapCard } from "@/components/patient-chat/cards/IngredientMapCard";
import { WeeklyComplianceCard } from "@/components/patient-chat/cards/WeeklyComplianceCard";
import { DoctorNoteCard } from "@/components/patient-chat/cards/DoctorNoteCard";

export interface Message {
  id: string;
  sender: "ai" | "user";
  text: string;
  intent?: string;
  secondaryIntents?: string[];
  citations?: string[];
  guardrailTriggered?: boolean;
  mealPlanId?: string | null;
  mealPreview?: MealPreviewOut | null;
  mockCard?: MockCardIntent;
  isStreaming?: boolean;
  thinkingSteps?: ThinkingStep[];
}

const SAMPLE_CHIPS = [
  {
    id: "meal",
    title: "Hôm nay ăn gì?",
    subtitle: "Gợi ý thực đơn cá nhân hóa",
    icon: "restaurant",
    colorClass: "bg-emerald-500/10 text-[#006857]",
    prompt: "Hôm nay tôi nên ăn gì?",
  },
  {
    id: "metrics",
    title: "Chỉ số của tôi thế nào?",
    subtitle: "Xem nhịp tim & đường huyết",
    icon: "monitoring",
    colorClass: "bg-blue-500/10 text-blue-600",
    prompt: "Tuân thủ của tôi tuần này thế nào?",
  },
  {
    id: "doctor",
    title: "Bác sĩ dặn gì?",
    subtitle: "Xem lại lời khuyên chuyên môn",
    icon: "clinical_notes",
    colorClass: "bg-amber-500/10 text-amber-600",
    prompt: "Bác sĩ có dặn gì tôi không?",
  },
  {
    id: "foodlog",
    title: "Ghi nhận bữa ăn",
    subtitle: "Cập nhật calo nhanh chóng",
    icon: "edit_note",
    colorClass: "bg-emerald-500/10 text-[#006857]",
    prompt: "", // Sẽ kích hoạt mở panel Thực đơn
    action: "open_meal_panel",
  },
];
```

#### Xử lý logic gửi tin nhắn (`handleSend`):
1. Khi bấm Chip 4 ("Ghi nhận bữa ăn"), gọi `openPanel("menu")`.
2. Với các câu hỏi khác:
   - Kiểm tra intent mock qua `detectMockCardIntent(query)` (xem `task-4`).
   - Nếu là mock intent: Thêm message user -> Hiện typing dots giả lập 400ms -> Trả lời message AI kèm `mockCard`.
   - Nếu là câu hỏi bình thường hoặc hỏi thực đơn: Gọi stream thật qua `api.chatStream(query)` để nhận SSE event và populate `mealPreview`.
3. Tự động cuộn mượt xuống đáy màn hình (`scrollRef`).

---

## Phần 2: T1.6 — Redirect Route `/patient/assistant`

### 1. Mục tiêu
Thay thế toàn bộ nội dung [frontend/app/patient/assistant/page.tsx](file:///d:/vinAI/P-014/frontend/app/patient/assistant/page.tsx) bằng redirect trực tiếp về `/patient` để đảm bảo bookmark cũ hoặc deep-link không bị lỗi 404.

### 2. File tác động
- [frontend/app/patient/assistant/page.tsx](file:///d:/vinAI/P-014/frontend/app/patient/assistant/page.tsx)

### 3. Hướng dẫn chi tiết
Thay toàn bộ nội dung file bằng:

```tsx
import { redirect } from "next/navigation";

export default function PatientAssistantRedirectPage() {
  redirect("/patient");
}
```

### 4. Tiêu chí Hoàn thành
- [ ] Truy cập `/patient/assistant` tự động chuyển về `/patient`.
- [ ] Màn hình `/patient` hiển thị đúng giao diện `chat-home` lúc chưa chat (Avatar + Greeting + 4 Chips).
- [ ] Nhập 1 câu hỏi bất kỳ gửi đi vẫn nhận được streaming trả lời từ backend.
