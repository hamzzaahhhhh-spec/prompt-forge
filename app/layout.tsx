import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { LenisProvider } from "@/components/LenisProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PromptForge — Transform Any Text Into a Masterful AI Prompt",
  description: "Paste any text and receive a masterfully engineered AI prompt. PromptForge transforms rough input into structured, high-quality prompts.",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,  // Allow user zoom — accessibility requirement
    // Do NOT use user-scalable=no — it breaks accessibility and causes iOS issues
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} bg-bg text-text antialiased`}
      >
        {/*
          Background layers: use aria-hidden + pointer-events-none so they
          never intercept touch events. Single layer is cheaper than two.
          `contain: strict` on mesh-bg (in CSS) isolates its repaint.
        */}
        <div
          className="mesh-bg fixed inset-0 -z-20"
          aria-hidden="true"
          style={{ pointerEvents: "none" }}
        />
        {/*
          Radial gradient overlay — static on mobile (no animation).
          position: fixed is fine here since it has -z-10 and pointer-events: none.
        */}
        <div
          className="fixed inset-0 -z-10"
          aria-hidden="true"
          style={{
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 20% 20%,rgba(124,110,248,0.16),transparent 40%),radial-gradient(circle at 85% 10%,rgba(62,207,207,0.12),transparent 35%),radial-gradient(circle at 80% 80%,rgba(124,110,248,0.12),transparent 30%)",
          }}
        />
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
