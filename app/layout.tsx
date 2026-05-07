import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppToastHost } from "@/components/app-toast-host";
import { AtelierShell } from "@/components/atelier-shell";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"]
});

export const metadata: Metadata = {
  title: "Pocket Wardrobe",
  description: "A wardrobe operating system for explainable styling, wear tracking, and trend matching."
};

const CHROMELESS_PATHS = ["/design-explorations"];

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const chromeless = CHROMELESS_PATHS.some((p) => pathname.startsWith(p));

  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        {chromeless ? null : <AtelierShell pathname={pathname} />}
        {children}
        <AppToastHost />
      </body>
    </html>
  );
}
