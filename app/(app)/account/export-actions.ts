"use server";

import { requestDataExport, getLatestDataExportRequest } from "@/lib/domain/account/service";
import { userFacingError } from "@/lib/ui/user-facing-error";

export async function requestDataExportAction() {
  try {
    await requestDataExport();
    return {
      status: "success" as const,
      message: "We're packaging your export. We'll let you know when it's ready."
    };
  } catch (error) {
    return {
      status: "error" as const,
      message: userFacingError(error, "we couldn't start your export. try again.")
    };
  }
}

export async function checkDataExportReadyAction() {
  return getLatestDataExportRequest();
}
