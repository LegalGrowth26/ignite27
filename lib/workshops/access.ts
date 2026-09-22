import {
  CANCEL_DEADLINE,
  GENERAL_ACCESS_OPENS,
  VIP_ACCESS_OPENS,
} from "./config";

// Pure workshop access logic (unit-tested; the database functions
// enforce the same rules authoritatively).

export type WorkshopAccess =
  | { open: true }
  | { open: false; opensAt: Date; reason: "vip_window_pending" | "general_window_pending" };

// When can this person book? VIPs from VIP_ACCESS_OPENS, everyone else
// from GENERAL_ACCESS_OPENS. isVip means "holds an active paid/comp
// VIP delegate booking".
export function workshopAccess(now: Date, isVip: boolean): WorkshopAccess {
  const opensAt = isVip ? VIP_ACCESS_OPENS : GENERAL_ACCESS_OPENS;
  if (now.getTime() >= opensAt.getTime()) return { open: true };
  return {
    open: false,
    opensAt,
    reason: isVip ? "vip_window_pending" : "general_window_pending",
  };
}

// Un-booking is allowed strictly before the start of event day.
export function canCancelWorkshopBooking(now: Date): boolean {
  return now.getTime() < CANCEL_DEADLINE.getTime();
}

// Interval overlap on [start, end): touching boundaries (13:00-14:00
// then 14:00-15:00) do NOT clash. Shared with the /my-day planner in
// Part 2, and mirrors the SQL clash check in book_workshop.
export function timesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}
