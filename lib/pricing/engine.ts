import {
  BOOKINGS_CLOSE_AT,
  BOOKINGS_OPEN_AT,
  CHRISTMAS_DROP,
  PRICING_WINDOWS,
  type PricingWindow,
} from "./windows";

export class BookingsNotOpenError extends Error {
  constructor() {
    super("bookings not yet open");
    this.name = "BookingsNotOpenError";
  }
}

export class BookingsClosedError extends Error {
  constructor() {
    super("bookings closed");
    this.name = "BookingsClosedError";
  }
}

function isWithin(now: Date, boundary: { opensAt: Date; closesAt: Date }): boolean {
  return now.getTime() >= boundary.opensAt.getTime() && now.getTime() < boundary.closesAt.getTime();
}

export function getActiveWindow(now: Date): PricingWindow {
  if (now.getTime() < BOOKINGS_OPEN_AT.getTime()) {
    throw new BookingsNotOpenError();
  }
  if (now.getTime() >= BOOKINGS_CLOSE_AT.getTime()) {
    throw new BookingsClosedError();
  }

  if (isWithin(now, CHRISTMAS_DROP)) {
    return "christmas_drop";
  }

  for (const boundary of PRICING_WINDOWS) {
    if (isWithin(now, boundary)) {
      return boundary.window;
    }
  }

  // Should be unreachable given the guards above. Defensive throw.
  throw new BookingsClosedError();
}
