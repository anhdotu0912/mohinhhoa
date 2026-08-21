# Giai đoạn 1 — UI Shell + Click-through + Mock Data

> Đọc [`00-overview.md`](00-overview.md) trước. Phạm vi: **chỉ `frontend/**`**, không sửa backend. Không đụng `frontend/app/doctor/**`, `frontend/components/doctor/**`. Mỗi task dưới đây là 1 đơn vị việc cho agent code, có thể làm tuần tự theo số thứ tự (có phụ thuộc task trước).

Quy ước đặt tên thư mục mới: `frontend/components/patient-chat/` cho toàn bộ component thuộc kiến trúc mới (shell, dock, panel, card). Giữ `frontend/components/patient/` hiện có (không xoá ở giai đoạn này — xem `03-phase3-cleanup.md`).

## T1.1 — Bổ sung design tokens từ mockup vào Tailwind

**File:** `frontend/tailwind.config.ts`

- Thêm (không xoá/sửa key cũ) vào `theme.extend.colors` các token lấy từ `ui/stitch_vmec_10_health_assistant/chat-home/code.html` (script `tailwind-config`): `"text-primary": "#141b2b"`, `"text-secondary": "#3c4a42"`, `"glass-surface": "rgba(255, 255, 255, 0.7)"`, `"emerald-ring": "rgba(16, 185, 129, 0.4)"`, `"inverse-surface": "#2e3131"`, `"inverse-on-surface": "#f0f1f1"`, và các biến thể `*-fixed`/`*-fixed-dim`/`*-fixed-variant` nếu component nào cần (chỉ thêm khi thực sự dùng, tránh phình config).
- Có thể đặt toàn bộ dưới 1 khoá riêng để rõ nguồn gốc, ví dụ comment `// --- patient-chat mockup tokens (ui/stitch_vmec_10_health_assistant) ---` ngay trước khối thêm, miễn là vẫn nằm trong `colors` (Tailwind không hỗ trợ namespace con cho `colors`, nên comment là đủ để phân biệt).
- Thêm `boxShadow` mới nếu cần cho hiệu ứng `shadow-emerald-ring` dùng nhiều trong mockup (`box-shadow: 0 0 20px <emerald-ring>` kiểu `active-glow` trong `health-metrics-dock/code.html`).
- **Không đổi** `primary`, `on-surface`, `surface-variant`, ... hiện tại — doctor UI đang phụ thuộc.
- Kiểm tra `frontend/app/layout.tsx` (hoặc file global head) đã load Google Fonts `Inter` + `Material Symbols Outlined` chưa (mockup dùng 2 font này qua `<link>` trong `<head>`). Nếu đã có (kiểm tra hiện tại project đã dùng `material-symbols-outlined` class rộng rãi → khả năng đã có sẵn) thì bỏ qua; nếu chưa, thêm `<link>` tương ứng.

**Done when:** `npm run build` (hoặc `next lint`) không lỗi; các class mới (`bg-glass-surface`, `text-text-primary`, `shadow-emerald-ring`, ...) render đúng màu khi dùng thử trong 1 component tạm.

## T1.2 — `PatientPanelProvider` (context quản lý panel)

**File mới:** `frontend/components/patient-chat/PatientPanelProvider.tsx`

Tạo React context + hook `usePatientPanel()` quản lý state UI của toàn bộ panel nổi bên phải (không liên quan router):

```ts
type PatientPanelKey = "menu" | "notifications" | "health" | null;
type HealthPanelView = "dock" | "record";
type NotificationsPanelView = "list" | { detailId: string };

type PatientPanelState = {
  activePanel: PatientPanelKey;
  healthView: HealthPanelView;
  notificationsView: NotificationsPanelView;
};

type PatientPanelContextValue = PatientPanelState & {
  openPanel: (key: Exclude<PatientPanelKey, null>) => void;
  closePanel: () => void;
  openNotificationDetail: (id: string) => void;
  backToNotificationList: () => void;
  goToRecordMetricsForm: () => void;
  backToHealthDock: () => void;
};
```

