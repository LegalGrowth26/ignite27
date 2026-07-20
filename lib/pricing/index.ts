import { getActivePeriod } from "./engine";
import type { PricingPeriod } from "./periods";
import {
  getDelegatePrice,
  getExhibitorPrice,
  getLunchAddOnPrice,
  getVipPrice,
  type PriceAmounts,
} from "./prices";

export interface CurrentPricing {
  period: PricingPeriod;
  delegate: {
    regular: PriceAmounts;
    vip: PriceAmounts;
    lunchAddOn: PriceAmounts;
  };
  exhibitor: PriceAmounts;
}

export function getCurrentPricing(now: Date): CurrentPricing {
  const period = getActivePeriod(now);
  return {
    period,
    delegate: {
      regular: getDelegatePrice(period),
      vip: getVipPrice(period),
      lunchAddOn: getLunchAddOnPrice(),
    },
    exhibitor: getExhibitorPrice(period),
  };
}

export {
  BookingsClosedError,
  BookingsNotOpenError,
  getActivePeriod,
} from "./engine";

export { formatExVatWithGross, formatPoundsFromPence } from "./format";

export {
  EXHIBITOR_STAND_CAP,
  exhibitorStandsRemaining,
  isExhibitorAvailable,
} from "./exhibitor";

export {
  LUNCH_ADDON_INC_VAT_PENCE,
  VAT_RATE,
  getDelegatePrice,
  getExhibitorPrice,
  getLunchAddOnPrice,
  getVipPrice,
  priceFromExVat,
  priceFromIncVat,
  type DelegateTicketType,
  type PriceAmounts,
} from "./prices";

export {
  BOOKINGS_CLOSE_AT,
  BOOKINGS_OPEN_AT,
  PRICING_PERIODS,
  PRICING_TIMEZONE,
  type PricingPeriod,
  type PricingPeriodBoundary,
} from "./periods";
