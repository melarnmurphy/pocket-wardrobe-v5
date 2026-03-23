"use client";

import { useRef, useState, useTransition } from "react";
import { uploadAndAnalyseAction } from "@/app/page-actions";

export default function UploadCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const formData = new FormData();
    formData.append("image", file);

    startTransition(async () => {
      const result = await uploadAndAnalyseAction(formData);
      if (result.status === "error") {
        setError(result.message);
      }
      // On success, the server action's redirect() handles navigation
    });
  }

  return (
    <div
      className="flex cursor-pointer flex-col justify-between rounded-2xl bg-[#c17a3a] p-5"
      onClick={() => !isPending && inputRef.current?.click()}
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">New</p>
        <p className="mt-2 text-base font-semibold text-white">
          Upload Outfit / Garment Photo
        </p>
        <p className="mt-1 text-[12px] text-white/75">AI detects garments automatically</p>
      </div>

      {isPending ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span className="text-xs text-white/80">Analysing…</span>
        </div>
      ) : (
        <div className="mt-3 w-fit rounded-full bg-white/20 px-4 py-2 text-xs font-semibold text-white">
          Upload Photo ↑
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-white/90">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
