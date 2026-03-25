import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppToastHost } from "@/components/app-toast-host";
import { AuthShell } from "@/components/auth-shell";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

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
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <AuthShell />
        {children}
        <AppToastHost />
      </body>
    </html>
  );
}
