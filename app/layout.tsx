import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { LenisProvider } from "@/components/LenisProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "PromptForge",
  description: "Paste any text and receive a masterfully engineered AI prompt.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} min-h-screen bg-bg text-text antialiased`}
      >
        <LenisProvider>
          <div className="mesh-bg fixed inset-0 -z-20" aria-hidden="true" />
          <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(124,110,248,0.16),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(62,207,207,0.12),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(124,110,248,0.12),transparent_30%)]" />
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