- `openPanel("menu"|"notifications"|"health")`: set `activePanel`, reset `healthView="dock"`, `notificationsView="list"`.
- `closePanel()`: set `activePanel=null`.
- Cung cấp qua `PatientPanelProvider` bọc trong `PatientChatShell` (T1.3), export `usePatientPanel` để mọi component con dùng (dock buttons, panel content, nút "Ghi nhận chỉ số", nút back trong notification detail).
- Đóng panel khi nhấn `Escape` hoặc click backdrop (theo hành vi modal chuẩn, xem cách `FoodLogModal.tsx` hiện tại xử lý backdrop để đồng bộ style).

**Done when:** component test tạm (hoặc Storybook nếu có) bấm mở/đóng panel qua context hoạt động đúng, không lỗi TypeScript.

## T1.3 — `PatientChatShell` (top bar + dock)

**File mới:** `frontend/components/patient-chat/PatientChatShell.tsx`
**Tham chiếu mockup:** `ui/stitch_vmec_10_health_assistant/chat-home/code.html` (header + `nav` phải) và `ui/stitch_vmec_10_health_assistant/doctor-note/code.html` (có thêm `BottomNavBar` cho mobile).

- Top app bar cố định (`fixed top-0`, `backdrop-blur-xl`, `bg-glass-surface`): logo "VMEC-10" bên trái, bên phải icon `sensors` (giữ nguyên placeholder, chưa cần chức năng thật) + avatar bệnh nhân (link tới `/patient/profile`, tái dùng logic avatar hiện có ở `Sidebar.tsx`/`TopBar.tsx` — có thể export 1 hook nhỏ `usePatientAvatar()` từ đó nếu tiện, hoặc copy tối giản để tránh phá `Sidebar`).
- Dock phải (desktop, `hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 rounded-full`): 3 nút icon `menu` (Thực đơn), `notifications` (Thông báo), `monitoring` (Chỉ số sức khỏe), mỗi nút gọi `openPanel(...)` từ `usePatientPanel()`; nút active (panel đang mở tương ứng) style `bg-primary text-on-primary ring-4 ring-emerald-ring` theo mockup, style `filled-icon` (Material Symbols `FILL 1`) khi active.
- Bottom nav (mobile, `md:hidden fixed bottom-4 left-4 right-4 rounded-full`): 3 nút tương tự, nút giữa nổi lên (`-translate-y-2`) theo đúng mockup `doctor-note`.
- Nhận `children` = nội dung trang chat, render children full-bleed phía dưới top bar; render các panel (T1.12–T1.14) là con của shell, hiển thị `fixed`/`absolute` đè lên trên khi `activePanel !== null` (dùng `usePatientPanel()` để biết render panel nào).
- Bọc toàn bộ trong `PatientPanelProvider` (T1.2).

**Done when:** Trang test tạm hiển thị đúng top bar + dock 3 nút responsive (thu nhỏ browser xuống mobile width để kiểm tra bottom nav xuất hiện thay dock phải).

## T1.4 — Rẽ nhánh trong `AppShell`

**File:** `frontend/components/shared/AppShell.tsx`

- Thêm nhánh: nếu `role === "patient"` **và** không phải trang onboarding (`hideChrome` hiện có) → bọc `children` bằng `PatientChatShell` (T1.3) thay cho `Sidebar` + layout div hiện tại.
- Nếu `role === "doctor"` → giữ nguyên 100% code hiện tại (`Sidebar` + `md:ml-[240px]` layout).
- Giữ `MobileMenuContext.Provider` bọc ngoài cùng như hiện tại (một số component con — ví dụ `TopBar` cũ nếu còn dùng ở trang profile — có thể vẫn cần `useMobileMenu()`).
- Kiểm tra biến `isAssistantPage` hiện tại (`pathname.includes("/assistant")`) — sau khi merge trang chat vào `/patient` (T1.5), điều kiện full-height/overflow-hidden này cần áp dụng cho **toàn bộ** `role === "patient"` (vì trang chủ giờ luôn là chat), không chỉ path `/assistant`.

**Done when:** Vào `/doctor/*` không có gì thay đổi so với trước (so sánh visual); vào `/patient/*` thấy shell mới.

## T1.5 — Trang chủ chat mới tại `/patient`

