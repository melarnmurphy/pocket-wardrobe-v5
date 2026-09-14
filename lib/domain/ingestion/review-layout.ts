export type ReviewLayoutInput = {
  aspectRatio?: number | null;
  pending?: boolean;
};

export type ReviewLayoutPosition = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Deterministic percentage-based layout for the upload review flat-lay. */
export function calculateReviewLayout(items: ReviewLayoutInput[]): ReviewLayoutPosition[] {
  if (items.length === 0) return [];

  const columns = items.length <= 3 ? items.length : items.length <= 6 ? 3 : 4;
  const rows = Math.ceil(items.length / columns);
  const horizontalGutter = 5;
  const verticalGutter = rows === 1 ? 8 : 5;
  const rowHeight = Math.min(42, (92 - verticalGutter * (rows - 1)) / rows);
  const columnWidth = (100 - horizontalGutter * 2) / columns;

  return items.map((item, index) => {
    const row = Math.floor(index / columns);
    const rowStart = row * columns;
    const rowLength = Math.min(columns, items.length - rowStart);
    const column = index - rowStart;
    const center = 50 + (column - (rowLength - 1) / 2) * columnWidth;
    const ratio = item.aspectRatio && Number.isFinite(item.aspectRatio) && item.aspectRatio > 0
      ? item.aspectRatio
      : 0.72;
    const widthFromRatio = Math.sqrt(ratio) * rowHeight * 0.78;
    const width = Math.max(13, Math.min(columnWidth * 0.82, widthFromRatio));
    const height = item.pending ? Math.min(rowHeight * 0.72, 26) : rowHeight;

    return {
      left: Number((center - width / 2).toFixed(3)),
      top: Number((verticalGutter / 2 + row * (rowHeight + verticalGutter)).toFixed(3)),
      width: Number(width.toFixed(3)),
      height: Number(height.toFixed(3))
    };
  });
}
