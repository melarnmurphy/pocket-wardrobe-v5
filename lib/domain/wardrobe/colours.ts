import type { TablesInsert } from "@/types/database";

export const canonicalWardrobeColours = [
  {
    family: "black",
    hex: "#1b1918",
    rgb_r: 27,
    rgb_g: 25,
    rgb_b: 24,
    undertone: "neutral",
    saturation_band: "low",
    lightness_band: "low",
    neutral_flag: true
  },
  {
    family: "white",
    hex: "#f6f2ea",
    rgb_r: 246,
    rgb_g: 242,
    rgb_b: 234,
    undertone: "neutral",
    saturation_band: "low",
    lightness_band: "high",
    neutral_flag: true
  },
  {
    family: "grey",
    hex: "#8a8580",
    rgb_r: 138,
    rgb_g: 133,
    rgb_b: 128,
    undertone: "neutral",
    saturation_band: "low",
    lightness_band: "medium",
    neutral_flag: true
  },
  {
    family: "blue",
    hex: "#3857a6",
    rgb_r: 56,
    rgb_g: 87,
    rgb_b: 166,
    undertone: "cool",
    saturation_band: "medium",
    lightness_band: "medium",
    neutral_flag: false
  },
  {
    family: "red",
    hex: "#a13d3a",
    rgb_r: 161,
    rgb_g: 61,
    rgb_b: 58,
    undertone: "warm",
    saturation_band: "medium",
    lightness_band: "medium",
    neutral_flag: false
  },
  {
    family: "green",
    hex: "#6d8266",
    rgb_r: 109,
    rgb_g: 130,
    rgb_b: 102,
    undertone: "neutral",
    saturation_band: "low",
    lightness_band: "medium",
    neutral_flag: false
  },
  {
    family: "yellow",
    hex: "#d6b449",
    rgb_r: 214,
    rgb_g: 180,
    rgb_b: 73,
    undertone: "warm",
    saturation_band: "medium",
    lightness_band: "high",
    neutral_flag: false
  },
  {
    family: "orange",
    hex: "#c76f3b",
    rgb_r: 199,
    rgb_g: 111,
    rgb_b: 59,
    undertone: "warm",
    saturation_band: "high",
    lightness_band: "medium",
    neutral_flag: false
  },
  {
    family: "purple",
    hex: "#7661a8",
    rgb_r: 118,
    rgb_g: 97,
    rgb_b: 168,
    undertone: "cool",
    saturation_band: "medium",
    lightness_band: "medium",
    neutral_flag: false
  },
  {
    family: "pink",
    hex: "#d495ac",
    rgb_r: 212,
    rgb_g: 149,
    rgb_b: 172,
    undertone: "warm",
    saturation_band: "low",
    lightness_band: "high",
    neutral_flag: false
  },
  {
    family: "brown",
    hex: "#8b6349",
    rgb_r: 139,
    rgb_g: 99,
    rgb_b: 73,
    undertone: "warm",
    saturation_band: "low",
    lightness_band: "medium",
    neutral_flag: true
  },
  {
    family: "beige",
    hex: "#d7c1a1",
    rgb_r: 215,
    rgb_g: 193,
    rgb_b: 161,
    undertone: "warm",
    saturation_band: "low",
    lightness_band: "high",
    neutral_flag: true
  }
] as const satisfies TablesInsert<"colours">[];

export type WardrobeColourFamily = (typeof canonicalWardrobeColours)[number]["family"];

export function getCanonicalWardrobeColour(family: string | null | undefined) {
  const normalized = (family ?? "").trim().toLowerCase();
  return canonicalWardrobeColours.find((colour) => colour.family === normalized) ?? null;
}
