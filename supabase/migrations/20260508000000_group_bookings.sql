-- Group delegate bookings (approved September 2026): one checkout buys
-- 2-10 tickets with tiered discounts (3-4 -> 10%, 5+ -> 25%, ticket
-- lines only, lunch never discounted, no stacking with discount codes:
-- the single larger discount applies).
--
-- pending_group_intents holds the full validated intent (lead, every
-- ticket's attendee, the pricing snapshot, the applied discount)
-- because Stripe metadata caps at 50 keys and 10 attendees do not fit.
-- The session metadata carries only the intent id; the webhook loads
-- the row back and creates ONE BOOKING PER TICKET:
--   - the lead's booking (group_position 1) carries the Stripe session
--     and payment-intent ids (unique constraint = idempotency, exactly
--     like single bookings),
--   - member bookings carry group_intent_id + group_position with a
--     unique index, so a crashed-and-retried webhook can only fill the
--     missing positions, never duplicate one.
-- Each booking stores its own allocated share of the money, so the sum
-- across the group equals what was charged and per-ticket refunds stay
-- computable.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

create table public.pending_group_intents (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Service-role only: no policies, no grants. The row is written by the
-- checkout action and read by the webhook, both server-side.
alter table public.pending_group_intents enable row level security;
revoke all on public.pending_group_intents from anon, authenticated;

alter table public.bookings
  add column group_intent_id uuid references public.pending_group_intents(id),
  add column group_position integer
    constraint bookings_group_position_chk
    check (group_position is null or group_position between 1 and 10);

-- One booking per position per group; the webhook's member-creation
-- idempotency key.
create unique index bookings_group_position_uidx
  on public.bookings (group_intent_id, group_position)
  where group_intent_id is not null;

commit;
