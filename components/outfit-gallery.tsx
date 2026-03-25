import type { OutfitWithItems } from "@/lib/domain/outfits";

interface OutfitGalleryProps {
  outfits: OutfitWithItems[];
}

function thumbnailSlots(items: OutfitWithItems["items"]): Array<OutfitWithItems["items"][number] | null> {
  // Slot order: top/dress → bottom → outerwear/shoes → remaining
  const priority: Array<string[]> = [
    ["top", "dress"],
    ["bottom"],
    ["outerwear", "shoes"],
    ["accessory", "bag", "jewellery", "other"]
  ];
  return priority.map(roles => items.find(i => roles.includes(i.role)) ?? null);
}

export function OutfitGallery({ outfits }: OutfitGalleryProps) {
  if (outfits.length === 0) {
    return (
      <p className="rounded-[1.25rem] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">
        No saved outfits yet. Generate your first outfit above.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {outfits.map(outfit => {
        const slots = thumbnailSlots(outfit.items);
        return (
          <article
            key={outfit.id}
            className="rounded-[1.4rem] border border-[var(--line)] bg-white overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-0.5 bg-[var(--surface)] p-3">
              {slots.map((item, i) =>
                item ? (
                  <div
                    key={item.id}
                    className="aspect-square rounded-[0.6rem] bg-[var(--line)] overflow-hidden"
                  >
                    {item.garment.preview_url ? (
                      <img
                        src={item.garment.preview_url}
                        alt={item.garment.title ?? item.garment.category}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-content-center" />
                    )}
                  </div>
                ) : (
                  <div key={i} className="aspect-square rounded-[0.6rem] bg-[var(--surface)]" />
                )
              )}
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-1">
                {outfit.title ?? "Outfit"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {outfit.items.length} item{outfit.items.length !== 1 ? "s" : ""} ·{" "}
                {new Date(outfit.created_at ?? "").toLocaleDateString()}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
