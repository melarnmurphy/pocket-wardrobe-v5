import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { getDashboardStats, getRecentGarments } from "@/lib/domain/wardrobe/service";
import { createClient } from "@/lib/supabase/server";
import UploadCard from "@/app/components/upload-card";

export default async function HomePage() {
  const user = await getOptionalUser();
  if (!user) redirect("/wardrobe");

  const [stats, recentGarments] = await Promise.all([
    getDashboardStats(),
    getRecentGarments(6),
  ]);

  // Generate signed URLs for thumbnails
  const supabase = await createClient();
  const garmentThumbnails = await Promise.all(
    recentGarments.map(async (g) => {
      if (!g.storagePath) return { ...g, imageUrl: null };
      const { data } = await supabase.storage
        .from("garment-originals")
        .createSignedUrl(g.storagePath, 60 * 60); // 1 hour
      return { ...g, imageUrl: data?.signedUrl ?? null };
    })
  );

  const hasDrafts = stats.pendingDraftsCount > 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Stats row */}
      <div className="mb-4 grid grid-cols-[1fr_1fr_1fr_1.6fr] gap-3">
        {/* Wardrobe */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#999]">Wardrobe</p>
          <p className="mt-1.5 text-[28px] font-bold text-[#1a1a1a]">{stats.garmentCount}</p>
          <p className="mt-0.5 text-[11px] text-[#999]">items</p>
        </div>

        {/* Favourites */}
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#999]">Favourites</p>
          <p className="mt-1.5 text-[28px] font-bold text-[#1a1a1a]">{stats.favouritesCount}</p>
          <p className="mt-0.5 text-[11px] text-[#999]">items</p>
        </div>

        {/* Drafts */}
        {hasDrafts ? (
          <Link
            href="/wardrobe/review"
            className="rounded-2xl border border-[#e8d8c8] bg-[#fff8f0] p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#c17a3a]">Drafts</p>
            <p className="mt-1.5 text-[28px] font-bold text-[#c17a3a]">{stats.pendingDraftsCount}</p>
            <p className="mt-0.5 text-[11px] text-[#c17a3a]">ready to review →</p>
          </Link>
        ) : (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#999]">Drafts</p>
            <p className="mt-1.5 text-[28px] font-bold text-[#1a1a1a]">0</p>
            <p className="mt-0.5 text-[11px] text-[#999]">items</p>
          </div>
        )}

        {/* Upload card */}
        <UploadCard />
      </div>

      {/* Recent additions */}
      <div className="rounded-[20px] border border-[var(--line)] bg-white p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold">Recent additions</p>
          <Link href="/wardrobe" className="text-[12px] text-[#c17a3a]">
            View all →
          </Link>
        </div>

        {garmentThumbnails.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#999]">
            No garments yet — upload a photo to get started.
          </p>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {garmentThumbnails.map((g) =>
              g.imageUrl ? (
                <Link
                  key={g.id}
                  href="/wardrobe"
                  className="aspect-[3/4] overflow-hidden rounded-[10px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.imageUrl}
                    alt={g.title ?? g.category}
                    className="h-full w-full object-cover"
                  />
                </Link>
              ) : (
                <div
                  key={g.id}
                  className="aspect-[3/4] rounded-[10px] bg-[#e8e0d8]"
                  title={g.title ?? g.category}
                />
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}
