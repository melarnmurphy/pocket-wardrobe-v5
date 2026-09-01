import type { Metadata } from "next";
import { IBM_Plex_Mono, Karla } from "next/font/google";
import "./globals.css";
import { AppToastHost } from "@/components/app-toast-host";
import { AtelierChrome } from "@/components/atelier-chrome";
import { AtelierShell } from "@/components/atelier-shell";

const bodyFont = Karla({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body"
});

const displayFont = Karla({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-display"
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
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
      <body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
        <AtelierChrome raw={children}>
          <AtelierShell>{children}</AtelierShell>
        </AtelierChrome>
        <AppToastHost />
      </body>
    </html>
  );
}
