import { getCurrentPricing } from "./index";
import { priceFromExVat } from "./prices";

// Group booking pricing (approved September 2026): one checkout buys
// 2-10 delegate tickets (regular and VIP both count toward the group
// size). Tiered discount on TICKET lines only:
//   1-2 tickets  -> no group discount
//   3-4 tickets  -> 10% off tickets
//   5+  tickets  -> 25% off tickets
// The £15 lunch add-on is NEVER discounted, by any discount, ever.
//
// No stacking: a discount code entered on the group form is compared
// against the group discount over the same eligible (ticket) lines and
// the single LARGER discount is applied. On a dead tie the code wins:
// the customer typed it, honour the choice that feels deliberate.
//
// All arithmetic is integer pence on ex-VAT amounts (tax_behavior
// "exclusive" means Stripe recomputes VAT on the discounted total).

export const GROUP_MIN_TICKETS = 2;
export const GROUP_MAX_TICKETS = 10;

export function groupDiscountPercent(ticketCount: number): number {
  if (ticketCount >= 5) return 25;
  if (ticketCount >= 3) return 10;
  return 0;
}

export interface GroupTicketSelection {
  ticketType: "regular" | "vip";
  lunchIncluded: boolean; // regular add-on; VIP lunch is built into its price
}

export interface GroupTicketPricing extends GroupTicketSelection {
  // Ex-VAT price of this ticket before any discount.
  ticketExVatPence: number;
  // This ticket's share of the applied discount (0 when a code beat the
  // group discount or no discount applied; the code's discount is
  // Stripe-side and lands on the session totals, not per ticket).
  discountExVatPence: number;
  // What this ticket actually costs after its discount share, ex VAT,
  // plus its (never-discounted) lunch line.
  netTicketExVatPence: number;
  lunchExVatPence: number;
  // Inc-VAT total for this ticket + lunch after discount (VAT at 20%
  // recomputed on the discounted base, matching Stripe).
  totalIncVatPence: number;
}

export interface GroupPricingSnapshot {
  period: string;
  ticketCount: number;
  groupDiscountPercent: number;
  // Totals, all ex-VAT pence unless stated.
  ticketsExVatPence: number; // ticket lines before discount
  lunchesExVatPence: number; // lunch lines (never discounted)
  groupDiscountPence: number; // what the group tier is worth
  tickets: GroupTicketPricing[];
}

// Largest-remainder allocation: split `total` across weights so the
// parts are proportional, integer, and sum EXACTLY to total.
export function allocateProportionally(
  total: number,
  weights: readonly number[],
): number[] {
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || weightSum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = total - floors.reduce((s, x) => s + x, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const result = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] = result[i]! + 1;
    remainder -= 1;
  }
  return result;
}

// Compute the group's pricing for the current period. `applyGroupDiscount`
// is false when a promo code beat the group tier (per-ticket rows then
// carry full prices and Stripe applies the code to the session).
export function computeGroupPricing(
  selections: readonly GroupTicketSelection[],
  now: Date,
  applyGroupDiscount = true,
): GroupPricingSnapshot {
  if (
    selections.length < GROUP_MIN_TICKETS ||
    selections.length > GROUP_MAX_TICKETS
  ) {
    throw new Error(
      `group size must be ${GROUP_MIN_TICKETS}-${GROUP_MAX_TICKETS} tickets`,
    );
  }

  const current = getCurrentPricing(now);
  const percent = groupDiscountPercent(selections.length);

  const bases = selections.map((s) => {
    const ticket =
      s.ticketType === "vip" ? current.delegate.vip : current.delegate.regular;
    const lunch =
      s.ticketType === "regular" && s.lunchIncluded
        ? current.delegate.lunchAddOn.exVatPence
        : 0;
    return { ticketExVatPence: ticket.exVatPence, lunchExVatPence: lunch };
  });

  const ticketsExVatPence = bases.reduce((s, b) => s + b.ticketExVatPence, 0);
  const lunchesExVatPence = bases.reduce((s, b) => s + b.lunchExVatPence, 0);
  const groupDiscountPence = Math.round((ticketsExVatPence * percent) / 100);

  const applied = applyGroupDiscount ? groupDiscountPence : 0;
  const shares = allocateProportionally(
    applied,
    bases.map((b) => b.ticketExVatPence),
  );

  const tickets: GroupTicketPricing[] = selections.map((s, i) => {
    const base = bases[i]!;
    const discount = shares[i]!;
    const netTicket = base.ticketExVatPence - discount;
    const totalEx = netTicket + base.lunchExVatPence;
    return {
      ...s,
      ticketExVatPence: base.ticketExVatPence,
      discountExVatPence: discount,
      netTicketExVatPence: netTicket,
      lunchExVatPence: base.lunchExVatPence,
      totalIncVatPence: priceFromExVat(totalEx).incVatPence,
    };
  });

  return {
    period: current.period,
    ticketCount: selections.length,
    groupDiscountPercent: percent,
    ticketsExVatPence,
    lunchesExVatPence,
    groupDiscountPence,
    tickets,
  };
}

// -----------------------------------------------------------------------------
// Promo-code comparison (no stacking). The coupon shape is what Stripe
// returns; the value is computed over the lines it may touch so the
// comparison against the group tier is apples to apples.
// -----------------------------------------------------------------------------

export interface CouponShape {
  percentOff: number | null;
  amountOffPence: number | null;
  // Product ids from coupon.applies_to.products; null/empty = applies
  // to everything on the session.
  appliesToProducts: readonly string[] | null;
}

export interface DiscountableLine {
  productId: string;
  exVatPence: number;
}

export function computeCouponDiscountPence(
  coupon: CouponShape,
  lines: readonly DiscountableLine[],
): number {
  const eligible = lines.filter(
    (l) =>
      !coupon.appliesToProducts ||
      coupon.appliesToProducts.length === 0 ||
      coupon.appliesToProducts.includes(l.productId),
  );
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.exVatPence, 0);
  if (eligibleSubtotal <= 0) return 0;
  if (coupon.percentOff !== null) {
    return Math.round((eligibleSubtotal * coupon.percentOff) / 100);
  }
  if (coupon.amountOffPence !== null) {
    return Math.min(coupon.amountOffPence, eligibleSubtotal);
  }
  return 0;
}

export type AppliedGroupDiscount =
  | { kind: "group"; percent: number; discountPence: number }
  | { kind: "code"; code: string; promotionCodeId: string; discountPence: number }
  | { kind: "none" };

// Compare-and-apply-larger. Tie goes to the code (the customer typed
// it). A zero-value outcome is 'none'.
export function pickAppliedDiscount(
  group: { percent: number; discountPence: number },
  code: { code: string; promotionCodeId: string; discountPence: number } | null,
): AppliedGroupDiscount {
  const groupValue = group.discountPence;
  const codeValue = code?.discountPence ?? 0;
  if (groupValue <= 0 && codeValue <= 0) return { kind: "none" };
  if (code && codeValue >= groupValue) {
    return { kind: "code", ...code };
  }
  return { kind: "group", percent: group.percent, discountPence: groupValue };
}
