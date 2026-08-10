import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "VMEC-10 - Dinh dưỡng AI chuẩn lâm sàng",
  description: "Dinh dưỡng AI chuẩn lâm sàng cho bệnh nhân mãn tính. Cá nhân hóa thực đơn theo bệnh lý với sự phê duyệt của bác sĩ chuyên khoa.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`light ${inter.variable}`}>
      <body className="bg-background font-body text-on-surface antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