**File:** `frontend/app/patient/page.tsx` (ghi đè nội dung cũ — dashboard rows/adherence ring sẽ bị thay, xem lưu ý xoá ở `03-phase3-cleanup.md`, **không xoá file `page.tsx` cũ vội, chỉ thay nội dung component**).

- Di chuyển toàn bộ logic chat streaming hiện có từ `frontend/app/patient/assistant/page.tsx` (state `messages`, `handleSend`, `api.chatStream`, xử lý `ChatThinkingSteps`, `mealPreview`, inline card `food_log`/`interaction_check`, panel tài liệu tham khảo) sang `app/patient/page.tsx`.
- Restyle theo `ui/stitch_vmec_10_health_assistant/chat-home/code.html`:
  - Khi `messages.length === 0`: hiển thị avatar float animation + "Chào buổi sáng, {displayName}" + subtitle + **4 chip gợi ý** dạng grid 2 cột (thay 5 `SAMPLE_QUESTIONS` cũ bằng đúng 4 gợi ý theo mockup: "Hôm nay ăn gì?", "Chỉ số của tôi thế nào?", "Bác sĩ dặn gì?", "Ghi nhận bữa ăn" — hoặc giữ cả 5 nếu muốn, ưu tiên đúng 4 để khớp mockup).
  - Khi có hội thoại: bong bóng user bên phải (`bg-primary-fixed/20` hoặc tương đương token mới), bong bóng AI bên trái với avatar robot nhỏ, giữ nguyên toàn bộ logic hiển thị card đặc biệt theo intent (đoạn `msg.mealPreview`, `msg.intent === "food_log"`, `msg.intent === "interaction_check"` trong file cũ) nhưng restyle theo `meal-suggestion/code.html` (xem T1.8).
  - Input chat đáy màn hình dạng pill bo tròn `rounded-full`, nút gửi tròn `bg-primary`, theo `chat-home/code.html` (khác input dạng chữ nhật `rounded-xl` hiện tại).
- Giữ nguyên toàn bộ phần "Lịch sử chat"/"Tài liệu tham khảo" hiện có (2 side panel trượt trái/phải) — có thể giữ nguyên logic, chỉ cần đảm bảo không đè lên dock mới bên phải (điều chỉnh `right-0` panel tài liệu tham khảo tránh trùng vị trí dock 3 nút, ví dụ thêm margin phải hoặc để dock nổi trên panel với `z-index` cao hơn).
- Redirect logic (`if (!token) router.replace("/login")`, `if (role === "doctor") router.replace("/doctor")`) giữ nguyên.

**Done when:** `/patient` hiển thị đúng như `chat-home` mockup lúc chưa chat, gửi 1 câu hỏi bất kỳ vẫn nhận được trả lời thật từ backend (luồng cũ không bị hỏng).

## T1.6 — Xoá/redirect route `/patient/assistant`

**File:** `frontend/app/patient/assistant/page.tsx`

- Sau khi T1.5 hoàn tất và đã copy hết logic, thay nội dung file này bằng redirect đơn giản về `/patient` (giống cách `frontend/app/patient/messages/page.tsx` đang làm với `redirect("/patient")`), để không gãy link cũ (bookmark, `nav-config.ts` entry `assistant` nếu còn được tham chiếu ở nơi khác — kiểm tra bằng grep `\"/patient/assistant\"` trước khi đổi).
- Cập nhật `frontend/lib/nav-config.ts`: bỏ mục `{ id: "assistant", ... }` khỏi `NAV_BY_ROLE.patient` (không còn nav trái nào dùng danh sách này cho patient sau T1.4, nhưng nếu vẫn còn tham chiếu ở nơi khác — ví dụ mobile fallback — giữ tạm và note lại để xử lý ở `03-phase3-cleanup.md`).

**Done when:** truy cập `/patient/assistant` tự động chuyển về `/patient`, không có lỗi 404/console.

## T1.7 — Mock intent detector cho 3 loại card mới (tạm thời)

**File mới:** `frontend/lib/patient-chat-mock-intents.ts`

