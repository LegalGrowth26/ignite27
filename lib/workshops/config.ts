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
