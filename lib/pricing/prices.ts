import type { PricingWindow } from "./windows";

export type DelegateTicketType = "regular" | "vip";

export class ExhibitorBookingsClosedOnEventDayError extends Error {
  constructor() {
    super("exhibitor bookings closed on event day");
    this.name = "ExhibitorBookingsClosedOnEventDayError";
  }
}

// All prices are VAT-inclusive integer pence. Tables are lifted verbatim from
// SPEC.md. Christmas drop reverts silently to Window 2. Event day delegate
// prices are the Window 4 figures: the £5 charity uplift is returned by
// getCharityUplift so Stripe can show it as a separate line item.
const REGULAR_PRICES_PENCE: Record<PricingWindow, number> = {
  window_1: 3900,
  window_2: 4900,
  window_3: 5900,
  christmas_drop: 4900,
  window_4: 6900,
  event_day: 6900,
};

const VIP_PRICES_PENCE: Record<PricingWindow, number> = {
  window_1: 9900,
  window_2: 11900,
  window_3: 13900,
  christmas_drop: 11900,
  window_4: 15900,
  event_day: 15900,
};

const EXHIBITOR_PRICES_PENCE: Record<Exclude<PricingWindow, "event_day">, number> = {
  window_1: 20000,
  window_2: 25000,
  window_3: 32500,
  christmas_drop: 25000,
  window_4: 40000,
};

export const LUNCH_ADDON_PENCE = 1500;
export const EVENT_DAY_CHARITY_UPLIFT_PENCE = 500;

export function getDelegatePrice(window: PricingWindow, ticketType: "vip"): number;
export function getDelegatePrice(
  window: PricingWindow,
  ticketType: "regular",
  withLunch: boolean,
): number;
export function getDelegatePrice(
  window: PricingWindow,
  ticketType: DelegateTicketType,
  withLunch?: boolean,
): number {
  if (ticketType === "vip") {
    return VIP_PRICES_PENCE[window];
  }
  const base = REGULAR_PRICES_PENCE[window];
  return base + (withLunch ? LUNCH_ADDON_PENCE : 0);
}

export function getExhibitorPrice(window: PricingWindow): number {
  if (window === "event_day") {
    throw new ExhibitorBookingsClosedOnEventDayError();
  }
  return EXHIBITOR_PRICES_PENCE[window];
}

export function getCharityUplift(window: PricingWindow): number {
  return window === "event_day" ? EVENT_DAY_CHARITY_UPLIFT_PENCE : 0;
}