Vì backend chưa có intent `grocery_list`/`weekly_compliance`/`doctor_note` (xem `00-overview.md` mục 6), tạo 1 hàm phía FE để **chặn trước** khi gọi `api.chatStream`, dựa theo keyword đơn giản (tiếng Việt, không dấu-insensitive nếu dễ làm):

```ts
export type MockCardIntent = "grocery_list" | "weekly_compliance" | "doctor_note" | null;

export function detectMockCardIntent(message: string): MockCardIntent {
  const m = message.toLowerCase();
  if (/đi chợ|mua (nguyên liệu|thực phẩm|đồ ăn)|siêu thị|chợ gần/.test(m)) return "grocery_list";
  if (/tuân thủ.*tuần|tuần này.*tuân thủ|báo cáo tuân thủ/.test(m)) return "weekly_compliance";
  if (/bác sĩ dặn|lời nhắc bác sĩ|ghi chú bác sĩ|bác sĩ có dặn/.test(m)) return "doctor_note";
  return null;
}
```

- Đánh dấu rõ ràng bằng comment `// TODO(phase2): thay bằng intent thật từ backend, xoá detector này — xem tasks/patient-chat-redesign/03-phase3-cleanup.md#T3.6` ngay đầu file.
- Trong `app/patient/page.tsx` (T1.5): trước khi gọi `api.chatStream(query)`, gọi `detectMockCardIntent(query)`; nếu khác `null`, **không gọi API thật**, thay vào đó push 1 message AI giả với field mới `mockCard: MockCardIntent` + text ngắn phù hợp, độ trễ giả `setTimeout(300–600ms)` để giữ cảm giác "đang trả lời" (tái dùng UI `ChatTypingDots` đã có).

**Done when:** gõ đúng các câu ví dụ trong mục 3 của `00-overview.md` trả về đúng loại card mock tương ứng; câu hỏi khác vẫn đi qua luồng backend thật như cũ.

## T1.8 — Card `meal-suggestion` (restyle, tái dùng dữ liệu thật)

**File mới:** `frontend/components/patient-chat/cards/MealSuggestionCard.tsx`

- Nhận props từ `MealPreviewOut` (đã có sẵn kiểu trong `frontend/lib/types.ts`, đang được dùng trong `app/patient/assistant/page.tsx` cũ).
- UI: slider ngang (`overflow-x-auto no-scrollbar`) các thẻ món theo bữa, mỗi thẻ có ảnh (dùng ảnh placeholder theo icon món nếu không có ảnh thật — dự án hiện chưa có ảnh món ăn, xem `DishCard` hiện tại xử lý sao thì tái dùng cách đó), badge bữa (Sáng/Trưa/Tối) góc trên trái, tên món, kcal, 1–2 tag dinh dưỡng — theo đúng bố cục `ui/stitch_vmec_10_health_assistant/meal-suggestion/code.html`.
- Giữ nguyên phần dưới card: box tổng dinh dưỡng + nút "Lưu/Áp dụng thực đơn này" + link "Xem chi tiết tại Thực đơn" đã có ở bản cũ (`app/patient/assistant/page.tsx`, đoạn `computeMealPreviewTotals` + action buttons) — chuyển logic này vào component mới, không viết lại từ đầu.

**Done when:** trong `/patient`, hỏi "hôm nay ăn gì" render đúng slider ngang theo mockup, nút Lưu/Áp dụng vẫn hoạt động như trước.

## T1.9 — Card `ingredient-map` (mock)

**File mới:** `frontend/components/patient-chat/cards/IngredientMapCard.tsx`

- Props mock:

```ts
type MockGroceryPlace = { id: string; name: string; distanceLabel: string; rank: number };
type IngredientMapCardProps = {
  areaLabel: string; // ví dụ "Quận 3"
  places: MockGroceryPlace[]; // 2-3 điểm mock
  mapImageSrc?: string; // placeholder ảnh bản đồ tĩnh, có thể dùng lại ảnh mockup gốc hoặc 1 ảnh local đặt trong `public/`
};
```

