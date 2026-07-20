-- Discount-code tracking on bookings + comp payment_status.
--
-- Codes are managed entirely in the Stripe Dashboard (Products →
-- Coupons / Promotion codes). We only need to record, on each
-- booking, which code the customer used (if any) and how much was
-- discounted, so Tom can answer "which bookings used code X" by
-- querying bookings.promo_code.
--
-- All three tracking columns are nullable: bookings without a code
-- leave them null. discount_pence is stored in ex-VAT pence to match
-- the exclusive-VAT presentation (Stripe applies the coupon to the
-- ex-VAT base and recomputes VAT on the discounted total).
--
-- The new 'comp' value on payment_status flags 100%-off / no-payment
-- bookings so "paid" continues to mean "money actually changed hands".
--
-- Applied per convention: dev first via the Supabase SQL Editor, then
-- production before the launch-pack PR merges.

-- Enum-value additions cannot be committed inside the same transaction
-- that then uses the new value, so run this ALTER standalone before
-- BEGIN. Postgres 15 (Supabase) handles it fine.
alter type public.payment_status add value if not exists 'comp';

begin;

alter table public.bookings
  add column promo_code text,
  add column promo_code_id text,
  add column discount_pence integer;

-- Only bookings that actually used a code will have a value here, and
-- Tom's most common query is "how many redemptions of STEPHINE20?".
-- A partial index on the non-null rows keeps the index small.
create index bookings_promo_code_idx
  on public.bookings (promo_code)
  where promo_code is not null;

commit;
