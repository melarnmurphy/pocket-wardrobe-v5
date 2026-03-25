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

const signInWithPasswordSchema = signInSchema.extend({
  password: z.string().min(1)
});

const signUpSchema = signInSchema
  .extend({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters.")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters."),
    next: z.string().trim().min(1).default("/")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
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

function buildAuthPageRedirect(params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return `/auth/sign-in${query ? `?${query}` : ""}`;
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

export async function signInWithPasswordAction(formData: FormData) {
  const values = signInWithPasswordSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? "/"
  });

  const next = sanitizeNextPath(values.next);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password
  });

  if (error) {
    redirect(
      buildAuthPageRedirect({
        mode: "password",
        next,
        email: values.email,
        error: error.message
      }) as never
    );
  }

  revalidatePath("/");
  redirect(next as never);
}

export async function signUpWithPasswordAction(formData: FormData) {
  const values = signUpSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirm_password"),
    next: formData.get("next") ?? "/"
  });

  const next = sanitizeNextPath(values.next);
  const origin = await getRequestOrigin();

  if (!origin) {
    throw new Error("Could not determine request origin for auth callback.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    redirect(
      buildAuthPageRedirect({
        mode: "signup",
        next,
        email: values.email,
        error: error.message
      }) as never
    );
  }

  const emailConfirmationRequired = !data.session;

  redirect(
    buildAuthPageRedirect({
      mode: "signup",
      next,
      email: values.email,
      notice: emailConfirmationRequired
        ? "Account created. Check your email to confirm your account."
        : "Account created. You can continue into Pocket Wardrobe now."
    }) as never
  );
}

export async function sendPasswordResetAction(formData: FormData) {
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
  const resetNext = `/auth/set-password?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(resetNext)}`
  });

  if (error) {
  redirect(
    buildAuthPageRedirect({
      mode: "reset",
      next,
      email: values.email,
      error: error.message
    }) as never
  );
  }

  redirect(
    buildAuthPageRedirect({
      mode: "reset",
      next,
      email: values.email,
      notice: "Password reset link sent. Check your email."
    }) as never
  );
}

export async function updatePasswordAction(formData: FormData) {
  const values = updatePasswordSchema.parse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirm_password"),
    next: formData.get("next") ?? "/"
  });

  const next = sanitizeNextPath(values.next);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: values.password
  });

  if (error) {
    redirect(
      `/auth/set-password?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}` as never
    );
  }

  revalidatePath("/");
  redirect(
    buildAuthPageRedirect({
      mode: "password",
      next,
      notice: "Password updated. You can now sign in with email and password."
    }) as never
  );
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
