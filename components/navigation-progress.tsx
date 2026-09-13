"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Lightweight feedback for App Router transitions that wait on server data. */
export function NavigationProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    let timeout: number | undefined;

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      setPending(true);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setPending(false), 10000);
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.clearTimeout(timeout);
    };
  }, []);

  if (!pending) return null;

  return (
    <div
      aria-label="Loading"
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] overflow-hidden bg-[rgba(123,31,46,.16)]"
    >
      <div className="h-full w-1/3 animate-[navigation-progress_1.1s_ease-in-out_infinite] bg-[var(--oxblood)]" />
    </div>
  );
}
