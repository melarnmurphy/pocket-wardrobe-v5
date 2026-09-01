"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PillButton } from "@/components/garderobe";
import { completeOnboardingAction, updateProfileAction } from "@/app/account/profile-actions";

const STEPS = ["photos", "you", "done"] as const;
type Step = (typeof STEPS)[number];

export function OnboardingFlow({
  hasGarments,
  suburb,
  topsSize
}: {
  hasGarments: boolean;
  suburb: string | null;
  topsSize: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(hasGarments ? "you" : "photos");
  const [localSuburb, setLocalSuburb] = useState(suburb ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function finish() {
    setIsSaving(true);
    await completeOnboardingAction();
    router.push("/wardrobe");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center px-6 py-10">
      <div className="flex gap-1 pb-8">
        {STEPS.map((value) => (
          <div
            key={value}
            className="h-[3px] flex-1 rounded-[2px]"
            style={{
              background: STEPS.indexOf(step) >= STEPS.indexOf(value) ? "var(--oxblood)" : "rgba(30,26,23,.14)"
            }}
          />
        ))}
      </div>

      {step === "photos" ? (
        <>
          <h1 className="text-[30px] font-light leading-[1.1] text-[var(--ink)]">
            start with a few pieces
          </h1>
          <p className="pt-3 text-[13px] leading-[1.6] text-[var(--slate)]">
            Photograph a handful of things you wear often. Nothing enters your wardrobe until you
            review and confirm it.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/wardrobe/batch/new">
              <PillButton>choose photos</PillButton>
            </Link>
            <PillButton variant="secondary" onClick={() => setStep("you")}>
              skip for now
            </PillButton>
          </div>
        </>
      ) : null}

      {step === "you" ? (
        <>
          <h1 className="text-[30px] font-light leading-[1.1] text-[var(--ink)]">
            your suburb
          </h1>
          <p className="pt-3 text-[13px] leading-[1.6] text-[var(--slate)]">
            This centres the nearby feed and finishes your public profile — never a street or a
            number, and only shown to others if you choose to.
          </p>
          <form
            className="mt-8 flex flex-col gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setIsSaving(true);
              const formData = new FormData();
              formData.set("local_name", "");
              formData.set("suburb", localSuburb);
              await updateProfileAction({ status: "idle", message: null }, formData);
              setIsSaving(false);
              setStep("done");
            }}
          >
            <input
              value={localSuburb}
              onChange={(event) => setLocalSuburb(event.target.value)}
              placeholder="e.g. norwood"
              className="rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
            />
            <PillButton type="submit" disabled={isSaving}>
              {isSaving ? "saving…" : "continue"}
            </PillButton>
            <PillButton type="button" variant="secondary" onClick={() => setStep("done")}>
              skip for now
            </PillButton>
          </form>
        </>
      ) : null}

      {step === "done" ? (
        <>
          <h1 className="text-[30px] font-light leading-[1.1] text-[var(--ink)]">
            you&apos;re set up
          </h1>
          <p className="pt-3 text-[13px] leading-[1.6] text-[var(--slate)]">
            Add more pieces whenever you like — the wardrobe fills in as you go.
            {topsSize ? "" : " You can add sizes from your account any time."}
          </p>
          <div className="mt-8">
            <PillButton onClick={finish} disabled={isSaving}>
              {isSaving ? "opening your wardrobe…" : "go to my wardrobe"}
            </PillButton>
          </div>
        </>
      ) : null}
    </div>
  );
}
