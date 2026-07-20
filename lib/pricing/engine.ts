import {
  BOOKINGS_CLOSE_AT,
  BOOKINGS_OPEN_AT,
  PRICING_PERIODS,
  type PricingPeriod,
} from "./periods";

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
  return (
    now.getTime() >= boundary.opensAt.getTime() &&
    now.getTime() < boundary.closesAt.getTime()
  );
}

export function getActivePeriod(now: Date): PricingPeriod {
  if (now.getTime() < BOOKINGS_OPEN_AT.getTime()) {
    throw new BookingsNotOpenError();
  }
  if (now.getTime() >= BOOKINGS_CLOSE_AT.getTime()) {
    throw new BookingsClosedError();
  }
  for (const boundary of PRICING_PERIODS) {
    if (isWithin(now, boundary)) {
      return boundary.period;
    }
  }
  // Unreachable given the guards above; defensive throw.
  throw new BookingsClosedError();
}
