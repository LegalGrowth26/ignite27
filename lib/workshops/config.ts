// Workshop booking windows and deadlines. These MIRROR the constants
// embedded in the book_workshop / cancel_workshop_booking database
// functions (supabase/migrations/20260506000000_workshops.sql), which
// are the authoritative gates; these copies drive UI copy and
// button states only. All three instants are UK midnights in January
// (GMT), so the UTC constants match the local times exactly.

// VIP ticket holders book from 1 January 2027, 00:00 UK.
export const VIP_ACCESS_OPENS = new Date("2027-01-01T00:00:00Z");

// Everyone else books from 4 January 2027, 00:00 UK.
export const GENERAL_ACCESS_OPENS = new Date("2027-01-04T00:00:00Z");

// Un-booking closes at the start of event day (21 January 2027, 00:00
// UK): cancellations are allowed up to and including the day before.
export const CANCEL_DEADLINE = new Date("2027-01-21T00:00:00Z");

// Every workshop room seats exactly 24. Fixed by decision (September
// 2026): not an admin field, never host-editable. The database column
// defaults to this too (20260512).
export const WORKSHOP_CAPACITY = 24;

// The two workshop rooms. Room and times are admin-only scheduling,
// set after the host has supplied the content; until then a published
// workshop shows "time and room to be confirmed".
export const WORKSHOP_ROOMS = ["Workshop Room One", "Workshop Room Two"] as const;
