import { AppToastHost } from "@/components/app-toast-host";
import { AtelierShell } from "@/components/atelier-shell";

export default function AppGroupLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AtelierShell>{children}</AtelierShell>
      <AppToastHost />
    </>
  );
}
