import type { Metadata } from "next";
import localFont from "next/font/local";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const materialSymbols = localFont({
  src: "../node_modules/material-symbols/material-symbols-outlined.woff2",
  display: "block",
  variable: "--font-material-symbols",
  weight: "100 700",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: `${APP_NAME} - Dinh dưỡng AI chuẩn lâm sàng`,
  description: "Dinh dưỡng AI chuẩn lâm sàng cho bệnh nhân mãn tính. Cá nhân hóa thực đơn theo bệnh lý với sự phê duyệt của bác sĩ chuyên khoa.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/favicon.png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`light ${inter.variable} ${materialSymbols.variable}`} suppressHydrationWarning>
      <body className="bg-background font-body text-on-surface antialiased min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
