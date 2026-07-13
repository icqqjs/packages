import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "icqq gateway",
  description: "多用户多 bot icqq 网关：主机隔离、跨机控制面、集中 MCP 与 RPC。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="relative z-[2]">{children}</body>
    </html>
  );
}
