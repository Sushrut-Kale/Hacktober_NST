import type { Metadata } from "next";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: "VIKASA — AI Development Intelligence & Verification Platform",
  description:
    "Deterministic verification and evidence platform for AI coding agents. Plan → Approve → Execute → Record Evidence → Verify → Diagnose.",
  keywords: ["AI verification", "deterministic testing", "coding agents", "evidence platform"],
  authors: [{ name: "VIKASA Team" }],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter+Tight:ital,wght@0,300..900;1,300..900&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#07090e] antialiased font-sans">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
