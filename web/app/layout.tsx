import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

const num = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-num" });
const ui = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ui" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Yebudi",
  description: "Your Garmin performance data across readiness, strength and game days.",
};

export const viewport: Viewport = {
  themeColor: "#eff2f7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${num.variable} ${ui.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
