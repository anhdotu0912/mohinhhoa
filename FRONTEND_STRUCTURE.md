# Cấu Trúc Thư Mục Frontend & UI Design Prototypes

Tài liệu này chi tiết hóa cấu trúc thư mục của **Frontend (Next.js App Router)** và thư mục **UI Prototypes (`ui/stitch_vmec_10_health_assistant`)** thuộc dự án **P-014 VMEC Health Assistant**.

---

## 1. Cấu Trúc Thư Mục Frontend (`frontend/`)

Ứng dụng Frontend được xây dựng trên framework **Next.js 14+ (App Router)** với TypeScript và Tailwind CSS, phân chia làm 2 phân hệ chính: **Doctor Portal** và **Patient Portal**.

```text
frontend/
├── api/                                # Subdirectory chứa các API integrations
├── app/                                # Next.js App Router (Định tuyến ứng dụng)
│   ├── (auth)/                         # Route group quản lý Xác thực / Đăng nhập
│   ├── doctor/                         # Phân hệ Bác sĩ (Doctor Portal)
│   │   ├── messages/                   # Quản lý tin nhắn & trò chuyện với bệnh nhân
│   │   │   ├── [conversationId]/
│   │   │   │   └── page.tsx           # Giao diện chi tiết cuộc hội thoại
│   │   │   └── page.tsx                # Danh sách các cuộc hội thoại
│   │   ├── patients/                   # Quản lý danh sách & hồ sơ bệnh nhân
│   │   │   ├── [patientId]/
│   │   │   │   └── page.tsx           # Chi tiết hồ sơ & chỉ số bệnh nhân
│   │   │   ├── compliance/
│   │   │   │   └── page.tsx           # Báo cáo & theo dõi tuân thủ phác trị
│   │   │   ├── constraints/
│   │   │   │   └── page.tsx           # Thiết lập giới hạn & ràng buộc sức khỏe
│   │   │   └── page.tsx                # Danh sách bệnh nhân đang quản lý
│   │   ├── reviews/                    # Đánh giá & duyệt kế hoạch điều trị / bữa ăn
│   │   │   ├── [planId]/
│   │   │   │   └── page.tsx           # Chi tiết kế hoạch cần duyệt
│   │   │   └── page.tsx                # Danh sách các kế hoạch chờ đánh giá
│   │   ├── layout.tsx                  # Layout dùng chung cho Doctor Portal
│   │   └── page.tsx                    # Bảng điều khiển Bác sĩ (Doctor Dashboard)
│   ├── patient/                        # Phân hệ Bệnh nhân (Patient Portal)
│   │   ├── assistant/
│   │   │   └── page.tsx                # Trợ lý sức khỏe thông minh (AI Health Assistant Chat)
│   │   ├── history/
│   │   │   └── page.tsx                # Nhật ký & Lịch sử theo dõi sức khỏe
│   │   ├── meals/                      # Quản lý dinh dưỡng & bữa ăn
│   │   │   ├── log/
│   │   │   │   └── page.tsx           # Giao diện ghi chép nhật ký bữa ăn
│   │   │   └── page.tsx                # Tổng quan kế hoạch bữa ăn
│   │   ├── messages/
│   │   │   └── page.tsx                # Tin nhắn trao đổi trực tiếp với bác sĩ
│   │   ├── notifications/
│   │   │   └── page.tsx                # Hộp thư thông báo & cảnh báo sức khỏe
│   │   ├── layout.tsx                  # Layout dùng chung cho Patient Portal
│   │   └── page.tsx                    # Bảng điều khiển Bệnh nhân (Patient Dashboard)
│   ├── globals.css                     # Global Styles & Tailwind CSS import
│   ├── layout.tsx                      # Root Layout của toàn bộ ứng dụng Next.js
│   └── page.tsx                        # Trang chủ hệ thống / Landing Page
├── components/                         # Các thành phần React Component tái sử dụng
│   └── shared/                         # Component giao diện dùng chung
│       ├── AppShell.tsx                # Khung giao diện chính (Sidebar + TopBar + Content Area)
│       ├── MobileMenuContext.tsx       # React Context quản lý trạng thái Menu trên di động
│       ├── Sidebar.tsx                 # Thanh điều hướng bên (Sidebar navigation)
│       └── TopBar.tsx                  # Thanh tiêu đề & công cụ phía trên (Header TopBar)
├── hooks/                              # Custom React Hooks
├── lib/                                # Các tiện ích & cấu hình dùng chung
│   └── nav-config.ts                   # Định nghĩa cấu hình Navigation Menu & phân quyền
├── public/                             # Tài nguyên tĩnh (Static Assets: SVGs, Images)
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── services/                           # Tầng kết nối & gọi API dịch vụ (Service Layer)
├── store/                              # Quản lý State toàn cục (Zustand / Redux)
├── utils/                              # Các hàm tiện ích hỗ trợ (Helper functions)
├── .env.local.example                  # Mẫu biến môi trường phát triển local
├── .eslintrc.json                      # Cấu hình kiểm tra mã nguồn ESLint (Legacy)
├── Dockerfile                          # Cấu hình đóng gói Docker container cho Frontend
├── eslint.config.mjs                   # Cấu hình ESLint (Flat Config mới)
├── next-env.d.ts                       # Định nghĩa Type cho môi trường Next.js
├── next.config.mjs                     # Cấu hình ứng dụng Next.js
├── package-lock.json                   # Lockfile lưu chính xác phiên bản các gói phụ thuộc
├── package.json                        # Khai báo thông tin dự án, dependencies & scripts
├── postcss.config.mjs                  # Cấu hình PostCSS cho Tailwind CSS
├── tailwind.config.ts                  # Cấu hình Theme & Utilities cho Tailwind CSS
├── tsconfig.json                       # Cấu hình biên dịch TypeScript
└── tsconfig.tsbuildinfo                # Cache thông tin build của TypeScript
```

