import * as React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/app/globals.css";
import { AuthSessionProvider } from "@/components/auth/session-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InterviewOps",
  description: "AI-powered technical interview copilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
