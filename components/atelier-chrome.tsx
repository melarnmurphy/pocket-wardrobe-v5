"use client";

import { usePathname } from "next/navigation";

const CHROMELESS_PATHS = ["/design-explorations"];

export function AtelierChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chromeless = CHROMELESS_PATHS.some((path) => pathname.startsWith(path));
  if (chromeless) return null;
  return children;
}
