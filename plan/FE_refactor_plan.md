# KẾ HOẠCH TÁI CẤU TRÚC FRONTEND — P-014 Nutrition AI Agent

> Phạm vi: `D:\vinAI\P-014\frontend` (Next.js 14 App Router, TypeScript, Tailwind, Zustand)
> Mục tiêu: chuẩn hoá layout Doctor/Patient, bổ sung Landing Page + Dashboard đạt chuẩn production, dùng mock data thực dùng được, tuân thủ clean code, tối ưu hiệu năng.

---

## 1. Audit hiện trạng (đã quét trực tiếp source code)

Đã đọc `package.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/doctor/layout.tsx`, `app/patient/layout.tsx`, `app/doctor/dashboard/page.tsx`, `app/patient/dashboard/page.tsx`, `lib/types.ts`, `lib/api.ts`, `store/useProfileStore.ts`, và toàn bộ cây thư mục `app/`, `components/`.

### 1.1 Điểm cộng đã có sẵn
- Next.js 14.2 App Router, TypeScript, Tailwind 3.4, Zustand 5, lucide-react đã cài đặt đầy đủ.
- Đã tách route theo role: `app/doctor/*` và `app/patient/*` — đúng hướng.
- `app/globals.css` đã có design tokens dạng CSS variables (`--primary`, `--radius-md`, `--shadow-md`...) — có thể tái sử dụng làm nền cho Tailwind theme.
- Dashboard **đã tồn tại** cho cả hai role (`app/doctor/dashboard/page.tsx`, `app/patient/dashboard/page.tsx`) — vấn đề không phải "thiếu file" mà là **chất lượng/tính nhất quán chưa đạt chuẩn production**.

### 1.2 Vấn đề nghiêm trọng đã phát hiện

| # | Vấn đề | Bằng chứng cụ thể |
|---|--------|-------------------|
| 1 | **`components/doctor`, `components/patient`, `components/ui`, `components/shared` đều RỖNG** | Không có bất kỳ component tái sử dụng nào, dù đã tạo sẵn cấu trúc thư mục |
| 2 | **Toàn bộ UI viết bằng inline `style={{...}}`**, không dùng Tailwind dù đã cài | `app/doctor/dashboard/page.tsx`, `app/doctor/layout.tsx` dùng style object cho >90% phần tử |
| 3 | **Hai layout Doctor/Patient dùng 2 cách tiếp cận khác nhau** | Doctor layout: 100% inline style. Patient layout: trộn `className` (`.sidebar`, `.sidebar-link`) với inline style → **đây chính là gốc rễ "layout không đồng nhất"** |
| 4 | **Mock data hardcode thẳng trong JSX**, lặp lại ở nhiều nơi | Danh sách bệnh nhân, cảnh báo, lịch hẹn... viết cứng trong từng `page.tsx`, không có `lib/mock-data` |
| 5 | **`lib/types.ts` và `lib/api.ts` chỉ là placeholder rỗng** (`export {}`) | Không có type hệ thống, không có data layer/service layer |
| 6 | **`store/useProfileStore.ts` là hàm giả**, không dùng Zustand thật | `export const useProfileStore = () => ({ token: "fake-token", ... })` — không phải `create()` của Zustand |
| 7 | **Landing page (`app/page.tsx`) chỉ là 2 link trần**, không có branding, hero, giới thiệu sản phẩm | Không đạt chuẩn production, không responsive, không SEO |
| 8 | **Không có Root Layout thống nhất** (header, font, theme) | `app/layout.tsx` chỉ có `<html><body>`, không set font Inter/Outfit dùng `next/font`, đang load Google Fonts qua `@import` trong CSS → chặn render, ảnh hưởng Core Web Vitals (LCP) |
| 9 | **Ảnh dùng URL Unsplash trực tiếp trong `style` background**, không dùng `next/image` | Không tối ưu, không lazy-load, không responsive image |
| 10 | **Không có barrel export, không có alias `@/`**, khó maintain khi scale | — |
| 11 | **Trộn Server Component và Client Component tuỳ tiện** | Một số page có `'use client'` không cần thiết (chỉ hiển thị tĩnh) → mất lợi ích SSR |
| 12 | **Không có Loading/Error boundary** (`loading.tsx`, `error.tsx`) cho bất kỳ route nào | Trải nghiệm khi fetch API thật sau này sẽ bị giật/trắng trang |

