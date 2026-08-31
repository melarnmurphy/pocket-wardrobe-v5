export function isRoleCompleteOutfit(garments: { role: string }[]): boolean {
  const roles = new Set(garments.map((garment) => garment.role));
  if (roles.has("dress") && roles.has("shoes")) return true;
  return roles.has("top") && roles.has("bottom") && roles.has("shoes");
}
