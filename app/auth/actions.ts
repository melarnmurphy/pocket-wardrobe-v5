"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().trim().email(),
  next: z.string().trim().min(1).default("/")
});

function sanitizeNextPath(next: string) {
  return next.startsWith("/") ? next : "/";
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${proto}://${host}`;
  }

  return null;
}

export async function signInWithMagicLinkAction(formData: FormData) {
  const values = signInSchema.parse({
    email: formData.get("email"),
    next: formData.get("next") ?? "/"
  });

  const next = sanitizeNextPath(values.next);
  const origin = await getRequestOrigin();

  if (!origin) {
    throw new Error("Could not determine request origin for auth callback.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: values.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  redirect(`/auth/check-email?email=${encodeURIComponent(values.email)}&next=${encodeURIComponent(next)}`);
}

export async function signOutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  redirect("/");
}
