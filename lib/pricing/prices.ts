import type { PricingPeriod } from "./periods";

export type DelegateTicketType = "regular" | "vip";

export interface PriceAmounts {
  exVatPence: number;
  vatPence: number;
  incVatPence: number;
}

export const VAT_RATE = 0.2;

// Derive a PriceAmounts from an ex-VAT source. All new-model tickets are
// defined ex-VAT and every listed value rounds to exact pence at 20%
// (e.g. 2500 × 0.2 = 500, no fractional pence).
export function priceFromExVat(exVatPence: number): PriceAmounts {
  const vatPence = Math.round(exVatPence * VAT_RATE);
  return { exVatPence, vatPence, incVatPence: exVatPence + vatPence };
}

// Derive a PriceAmounts from an inc-VAT source. The lunch add-on is the
// only price defined this way, so the customer-facing "£15 flat" is
// exact. 1500 / 1.2 = 1250 (ex) + 250 (VAT).
export function priceFromIncVat(incVatPence: number): PriceAmounts {
  const exVatPence = Math.round(incVatPence / (1 + VAT_RATE));
  const vatPence = incVatPence - exVatPence;
  return { exVatPence, vatPence, incVatPence };
}

const DELEGATE_EX_VAT_PENCE: Record<PricingPeriod, number> = {
  launch: 2500,
  standard: 3500,
  late: 4500,
};

const VIP_EX_VAT_PENCE: Record<PricingPeriod, number> = {
  launch: 6900,
  standard: 8500,
  late: 9900,
};

// Exhibitor: no separate late price; standard price continues through
// the late period until the stand cap or bookings-close, whichever first.
const EXHIBITOR_EX_VAT_PENCE: Record<PricingPeriod, number> = {
  launch: 18900,
  standard: 24900,
  late: 24900,
};

// Lunch add-on is defined inc-VAT so the customer-facing "£15 flat"
// reads exactly.
export const LUNCH_ADDON_INC_VAT_PENCE = 1500;

export function getDelegatePrice(period: PricingPeriod): PriceAmounts {
  return priceFromExVat(DELEGATE_EX_VAT_PENCE[period]);
}

export function getVipPrice(period: PricingPeriod): PriceAmounts {
  return priceFromExVat(VIP_EX_VAT_PENCE[period]);
}

export function getExhibitorPrice(period: PricingPeriod): PriceAmounts {
  return priceFromExVat(EXHIBITOR_EX_VAT_PENCE[period]);
}

export function getLunchAddOnPrice(): PriceAmounts {
  return priceFromIncVat(LUNCH_ADDON_INC_VAT_PENCE);
}
