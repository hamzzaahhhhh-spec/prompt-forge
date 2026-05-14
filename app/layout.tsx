import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { LenisProvider } from "@/components/LenisProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  display: "swap",
});

const DEFAULT_SITE_URL = "https://promptforge-virid-gamma.vercel.app";
const resolvedSiteUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_SITE_URL;

const metadataBase = (() => {
  try {
    return new URL(resolvedSiteUrl);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
})();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A0A0A",
};

export const metadata: Metadata = {
  metadataBase,
  title: "PromptForge — Transform Any Text Into a Masterful AI Prompt",
  description: "Paste any text and receive a masterfully engineered AI prompt. PromptForge transforms rough input into structured, high-quality prompts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} antialiased`}
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        {/* ── Global noise texture overlay ── */}
        <div className="noise-overlay" aria-hidden="true" />

        {/* ── Background mesh with Ken Burns ── */}
        <div
          className="mesh-bg fixed inset-0 -z-20"
          aria-hidden="true"
          style={{ pointerEvents: "none" }}
        />

        {/* ── Ambient gradient glow ── */}
        <div
          className="fixed inset-0 -z-10"
          aria-hidden="true"
          style={{
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 20% 20%, rgba(124, 58, 237, 0.1), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(124, 58, 237, 0.06), transparent 40%)",
          }}
        />

        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
