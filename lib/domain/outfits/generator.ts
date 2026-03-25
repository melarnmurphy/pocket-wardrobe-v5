import type { OutfitItemRole } from "@/lib/domain/outfits";

const ROLE_KEYWORDS: Array<[OutfitItemRole, string[]]> = [
  ["dress",     ["dress", "jumpsuit", "playsuit"]],
  ["top",       ["shirt", "blouse", "top", "tee", "t-shirt", "knitwear", "jumper", "sweater", "cardigan", "turtleneck", "tank", "bodysuit", "crop"]],
  ["bottom",    ["trouser", "jean", "skirt", "short", "chino", "legging", "pant"]],
  ["outerwear", ["coat", "jacket", "blazer", "waistcoat", "vest", "puffer", "trench", "anorak", "mac"]],
  ["shoes",     ["shoe", "boot", "trainer", "sandal", "loafer", "heel", "flat", "mule", "sneaker"]],
  ["bag",       ["bag", "handbag", "clutch", "tote", "backpack", "purse"]],
  ["accessory", ["scarf", "belt", "hat", "cap", "glove", "sunglasses", "tie", "watch"]],
  ["jewellery", ["necklace", "ring", "earring", "bracelet", "pendant", "chain"]],
];

export function categoryToRole(category: string): OutfitItemRole {
  const lower = category.toLowerCase();
  for (const [role, keywords] of ROLE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return role;
  }
  return "other";
}