### 1.3 Kết luận
Nguyên nhân gốc của "layout không đồng nhất" là: **không có design system + component library dùng chung**, mỗi trang tự viết CSS-in-JS bằng tay → trùng lặp code, sai lệch spacing/màu sắc giữa các trang, không thể maintain khi dự án lớn dần. Kế hoạch dưới đây giải quyết tận gốc vấn đề này.

---

## 2. Mục tiêu & nguyên tắc

1. **Một design system duy nhất** áp dụng cho cả Doctor & Patient (dùng chung tokens, chỉ khác accent màu nếu cần).
2. **100% dùng Tailwind utility classes** thay inline style; inline style chỉ cho giá trị động runtime (vd: `width: ${percent}%`).
3. **Component-driven**: mọi UI lặp lại ≥2 lần phải là component trong `components/`.
4. **Tách biệt Data layer / UI layer**: mock data nằm trong `lib/mock-data/*`, truy cập qua `lib/services/*` (interface giống hệt API thật) → sau này swap sang FastAPI chỉ cần đổi 1 lớp, UI không đổi.
5. **Type-safe tuyệt đối**: không dùng `any`, mọi domain model định nghĩa trong `lib/types/*`.
6. **Server Component mặc định**, chỉ `'use client'` khi thật sự cần state/event/browser API.
7. **Performance-first**: `next/image`, `next/font`, code-splitting, memoization hợp lý, không re-render thừa.
8. **Accessibility**: semantic HTML, `aria-*`, contrast đạt WCAG AA, keyboard navigation cho sidebar/dropdown.

---

## 3. Kiến trúc thư mục đề xuất

