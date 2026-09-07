"use server";

import { requestDataExport, getLatestDataExportRequest } from "@/lib/domain/account/service";

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
      message: error instanceof Error ? error.message : "Could not start your export."
    };
  }
}

export async function checkDataExportReadyAction() {
  return getLatestDataExportRequest();
}
