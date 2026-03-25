import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock scaffold ---
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn().mockReturnValue({ from: mockFrom })
}));

vi.mock("../content", () => ({
  fetchArticleContent: vi.fn().mockResolvedValue("")
}));

// Chain setup helpers
function chainSelect(result: { data: unknown; error: unknown }) {
  mockEq.mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue(result) });
  mockSelect.mockReturnValue({ eq: mockEq });
}

function chainInsertSelect(result: { data: unknown; error: unknown }) {
  mockSingle.mockResolvedValue(result);
  mockSelect.mockReturnValue({ single: mockSingle });
  mockInsert.mockReturnValue({ select: mockSelect });
}

function chainUpdate(result: { error: unknown }) {
  mockEq.mockReturnValue(result);
  mockUpdate.mockReturnValue({ eq: mockEq });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: mockEq
  });
});

// --- Adapter stub ---
const stubAdapter = {
  sourceName: "TestSource",
  sourceType: "fashion_publication",
  feedUrl: "https://example.com/rss",
  baseAuthorityScore: 0.8,
  parseEntry: (entry: { title: string; link: string; description: string | null; author: string | null; pubDate: string | null; categories: string[] }) => ({
    source_name: "TestSource",
    source_type: "fashion_publication",
    source_url: entry.link,
    title: entry.title,
    publish_date: null,
    author: entry.author,
    region: null,
    season: null,
    raw_text_excerpt: entry.description,
    authority_score: 0.8
  })
};

// Mock fetchRSSEntries
vi.mock("../adapters/rss", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../adapters/rss")>();
  return {
    ...actual,
    fetchRSSEntries: vi.fn()
  };
});

describe("runSourceIngestion", () => {
  it("inserts new source and queues extraction job when URL is not already stored", async () => {
    const { fetchRSSEntries } = await import("../adapters/rss");
    vi.mocked(fetchRSSEntries).mockResolvedValue([
      { title: "Spring Trends 2026", link: "https://example.com/spring-2026", description: "Beige is back.", author: "Editor", pubDate: null, categories: ["fashion"] }
    ]);

    // Job insert (source_ingestion job)
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "job-1" }, error: null }) }) })
    });

    // Dedup check: no existing source
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) })
    });

    // Source insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "src-1" }, error: null }) }) })
    });

    // Extraction job insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null })
    });

    // Job update (succeeded)
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    });

    const { runSourceIngestion } = await import("../ingestion");
    const result = await runSourceIngestion(stubAdapter);

    expect(result.newSourceCount).toBe(1);
    expect(result.queuedJobCount).toBe(1);
  });

  it("skips source when URL already exists in trend_sources", async () => {
    const { fetchRSSEntries } = await import("../adapters/rss");
    vi.mocked(fetchRSSEntries).mockResolvedValue([
      { title: "Spring Trends 2026", link: "https://example.com/spring-2026", description: null, author: null, pubDate: null, categories: [] }
    ]);

    // Job insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "job-2" }, error: null }) }) })
    });

    // Dedup check: existing source found
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "src-existing" }, error: null }) }) })
    });

    // Job update (succeeded)
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    });

    const { runSourceIngestion } = await import("../ingestion");
    const result = await runSourceIngestion(stubAdapter);

    expect(result.newSourceCount).toBe(0);
    expect(result.queuedJobCount).toBe(0);
  });

  it("silently skips on unique constraint violation (race condition)", async () => {
    const { fetchRSSEntries } = await import("../adapters/rss");
    vi.mocked(fetchRSSEntries).mockResolvedValue([
      { title: "Race Condition Article", link: "https://example.com/race", description: null, author: null, pubDate: null, categories: [] }
    ]);

    // Job insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "job-3" }, error: null }) }) })
    });

    // Dedup check: no existing (passes the check)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) })
    });

    // Source insert returns 23505 (unique violation from concurrent request)
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } }) }) })
    });

    // Job update (succeeded — only 0 sources inserted but no throw)
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    });

    const { runSourceIngestion } = await import("../ingestion");
    const result = await runSourceIngestion(stubAdapter);
    expect(result.newSourceCount).toBe(0);
  });
});
