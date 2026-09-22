import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VietQR & Zalo Automation - Cổng Thanh Toán Tự Động 3s",
  description: "Tự động đối soát chuyển khoản ngân hàng và gửi tin nhắn Zalo chăm sóc khách hàng.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}