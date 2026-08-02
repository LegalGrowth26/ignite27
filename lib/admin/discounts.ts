// Pure aggregation of promo-code usage from booking rows, unit-testable
// without a database.
export interface PromoBookingRow {
  promo_code: string | null;
  discount_pence: number | null;
  gross_amount_pence: number;
  payment_status: string;
}

export interface PromoUsage {
  code: string;
  uses: number;
  totalDiscountPence: number;
  totalRevenuePence: number;
  compCount: number;
}

export function aggregatePromoUsage(rows: readonly PromoBookingRow[]): PromoUsage[] {
  const byCode = new Map<string, PromoUsage>();
  for (const r of rows) {
    if (!r.promo_code) continue;
    if (r.payment_status !== "paid" && r.payment_status !== "comp") continue;
    const entry = byCode.get(r.promo_code) ?? {
      code: r.promo_code,
      uses: 0,
      totalDiscountPence: 0,
      totalRevenuePence: 0,
      compCount: 0,
    };
    entry.uses += 1;
    entry.totalDiscountPence += r.discount_pence ?? 0;
    entry.totalRevenuePence += r.gross_amount_pence;
    if (r.payment_status === "comp") entry.compCount += 1;
    byCode.set(r.promo_code, entry);
  }
  return [...byCode.values()].sort((a, b) => b.uses - a.uses);
}