```
frontend/
├── app/
│   ├── (marketing)/                  # Route group cho landing/public pages
│   │   ├── page.tsx                  # Landing page
│   │   ├── about/page.tsx
│   │   └── layout.tsx                # Header/Footer công khai
│   │
│   ├── (auth)/                       # Gộp toàn bộ login/register 2 role vào 1 group
│   │   ├── doctor/login/page.tsx
│   │   ├── doctor/register/page.tsx
│   │   ├── patient/login/page.tsx
│   │   ├── patient/register/page.tsx
│   │   └── layout.tsx                # Layout auth tối giản, không sidebar
│   │
│   ├── doctor/
│   │   ├── layout.tsx                # Dùng <DashboardShell role="doctor">
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── patients/
│   │   │   ├── page.tsx
│   │   │   └── [patientId]/page.tsx  # Chi tiết bệnh nhân (đang thiếu)
│   │   ├── menus/page.tsx
│   │   ├── warnings/page.tsx
│   │   ├── dietitian/page.tsx
│   │   └── profile/page.tsx          # Đang link tới nhưng chưa có file
│   │
│   ├── patient/
│   │   ├── layout.tsx                # Dùng chung <DashboardShell role="patient">
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── food-log/page.tsx
│   │   ├── meal-plan/page.tsx
│   │   ├── chat/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── reports/page.tsx
│   │   └── profile/page.tsx          # Đang thiếu
│   │
│   ├── layout.tsx                    # Root layout: next/font, <html>, ThemeProvider
│   ├── globals.css                   # Chỉ giữ @tailwind + reset tối thiểu
│   └── not-found.tsx
│
├── components/
│   ├── ui/                           # Atoms — tái sử dụng toàn hệ thống
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Dropdown.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Toast.tsx
│   │   └── index.ts                  # barrel export
│   │
│   ├── layout/                       # Molecules cấu trúc trang
│   │   ├── DashboardShell.tsx        # Sidebar + Topbar dùng chung Doctor/Patient
│   │   ├── Sidebar.tsx                # Nhận props `items`, `role`
│   │   ├── SidebarLink.tsx
│   │   ├── Topbar.tsx
│   │   ├── UserMenu.tsx
│   │   ├── MarketingHeader.tsx
│   │   └── MarketingFooter.tsx
│   │
│   ├── charts/
│   │   ├── GlucoseTrendChart.tsx
│   │   └── MacroDonutChart.tsx
│   │
│   ├── doctor/                       # Organisms riêng cho Doctor
│   │   ├── SummaryCardGrid.tsx
│   │   ├── UrgentWarningList.tsx
│   │   ├── ScheduleTimeline.tsx
│   │   └── PatientTable.tsx
│   │
│   ├── patient/                      # Organisms riêng cho Patient
│   │   ├── CalorieSummaryCard.tsx
│   │   ├── TodayMealList.tsx
│   │   ├── MealCard.tsx
│   │   ├── QuickActions.tsx
│   │   └── AlertBanner.tsx
│   │
│   └── shared/                       # Dùng chung 2 role
│       ├── EmptyState.tsx
│       ├── PageHeader.tsx
│       └── ConfirmDialog.tsx
│
├── lib/
│   ├── types/
│   │   ├── user.ts                   # Doctor, Patient, Role
│   │   ├── nutrition.ts              # Meal, MealPlan, Macro
│   │   ├── alert.ts                  # Warning, AlertSeverity
│   │   └── index.ts
│   ├── mock-data/
│   │   ├── patients.mock.ts
│   │   ├── doctors.mock.ts
│   │   ├── meal-plans.mock.ts
│   │   ├── warnings.mock.ts
│   │   └── schedule.mock.ts
│   ├── services/                     # Interface giống API thật — dễ swap FastAPI sau
│   │   ├── patient.service.ts
│   │   ├── doctor.service.ts
│   │   ├── mealPlan.service.ts
│   │   └── alert.service.ts
│   ├── api.ts                        # fetch wrapper thật (khi có backend)
│   ├── constants.ts                  # route paths, nav items
│   └── utils.ts                      # cn(), formatDate(), formatNumber()
│
├── store/
│   ├── useProfileStore.ts            # Zustand thật, persist middleware
│   ├── useMealPlanStore.ts
│   └── useUIStore.ts                 # sidebar collapsed, toast queue
│
├── hooks/
│   ├── useMediaQuery.ts
│   └── useOnClickOutside.ts
│
├── tailwind.config.ts                # Map toàn bộ CSS variables hiện có vào theme
└── ...
```

**Quy tắc đặt tên**: PascalCase cho component file, camelCase cho hook/util, `*.mock.ts` cho mock data, `*.service.ts` cho data-access layer, `*.types.ts`/`types/` cho domain model.

---

## 4. Design System — Tailwind hoá tokens hiện có

Giữ nguyên bảng màu đã thiết kế trong `globals.css` (khá ổn) nhưng đưa vào `tailwind.config.ts` thay vì dùng lẻ tẻ qua `var(--x)` trong `style`:

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#e0f2fe",
          DEFAULT: "#0284c7",
          dark: "#0369a1",
        },
        secondary: "#475569",
        surface: "#ffffff",
        background: "#f8fafc",
        danger: "#dc2626",
        warning: "#d97706",
        success: "#0284c7",
        border: "#e2e8f0",
      },
      fontFamily: {
        heading: ["var(--font-outfit)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        sm: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0,0,0,0.05)",
        md: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)",
        lg: "0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: { fadeIn: "fadeIn 0.5s ease-out forwards" },
    },
  },
  plugins: [],
};
export default config;
```

`app/globals.css` sau refactor chỉ còn:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { @apply scroll-smooth; }
  body { @apply bg-background text-slate-900 font-body antialiased; }
  h1, h2, h3, h4 { @apply font-heading font-semibold text-slate-900; }
}
```

Font dùng `next/font/google` trong `app/layout.tsx` (không dùng `@import` CSS → tránh render-blocking):
```tsx
import { Inter, Outfit } from "next/font/google";
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin", "vietnamese"], variable: "--font-outfit", weight: ["500","600","700"] });
```

---

## 5. Component Library — danh sách ưu tiên xây trước

