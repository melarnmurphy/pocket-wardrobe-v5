export type NeglectGarment = {
  purchase_price?: number | null;
  wear_count: number;
};

export function valueNeglect(garment: NeglectGarment): number | null {
  if (garment.purchase_price == null) return null;
  return garment.purchase_price / Math.max(garment.wear_count, 1);
}

export function compareNeglected(left: NeglectGarment, right: NeglectGarment): number {
  const leftNeglect = valueNeglect(left);
  const rightNeglect = valueNeglect(right);

  if (leftNeglect == null && rightNeglect == null) return 0;
  if (leftNeglect == null) return 1;
  if (rightNeglect == null) return -1;

  return rightNeglect - leftNeglect;
}
