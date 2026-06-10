import { describe, it, expect } from "vitest";
import { toDateKey, buildMonthGrid, bucketOutfitsByDate } from "@/lib/domain/outfits/calendar";

describe("toDateKey", () => {
  it("zero-pads month and day", () => {
    expect(toDateKey(2026, 6, 7)).toBe("2026-06-07");
    expect(toDateKey(2026, 12, 25)).toBe("2026-12-25");
  });
});

describe("buildMonthGrid", () => {
  it("lays June 2026 out Monday-first with no leading blanks", () => {
    const grid = buildMonthGrid(2026, 6); // June 1 2026 is a Monday
    expect(grid.weeks[0][0]).toEqual({ date: "2026-06-01", day: 1 });
    const flat = grid.weeks.flat();
    expect(flat.filter((c) => c !== null)).toHaveLength(30);
    expect(flat.find((c) => c?.day === 30)?.date).toBe("2026-06-30");
  });

  it("puts leading blanks when the month starts mid-week", () => {
    const grid = buildMonthGrid(2026, 7); // July 1 2026 is a Wednesday
    expect(grid.weeks[0][0]).toBeNull(); // Mon
    expect(grid.weeks[0][1]).toBeNull(); // Tue
    expect(grid.weeks[0][2]).toEqual({ date: "2026-07-01", day: 1 }); // Wed
  });
});

describe("bucketOutfitsByDate", () => {
  const mk = (id: string, planned_for: string | null, created_at: string) =>
    ({ id, planned_for, created_at, items: [] } as never);

  it("maps outfits by planned_for and ignores unplanned", () => {
    const map = bucketOutfitsByDate([
      mk("a", "2026-06-07", "2026-06-01T00:00:00Z"),
      mk("b", null, "2026-06-02T00:00:00Z"),
    ]);
    expect(map.get("2026-06-07")?.id).toBe("a");
    expect(map.size).toBe(1);
  });

  it("on a date collision keeps the newest created_at", () => {
    const map = bucketOutfitsByDate([
      mk("old", "2026-06-07", "2026-06-01T00:00:00Z"),
      mk("new", "2026-06-07", "2026-06-05T00:00:00Z"),
    ]);
    expect(map.get("2026-06-07")?.id).toBe("new");
  });
});