**Tier 1 (chặn mọi thứ khác, làm trước tiên):**
- `Button` (variants: primary/outline/danger/ghost, size: sm/md/lg, `asChild` cho Link)
- `Card` (dùng thay `.glass-panel`)
- `Badge` (thay `.badge-warning/success/danger`)
- `Avatar` (dùng `next/image`, fallback initials — thay toàn bộ `background: url(...)` inline)
- `DashboardShell` + `Sidebar` + `SidebarLink` + `Topbar` — **component quan trọng nhất**, dùng chung cho `app/doctor/layout.tsx` và `app/patient/layout.tsx`, chỉ khác `navItems` truyền vào qua props/config (`lib/constants.ts`)

**Tier 2 (feature components):**
- Doctor: `SummaryCardGrid`, `UrgentWarningList`, `ScheduleTimeline`, `PatientTable`
- Patient: `CalorieSummaryCard`, `TodayMealList`, `MealCard`, `QuickActions`, `AlertBanner`

**Tier 3 (hoàn thiện trải nghiệm):**
- `Modal`, `Dropdown`, `Toast`, `EmptyState`, `Skeleton` (loading state), `ConfirmDialog`

**Ví dụ chuẩn hoá Button (thay hoàn toàn `.btn` inline style cũ):**
```tsx
// components/ui/Button.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-heading font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-br from-primary to-sky-400 text-white shadow-md hover:-translate-y-0.5",
        outline: "border-2 border-primary text-primary hover:bg-primary-light",
        danger: "bg-danger text-white hover:bg-red-700",
        ghost: "text-secondary hover:bg-slate-100",
      },
      size: { sm: "px-3 py-1.5 text-sm", md: "px-6 py-3 text-base", lg: "px-8 py-4 text-lg" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```
> Cần cài thêm `class-variance-authority` và `clsx` + `tailwind-merge` (cho hàm `cn()`).

---

## 6. Lớp dữ liệu Mock — dùng thật, dễ thay API sau

**`lib/types/user.ts`**
```ts
export type UserRole = "doctor" | "patient";

export interface Patient {
  id: string;
  fullName: string;
  avatarUrl: string;
  condition: string;          // vd: "Tiểu đường Type 2"
  complianceRate: number;     // 0-100
  lastGlucose: number;
  status: "stable" | "warning" | "critical";
}

export interface Doctor {
  id: string;
  fullName: string;
  title: string;              // "Trưởng khoa Dinh dưỡng"
  avatarUrl: string;
  totalPatients: number;
}
```

**`lib/mock-data/patients.mock.ts`**
```ts
import type { Patient } from "@/lib/types";

export const mockPatients: Patient[] = [
  { id: "p1", fullName: "Nguyễn Thị Hoa", avatarUrl: "/avatars/p1.jpg", condition: "Tiểu đường Type 2", complianceRate: 78, lastGlucose: 18.0, status: "critical" },
  { id: "p2", fullName: "Trần Minh Quân", avatarUrl: "/avatars/p2.jpg", condition: "Tiền tiểu đường", complianceRate: 65, lastGlucose: 9.2, status: "warning" },
  // ... đủ 10-15 bản ghi để bảng/danh sách trông thật
];
```

**`lib/services/patient.service.ts`** — interface giả lập async y hệt gọi API thật:
```ts
import { mockPatients } from "@/lib/mock-data/patients.mock";
import type { Patient } from "@/lib/types";

const SIMULATED_DELAY = 300;

export async function getPatients(): Promise<Patient[]> {
  await new Promise((r) => setTimeout(r, SIMULATED_DELAY));
  return mockPatients;
}

export async function getPatientById(id: string): Promise<Patient | undefined> {
  await new Promise((r) => setTimeout(r, SIMULATED_DELAY));
  return mockPatients.find((p) => p.id === id);
}
```
> **Lợi ích**: Server Component gọi `await getPatients()` giống hệt cú pháp khi sau này đổi nội dung hàm sang `fetch(process.env.API_URL + "/patients")`. UI, component, loading/error state **không cần sửa gì**.

