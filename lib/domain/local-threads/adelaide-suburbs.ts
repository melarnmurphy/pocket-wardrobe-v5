/**
 * Local threads is "Adelaide-shaped" (DATA_MODEL.md) — a bounded, known
 * geography, so NearbyQuery.centre ("the user's suburb centroid, not their
 * device") can be resolved from a fixed suburb→lat/lng lookup instead of a
 * geocoding API. Coordinates are approximate public suburb centroids.
 */
export const ADELAIDE_SUBURBS = [
  { name: "adelaide", lat: -34.9285, lng: 138.6007 },
  { name: "north adelaide", lat: -34.9081, lng: 138.5942 },
  { name: "norwood", lat: -34.9203, lng: 138.6295 },
  { name: "unley", lat: -34.9497, lng: 138.6062 },
  { name: "glenelg", lat: -34.9805, lng: 138.5183 },
  { name: "prospect", lat: -34.8814, lng: 138.5942 },
  { name: "burnside", lat: -34.9328, lng: 138.6428 },
  { name: "walkerville", lat: -34.8994, lng: 138.6103 },
  { name: "west lakes", lat: -34.8686, lng: 138.5028 },
  { name: "henley beach", lat: -34.9161, lng: 138.4956 },
  { name: "mawson lakes", lat: -34.8083, lng: 138.6161 },
  { name: "modbury", lat: -34.8306, lng: 138.6842 },
  { name: "marion", lat: -35.0092, lng: 138.5586 },
  { name: "brighton", lat: -35.0161, lng: 138.5217 },
  { name: "mitcham", lat: -34.9781, lng: 138.6194 },
  { name: "st peters", lat: -34.9042, lng: 138.6153 },
  { name: "campbelltown", lat: -34.8969, lng: 138.6614 },
  { name: "port adelaide", lat: -34.8464, lng: 138.5031 },
  { name: "semaphore", lat: -34.8386, lng: 138.4886 },
  { name: "hindmarsh", lat: -34.9067, lng: 138.5722 }
] as const;

export type AdelaideSuburb = (typeof ADELAIDE_SUBURBS)[number]["name"];

export function resolveSuburbCentroid(suburb: string | null): { lat: number; lng: number } | null {
  if (!suburb) return null;
  const normalised = suburb.trim().toLowerCase();
  const match = ADELAIDE_SUBURBS.find((entry) => entry.name === normalised);
  return match ? { lat: match.lat, lng: match.lng } : null;
}
