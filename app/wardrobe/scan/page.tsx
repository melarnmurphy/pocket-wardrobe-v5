"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { PillButton } from "@/components/garderobe";
import { scanGarmentAction, type ScanResult } from "./actions";

/** 8a — in-store scan: is this worth buying, before you do. */
export default function ScanPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  async function handleFile(file: File) {
    setIsScanning(true);
    setResult(null);
    const formData = new FormData();
    formData.append("photo", file);
    const outcome = await scanGarmentAction(formData);
    setResult(outcome);
    setIsScanning(false);
  }

  return (
    <div className="mx-auto max-w-[520px] px-5 py-6 pb-16">
      <Link href="/wardrobe" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
        <ChevronLeft size={14} strokeWidth={1.5} />
        wardrobe
      </Link>

      <h1 className="pt-4 text-[30px] font-light leading-[1.05] text-[var(--ink)]">scan it</h1>
      <p className="pt-2 text-[12.5px] leading-[1.5] text-[var(--slate)]">
        A photo of a price tag or a garment on the rail — a quick check before you buy. Nothing is
        saved unless you add it later the normal way.
      </p>

      <label className="mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] bg-[var(--paper)] px-6 py-10 text-center">
        <span className="text-[12.5px] text-[var(--slate)]">
          {isScanning ? "checking…" : "tap to take or choose a photo"}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={isScanning}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </label>

      {result?.status === "error" ? (
        <p className="mt-6 text-[12.5px] text-[var(--oxblood)]">{result.message}</p>
      ) : null}

      {result?.status === "success" ? (
        <div className="mt-6 rounded-[14px] border border-[rgba(30,26,23,.11)] bg-[var(--cream)] p-5 text-center">
          <p className="text-[21px] font-light leading-[1.25] text-[var(--ink)]">
            {result.verdict === "buy it"
              ? "buy it"
              : result.verdict === "you already own this"
                ? "you already own this"
                : "maybe"}
          </p>
          <p className="pt-2 text-[12.5px] text-[var(--slate)]">
            {result.category}, {result.colour}
            {result.verdict !== "you already own this"
              ? ` — unlocks ${result.unlockCount} look${result.unlockCount === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
