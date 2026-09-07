import type { Metadata } from "next";
import { Abril_Fatface, Bodoni_Moda, IBM_Plex_Mono, Karla } from "next/font/google";
import "./globals.css";

const bodyFont = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap"
});

const displayFont = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap"
});

const bodoniFont = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-bodoni",
  display: "swap"
});

const abrilFont = Abril_Fatface({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-abril",
  display: "swap"
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap"
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
      <body
        className={`${bodyFont.variable} ${displayFont.variable} ${bodoniFont.variable} ${abrilFont.variable} ${monoFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
