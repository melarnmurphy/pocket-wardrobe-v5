"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  createBillingPortalSession,
  createPlusCheckoutSession
} from "@/lib/domain/billing/service";

async function getBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function startPlusCheckoutAction(): Promise<never> {
  const baseUrl = await getBaseUrl();
  const { url } = await createPlusCheckoutSession(baseUrl);
  redirect(url as Route);
}

export async function openBillingPortalAction(): Promise<never> {
  const baseUrl = await getBaseUrl();
  const { url } = await createBillingPortalSession(baseUrl);
  redirect(url as Route);
}
