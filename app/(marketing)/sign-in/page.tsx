import type { Metadata } from "next";
import SignInForm from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in · Garderobe",
  description: "Sign in to your Garderobe wardrobe."
};

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{
    next?: string;
    mode?: string;
    email?: string;
    name?: string;
    dateOfBirth?: string;
    location?: string;
    error?: string;
    errorSource?: string;
    notice?: string;
    resetSent?: string;
    duplicate?: string;
  }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : "/onboarding";

  return (
    <SignInForm
      next={next}
      initialMode={params.mode === "signup" ? "create" : "signin"}
      resetMode={params.mode === "reset"}
      email={params.email ?? ""}
      name={params.name ?? ""}
      dateOfBirth={params.dateOfBirth ?? ""}
      location={params.location ?? ""}
      error={params.error}
      errorSource={params.errorSource}
      notice={params.notice}
      resetSent={params.resetSent === "1"}
      duplicate={params.duplicate === "1"}
    />
  );
}
