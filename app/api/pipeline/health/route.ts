import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

export async function GET(): Promise<NextResponse> {
  try {
    const env = getServerEnv();
    const healthResponse = await fetch(new URL("/health", env.PIPELINE_SERVICE_URL), {
      method: "GET",
      cache: "no-store"
    });

    if (!healthResponse.ok) {
      return NextResponse.json(
        { status: "error", message: `Pipeline health check failed: ${healthResponse.status}` },
        { status: 503 }
      );
    }

    const capabilitiesResponse = await fetch(
      new URL("/capabilities", env.PIPELINE_SERVICE_URL),
      { method: "GET", cache: "no-store" }
    ).catch(() => null);

    const capabilities =
      capabilitiesResponse?.ok
        ? await capabilitiesResponse.json().catch(() => null)
        : null;

    return NextResponse.json({ status: "ok", capabilities });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Pipeline health check failed."
      },
      { status: 503 }
    );
  }
}
