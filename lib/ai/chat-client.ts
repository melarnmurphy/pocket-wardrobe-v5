import OpenAI from "openai";

/** OpenRouter discounted-models collection, Aug 2026. 90% off list. */
export const DEFAULT_OPENROUTER_CHAT_MODEL = "upstage/solar-pro4";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export type ChatClientEnv = {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_CHAT_MODEL?: string;
  OPENAI_API_KEY: string;
};

export type ChatModelClient = {
  client: OpenAI;
  model: string;
  provider: "openrouter" | "openai";
};

export function resolveChatModel(env: ChatClientEnv): string {
  if (env.OPENROUTER_API_KEY) {
    return env.OPENROUTER_CHAT_MODEL ?? DEFAULT_OPENROUTER_CHAT_MODEL;
  }
  return "gpt-4o-mini";
}

export function createChatModelClient(env: ChatClientEnv): ChatModelClient {
  if (env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      model: resolveChatModel(env),
      client: new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: OPENROUTER_BASE_URL,
        defaultHeaders: {
          "HTTP-Referer": "https://pocketwardrobe.app",
          "X-Title": "Pocket Wardrobe"
        }
      })
    };
  }

  return {
    provider: "openai",
    model: resolveChatModel(env),
    client: new OpenAI({ apiKey: env.OPENAI_API_KEY })
  };
}
