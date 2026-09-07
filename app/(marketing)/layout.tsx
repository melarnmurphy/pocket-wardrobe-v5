/**
 * Marketing routes stay out of AtelierShell so `/` does not await auth
 * cookies or stream `app/loading.tsx` on hard refresh.
 */
export const dynamic = "force-static";

export default function MarketingLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
