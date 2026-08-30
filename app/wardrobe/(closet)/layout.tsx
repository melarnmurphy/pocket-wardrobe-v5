import { ClosetTabs } from "@/components/closet-tabs";

export default function ClosetLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="pw-shell flex min-h-screen max-w-7xl flex-col md:px-10">
      <ClosetTabs />
      {children}
    </main>
  );
}
