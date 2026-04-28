import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vigil - 网页请求监控与自动化工具",
  description: "基于 Puppeteer + Next.js 的网页请求监控系统",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