- UI theo `ingredient-map/code.html`: ảnh bản đồ full-bleed trong khung `rounded-[20px]`, marker chấm nhấp nháy (`animate-ping`) ở vị trí cố định, card nổi góc trên phải "GẦN BẠN NHẤT" liệt kê `places`, nút "Xem bản đồ lớn" (chỉ cần `console.log`/toast placeholder ở giai đoạn này, không cần modal bản đồ thật).
- Dữ liệu mock cứng trong file card hoặc 1 file `frontend/lib/patient-chat-mock-data.ts` chung (khuyến nghị tạo file này để chứa mock data của T1.9–T1.11, dễ dọn ở Giai đoạn 3).

**Done when:** hỏi "đi chợ mua nguyên liệu ở đâu" hiển thị đúng card, responsive ổn trên mobile (map card full width, list nằm dưới ảnh thay vì đè lên nếu màn hình quá nhỏ — tham khảo cách mockup xử lý `flex-col md:flex-row`).

## T1.10 — Card `weekly-compliance-dock` (mock)

**File mới:** `frontend/components/patient-chat/cards/WeeklyComplianceCard.tsx`

- Props mock:

```ts
type WeeklyComplianceCardProps = {
  overallPct: number; // ví dụ 92
  dailyPct: number[]; // 7 giá trị T2..CN
};
```

- UI theo `weekly-compliance-dock/code.html`: số lớn `{overallPct}%` + label, SVG line-chart 7 điểm (path + gradient fill dưới đường, giống mockup — có thể tính toán path đơn giản từ `dailyPct` hoặc dùng lại đúng path tĩnh nếu chấp nhận demo hoá ở giai đoạn 1), legend 3 mục (Đúng thực đơn / Thực đơn khác / Thiếu dữ liệu), nút "Xem báo cáo chi tiết" → mở `MealLogPanel` (dùng `usePatientPanel().openPanel("menu")`) thay vì điều hướng trang khác.
- Mock data mặc định: `overallPct: 92`, `dailyPct: [80, 85, 88, 90, 90, 95, 95]` (đúng số trong mockup) để khớp pixel khi demo.

**Done when:** hỏi "tuân thủ của tôi tuần này thế nào" hiển thị đúng chart; bấm "Xem báo cáo chi tiết" mở panel Thực đơn.

## T1.11 — Card `doctor-note` (mock)

**File mới:** `frontend/components/patient-chat/cards/DoctorNoteCard.tsx`

- Props mock:

```ts
type DoctorNoteCardProps = {
  doctorName: string; // "BS. Minh Nguyễn"
  department: string; // "Khoa Tim mạch"
  avatarUrl?: string;
  quote: string; // "Hãy duy trì việc đi bộ 30p mỗi ngày và hạn chế tinh bột trắng."
  timeLabel: string; // "08:15 AM"
  tags: { icon: string; label: string; variant: "warning" | "info" }[];
};
```

- UI theo `doctor-note/code.html`: bento card glass với gradient blur trang trí góc, header avatar + tên + khoa + giờ, quote block có icon `format_quote`, các tag pill (`warning` dùng `bg-error-container`, `info` dùng `bg-secondary-container`).
- Mock data mặc định đúng như mockup: quote "Hãy duy trì việc đi bộ 30p mỗi ngày và hạn chế tinh bột trắng.", tag "Hạn chế muối" (warning) + "Tái khám 2 tuần" (info).

**Done when:** hỏi "bác sĩ dặn gì" hiển thị đúng card.

## T1.12 — `MealLogPanel` (panel "Thực đơn")

**File mới:** `frontend/components/patient-chat/panels/MealLogPanel.tsx`
**Tham chiếu:** `ui/stitch_vmec_10_health_assistant/meal-log-action/code.html` (phần modal `#compliance-modal`).

