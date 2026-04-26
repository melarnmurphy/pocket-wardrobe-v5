import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import { GARMENT_CATEGORY_SUGGESTIONS } from "@/lib/domain/style-rules/templates";
import {
  colourFamilies,
  inferColourFamilyFromText,
  normalizeLooseText,
  normalizeRuleValue
} from "@/lib/domain/style-rules/knowledge/colours";
import { occasionProfiles } from "@/lib/domain/style-rules/knowledge/occasions";

type EmbeddingVector = number[];

export type SemanticSuggestionMatch = {
  input: string;
  resolved: string;
  method: "exact" | "semantic";
  score: number;
};

export type SupportedStyleRuleValueType =
  | "category"
  | "colour"
  | "colour_family"
  | "occasion"
  | "season";

export type SuggestionEmbeddingFn = (inputs: string[]) => Promise<EmbeddingVector[]>;

const DEFAULT_THRESHOLD = 0.62;
const suggestionEmbeddingCache = new Map<string, Promise<EmbeddingVector[]>>();
const OCCASION_ALIASES = new Map<string, string>([
  ["business casual", "business_casual"],
  ["biz casual", "business_casual"],
  ["office", "workwear"],
  ["work", "workwear"],
  ["smart casual", "smart_casual"],
  ["formal evening", "formal_evening"],
  ["black tie", "formal_evening"],
  ["gym", "active"],
  ["sport", "lifestyle_sport"],
  ["athleisure", "lifestyle_sport"],
  ["essentials", "wardrobe_essentials"]
]);
const SEASON_ALIASES = new Map<string, string>([
  ["fall", "autumn"],
  ["autumn", "autumn"],
  ["spring", "spring"],
  ["summer", "summer"],
  ["winter", "winter"],
  ["hot weather", "summer"],
  ["cold weather", "winter"]
]);

function normalizeFreeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cosineSimilarity(left: EmbeddingVector, right: EmbeddingVector): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

async function embedTexts(inputs: string[]): Promise<EmbeddingVector[]> {
  const env = getServerEnv();
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: inputs
  });

  return response.data.map((entry) => entry.embedding);
}

function getSuggestionCacheKey(suggestions: string[]): string {
  return suggestions.map(normalizeFreeText).join("|");
}

async function getCachedSuggestionEmbeddings(
  suggestions: string[],
  embed: SuggestionEmbeddingFn
): Promise<EmbeddingVector[]> {
  const cacheKey = getSuggestionCacheKey(suggestions);
  const cached = suggestionEmbeddingCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = embed(suggestions);
  suggestionEmbeddingCache.set(cacheKey, pending);

  try {
    return await pending;
  } catch (error) {
    suggestionEmbeddingCache.delete(cacheKey);
    throw error;
  }
}

export async function resolveSemanticSuggestion(params: {
  input: string;
  suggestions: string[];
  threshold?: number;
  embed?: SuggestionEmbeddingFn;
}): Promise<SemanticSuggestionMatch | null> {
  const normalizedInput = normalizeFreeText(params.input);
  if (!normalizedInput) {
    return null;
  }

  const suggestionsByNormalized = new Map(
    params.suggestions.map((suggestion) => [normalizeFreeText(suggestion), suggestion] as const)
  );

  const exactMatch = suggestionsByNormalized.get(normalizedInput);
  if (exactMatch) {
    return {
      input: params.input,
      resolved: exactMatch,
      method: "exact",
      score: 1
    };
  }

  const embed = params.embed ?? embedTexts;
  const threshold = params.threshold ?? DEFAULT_THRESHOLD;
  const queryEmbeddings = await embed([params.input]);
  const queryEmbedding = queryEmbeddings[0];

  if (!queryEmbedding) {
    return null;
  }

  const suggestionEmbeddings = await getCachedSuggestionEmbeddings(params.suggestions, embed);
  let bestSuggestion: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < params.suggestions.length; index += 1) {
    const suggestion = params.suggestions[index];
    const suggestionEmbedding = suggestionEmbeddings[index];
    if (!suggestionEmbedding) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, suggestionEmbedding);
    if (score > bestScore) {
      bestScore = score;
      bestSuggestion = suggestion;
    }
  }

  if (!bestSuggestion || bestScore < threshold) {
    return null;
  }

  return {
    input: params.input,
    resolved: bestSuggestion,
    method: "semantic",
    score: bestScore
  };
}

export async function resolveGarmentCategoryInput(
  input: string,
  options?: {
    threshold?: number;
    embed?: SuggestionEmbeddingFn;
  }
): Promise<SemanticSuggestionMatch | null> {
  return resolveSemanticSuggestion({
    input,
    suggestions: GARMENT_CATEGORY_SUGGESTIONS,
    threshold: options?.threshold,
    embed: options?.embed
  });
}

export async function resolveColourInput(
  input: string,
  options?: {
    threshold?: number;
    embed?: SuggestionEmbeddingFn;
  }
): Promise<SemanticSuggestionMatch | null> {
  const inferred = inferColourFamilyFromText(input);
  if (inferred) {
    return {
      input,
      resolved: inferred,
      method: "exact",
      score: 1
    };
  }

  return resolveSemanticSuggestion({
    input,
    suggestions: [...colourFamilies],
    threshold: options?.threshold,
    embed: options?.embed
  });
}

export async function resolveOccasionInput(
  input: string,
  options?: {
    threshold?: number;
    embed?: SuggestionEmbeddingFn;
  }
): Promise<SemanticSuggestionMatch | null> {
  const normalizedLoose = normalizeLooseText(input);
  const normalizedRule = normalizeRuleValue(input);
  const aliasMatch =
    OCCASION_ALIASES.get(normalizedLoose) ??
    OCCASION_ALIASES.get(normalizedRule.replaceAll("_", " "));

  if (aliasMatch) {
    return {
      input,
      resolved: aliasMatch,
      method: "exact",
      score: 1
    };
  }

  return resolveSemanticSuggestion({
    input,
    suggestions: [...occasionProfiles],
    threshold: options?.threshold,
    embed: options?.embed
  });
}

export async function resolveSeasonInput(
  input: string,
  options?: {
    threshold?: number;
    embed?: SuggestionEmbeddingFn;
  }
): Promise<SemanticSuggestionMatch | null> {
  const normalizedLoose = normalizeLooseText(input);
  const normalizedRule = normalizeRuleValue(input);
  const aliasMatch =
    SEASON_ALIASES.get(normalizedLoose) ??
    SEASON_ALIASES.get(normalizedRule.replaceAll("_", " "));

  if (aliasMatch) {
    return {
      input,
      resolved: aliasMatch,
      method: "exact",
      score: 1
    };
  }

  return resolveSemanticSuggestion({
    input,
    suggestions: ["spring", "summer", "autumn", "winter"],
    threshold: options?.threshold,
    embed: options?.embed
  });
}

export async function resolveStyleRuleValue(params: {
  type: SupportedStyleRuleValueType;
  input: string;
  threshold?: number;
  embed?: SuggestionEmbeddingFn;
}): Promise<SemanticSuggestionMatch | null> {
  switch (params.type) {
    case "category":
      return resolveGarmentCategoryInput(params.input, params);
    case "colour":
    case "colour_family":
      return resolveColourInput(params.input, params);
    case "occasion":
      return resolveOccasionInput(params.input, params);
    case "season":
      return resolveSeasonInput(params.input, params);
    default:
      return null;
  }
}
