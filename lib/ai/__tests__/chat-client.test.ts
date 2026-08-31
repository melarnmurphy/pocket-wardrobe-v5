import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENROUTER_CHAT_MODEL,
  createChatModelClient,
  resolveChatModel
} from "../chat-client";

describe("createChatModelClient", () => {
  it("uses discounted Solar Pro 4 on OpenRouter by default", () => {
    expect(
      resolveChatModel({
        OPENAI_API_KEY: "sk-test",
        OPENROUTER_API_KEY: "or-key"
      })
    ).toBe(DEFAULT_OPENROUTER_CHAT_MODEL);
    expect(DEFAULT_OPENROUTER_CHAT_MODEL).toBe("upstage/solar-pro4");

    const chat = createChatModelClient({
      OPENAI_API_KEY: "sk-test",
      OPENROUTER_API_KEY: "or-key"
    });
    expect(chat.provider).toBe("openrouter");
    expect(chat.model).toBe("upstage/solar-pro4");
    expect(chat.client.baseURL).toContain("openrouter.ai");
  });

  it("honours OPENROUTER_CHAT_MODEL when set", () => {
    expect(
      resolveChatModel({
        OPENAI_API_KEY: "sk-test",
        OPENROUTER_API_KEY: "or-key",
        OPENROUTER_CHAT_MODEL: "qwen/qwen3-30b-a3b-instruct-2507"
      })
    ).toBe("qwen/qwen3-30b-a3b-instruct-2507");
  });

  it("falls back to OpenAI gpt-4o-mini without an OpenRouter key", () => {
    const chat = createChatModelClient({ OPENAI_API_KEY: "sk-test" });
    expect(chat.provider).toBe("openai");
    expect(chat.model).toBe("gpt-4o-mini");
  });
});
