"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

export function MobileNavToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="open menu"
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center"
        style={{ color: "var(--ink)" }}
      >
        <Menu size={18} strokeWidth={1.5} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="dismiss"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(12,10,9,.55)]"
          />
          <div className="gw-pop relative h-full w-[260px]" onClick={() => setOpen(false)}>
            <button
              type="button"
              aria-label="close menu"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center"
              style={{ color: "var(--stone)" }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
