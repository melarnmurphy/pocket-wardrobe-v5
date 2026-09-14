"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import { mapMagicLinkError, mapSignInPasswordError } from "@/lib/domain/auth/sign-in-errors";
import { isDuplicateAccountMessage, looksLikeExistingAccount } from "@/lib/domain/auth/duplicate-signup";

const signInSchema = z.object({
  email: z.string().trim().email(),
  next: z.string().trim().min(1).default("/")
});

const signInWithPasswordSchema = signInSchema.extend({
  password: z.string().min(1)
});

const signUpSchema = signInSchema
  .extend({
    name: z.string().trim().min(1, "Enter your name.").max(80),
    dateOfBirth: z.string().trim().date("Enter a valid date of birth."),
    location: z.string().trim().min(1, "Enter your location.").max(120),
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
  return `/sign-in${query ? `?${query}` : ""}`;
}

function redirectMagicLinkError(next: string, email: string, error: string) {
  redirect(
    buildAuthPageRedirect({
      next,
      email,
      error,
      errorSource: "magic-link"
    }) as never
  );
}

export async function signInWithMagicLinkAction(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? "/"
  });

  const fallbackNext = sanitizeNextPath(String(formData.get("next") ?? "/"));
  const fallbackEmail = String(formData.get("email") ?? "");

  if (!parsed.success) {
    redirectMagicLinkError(
      fallbackNext,
      fallbackEmail,
      parsed.error.issues[0]?.message ?? "Enter a valid email."
    );
    return;
  }

  const values = parsed.data;
  const next = sanitizeNextPath(values.next);

  try {
    await checkRateLimit("magic-link", 5, 600, { failClosed: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirectMagicLinkError(next, values.email, error.message);
    }
    throw error;
  }

  const origin = await getRequestOrigin();

  if (!origin) {
    redirectMagicLinkError(next, values.email, "Could not determine the sign-in return URL. Refresh and try again.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: values.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    redirectMagicLinkError(next, values.email, mapMagicLinkError(error.message));
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

  try {
    await checkRateLimit("sign-in-password", 10, 60, { failClosed: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirect(
        buildAuthPageRedirect({
          mode: "password",
          next,
          email: values.email,
          error: error.message,
          errorSource: "password"
        }) as never
      );
    }
    throw error;
  }

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
        error: mapSignInPasswordError(error.message),
        errorSource: "password"
      }) as never
    );
  }

  revalidatePath("/");
  redirect(next as never);
}

export async function signUpWithPasswordAction(formData: FormData) {
  const rawValues = {
    email: formData.get("email"),
    name: formData.get("name"),
    dateOfBirth: formData.get("date_of_birth"),
    location: formData.get("location"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirm_password"),
    next: formData.get("next") ?? "/"
  };
  const parsed = signUpSchema.safeParse(rawValues);
  if (!parsed.success) {
    redirect(
      buildAuthPageRedirect({
        mode: "signup",
        next: sanitizeNextPath(String(rawValues.next)),
        email: typeof rawValues.email === "string" ? rawValues.email : "",
        error: parsed.error.issues[0]?.message ?? "Check the account details and try again.",
        errorSource: "signup"
      }) as never
    );
  }
  const values = parsed.data;

  const next = sanitizeNextPath(values.next);

  try {
    // Sign-up is a low-frequency path. Keep the guard, but allow normal retry behavior
    // so a tester does not get blocked by a couple of failed attempts.
    // Rate limiting is protective infrastructure, not a dependency required
    // to create an account. If the hosted limiter is unavailable, preserve
    // signup and let the service log the outage rather than throwing a 500.
    await checkRateLimit("sign-up", 10, 3600, { failClosed: false });
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirect(
        buildAuthPageRedirect({
          mode: "signup",
          next,
          email: values.email,
          error: error.message,
          errorSource: "signup"
        }) as never
      );
    }
    throw error;
  }

  const origin = await getRequestOrigin();

  if (!origin) {
    throw new Error("Could not determine request origin for auth callback.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        local_name: values.name,
        suburb: values.location,
        date_of_birth: values.dateOfBirth
      },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    if (isDuplicateAccountMessage(error.message)) {
      redirect(
        buildAuthPageRedirect({ mode: "signup", next, email: values.email, duplicate: "1" }) as never
      );
    }
    redirect(
      buildAuthPageRedirect({
        mode: "signup",
        next,
        email: values.email,
        error: error.message,
        errorSource: "signup"
      }) as never
    );
  }

  if (looksLikeExistingAccount(data.user)) {
    redirect(
      buildAuthPageRedirect({ mode: "signup", next, email: values.email, duplicate: "1" }) as never
    );
  }

  if (data.session && data.user) {
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        user_id: data.user.id,
        local_name: values.name,
        suburb: values.location
      } as never,
      { onConflict: "user_id" }
    );

    if (profileError) {
      throw new Error(profileError.message);
    }

    revalidatePath("/");
    redirect(next as never);
  }

  const emailConfirmationRequired = !data.session;

  if (emailConfirmationRequired) {
    redirect(`/auth/check-email?type=signup&email=${encodeURIComponent(values.email)}&next=${encodeURIComponent(next)}` as never);
  }

  redirect(buildAuthPageRedirect({
    mode: "signup",
    next,
    email: values.email,
    notice: "Account created. You can continue into Pocket Wardrobe now."
  }) as never);
}

export async function sendPasswordResetAction(formData: FormData) {
  const values = signInSchema.parse({
    email: formData.get("email"),
    next: formData.get("next") ?? "/"
  });

  const next = sanitizeNextPath(values.next);

  try {
    await checkRateLimit("password-reset", 3, 600, { failClosed: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirect(
        buildAuthPageRedirect({
          mode: "reset",
          next,
          email: values.email,
          error: error.message,
          errorSource: "reset"
        }) as never
      );
    }
    throw error;
  }

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
        error: error.message,
        errorSource: "reset"
      }) as never
    );
  }

  redirect(
    buildAuthPageRedirect({
      mode: "reset",
      next,
      email: values.email,
      resetSent: "1"
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