---

## 2. Cấu Trúc Thư Mục UI Prototypes (`ui/stitch_vmec_10_health_assistant/`)

Thư mục `ui/stitch_vmec_10_health_assistant` chứa các mẫu thiết kế UI prototype dạng HTML tĩnh và hình ảnh chụp màn hình tương ứng cho từng màn hình của hệ thống.

```text
ui/stitch_vmec_10_health_assistant/
├── compliance/                         # Prototype màn hình Theo dõi tuân thủ phác đồ (Compliance)
│   ├── code.html                       # Mã nguồn HTML & CSS của giao diện
│   └── screen.png                      # Ảnh chụp màn hình mẫu thiết kế
├── constraints/                        # Prototype màn hình Quản lý rào cản / Giới hạn sức khỏe
│   ├── code.html                       # Mã nguồn HTML & CSS của giao diện
│   └── screen.png                      # Ảnh chụp màn hình mẫu thiết kế
├── dashboard/                          # Prototype Bảng điều khiển (Dashboard)
│   ├── code.html                       # Mã nguồn HTML & CSS của giao diện
│   └── screen.png                      # Ảnh chụp màn hình mẫu thiết kế
├── landing/                            # Prototype Trang giới thiệu / Landing Page
│   ├── code.html                       # Mã nguồn HTML & CSS của giao diện
│   └── screen.png                      # Ảnh chụp màn hình mẫu thiết kế
├── messages/                           # Prototype Màn hình Tin nhắn & Trò chuyện
│   ├── code.html                       # Mã nguồn HTML & CSS của giao diện
│   └── screen.png                      # Ảnh chụp màn hình mẫu thiết kế
├── patients/                           # Prototype Quản lý Bệnh nhân
│   └── [patientId]/                    # Giao diện chi tiết thông tin một bệnh nhân cụ thể
│       ├── code.html                   # Mã nguồn HTML & CSS của giao diện
│       └── screen.png                  # Ảnh chụp màn hình mẫu thiết kế
├── reviews/                            # Prototype Màn hình Đánh giá & Duyệt đề xuất
│   ├── code.html                       # Mã nguồn HTML & CSS của giao diện
│   └── screen.png                      # Ảnh chụp màn hình mẫu thiết kế
├── reviews_/                           # Prototype Màn hình Đánh giá nâng cao / Biến thể thiết kế
│   ├── code.html                       # Mã nguồn HTML & CSS của giao diện
│   └── screen.png                      # Ảnh chụp màn hình mẫu thiết kế
└── sign-in/                            # Prototype Màn hình Đăng nhập (Sign-in)
    ├── code.html                       # Mã nguồn HTML & CSS của giao diện
    └── screen.png                      # Ảnh chụp màn hình mẫu thiết kế
```

---

## 3. Tương Quan Giữa UI Prototypes Và Frontend (App Router)

| Màn Hình Prototype (`ui/stitch_vmec_10_health_assistant`) | Đường Dẫn Frontend Tương Ứng (`frontend/app`) | Mô Tả Chức Năng |
| :--- | :--- | :--- |
| `landing/` | `app/page.tsx` | Trang đích giới thiệu hệ thống VMEC Health Assistant |
| `sign-in/` | `app/(auth)/` | Trang đăng nhập hệ thống |
| `dashboard/` | `app/doctor/page.tsx` & `app/patient/page.tsx` | Bảng điều khiển trung tâm cho Bác sĩ và Bệnh nhân |
| `messages/` | `app/doctor/messages/` & `app/patient/messages/` | Hệ thống tin nhắn & tư vấn |
| `patients/[patientId]/` | `app/doctor/patients/[patientId]/page.tsx` | Xem thông tin chi tiết & hồ sơ sức khỏe bệnh nhân |
| `compliance/` | `app/doctor/patients/compliance/page.tsx` | Theo dõi mức độ tuân thủ uống thuốc / chế độ ăn |
| `constraints/` | `app/doctor/patients/constraints/page.tsx` | Cấu hình các điều kiện ràng buộc sức khỏe / dị ứng |
| `reviews/` | `app/doctor/reviews/` | Đánh giá & phê duyệt thực đơn / kế hoạch chăm sóc |
