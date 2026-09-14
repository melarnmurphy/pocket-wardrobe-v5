import type { Metadata } from "next";
import SignInForm from "../sign-in/sign-in-form";

export const metadata: Metadata = {
  title: "Create account · Garderobe",
  description: "Create your Garderobe wardrobe."
};

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{
    next?: string;
    email?: string;
    name?: string;
    dateOfBirth?: string;
    location?: string;
    error?: string;
    errorSource?: string;
    notice?: string;
    duplicate?: string;
  }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : "/onboarding";

  return (
    <SignInForm
      next={next}
      initialMode="create"
      resetMode={false}
      email={params.email ?? ""}
      name={params.name ?? ""}
      dateOfBirth={params.dateOfBirth ?? ""}
      location={params.location ?? ""}
      error={params.error}
      errorSource={params.errorSource}
      notice={params.notice}
      resetSent={false}
      duplicate={params.duplicate === "1"}
    />
  );
}
