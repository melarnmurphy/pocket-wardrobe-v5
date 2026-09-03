import { beforeEach, describe, expect, it, vi } from "vitest";

const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();
const remove = vi.fn();
const storageFrom = vi.fn(() => ({ remove }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from, storage: { from: storageFrom } }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("deleteAllUserPhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remove.mockResolvedValue({ error: null });
  });

  it("removes every garment image for the user's garments but leaves garments untouched", async () => {
    // garments query
    const garmentsEq = vi.fn().mockResolvedValue({
      data: [{ id: "g1" }, { id: "g2" }],
      error: null
    });
    const garmentsSelect = vi.fn(() => ({ eq: garmentsEq }));

    // garment_images select + delete
    const imagesInSelect = vi.fn().mockResolvedValue({
      data: [
        { id: "img1", garment_id: "g1", image_type: "original", storage_path: "u1/g1/a.jpg" },
        { id: "img2", garment_id: "g2", image_type: "cutout", storage_path: "u1/g2/b.png" }
      ],
      error: null
    });
    const imagesSelect = vi.fn(() => ({ in: imagesInSelect }));

    const deleteIn = vi.fn().mockResolvedValue({ error: null });
    const imagesDelete = vi.fn(() => ({ in: deleteIn }));

    from.mockImplementation((table: string) => {
      if (table === "garments") return { select: garmentsSelect };
      if (table === "garment_images") return { select: imagesSelect, delete: imagesDelete };
      throw new Error(`Unexpected table ${table}`);
    });

    const { deleteAllUserPhotos } = await import("@/lib/domain/account/service");
    const result = await deleteAllUserPhotos();

    expect(result.deletedCount).toBe(2);
    expect(storageFrom).toHaveBeenCalledWith("garment-originals");
    expect(storageFrom).not.toHaveBeenCalledWith("garment-cutouts");
    expect(remove).toHaveBeenCalledWith(["u1/g1/a.jpg"]);
    expect(remove).toHaveBeenCalledWith(["u1/g2/b.png"]);
    expect(imagesDelete).toHaveBeenCalled();
    expect(deleteIn).toHaveBeenCalledWith("id", ["img1", "img2"]);
    // garments themselves are never deleted or updated
    expect(garmentsSelect).toHaveBeenCalledWith("id");
  });

  it("returns zero and does nothing when the user has no garments", async () => {
    const garmentsEq = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockImplementation((table: string) => {
      if (table === "garments") return { select: vi.fn(() => ({ eq: garmentsEq })) };
      throw new Error(`Unexpected table ${table}`);
    });

    const { deleteAllUserPhotos } = await import("@/lib/domain/account/service");
    const result = await deleteAllUserPhotos();

    expect(result.deletedCount).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });
});
