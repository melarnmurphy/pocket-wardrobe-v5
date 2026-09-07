import { redirect } from "next/navigation";

export default async function LegacySignInPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string") query.set(key, value);
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
  });

  redirect(`/sign-in${query.toString() ? `?${query.toString()}` : ""}` as never);
}
