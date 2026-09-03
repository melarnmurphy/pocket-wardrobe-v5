"use client";

import { useActionState, useState } from "react";
import type { Profile, PublicProfilePreview } from "@/lib/domain/profile";
import { PillButton } from "@/components/garderobe";
import { DeletePhotosDialog } from "@/components/garderobe/account/delete-photos-dialog";
import { CloseAccountDialog } from "@/components/garderobe/account/close-account-dialog";
import { ExportRow } from "@/components/garderobe/account/export-row";
import {
  updateLocalPrivacyAction,
  updateProfileAction,
  updateSizesAction,
  type ProfileActionState
} from "./profile-actions";
import { deleteAllUserPhotosAction } from "./photos-actions";
import { closeUserAccountAction } from "./close-account-actions";
import { requestDataExportAction, checkDataExportReadyAction } from "./export-actions";

const idleState: ProfileActionState = { status: "idle", message: null };
const SIZE_SYSTEMS = ["AU", "UK", "US", "EU"] as const;

/** 17a / w3e — details, sizes, and what other people see. */
export function YouSection({
  profile,
  preview,
  garmentCount,
  liveListingCount,
  openThreadCount
}: {
  profile: Profile;
  preview: PublicProfilePreview;
  garmentCount: number;
  liveListingCount: number;
  openThreadCount: number;
}) {
  const [profileState, profileFormAction] = useActionState(updateProfileAction, idleState);
  const [sizesState, sizesFormAction] = useActionState(updateSizesAction, idleState);
  const [privacyState, privacyFormAction] = useActionState(updateLocalPrivacyAction, idleState);

  return (
    <section className="border-t border-[rgba(30,26,23,.14)] pt-8">
      <p className="pb-1 text-[9px] font-semibold uppercase tracking-[.22em] text-[var(--ink)]">
        you
      </p>
      <h2 className="text-[26px] font-light leading-[1.1] text-[var(--ink)]">
        local name, sizes, and what other people see
      </h2>

      <form action={profileFormAction} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="block pb-1 text-[11px] text-[var(--stone)]">local name</span>
          <input
            name="local_name"
            defaultValue={profile.local_name ?? ""}
            placeholder="esther"
            className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
          />
        </label>
        <label className="flex-1">
          <span className="block pb-1 text-[11px] text-[var(--stone)]">suburb</span>
          <input
            name="suburb"
            defaultValue={profile.suburb ?? ""}
            placeholder="norwood"
            className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
          />
        </label>
        <PillButton type="submit" fullWidth={false} variant="secondary" className="self-end">
          save
        </PillButton>
      </form>
      {profileState.message ? (
        <p className="pt-2 text-[11px] text-[var(--stone)]">{profileState.message}</p>
      ) : null}

      <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
        <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          sizes
        </p>
        <form action={sizesFormAction} className="flex flex-col gap-4">
          <SizeRow
            label="tops"
            sizeName="tops_size"
            systemName="tops_size_system"
            defaultSize={profile.tops_size}
            defaultSystem={profile.tops_size_system}
          />
          <SizeRow
            label="bottoms"
            sizeName="bottoms_size"
            systemName="bottoms_size_system"
            defaultSize={profile.bottoms_size}
            defaultSystem={profile.bottoms_size_system}
          />
          <SizeRow
            label="shoes"
            sizeName="shoes_size"
            systemName="shoes_size_system"
            defaultSize={profile.shoes_size}
            defaultSystem={profile.shoes_size_system}
          />
          <label className="max-w-[160px]">
            <span className="block pb-1 text-[11px] text-[var(--stone)]">height, cm</span>
            <input
              name="height_cm"
              type="number"
              min="1"
              max="299"
              defaultValue={profile.height_cm ?? ""}
              className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--slate)]">
            <input
              type="checkbox"
              name="one_size_either_way"
              defaultChecked={profile.one_size_either_way}
            />
            one size either way — widen the nearby feed
          </label>
          <PillButton type="submit" fullWidth={false} variant="secondary">
            save sizes
          </PillButton>
        </form>
        {sizesState.message ? (
          <p className="pt-2 text-[11px] text-[var(--stone)]">{sizesState.message}</p>
        ) : null}
      </div>

      <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
        <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          local privacy
        </p>
        <form action={privacyFormAction} className="flex flex-col gap-4">
          <label className="flex items-center gap-3">
            <ToggleVisual name="show_suburb" defaultChecked={profile.show_suburb} />
            <span className="text-[12.5px] text-[var(--slate)]">show your suburb</span>
          </label>
          <label className="flex items-center gap-3">
            <ToggleVisual name="show_wear_count" defaultChecked={profile.show_wear_count} />
            <span className="text-[12.5px] text-[var(--slate)]">
              show wear count — never the dates
            </span>
          </label>
          <PillButton type="submit" fullWidth={false} variant="secondary">
            save privacy
          </PillButton>
        </form>
        {privacyState.message ? (
          <p className="pt-2 text-[11px] text-[var(--stone)]">{privacyState.message}</p>
        ) : null}
      </div>

      <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
        <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          what other people see
        </p>
        <div className="rounded-[14px] border border-[rgba(30,26,23,.11)] bg-[var(--cream)] p-5">
          <p className="text-[17px] text-[var(--ink)]">{preview.localName || "no local name set"}</p>
          <p className="pt-1 text-[12.5px] text-[var(--stone)]">
            {preview.suburb || "suburb hidden"}
          </p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]">
              {preview.handoverCount} handovers
            </span>
            <span className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]">
              {preview.listedCount} listed
            </span>
          </div>
          <p className="pt-3 text-[11px] text-[var(--stone)]">
            joined{" "}
            {preview.joinedAt ? new Date(preview.joinedAt).toLocaleDateString("en-AU") : "recently"}
          </p>
        </div>
        <p className="pt-2 text-[11px] text-[var(--stone)]">
          This is exactly what a buyer or seller sees in local threads — nothing else about your
          wardrobe, wear dates, or contact details.
        </p>
      </div>

      <PhotosSection garmentCount={garmentCount} />

      <CloseAccountSection liveListingCount={liveListingCount} openThreadCount={openThreadCount} />

      <ExportRow requestAction={requestDataExportAction} checkAction={checkDataExportReadyAction} />
    </section>
  );
}

