"use client";

import { Dialog } from "@/components/garderobe/dialog";

type UploadFailedDialogProps = {
  open: boolean;
  errorCode: "unsupported_format" | "too_large" | "dead_url";
  onClose: () => void;
  onRetry: () => void;
};

const COPY: Record<
  UploadFailedDialogProps["errorCode"],
  { title: string; description: string; confirmLabel: string }
> = {
  unsupported_format: {
    title: "that file type won't open",
    description:
      "Garderobe reads JPEG, PNG and WEBP. A HEIC photo needs converting first, most phones can do this from the share sheet when you save or send it.",
    confirmLabel: "choose another photo"
  },
  too_large: {
    title: "that photo's too large",
    description: "Photos over 20MB won't upload. Try a smaller export, or a screenshot instead.",
    confirmLabel: "choose another photo"
  },
  dead_url: {
    title: "couldn't open that link",
    description:
      "The page didn't load, so nothing came back automatically. Add the piece's details yourself instead.",
    confirmLabel: "add manually"
  }
};

/** MODALS.md §3 — "upload failed / unsupported file": HEIC, size caps, a dead product URL. */
export function UploadFailedDialog({ open, errorCode, onClose, onRetry }: UploadFailedDialogProps) {
  const copy = COPY[errorCode];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      cancelLabel="cancel"
      confirmLabel={copy.confirmLabel}
      onConfirm={onRetry}
    />
  );
}
