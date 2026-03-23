import type { Metadata } from "next";
import "./globals.css";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = {
  title: "Pocket Wardrobe",
  description: "A wardrobe operating system for explainable styling, wear tracking, and trend matching."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthShell />
        {children}
      </body>
    </html>
  );
}