- Layout: panel trượt từ phải (desktop, `w-full max-w-md`, animation `slide-in-from-right`) / full-screen bottom sheet (mobile), header "Ghi nhận tuân thủ" + nút đóng gọi `closePanel()`.
- Nội dung: mini bar-chart 7 ngày tuân thủ tuần (có thể tái dùng cùng dữ liệu mock với T1.10, hoặc để trống/giá trị tĩnh — không cần đồng bộ real-time ở giai đoạn này) + danh sách 3 bữa **hôm nay** (Sáng/Trưa/Tối) với ảnh mini, tên món, trạng thái ("Đã ghi nhận" nếu có, hoặc 2 nút "Ăn đúng"/"Ăn khác").
- Với dữ liệu món hôm nay: **nên gọi API thật ngay ở giai đoạn 1 nếu có thể** (tái dùng `api.getMyMealPlan()` + `api.listFoodLogs()` như trang `/patient/meals` cũ đang làm) vì dữ liệu này đã có sẵn thật — tránh mock không cần thiết. Nút "Ăn đúng"/"Ăn khác" tái dùng thẳng logic `FoodLogModal.tsx` (có thể mở `FoodLogModal` từ trong panel này khi bấm nút, hoặc inline hoá 2 action trực tiếp nếu đơn giản hơn — ưu tiên tái dùng `FoodLogModal` để tránh trùng logic).

**Done when:** bấm nút "Thực đơn" trên dock mở panel đúng bố cục mockup, 2 hành động Ăn đúng/Ăn khác lưu thành công qua API thật (kiểm tra lại ở trang `/patient/meals` thấy phản ánh đúng).

## T1.13 — `NotificationsPanel` + `NotificationDetailModal`

**File mới:** `frontend/components/patient-chat/panels/NotificationsPanel.tsx`, `frontend/components/patient-chat/panels/NotificationDetailModal.tsx`
**Tham chiếu:** `ui/stitch_vmec_10_health_assistant/notification-list/code.html` (phần overlay dropdown cạnh nav) và `notification-detail/code.html` (modal trung tâm).

- `NotificationsPanel`: tái dùng thẳng logic dữ liệu từ `app/patient/notifications/page.tsx` hiện tại (`api.listNotifications`, filter theo thời gian, các hành động `markNotificationRead/Dismiss/Done`) nhưng đóng gói UI thành list gọn hơn (mỗi item: dot màu theo loại, tiêu đề, thời gian, rút gọn nội dung) hiển thị trong panel trượt phải (không phải dropdown nhỏ như mockup gốc — panel rộng hơn để chứa danh sách đầy đủ, tận dụng bố cục `health-metrics-dock` làm khung chuẩn cho mọi panel để đồng bộ style).
- Click 1 item → `openNotificationDetail(id)` (từ `usePatientPanel()`) → hiển thị `NotificationDetailModal` đè lên trên panel (hoặc thay nội dung panel bằng detail view, tuỳ độ phức tạp — ưu tiên cách đơn giản hơn cho giai đoạn 1: thay nội dung panel).
- `NotificationDetailModal`/detail view: tiêu đề, nguồn ("Hệ thống điều trị VMEC" hoặc tên bác sĩ nếu có trong `related_ids`), nội dung đầy đủ (`body`), 2 nút "Đóng" (→ `backToNotificationList()`) và nút hành động theo loại — với `type === "plan_approved"` hiển thị "Xem thực đơn tuần mới" (điều hướng `router.push("/patient/meals?plan_id=...")` hoặc mở `MealLogPanel` — quyết định cụ thể khi code, ưu tiên điều hướng trang `/patient/meals` vì đây là thực đơn *tuần*, khác `MealLogPanel` chỉ hiện *hôm nay*).

**Done when:** bấm nút "Thông báo" mở panel danh sách thật (dữ liệu từ `api.listNotifications`), bấm 1 item mở detail đúng nội dung, action đọc/bỏ qua/ghi nhận vẫn gọi API như cũ.

## T1.14 — `HealthMetricsPanel` + `RecordMetricsFormPanel`

**File mới:** `frontend/components/patient-chat/panels/HealthMetricsPanel.tsx`, `frontend/components/patient-chat/panels/RecordMetricsFormPanel.tsx`
**Tham chiếu:** `ui/stitch_vmec_10_health_assistant/health-metrics-dock/code.html`, `record-metrics-form/code.html`.