Ảnh avatar mock: tải sẵn 8-10 ảnh vào `public/avatars/` (thay vì hotlink Unsplash) để dùng với `next/image` ổn định, không phụ thuộc mạng ngoài lúc demo.

---

## 7. State Management — Zustand chuẩn

```ts
// store/useProfileStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Doctor, Patient, UserRole } from "@/lib/types";

interface ProfileState {
  role: UserRole | null;
  profile: Doctor | Patient | null;
  isAuthenticated: boolean;
  setProfile: (role: UserRole, profile: Doctor | Patient) => void;
  logout: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      role: null,
      profile: null,
      isAuthenticated: false,
      setProfile: (role, profile) => set({ role, profile, isAuthenticated: true }),
      logout: () => set({ role: null, profile: null, isAuthenticated: false }),
    }),
    { name: "p014-profile-storage" }
  )
);
```
Áp dụng tương tự cho `useMealPlanStore` và thêm `useUIStore` (trạng thái sidebar thu gọn, toast queue) để tránh prop-drilling giữa `DashboardShell` và các trang con.

---

## 8. Landing Page — spec chi tiết (đang thiếu hoàn toàn)

Route: `app/(marketing)/page.tsx` (Server Component, không cần `'use client'`).

**Cấu trúc section:**
1. `MarketingHeader` — logo NutriMed AI, nav (Tính năng, Về chúng tôi, Liên hệ), 2 nút CTA "Đăng nhập bác sĩ" / "Đăng nhập bệnh nhân"
2. **Hero** — headline giá trị cốt lõi (AI cá nhân hoá dinh dưỡng), subtext, 2 CTA chính (`Bắt đầu miễn phí` → patient register, `Dành cho chuyên gia y tế` → doctor register), hình minh hoạ/illustration bên phải
3. **Vấn đề & giải pháp** — 3 cột icon: theo dõi tự động, cảnh báo AI real-time, thực đơn cá nhân hoá
4. **Cách hoạt động** — 3-4 bước (Đăng ký → Khai báo tình trạng sức khoẻ → AI tạo thực đơn → Bác sĩ theo dõi & điều chỉnh)
5. **Dành cho ai** — 2 card song song: "Bệnh nhân" vs "Bác sĩ/Chuyên gia dinh dưỡng", liệt kê lợi ích riêng từng nhóm
6. **Testimonial/Trust** (mock 2-3 câu trích dẫn, có thể ghi rõ demo data)
7. **CTA cuối trang** — nhắc lại 2 nút đăng ký
8. `MarketingFooter` — liên kết, thông tin liên hệ, năm bản quyền

**Yêu cầu kỹ thuật:** responsive mobile-first, `next/image` cho toàn bộ hình minh hoạ, `next/link` cho CTA, animation `fadeIn` khi scroll (dùng `IntersectionObserver` trong 1 client component nhỏ riêng, không kéo cả trang thành client).

---

## 9. Dashboard Bác sĩ & Bệnh nhân — refactor spec

Cả hai dashboard **đã có nội dung tốt** (đúng ý đồ UX), việc cần làm là **tách thành component + thay inline style bằng Tailwind + nối vào service layer**, giữ nguyên bố cục hiện tại (đã hợp lý):

**Doctor Dashboard** (`app/doctor/dashboard/page.tsx` → Server Component):
```tsx
export default async function DoctorDashboardPage() {
  const [summary, warnings, schedule] = await Promise.all([
    getDoctorSummary(),
    getUrgentWarnings(),
    getTodaySchedule(),
  ]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      <div className="flex flex-col gap-8">
        <PageHeader title={`Chào buổi sáng, ${summary.doctorName}`} subtitle={`Hôm nay bạn có ${summary.consultCount} ca tư vấn...`} />
        <SummaryCardGrid data={summary.cards} />
        <GlucoseTrendChart data={summary.glucoseTrend} />
        <UrgentWarningList warnings={warnings} />
      </div>
      <ScheduleTimeline items={schedule} />
    </div>
  );
}
```
Áp dụng cùng cách tiếp cận cho `PatientDashboardPage`, tách `CalorieSummaryCard`, `TodayMealList`, `QuickActions`, `AlertBanner`.

