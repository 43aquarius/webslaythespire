import type { Metadata } from "next";
import { Ma_Shan_Zheng, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const titleFont = Ma_Shan_Zheng({
  variable: "--font-title",
  weight: "400",
  subsets: ["latin"],
  preload: false,
});

const bodyFont = Noto_Serif_SC({
  variable: "--font-body",
  weight: ["400", "600", "700", "900"],
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "杀戮尖塔 Web - Slay the Spire",
  description: "经典卡牌构筑 Roguelike 游戏《杀戮尖塔》的 Web 复刻版：铁甲战士第一幕完整体验。",
  icons: {
    icon: "/assets/mapicons/boss.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${titleFont.variable} ${bodyFont.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
