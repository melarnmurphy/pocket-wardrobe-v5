import { describe, it, expect } from "vitest";
import { chunkIds, POSTGREST_IN_CHUNK } from "../query-chunks";

describe("chunkIds", () => {
  it("returns no chunks for an empty list", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("keeps a short list as a single chunk", () => {
    expect(chunkIds(["a", "b"])).toEqual([["a", "b"]]);
  });

  it("splits a PostgREST-sized id list so the in-filter stays under the URL limit", () => {
    const ids = Array.from({ length: 1000 }, (_, index) => `id-${index}`);
    const chunks = chunkIds(ids);
    expect(chunks).toHaveLength(Math.ceil(1000 / POSTGREST_IN_CHUNK));
    expect(chunks.every((chunk) => chunk.length <= POSTGREST_IN_CHUNK)).toBe(true);
    expect(chunks.flat()).toEqual(ids);
  });
});
