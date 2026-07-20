-- Pricing v2 schema migration.
--
-- Replaces the pricing_window enum (window_1..window_4 + christmas_drop +
-- event_day) with a simpler pricing_period enum (launch / standard / late)
-- and drops the charity_uplift_pence column (charity uplift removed from
-- the pricing model in v2).
--
-- Backfill mapping:
--   window_1                          -> launch
--   window_2, window_3, christmas_drop -> standard
--   window_4, event_day               -> late
--
-- Applied per project convention: dev first via the Supabase SQL editor,
-- then production before the pricing-v2 PR merges.

begin;

-- 1. New enum.
create type public.pricing_period as enum ('launch', 'standard', 'late');

-- 2. New nullable column so we can backfill before enforcing NOT NULL.
alter table public.bookings
  add column pricing_period public.pricing_period;

-- 3. Backfill from the old enum.
update public.bookings
set pricing_period = case pricing_window
  when 'window_1'       then 'launch'::public.pricing_period
  when 'window_2'       then 'standard'::public.pricing_period
  when 'window_3'       then 'standard'::public.pricing_period
  when 'christmas_drop' then 'standard'::public.pricing_period
  when 'window_4'       then 'late'::public.pricing_period
  when 'event_day'      then 'late'::public.pricing_period
end;

-- 4. Enforce NOT NULL now that every existing row has a value.
alter table public.bookings
  alter column pricing_period set not null;

-- 5. Drop the old window index, then the old column, then the old enum type.
drop index if exists public.bookings_pricing_window_idx;

alter table public.bookings
  drop column pricing_window;

drop type public.pricing_window;

-- 6. Drop the removed charity_uplift_pence column.
alter table public.bookings
  drop column charity_uplift_pence;

-- 7. Index the new period column (same shape as the old window index).
create index bookings_pricing_period_idx
  on public.bookings (pricing_period);

commit;
