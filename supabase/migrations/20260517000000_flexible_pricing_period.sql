-- Fix: bookings that are not tied to a sales window could not be
-- created. Adding FSB as a £0 contra partner failed with:
--
--   null value in column "pricing_period" of relation "bookings"
--   violates not-null constraint
--
-- The partner package booking rightly carries no pricing period (it
-- is part of a deal, not a window purchase), and the comp-issuance
-- code has ALWAYS intended null when issued outside the sales window
-- (its period lookup falls back to null by design) - the NOT NULL
-- was a latent trap there too. Delegate, group, and exhibitor
-- checkouts continue to write a real period on every row.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

alter table public.bookings
  alter column pricing_period drop not null;

commit;
