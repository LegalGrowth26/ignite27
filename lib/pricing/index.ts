import { getActiveWindow } from "./engine";
import {
  getCharityUplift,
  getDelegatePrice,
  getExhibitorPrice,
  LUNCH_ADDON_PENCE,
} from "./prices";
import type { PricingWindow } from "./windows";

export interface CurrentPricing {
  window: PricingWindow;
  delegate: {
    regular: number;
    vip: number;
    lunchAddOn: number;
  };
  exhibitor: number | null;
  charityUplift: number;
}

export function getCurrentPricing(now: Date): CurrentPricing {
  const window = getActiveWindow(now);

  return {
    window,
    delegate: {
      regular: getDelegatePrice(window, "regular", false),
      vip: getDelegatePrice(window, "vip"),
      lunchAddOn: LUNCH_ADDON_PENCE,
    },
    exhibitor: window === "event_day" ? null : getExhibitorPrice(window),
    charityUplift: getCharityUplift(window),
  };
}

export {
  BookingsClosedError,
  BookingsNotOpenError,
  getActiveWindow,
} from "./engine";
export {
  EVENT_DAY_CHARITY_UPLIFT_PENCE,
  ExhibitorBookingsClosedOnEventDayError,
  LUNCH_ADDON_PENCE,
  getCharityUplift,
  getDelegatePrice,
  getExhibitorPrice,
  type DelegateTicketType,
} from "./prices";
export {
  BOOKINGS_CLOSE_AT,
  BOOKINGS_OPEN_AT,
  CHRISTMAS_DROP,
  PRICING_TIMEZONE,
  PRICING_WINDOWS,
  type PricingWindow,
  type PricingWindowBoundary,
} from "./windows";