**Trang còn thiếu cần bổ sung** (đã phát hiện link trỏ tới nhưng chưa có `page.tsx`):
- `app/doctor/profile/page.tsx`
- `app/doctor/patients/[patientId]/page.tsx` (chi tiết bệnh nhân)
- `app/patient/profile/page.tsx`

---

## 10. Chuẩn Clean Code

1. **ESLint + Prettier** thống nhất — thêm `.prettierrc`, bật rule `no-inline-styles` (custom hoặc dùng `eslint-plugin-tailwindcss` để cảnh báo class trùng lặp/sai thứ tự).
2. **Không dùng `any`** — bật `@typescript-eslint/no-explicit-any: error`.
3. **Props luôn có interface riêng**, export kèm component (`export interface ButtonProps`).
4. **Barrel export** (`index.ts`) cho từng thư mục component để import gọn: `import { Button, Card, Badge } from "@/components/ui"`.
5. **Không logic nghiệp vụ trong component UI thuần** — mọi tính toán (vd: % tuân thủ, phân loại mức độ cảnh báo) đưa vào `lib/utils.ts` hoặc hook riêng, component chỉ nhận data đã xử lý.
6. **1 component = 1 trách nhiệm** — component > 150 dòng là dấu hiệu cần tách nhỏ (áp dụng ngay cho `doctor/dashboard/page.tsx` hiện tại đang > 150 dòng trong 1 file).
7. **Đặt tên nhất quán**: `PascalCase.tsx` cho component, `camelCase.ts` cho non-component, không viết tắt khó hiểu.
8. **Commit theo Conventional Commits** (`feat:`, `refactor:`, `fix:`, `style:`) để dễ review khi tái cấu trúc từng phase.

---

## 11. Tối ưu hiệu năng

| Hạng mục | Hành động cụ thể |
|---|---|
| **Font** | Chuyển từ `@import` Google Fonts trong CSS sang `next/font/google` (self-hosted, không render-blocking, tự động `font-display: swap`) |
| **Ảnh** | Thay mọi `background: url(...)` bằng `next/image` + `sizes` phù hợp; ảnh mock lưu local trong `public/` thay vì hotlink Unsplash |
| **Server vs Client Component** | Mặc định Server Component; chỉ thêm `'use client'` cho phần thật sự tương tác (dropdown, form, chart) — tách nhỏ "client island" thay vì client hoá cả `layout.tsx` |
| **Code splitting** | `next/dynamic` cho `Modal`, `Chart` (thư viện chart thường nặng), `ConfirmDialog` — load khi cần |
| **Memoization** | `React.memo` cho `MealCard`, `PatientTable` row nếu list dài; `useMemo` cho tính toán phái sinh (vd tổng calo) |
| **Zustand selector** | Luôn subscribe theo field cụ thể (`useProfileStore((s) => s.profile)`) thay vì lấy cả store để tránh re-render thừa |
| **Danh sách dài** | `PatientTable`, `TodayMealList` nếu > 50 item cần virtualization (`@tanstack/react-virtual`) — chuẩn bị sẵn interface, kích hoạt khi data thật lớn |
| **Bundle** | Chạy `next build` + `@next/bundle-analyzer` định kỳ để phát hiện dependency thừa |
| **Metadata/SEO** | Mỗi route dùng `export const metadata` (đã có ở 1 vài trang, cần áp dụng đủ toàn bộ, đặc biệt landing page) |
| **Static vs Dynamic** | Landing page nên là Static (SSG) vì nội dung không đổi theo user; dashboard là Dynamic vì cần data theo phiên đăng nhập |

---

## 12. Testing & QA tối thiểu trước khi coi là "production-ready"

