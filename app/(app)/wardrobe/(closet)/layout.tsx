import { ClosetTabs } from "@/components/closet-tabs";

export default function ClosetLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen max-w-7xl flex-col px-6 py-6 md:px-8">
      <ClosetTabs />
      {children}
    </main>
  );
}
