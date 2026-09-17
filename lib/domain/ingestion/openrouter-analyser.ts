import OpenAI from "openai";
import { z } from "zod";

const openRouterGarmentSchema = z.object({
  title: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  colour: z.string().min(1).max(80),
  material: z.string().max(120),
  style: z.string().max(120),
  confidence: z.number().min(0).max(1),
  role: z.string().max(40),
  notes: z.string().max(240)
});

const openRouterResponseSchema = z.object({
  garments: z.array(openRouterGarmentSchema).max(12)
});

export type OpenRouterGarmentResult = z.infer<typeof openRouterGarmentSchema>;
export type OpenRouterAnalyzeResponse = z.infer<typeof openRouterResponseSchema>;

const OPENROUTER_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_INGESTION_MODEL = "google/gemma-4-26b-a4b";
export const DEFAULT_OPENROUTER_INGESTION_FALLBACK_MODEL = "qwen/qwen3.7-flash";

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "garment_detection",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        garments: {
          type: "array",
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              category: { type: "string" },
              colour: { type: "string" },
              material: { type: "string" },
              style: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              role: { type: "string" },
              notes: { type: "string" }
            },
            required: ["title", "category", "colour", "material", "style", "confidence", "role", "notes"]
          }
        }
      },
      required: ["garments"]
    }
  }
} as const;

export async function analyzePhotoWithOpenRouter(params: {
  apiKey: string;
  imageUrl: string;
  model?: string;
  fallbackModel?: string;
}): Promise<OpenRouterAnalyzeResponse> {
  const client = new OpenAI({
    apiKey: params.apiKey,
    baseURL: OPENROUTER_URL,
    timeout: 25_000,
    defaultHeaders: {
      "HTTP-Referer": "https://fashionapp5.vercel.app",
      "X-Title": "Garderobe"
    }
  });

  const request = {
    model: params.model ?? DEFAULT_OPENROUTER_INGESTION_MODEL,
    models: [
      params.model ?? DEFAULT_OPENROUTER_INGESTION_MODEL,
      params.fallbackModel ?? DEFAULT_OPENROUTER_INGESTION_FALLBACK_MODEL
    ],
    temperature: 0,
    max_tokens: 1200,
    provider: {
      zdr: true,
      data_collection: "deny"
    },
    response_format: responseFormat,
    messages: [
      {
        role: "system",
        content:
          "You identify visible clothing and accessories for a wardrobe app. Only report items clearly visible in the image. Never invent brand, fabric, colour, or garments hidden by the crop. If no garment is visible, return an empty garments array. Use plain lowercase category and colour names. Confidence must reflect visual certainty."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Identify each distinct garment or accessory in this photo. For a person wearing an outfit, list the distinct visible pieces rather than the person. Keep notes short and useful for a human review."
          },
          { type: "image_url", image_url: { url: params.imageUrl } }
        ]
      }
    ]
  } as never;

  const response = await client.chat.completions.create(request);

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no garment analysis.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenRouter returned invalid garment analysis.");
  }

  return openRouterResponseSchema.parse(parsed);
}
