# VMEC-10 — Prompt tạo giao diện trên Stitch AI

Mục tiêu file này: cung cấp **1 Design System chung** (dùng lại ở đầu MỌI prompt) + **17 prompt riêng cho từng màn hình** (Landing Page + 9 Bác sĩ + 7 Bệnh nhân, bao gồm luồng "Tạo thực đơn bằng AI" #3.5–#3.6), để khi tạo trên Stitch AI, các màn hình không bị lệch layout, lệch màu sắc, lệch component với nhau.

**Cách dùng:** Với mỗi màn hình, copy nguyên khối "DESIGN SYSTEM" bên dưới + dán tiếp phần "Prompt riêng" của màn hình đó vào 1 prompt duy nhất trên Stitch. Không tách rời hai phần.

---

## 🎨 DESIGN SYSTEM DÙNG CHUNG (dán vào ĐẦU mọi prompt)

```
Design a desktop web app screen called "VMEC-10" (AI nutrition & lifestyle
assistant for chronic disease patients in Vietnam). Target: desktop browser,
min-width 1280px, NOT a mobile app layout.

GLOBAL DESIGN SYSTEM — apply consistently to this screen:
- Style: clean clinical/medical SaaS, trustworthy, calm, NOT playful, NOT
  consumer-social-app style. Similar spirit to Notion + a clinical dashboard.
- Color palette:
  - Primary: soft medical teal/green (#2F8F7A or similar teal-green)
  - Secondary/accent: soft blue (#3B7DD8) for informational elements
  - Warning: amber (#E0A233) for compliance/threshold alerts
  - Danger: soft red (#D9534F) for medical risk alerts ONLY (allergy,
    threshold exceeded) — use sparingly, never decorative
  - Background: off-white (#F7F8FA), cards: white (#FFFFFF)
  - Text: dark slate (#1F2937) primary, gray (#6B7280) secondary
- Typography: one sans-serif family only (e.g. Inter/Roboto style),
  consistent type scale: H1 24px bold, H2 18px semibold, body 14px regular,
  caption 12px regular. Do not mix fonts across screens.
- Spacing: 8px grid system, consistent card padding 16px, consistent gap
  between sections 24px.
- Corner radius: 12px for cards, 8px for buttons/inputs — consistent on
  every screen, never sharp corners on one screen and rounded on another.
- Navigation pattern (SAME for BOTH roles — web desktop, sidebar-based):
  - LEFT SIDEBAR navigation, fixed, ~240px wide, same visual style for both
    roles (icon + label menu items, active item highlighted with teal
    background + teal text).
  - DOCTOR sidebar menu items: Dashboard, Bệnh nhân, Duyệt kế hoạch, Tuân
    thủ, Ràng buộc lâm sàng, Tin nhắn.
  - PATIENT sidebar menu items: Trang chủ, Trợ lý AI, Thực đơn, Ghi nhận,
    Thông báo, Lịch sử, Trao đổi.
  - Sidebar footer (both roles): small user avatar + name + role label at
    the bottom of the sidebar.
  - Top bar (both roles): screen title on the left, notification bell +
    user avatar on the right — identical top bar component reused across
    every screen regardless of role.
  - Never use bottom tab bar, never use mobile-style layouts — this is a
    desktop web product for both Doctor and Patient roles.
- Cards: white background, 1px light gray border (#E5E7EB), subtle shadow,
  12px radius — this exact card style repeats on every screen.
- Buttons: primary button = solid teal fill, white text, 8px radius;
  secondary button = white fill, teal border, teal text. Same button style
  across all screens.
- Status badges/pills: small rounded-full pill, colored background matching
  status meaning (green = OK/approved, amber = warning, red = risk) — same
  pill component reused everywhere.
- Icons: consistent simple line-icon set (like Lucide/Feather style)
  throughout — do not switch icon styles between screens.
- Language: all UI text in Vietnamese.
- Do not introduce new colors, fonts, spacing values, or component shapes
  beyond what is defined above.
```

---

---

## 🌐 LANDING PAGE (trang giới thiệu, trước đăng nhập)

### 0. Landing Page
**Prompt riêng:**
```
SCREEN: VMEC-10 — Public Landing Page.
Layout: NO sidebar, NO app shell — this is a public marketing page, full-
width, standalone from the app navigation. Same color palette, typography,
and button styles as the global design system, but laid out as a marketing
page, not a dashboard.
Structure top to bottom:
1. Top nav bar (not sidebar): logo "VMEC-10" left, menu links center
   (Tính năng, Cách hoạt động, Về chúng tôi, Liên hệ), "Đăng nhập" secondary
   button + "Bắt đầu" primary button right.
2. Hero section: large H1 headline in Vietnamese about AI-assisted nutrition
   planning for chronic disease patients, short supporting paragraph below,
   primary CTA button "Bắt đầu miễn phí" + secondary "Xem demo" button,
   right side shows a placeholder illustration/mockup of the app dashboard.
3. "Vấn đề" section: 3-column layout, each column = icon + short heading +
   1-2 line description (e.g. khó tự lập thực đơn phù hợp bệnh lý, thiếu
   căn cứ khoa học, khó theo dõi tuân thủ).
4. "Cách hoạt động" section: horizontal 4-step flow diagram (Khai báo hồ
   sơ → AI gợi ý thực đơn → Bác sĩ duyệt → Theo dõi tuân thủ), each step =
   numbered circle + icon + short label, connected by thin lines.
5. "Tính năng nổi bật" section: 3x2 grid of feature cards, each card = icon
   + title + 1-2 line description (e.g. RAG trên CSDL dinh dưỡng Việt Nam,
   HITL bác sĩ duyệt, cảnh báo dị ứng/tương tác thuốc, theo dõi tuân thủ
   tự động).
6. "Dành cho ai" section: 2-column split — "Bệnh nhân" card and "Bác sĩ /
   chuyên gia" card, each with icon, short description, and its own CTA
   button.
7. Footer: logo, short tagline, columns of links (Sản phẩm, Công ty, Liên
   hệ), copyright line, minimal and clean.
Use the same teal primary color, 12px card radius, 8px button radius, and
typography scale as the global design system — the landing page must feel
like the same product as the dashboard screens, just in marketing layout.
Do not introduce new colors or fonts beyond the global palette.
```

---

## 👨‍⚕️ NHÓM MÀN HÌNH: BÁC SĨ / CHUYÊN GIA DINH DƯỠNG

### 1. Đăng nhập & Dashboard bác sĩ
**Prompt riêng:**
```
SCREEN: Doctor Dashboard.
Layout: left sidebar nav (as defined) + top bar "Dashboard" + main content
area with 3 sections stacked vertically:
1. Top row: 3 summary stat cards side by side — "Bệnh nhân đang phụ trách"
   (number), "Kế hoạch chờ duyệt" (number, amber badge if >0), "Cảnh báo
   tuân thủ hôm nay" (number, red badge if >0).
2. Middle section: "Hàng đợi duyệt gần nhất" — list of 3-4 compact rows,
   each row = patient avatar + name + short summary text + amber/red status
   pill + "Xem" button on the right.
3. Bottom section: "Cảnh báo tuân thủ gần đây" — list of 3 rows, each with
   red/amber icon + patient name + short alert text + timestamp.
Use the card style and pill component exactly as defined in the global
design system.
```

### 2. Hồ sơ bệnh nhân
**Prompt riêng:**
```
SCREEN: Doctor — Patient Profile.
Layout: left sidebar nav + top bar showing patient name as title + "Chỉnh
sửa" secondary button AND "✨ Tạo thực đơn bằng AI" primary button (teal
fill) top-right, primary button placed rightmost as the main CTA of this
screen.
Main content: 2-column layout on desktop.
- Left column (30% width): patient photo/avatar circle, name, age, patient
  ID, primary condition tags as colored pills (e.g. "Tiểu đường type 2",
  "Tăng huyết áp").
- Right column (70% width): stacked cards —
  Card 1 "Chỉ số cơ thể": cân nặng, chiều cao, BMI, hiển thị dạng 3 số liệu
  lớn cạnh nhau.
  Card 2 "Dị ứng & thuốc đang dùng": bullet list, dị ứng hiển thị bằng pill
  màu đỏ nhạt.
  Card 3 "Mục tiêu điều trị": text field do bác sĩ nhập, hiển thị dạng
  editable text block.
Same card/pill style as global design system.
```

### 3. Hàng đợi duyệt kế hoạch (HITL Review Queue)
**Prompt riêng:**
```
SCREEN: Doctor — HITL Review Queue.
Layout: left sidebar nav + top bar "Hàng đợi duyệt kế hoạch" + filter tabs
row below top bar: "Tất cả | Ưu tiên cao | Đã duyệt".
Main content: vertical list of queue item cards, each card contains:
- Left: patient avatar + name + condition tag pill.
- Middle: short auto-generated summary of the meal plan (1 line truncated
  text) + small nutrition icons row (calo, muối, đường values as mini tags).
- Right: status pill ("Chờ duyệt" amber / "Cảnh báo" red if threshold
  exceeded) + primary button "Xem chi tiết".
List items use identical card style, consistent row height, consistent
alignment across all rows — this consistency is critical.
```

### 3.5. Tạo thực đơn mới — Cấu hình đầu vào cho AI Agent
**Prompt riêng:**
```
SCREEN: Doctor — New AI Meal Plan Generation (Step 1: Configuration).
Layout: left sidebar nav + top bar with back arrow + "Tạo thực đơn mới"
title + patient name as subtitle underneath the title.
Main content: 2-column layout.
- Left column (60%): single card "Thiết lập yêu cầu" containing a form:
  - "Khoảng thời gian áp dụng" — segmented control with 3 options: "1
    ngày" / "3 ngày" / "1 tuần", teal-filled active segment.
  - "Ưu tiên đặc biệt" — row of selectable chips (multi-select), e.g. "Ưu
    tiên món quen thuộc", "Đa dạng món ăn", "Giảm calo nhanh hơn mục
    tiêu" — selected chips filled teal, unselected outlined gray.
  - "Ghi chú bổ sung cho AI Agent" — multiline textarea, placeholder text
    "Ví dụ: bệnh nhân không thích hải sản, ưu tiên món miền Bắc...".
  - Large primary button full-width at bottom: "✨ Bắt đầu tạo thực đơn".
- Right column (40%), stacked cards (read-only, reference info):
  - Card "Ràng buộc lâm sàng hiện tại" — compact list of threshold values
    (muối, đường, đạm) pulled from the Constraints screen, each as a
    label+value row, plus a small text link "Chỉnh sửa ràng buộc →" that
    would navigate to screen #6.
  - Card "Tóm tắt bệnh nhân" — condition tag pills + allergy pills, same
    pill component as Patient Profile screen (#2).
Same card, pill, chip, and button styles as global design system — this
screen must look like a natural step after Patient Profile (#2).
```

### 3.6. Agent đang xử lý — Trực quan hóa luồng suy luận (trạng thái loading)
**Prompt riêng:**
```
SCREEN: Doctor — AI Generation In Progress.
Layout: left sidebar nav (visually present but dimmed/non-interactive) +
top bar "Đang tạo thực đơn..." + patient name subtitle, no action buttons
in top bar except a small secondary "Hủy" button top-right.
Main content: centered, full-width single panel (this screen has ONE big
focal card, not multiple small cards — this is the "wow" screen).
1. Thin progress bar spanning the full width at the very top of the panel,
   teal fill, small percentage label right-aligned above it (e.g. "62%").
2. Below it, a horizontal NODE-FLOW DIAGRAM (like a pipeline/flowchart,
   NOT a simple list) with 6 connected nodes left to right:
   "Phân tích hồ sơ bệnh nhân" → "Truy vấn CSDL dinh dưỡng (RAG)" → "Áp
   dụng ràng buộc lâm sàng" → "Sinh thực đơn" → "Kiểm tra an toàn (dị
   ứng/tương tác)" → "Hoàn thiện".
   - Each node = circle icon + short label underneath, connected by thin
     lines/arrows.
   - Completed nodes: solid teal circle with white checkmark icon.
   - Currently active node: teal circle with a soft pulsing glow ring
     around it (visually indicate animation/in-progress state), slightly
     larger than other nodes.
   - Upcoming nodes: gray outline circle, gray muted label text.
3. Below the node diagram, a "live activity log" panel — a bordered card
   with a scrollable list of short status lines that look like they are
   streaming in one by one, each line = small gray dot + muted gray text
   + timestamp, e.g.:
   "Đã tải hồ sơ bệnh nhân Nguyễn Văn A"
   "Tìm thấy 45 món ăn phù hợp với tiêu chí tiểu đường type 2"
   "Đang cân bằng calo cho 3 bữa chính..."
   "Kiểm tra tương tác với Metformin — không phát hiện xung đột"
   Most recent line at the bottom, slightly bolder/darker than older lines
   above it to suggest active streaming.
This screen should feel technical and transparent (showing real agent
work), not a generic spinner — but still calm and clinical, using ONLY the
color palette from the global design system (teal for progress/active,
gray for pending, no decorative colors).
```


### 4. Chi tiết duyệt thực đơn
**Prompt riêng:**
```
SCREEN: Doctor — Meal Plan Review Detail.
Layout: left sidebar nav + top bar with back arrow + patient name + 3
action buttons top-right: "Từ chối" (secondary, red border), "Chỉnh sửa"
(secondary, teal border), "Duyệt" (primary, solid teal).
Optional banner (show it in this mockup): a thin teal-tinted banner strip
right below the top bar with a sparkle icon + text "✨ Thực đơn vừa được
AI Agent tạo — vui lòng xem kỹ trước khi duyệt", dismissible with an (x)
icon. This banner appears when arriving here right after generation
(screen #3.6), and is hidden for plans opened from the normal queue.
Main content: 2-column layout.
- Left column (60%): meal plan displayed as a day timeline — Sáng / Trưa /
  Tối / Snack, each as a card listing dish names with small nutrition
  values (calo, muối, đường) as inline tags.
- Right column (40%): "Căn cứ AI" panel — card showing source references
  (RAG citations) as small bordered chips, plus a warning card if any
  threshold is exceeded (amber/red background, icon, short text).
Reuse exact card, pill, and button styles from global design system.
```

### 5. Theo dõi tuân thủ bệnh nhân
**Prompt riêng:**
```
SCREEN: Doctor — Patient Compliance Tracking.
Layout: left sidebar nav + top bar "Theo dõi tuân thủ" + patient selector
dropdown top-right.
Main content:
1. Top: horizontal line chart card showing compliance trend over last 7-14
   days (simple line chart, teal line, gray gridlines, no extra colors).
2. Below: "Nhật ký sự kiện" — vertical timeline list, each entry = icon
   (amber warning or green check) + short event text + timestamp, in a
   single bordered card container.
Chart style, card style, and icon style must match the same visual system
used in other doctor screens — no new chart colors beyond the palette
defined globally.
```

### 6. Cấu hình ràng buộc lâm sàng
**Prompt riêng:**
```
SCREEN: Doctor — Clinical Constraints Configuration.
Layout: left sidebar nav + top bar "Ràng buộc lâm sàng" + patient name
subtitle + "Lưu thay đổi" primary button top-right.
Main content: a single card containing a form with labeled input rows
(label left, input right, consistent row layout), each row = a threshold
setting:
- Giới hạn muối (g/ngày) — numeric input with slider.
- Giới hạn đường (g/ngày) — numeric input with slider.
- Giới hạn đạm (g/ngày) — numeric input with slider.
- Ghi chú ràng buộc bổ sung — multiline text box.
All input fields use the same 8px-radius input style, same label
typography as defined in global design system. Slider color = primary
teal.
```

### 7. Trao đổi với bệnh nhân
**Prompt riêng:**
```
SCREEN: Doctor — Chat with Patient.
Layout: left sidebar nav + top bar showing patient name + status ("Đang
hoạt động").
Main content: standard chat interface —
- Left narrow panel (25%): list of patient conversations, each row =
  avatar + name + last message preview + timestamp.
- Right main panel (75%): selected conversation thread, messages as
  rounded bubbles (doctor messages = teal fill right-aligned, patient
  messages = light gray fill left-aligned), input box + send button fixed
  at bottom.
Bubble radius and button style must match global design system exactly.
```

---

## 🧑‍🤝‍🧑 NHÓM MÀN HÌNH: BỆNH NHÂN

### 8. Đăng nhập & khai báo hồ sơ y tế
**Prompt riêng:**
```
SCREEN: Patient — Onboarding / Medical Profile Form.
Layout: no sidebar (this is a pre-login/onboarding flow, standalone from
the main app shell) — centered single-column form on a plain background,
desktop viewport, form card max-width ~560px centered horizontally with
generous whitespace around it, progress indicator (step 1 of 3) at top.
Main content: card containing stacked form fields — Bệnh lý nền (multi-
select chips), Dị ứng (tag input), Thuốc đang dùng (repeatable list input),
Cân nặng/Chiều cao (two numeric inputs side by side), Mục tiêu (text
input). Primary button "Tiếp tục" full-width at bottom of card.
Use same input, chip, and button styles as global design system.
```

### 9. Dashboard bệnh nhân
**Prompt riêng:**
```
SCREEN: Patient — Home Dashboard.
Layout: left sidebar nav (as defined, Patient menu) + top bar with greeting
text "Chào, [Tên]" as title + notification bell icon top-right.
Main content: desktop 2-column grid.
1. Left column (65%): "Kế hoạch hôm nay" card — today's meal plan preview
   (Sáng/Trưa/Tối as 3 rows with dish name + small icon + nutrition tags).
2. Right column (35%), stacked: "Tiến độ tuân thủ tuần này" card — simple
   progress bar or ring chart, teal fill, percentage in center; below it,
   "Cảnh báo" card (only if active) — amber/red background, icon, short
   alert text, "Xem chi tiết" link.
Same card style, spacing, and grid proportions as the Doctor Dashboard
(#1) so both dashboards feel like the same product.
```

### 9.5. Chatbot AI — Trợ lý dinh dưỡng
**Prompt riêng:**
```
SCREEN: Patient — AI Nutrition Assistant Chatbot.
Layout: left sidebar nav (Patient menu, "Trợ lý AI" item active) + top bar
"Trợ lý AI" title + small status pill "Đang hoạt động" top-right.
Main content: 3-column layout within the main area.

COLUMN 1 — Chat History panel (left, ~20% width, own thin bordered panel
inside main content, separate from the main sidebar nav):
- "Cuộc trò chuyện mới" button (secondary, teal border) at top.
- Below: vertical list of past conversation rows, each row = truncated
  first-message text + relative timestamp (e.g. "Hôm qua", "3 ngày trước").
  Active conversation highlighted with light teal background.

COLUMN 2 — Main chat panel (center, ~50% width):
- Empty-state (when no conversation started) shows: friendly icon/avatar
  for the AI agent, short greeting text, and a grid of 4 "câu hỏi mẫu"
  suggestion chips/buttons (e.g. "Gợi ý thực đơn giảm muối cho hôm nay",
  "Món nào phù hợp với người tiểu đường?", "Giải thích vì sao tôi cần
  giảm đạm", "Thực đơn tuần này có gì?") — clicking a chip sends it as a
  message.
- Once conversation starts: standard chat thread, user messages = teal
  bubble right-aligned, AI agent messages = light gray bubble left-aligned
  with small AI avatar icon.
- Each AI agent message that involved retrieval shows a small secondary
  button/chip below the bubble: "📄 Xem tài liệu tham khảo" — implies
  opening column 3 or a modal.
- ABOVE each AI agent's final answer, show a collapsed "Luồng tư duy của
  Agent" expandable section (collapsed by default, chevron icon to expand)
  — when expanded it reveals a small vertical stepper with short labeled
  steps in gray monospace-ish text, e.g. "1. Phân tích hồ sơ bệnh nhân →
  2. Truy vấn CSDL dinh dưỡng → 3. Kiểm tra ràng buộc bác sĩ đặt → 4. Tổng
  hợp câu trả lời" — styled as a subtle, muted timeline, visually distinct
  from the main answer text (smaller font, gray, indented, connected by a
  thin vertical line), so it clearly reads as "behind the scenes" not the
  main content.
- Input box fixed at bottom of column 2: text input + send button (teal,
  circular). While the user is typing (after a few words), show a thin
  row of 2-3 "gợi ý từ tiếp theo" (next-word/phrase suggestion) chips
  directly above the input box, small pill-shaped, light gray background,
  tappable to autocomplete the sentence — same pill style as elsewhere in
  the design system but smaller size.

COLUMN 3 — Retrieved Documents panel (right, ~30% width, appears/expands
when "Xem tài liệu tham khảo" is clicked; show it open by default in this
mockup so the layout is visible):
- Panel header "Tài liệu tham khảo" + close (x) icon.
- List of source cards, each card = small document icon + source title
  (e.g. "CSDL thành phần thực phẩm Việt Nam — Cá basa"), short excerpt
  snippet (1-2 lines, muted gray text), and a small relevance tag (e.g.
  "Độ liên quan: cao" as a teal pill).

Use the exact same card, pill, button, and typography styles as the rest
of the app — this screen must look like a natural extension of the
Dashboard and Meal Plan screens, not a different product.
```


### 10. Xem thực đơn chi tiết
**Prompt riêng:**
```
SCREEN: Patient — Meal Plan Detail.
Layout: left sidebar nav (Patient menu) + top bar "Thực đơn hôm nay" + date
selector (left/right arrows) top-right of the top bar.
Main content: centered content column (max-width ~800px within the main
area), vertical list of meal cards grouped by Sáng / Trưa / Tối / Snack,
each meal card shows: dish name, small dish icon/thumbnail placeholder,
nutrition tags row (calo, muối, đường as small pills), and an expandable
"Vì sao gợi ý món này?" text link revealing 1-2 lines of reasoning.
Same pill and card style as global design system.
```

### 11. Ghi nhận ăn uống & phản hồi
**Prompt riêng:**
```
SCREEN: Patient — Meal Log / Feedback (simple confirm, not photo food log).
Layout: left sidebar nav (Patient menu) + top bar "Ghi nhận bữa ăn".
Main content: centered content column (max-width ~800px), vertical list,
one row per meal of the day (Sáng/Trưa/Tối),
each row = meal name + two simple toggle buttons: "Đã ăn theo kế hoạch"
(teal) / "Ăn khác" (gray outline). If "Ăn khác" selected, show a small
inline text input to note what was eaten instead.
Keep this screen simple — no photo upload UI, no complex food-image
recognition elements (explicitly out of scope). Same button and card style
as global design system.
```

### 12. Thông báo tuân thủ (Compliance Notification)
**Prompt riêng:**
```
SCREEN: Patient — Compliance Notifications.
Layout: left sidebar nav (Patient menu) + top bar "Thông báo".
Main content: centered content column (max-width ~800px), vertical list of
notification cards, each card = icon
(amber warning triangle or green check circle) + bold short title (e.g.
"Vượt ngưỡng muối hôm nay") + 1-2 line description + timestamp + optional
small "Xem gợi ý điều chỉnh" link.
Unread notifications have a subtle teal left-border accent; read ones are
plain white card. Same card style, spacing, and icon set as global design
system — no new colors introduced.
```

### 13. Lịch sử & tiến độ
**Prompt riêng:**
```
SCREEN: Patient — History & Progress.
Layout: left sidebar nav (Patient menu) + top bar "Lịch sử & tiến độ" + date
range selector top-right of the top bar.
Main content (centered column, max-width ~900px):
1. Top: line chart card showing weight/health metric trend over time
   (teal line, gray gridlines) with a horizontal dashed target line
   (secondary blue) representing doctor's goal.
2. Below: "Thực đơn đã dùng" — horizontal scrollable list or vertical list
   of past day cards, each showing date + short meal summary + compliance
   status pill.
Chart and pill styling identical to global design system, no deviation.
```

### 14. Trao đổi với bác sĩ
**Prompt riêng:**
```
SCREEN: Patient — Chat with Doctor.
Layout: left sidebar nav (Patient menu) + top bar showing doctor name +
specialty subtitle.
Main content: single conversation thread view filling the main content
area (no side list panel needed since patient only has one doctor), thread
centered with max-width ~800px — chat bubbles (patient messages = teal
fill right-aligned, doctor messages = light gray fill left-aligned), input
box + send button fixed at bottom, attach icon optional inside input box.
Same bubble radius, button style, and typography as the doctor's chat
screen (#7) — these two chat screens must look like the same component
reused, not two different designs.
```

---

## ✅ Checklist tránh lệch UI khi tạo trên Stitch

- [ ] Luôn dán khối "DESIGN SYSTEM DÙNG CHUNG" ở đầu mỗi prompt, không bỏ qua.
- [ ] Tạo theo đúng thứ tự: Landing Page → Dashboard bác sĩ → các màn bác sĩ còn lại (bao gồm Tạo thực đơn AI #3.5, #3.6) → Dashboard bệnh nhân → Chatbot AI → các màn bệnh nhân còn lại, để Stitch có ngữ cảnh nhất quán dần.
- [ ] Sau khi tạo xong 2-3 màn đầu, chụp lại bảng màu/spacing thực tế Stitch xuất ra và bổ sung vào phần Design System nếu Stitch tự ý đổi (ví dụ đổi tông teal khác), để các prompt sau khớp với các màn trước.
- [ ] Hai màn chat (#7 và #14) nên tạo liền nhau để đảm bảo bubble/style giống hệt nhau.
- [ ] Cả 2 vai trò dùng chung 1 kiểu sidebar + top bar — khi tạo màn Bệnh nhân, luôn nhắc rõ "same sidebar/top bar component as Doctor screens" nếu Stitch hỗ trợ tham chiếu.
- [ ] Landing Page (#0) là trang duy nhất KHÔNG dùng sidebar/app shell — nhắc rõ điều này khi tạo để Stitch không tự thêm sidebar vào.
- [ ] Màn Chatbot AI (#9.5) có 3 cột — nếu Stitch bị lệch tỷ lệ cột, thử tạo riêng cột "Luồng tư duy Agent" và "Tài liệu tham khảo" thành 1 prompt bổ sung mô tả rõ 2 thành phần này là các panel phụ, không phải nội dung chính.
- [ ] Màn Agent đang xử lý (#3.6) là màn hình "wow" quan trọng nhất — nếu Stitch vẽ node-flow diagram bị lệch (chồng chéo, không thẳng hàng), thử mô tả lại rõ hơn "horizontal timeline with 6 equally-spaced circular nodes connected by straight lines, similar to a checkout/onboarding step indicator but wider".
- [ ] Khi code frontend, luồng #3.5 → #3.6 → #4 nên implement dạng client-side state machine trong 1 route (vd `/doctor/patients/[patientId]/generate`) thay vì 3 route riêng, để tránh mất trạng thái khi chuyển trang giữa lúc AI đang "đang xử lý".
- [ ] Nếu Stitch cho phép "reference previous screen" hoặc "component library", bật tính năng đó thay vì tạo độc lập từng màn.