- [ ] `npm run lint` không lỗi/warning
- [ ] `npm run build` thành công, không warning về `<img>` chưa tối ưu
- [ ] Kiểm tra responsive ở 3 breakpoint: 375px (mobile), 768px (tablet), 1440px (desktop) cho landing + cả 2 dashboard
- [ ] Kiểm tra điều hướng Sidebar active state đúng ở mọi route con
- [ ] Kiểm tra Lighthouse: Performance ≥ 90, Accessibility ≥ 90, SEO ≥ 90 (chạy trên landing page)
- [ ] Toàn bộ nút bấm có trạng thái `hover`, `focus-visible`, `disabled` rõ ràng
- [ ] Không còn `console.log` hoặc mock token cứng kiểu `"fake-token"` lộ trong code build production

---

## 13. Lộ trình triển khai theo Phase

### Phase 0 — Nền tảng (0.5–1 ngày)
- [ ] Cấu hình `tailwind.config.ts` theo tokens ở mục 4
- [ ] Cài `class-variance-authority`, `clsx`, `tailwind-merge`
- [ ] Viết `lib/utils.ts` (hàm `cn`)
- [ ] Dựng `lib/types/*` đầy đủ domain model
- [ ] `app/layout.tsx`: tích hợp `next/font`, xoá `@import` font trong CSS

### Phase 1 — Design System & Shell (1–2 ngày)
- [ ] Xây `components/ui`: Button, Card, Badge, Avatar, Input, Skeleton
- [ ] Xây `DashboardShell` + `Sidebar` + `Topbar` dùng chung — **thay thế hoàn toàn** `app/doctor/layout.tsx` và `app/patient/layout.tsx` hiện tại bằng cách gọi chung 1 component, chỉ đổi `navItems` config
- [ ] Migrate `app/globals.css` sang Tailwind layers

### Phase 2 — Mock Data & Service Layer (1 ngày)
- [ ] Viết đủ `lib/mock-data/*` cho patient, doctor, meal-plan, warnings, schedule
- [ ] Viết `lib/services/*` với async interface
- [ ] Chuẩn hoá `useProfileStore`, `useMealPlanStore` bằng Zustand thật + `persist`

### Phase 3 — Landing Page (1 ngày)
- [ ] Dựng đủ 8 section theo mục 8
- [ ] `MarketingHeader`/`MarketingFooter`

### Phase 4 — Refactor Dashboard (1.5–2 ngày)
- [ ] Tách `SummaryCardGrid`, `UrgentWarningList`, `ScheduleTimeline` khỏi `doctor/dashboard/page.tsx`
- [ ] Tách `CalorieSummaryCard`, `TodayMealList`, `QuickActions`, `AlertBanner` khỏi `patient/dashboard/page.tsx`
- [ ] Nối cả hai dashboard vào service layer (Server Component `async function`)
- [ ] Thêm `loading.tsx`/`error.tsx` cho cả hai route dashboard

### Phase 5 — Các trang còn lại & hoàn thiện (1.5–2 ngày)
- [ ] Refactor lần lượt: `patients`, `menus`, `warnings`, `dietitian` (doctor) và `food-log`, `meal-plan`, `chat`, `alerts`, `reports`, `onboarding` (patient) theo cùng pattern component + service layer
- [ ] Bổ sung trang thiếu: `doctor/profile`, `patient/profile`, `doctor/patients/[patientId]`
- [ ] Gộp toàn bộ login/register vào `(auth)` route group

### Phase 6 — Polish & QA (0.5–1 ngày)
- [ ] Chạy checklist mục 12
- [ ] Lighthouse audit + fix
- [ ] Review clean code checklist mục 10

**Tổng ước lượng: ~7–10 ngày làm việc** (1 dev full-time), có thể rút ngắn nếu ưu tiên Phase 0–4 trước cho demo, Phase 5 làm sau.

---

## 14. Definition of Done

Một trang được coi là "xong" khi đồng thời thoả:
1. Không còn `style={{...}}` cho giá trị tĩnh (chỉ Tailwind class)
2. Toàn bộ UI lặp lại dùng component từ `components/`
3. Data lấy qua `lib/services/*`, không hardcode trong JSX
4. Có `loading.tsx` nếu là route fetch async
5. Responsive đạt 3 breakpoint chuẩn
6. Không lỗi ESLint/TypeScript
7. Sidebar/Topbar giống hệt cấu trúc giữa Doctor và Patient (chỉ khác nội dung nav)