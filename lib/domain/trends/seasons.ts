// lib/domain/trends/seasons.ts

export interface SeasonYear {
  season: string; // e.g. "SS26", "AW27"
  year: number;   // e.g. 2026
}

// Regex patterns — explicit always beats inferred
const EXPLICIT_PATTERNS: Array<{ re: RegExp; parse: (m: RegExpMatchArray) => SeasonYear | null }> = [
  {
    // SS26, AW25, FW26
    re: /\b(SS|AW|FW|PF|RE)\s*(\d{2})\b/gi,
    parse: (m) => {
      const prefix = m[1].toUpperCase();
      const yr = parseInt(m[2], 10) + 2000;
      const season = prefix === "FW" ? "AW" : prefix;
      return { season: `${season}${m[2]}`, year: yr };
    }
  },
  {
    // Spring/Summer 2026, Fall/Winter 2025, Autumn/Winter 2026
    re: /\b(spring[\s/]*summer|fall[\s/]*winter|autumn[\s/]*winter|pre[- ]fall|resort)\s+(\d{4})\b/gi,
    parse: (m) => {
      const label = m[1].toLowerCase();
      const yr = parseInt(m[2], 10);
      const twoDigit = String(yr).slice(2);
      if (label.includes("spring") || label.includes("summer")) return { season: `SS${twoDigit}`, year: yr };
      if (label.includes("fall") || label.includes("winter") || label.includes("autumn")) return { season: `AW${twoDigit}`, year: yr };
      if (label.includes("pre") || label.includes("resort")) return { season: `PF${twoDigit}`, year: yr };
      return null;
    }
  },
  {
    // Spring 2026, Fall 2025, Summer 2026, Winter 2025
    re: /\b(spring|fall|autumn|summer|winter)\s+(\d{4})\b/gi,
    parse: (m) => {
      const label = m[1].toLowerCase();
      const yr = parseInt(m[2], 10);
      const twoDigit = String(yr).slice(2);
      if (label === "spring" || label === "summer") return { season: `SS${twoDigit}`, year: yr };
      return { season: `AW${twoDigit}`, year: yr };
    }
  }
];

export function extractSeasonFromText(text: string): SeasonYear | null {
  for (const { re, parse } of EXPLICIT_PATTERNS) {
    re.lastIndex = 0;
    const match = re.exec(text);
    if (match) {
      const result = parse(match);
      if (result) return result;
    }
  }
  return null;
}

export function inferSeasonFromDate(publishDate: string | null): SeasonYear | null {
  if (!publishDate) return null;
  const d = new Date(publishDate);
  if (isNaN(d.getTime())) return null;
  const month = d.getMonth() + 1; // 1-12
  const yr = d.getFullYear();
  const twoDigit = String(yr).slice(2);
  // Jan–Jun → SS; Jul–Dec → AW
  const season = month <= 6 ? `SS${twoDigit}` : `AW${twoDigit}`;
  return { season, year: yr };
}

/** Explicit text extraction beats date inference. */
export function resolveSeasonYear(text: string, publishDate: string | null): SeasonYear | null {
  return extractSeasonFromText(text) ?? inferSeasonFromDate(publishDate);
}