function PhotosSection({ garmentCount }: { garmentCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
      <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
        your photos
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[14.5px] text-[var(--oxblood)]"
      >
        delete my photos, keep the records
      </button>
      <DeletePhotosDialog
        open={open}
        onClose={() => setOpen(false)}
        garmentCount={garmentCount}
        action={deleteAllUserPhotosAction}
      />
    </div>
  );
}

function CloseAccountSection({
  liveListingCount,
  openThreadCount
}: {
  liveListingCount: number;
  openThreadCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
      <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
        close your account
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[14.5px] text-[var(--oxblood)]"
      >
        close the account
      </button>
      <CloseAccountDialog
        open={open}
        onClose={() => setOpen(false)}
        liveListingCount={liveListingCount}
        openThreadCount={openThreadCount}
        action={closeUserAccountAction}
      />
    </div>
  );
}

function SizeRow({
  label,
  sizeName,
  systemName,
  defaultSize,
  defaultSystem
}: {
  label: string;
  sizeName: string;
  systemName: string;
  defaultSize: string | null;
  defaultSystem: string;
}) {
  return (
    <div className="flex items-end gap-3">
      <label className="w-24">
        <span className="block pb-1 text-[11px] text-[var(--stone)]">{label}</span>
        <input
          name={sizeName}
          defaultValue={defaultSize ?? ""}
          className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none"
        />
      </label>
      <label>
        <span className="block pb-1 text-[11px] text-[var(--stone)]">system</span>
        <select
          name={systemName}
          defaultValue={defaultSystem}
          className="rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none"
        >
          {SIZE_SYSTEMS.map((system) => (
            <option key={system} value={system}>
              {system}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ToggleVisual({ name, defaultChecked }: { name: string; defaultChecked: boolean }) {
  return (
    <span className="relative inline-flex h-[25px] w-[42px] shrink-0 items-center rounded-[100px] has-[:checked]:bg-[var(--oxblood)] bg-[rgba(30,26,23,.16)]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <span className="pointer-events-none absolute left-[3px] h-[19px] w-[19px] rounded-full bg-[var(--cream)] shadow-sm transition-transform peer-checked:translate-x-[20px]" />
    </span>
  );
}
