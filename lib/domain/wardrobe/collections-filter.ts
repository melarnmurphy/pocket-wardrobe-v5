export type CollectionFilterEntry = { id: string; garmentIds: string[] };

/**
 * 18c / w6a — the wardrobe grid's collection filter chips: does this garment
 * belong to the selected collection? Pulled out as a pure function so the
 * grid's client-side filtering (which already handles search/sort/etc. the
 * same way) can add collection membership without a full component render.
 */
export function garmentInCollection(
  garmentId: string,
  collectionId: string,
  collections: CollectionFilterEntry[]
): boolean {
  const collection = collections.find((entry) => entry.id === collectionId);
  if (!collection) return false;
  return collection.garmentIds.includes(garmentId);
}
