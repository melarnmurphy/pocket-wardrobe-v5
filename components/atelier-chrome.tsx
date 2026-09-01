"use client";

import { usePathname } from "next/navigation";

const CHROMELESS_PATHS = ["/design-explorations"];

export function AtelierChrome({
  children,
  raw
}: {
  children: React.ReactNode;
  raw: React.ReactNode;
}) {
  const pathname = usePathname();
  const chromeless = CHROMELESS_PATHS.some((path) => pathname.startsWith(path));
  return <>{chromeless ? raw : children}</>;
}
