"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateRadiusAction } from "@/app/local/actions";

export function SaveRadiusButton({ radiusKm }: { radiusKm: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await updateRadiusAction(radiusKm);
          router.refresh();
        })
      }
      className="text-[11px] text-[var(--stone)] underline disabled:opacity-50"
    >
      {isPending ? "saving…" : `save ${radiusKm} km as your default`}
    </button>
  );
}
