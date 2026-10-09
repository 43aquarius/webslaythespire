import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// 原版字体（反编译游戏文件）: 标题/卡名 = Kreon-Bold (英文) + SourceHanSerifSC-Bold (中文)
// 正文 = Kreon-Regular + SourceHanSerifSC-Medium（原版简中 zhs 字体方案）
const titleFont = localFont({
  variable: "--font-title",
  src: [
    { path: "../../public/assets/fonts/kreon-bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/assets/fonts/kreon-regular.woff2", weight: "400", style: "normal" },
  ],
  preload: false,
});

const zhTitleFont = localFont({
  variable: "--font-zh-title",
  src: [
    { path: "../../public/assets/fonts/SourceHanSerifSC-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/assets/fonts/SourceHanSerifSC-Medium.woff2", weight: "500", style: "normal" },
  ],
  preload: false,
});

const bodyFont = localFont({
  variable: "--font-body",
  src: [
    { path: "../../public/assets/fonts/kreon-regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/assets/fonts/kreon-bold.woff2", weight: "700", style: "normal" },
  ],
  preload: false,
});

const zhBodyFont = localFont({
  variable: "--font-zh-body",
  src: [
    { path: "../../public/assets/fonts/SourceHanSerifSC-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/assets/fonts/SourceHanSerifSC-Bold.woff2", weight: "700", style: "normal" },
  ],
  preload: false,
});

export const metadata: Metadata = {
  title: "杀戮尖塔 Web - Slay the Spire",
  description: "经典卡牌构筑 Roguelike 游戏《杀戮尖塔》的 Web 复刻版：铁甲战士第一幕完整体验。",
  icons: {
    icon: "/assets/mapicons/boss.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0604",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${titleFont.variable} ${zhTitleFont.variable} ${bodyFont.variable} ${zhBodyFont.variable} antialiased`}
        style={{ background: "#050302", overflow: "hidden" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
