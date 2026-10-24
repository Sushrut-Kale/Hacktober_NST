import type { Metadata } from "next";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: "VIKASA — AI Development Intelligence & Verification Platform",
  description:
    "Deterministic verification and evidence platform for AI coding agents. Plan → Approve → Execute → Record Evidence → Verify → Diagnose.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07090e] antialiased">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
