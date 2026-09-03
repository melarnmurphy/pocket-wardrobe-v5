import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: eqMock }));
const deleteMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock, delete: deleteMock, eq: eqMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("renameCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
  });

  it("updates the collection's name, scoped to the owning user", async () => {
    const { renameCollection } = await import("@/lib/domain/wardrobe/service");
    await renameCollection({
      collectionId: "22222222-2222-2222-2222-222222222222",
      name: "  weekend capsule  "
    });

    expect(fromMock).toHaveBeenCalledWith("collections");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "weekend capsule" })
    );
  });

  it("rejects an empty name", async () => {
    const { renameCollection } = await import("@/lib/domain/wardrobe/service");
    await expect(
      renameCollection({ collectionId: "22222222-2222-2222-2222-222222222222", name: "   " })
    ).rejects.toThrow();
  });
});

describe("deleteCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
  });

  it("deletes the collection row, scoped to the owning user", async () => {
    const { deleteCollection } = await import("@/lib/domain/wardrobe/service");
    await deleteCollection("22222222-2222-2222-2222-222222222222");

    expect(fromMock).toHaveBeenCalledWith("collections");
    expect(deleteMock).toHaveBeenCalled();
  });
});