- `HealthMetricsPanel`: header "Chỉ số sức khỏe" + ngày hôm nay, nội dung: sparkline đường huyết 7 ngày (tái dùng cách vẽ đã có ở `frontend/components/patient/MetricsProgressChart.tsx` nếu hợp lý, hoặc SVG riêng đơn giản theo mockup), vòng tròn % tuân thủ phác đồ (`stroke-dasharray` theo % — có thể tái dùng công thức đã có ở `app/patient/page.tsx` cũ, biến `adherencePct`/`weeklyAdherence`), 2 thẻ Cân nặng + Huyết áp lấy từ **API thật** (`api.getMetricsHistory(1)` lấy điểm gần nhất, hoặc `api.getProfile()` nếu có snapshot). Nút "Ghi nhận chỉ số" → `goToRecordMetricsForm()`.
- `RecordMetricsFormPanel`: cùng khung panel (đổi header thành "Ghi nhận chỉ số" + "Nhập thông số lâm sàng mới"), 3 input (Cân nặng kg / Huyết áp mmHg / Đường huyết mmol/L) + nút "Lưu chỉ số" gọi thật `api.recordMetrics(...)` (tái dùng logic `handleRecordMetrics` từ `app/patient/history/page.tsx` cũ), sau khi lưu thành công gọi `backToHealthDock()` để quay lại dock và refetch dữ liệu mới.
- Panel này nên dùng dữ liệu thật ngay từ giai đoạn 1 (không mock) vì `api.getMetricsHistory`/`api.recordMetrics` đã hoạt động đầy đủ — chỉ có phần "vòng tròn % tuân thủ phác đồ" là cần quyết định nguồn (có thể tạm dùng cùng cách tính `weeklyAdherence` từ `listFoodLogs` như dashboard cũ).

**Done when:** bấm nút "Chỉ số sức khỏe" hiển thị đúng dữ liệu thật gần nhất; bấm "Ghi nhận chỉ số" chuyển form, lưu thành công cập nhật lại chart.

## T1.15 — Rà soát responsive & mobile bottom sheet

- Kiểm tra toàn bộ 3 panel (T1.12–T1.14) + 4 card chat (T1.8–T1.11) ở breakpoint mobile (`<768px`): panel chuyển thành bottom-sheet full width với "handle" kéo (`w-12 h-1 bg-outline-variant rounded-full` như mockup `health-metrics-dock`), dock chuyển xuống `BottomNavBar` (T1.3).
- Kiểm tra dock/bottom-nav không đè lên input chat đáy màn hình (`z-index` + `padding-bottom` hợp lý cho vùng chat).
- Kiểm tra scroll bên trong panel không kéo theo scroll của trang chat phía sau (dùng `overflow-y-auto` + khoá `body` scroll khi panel mở, tương tự cách `showHistory`/`showReferences` cũ đã khoá `document.body.style.overflow`).

**Done when:** test tay trên viewport mobile (DevTools responsive mode) mọi panel/card không bị vỡ layout, không có scroll kẹt.

## T1.16 — Checklist QA click-through cuối Giai đoạn 1

Thực hiện tuần tự, xác nhận không lỗi console:

1. Đăng nhập bệnh nhân → vào thẳng `/patient`, thấy đúng `chat-home` (greeting + 4 chip).
2. Bấm từng chip gợi ý → thấy card tương ứng (meal-suggestion thật nếu có plan, hoặc trả lời fallback nếu chưa có plan).
3. Gõ câu hỏi tương ứng 4 loại card (mục 3 trong `00-overview.md`) → đúng 4 loại card hiển thị.
4. Bấm dock "Thực đơn" → panel mở, thấy 3 bữa hôm nay, bấm "Ăn đúng"/"Ăn khác" lưu được.
5. Bấm dock "Thông báo" → panel danh sách mở, bấm 1 item → detail mở, bấm "Đóng" quay lại list, đóng panel về chat.
6. Bấm dock "Chỉ số sức khỏe" → panel dock mở đúng dữ liệu, bấm "Ghi nhận chỉ số" → điền form → lưu → quay lại dock thấy số mới.
7. Thu nhỏ trình duyệt xuống mobile width, lặp lại bước 4–6 bằng bottom nav.
8. Vào `/doctor` (đăng nhập bác sĩ) → xác nhận UI **không đổi gì** so với trước khi bắt đầu Giai đoạn 1.
