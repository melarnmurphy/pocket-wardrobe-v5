import sharp from "sharp";
import {
  canonicalWardrobeColours,
  type WardrobeColourFamily
} from "@/lib/domain/wardrobe/colours";

type AnalyseImageColoursResult = {
  dominantHex: string | null;
  inferredFamily: WardrobeColourFamily | null;
  lightnessBand: "low" | "medium" | "high" | null;
  relativeLuminance: number | null;
};

function toHex(channel: number) {
  return Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");
}

function getRelativeLuminance(r: number, g: number, b: number) {
  const linear = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function inferLightnessBand(luminance: number | null) {
  if (luminance === null) {
    return null;
  }

  if (luminance < 0.14) {
    return "low" as const;
  }

  if (luminance > 0.55) {
    return "high" as const;
  }

  return "medium" as const;
}

function inferClosestWardrobeColour(r: number, g: number, b: number) {
  let bestFamily: WardrobeColourFamily | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const colour of canonicalWardrobeColours) {
    const distance = Math.sqrt(
      ((colour.rgb_r ?? 0) - r) ** 2 +
      ((colour.rgb_g ?? 0) - g) ** 2 +
      ((colour.rgb_b ?? 0) - b) ** 2
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestFamily = colour.family;
    }
  }

  return bestFamily;
}

export async function buildFeatureDerivative(params: {
  sourceBuffer: Buffer;
  contentType?: string | null;
  cropBox?: [number, number, number, number] | null;
}) {
  let image = sharp(params.sourceBuffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();

  if (params.cropBox && metadata.width && metadata.height) {
    const [x1, y1, x2, y2] = params.cropBox;
    const left = Math.max(0, Math.min(metadata.width - 1, x1));
    const top = Math.max(0, Math.min(metadata.height - 1, y1));
    const width = Math.max(1, Math.min(metadata.width - left, x2 - x1));
    const height = Math.max(1, Math.min(metadata.height - top, y2 - y1));

    image = image.extract({ left, top, width, height });
  }

  const trimmed = image.trim().flatten({ background: "#ffffff" });
  const derivativeBuffer = await trimmed
    .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  const derivativeMetadata = await sharp(derivativeBuffer).metadata();

  return {
    buffer: derivativeBuffer,
    width: derivativeMetadata.width ?? null,
    height: derivativeMetadata.height ?? null,
    contentType: "image/jpeg"
  };
}

export async function analyseImageColours(sourceBuffer: Buffer): Promise<AnalyseImageColoursResult> {
  const stats = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(320, 320, { fit: "inside", withoutEnlargement: true })
    .stats();

  const [red, green, blue] = stats.channels;

  if (!red || !green || !blue) {
    return {
      dominantHex: null,
      inferredFamily: null,
      lightnessBand: null,
      relativeLuminance: null
    };
  }

  const r = red.mean;
  const g = green.mean;
  const b = blue.mean;
  const relativeLuminance = getRelativeLuminance(r, g, b);

  return {
    dominantHex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
    inferredFamily: inferClosestWardrobeColour(r, g, b),
    lightnessBand: inferLightnessBand(relativeLuminance),
    relativeLuminance
  };
}
