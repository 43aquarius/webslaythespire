import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// 原版字体（FontHelper.java 权威考证，第二十八批）：
// ZHS 语言下全部文字（卡名27px/描述24px/类型行17px/检视大图48px/能量数字76px）统一用
// font/zhs/NotoSansMonoCJKsc-Regular.otf；prepFont 第二参是线性过滤而非粗体；
// ZHS_BOLD_FONT(SourceHanSerifSC-Bold) 为从未被引用的死常量——旧实现误把宋体当主字体已纠正。
// Kreon 仅 ENG 语言路线使用，中文站不引用（保留文件作为资产完备性）。
const zhMonoFont = localFont({
  variable: "--font-zh-mono",
  src: [
    { path: "../../public/assets/fonts/NotoSansMonoCJKsc-Regular.woff2", weight: "400", style: "normal" },
  ],
  preload: false,
  adjustFontFallback: false, // 不生成 Arial 调整 fallback 面（其 data URI 在部分环境 error；我们的链已有 Noto Sans SC/系统兜底）
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
        className={`${zhMonoFont.variable} antialiased`}
        style={{ background: "#050302", overflow: "hidden" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
