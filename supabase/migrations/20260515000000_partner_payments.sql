-- Partner payment requests (approved September 2026): collection for
-- deals sold by humans. The admin sends payment links from the
-- partner record; each request snapshots its own amount, so an edited
-- agreed price never changes a link already in someone's inbox, and
-- PART-PAYMENTS are first-class: a partner can hold several requests
-- (£500 now, £500 later), each tracked independently.
--
-- Partner payment STATUS derives from the money: unpaid / part-paid /
-- paid in full is computed from the sum of paid requests against
-- agreed_price_pence, webhook-driven like bookings, never flipped by
-- hand. The partners.status enum column REMAINS (no destructive
-- change) but the app stops reading or writing 'agreed'/'paid';
-- 'ended' stays as the only manual lifecycle action, and the public
-- strip rule becomes "visible and not ended" (same partners shown as
-- before, since agreed and paid both qualified).
--
-- The emailed link is OUR stable /pay/<token> page, which mints a
-- fresh Stripe Checkout Session per click (Stripe caps a session's
-- own life at 24 hours; our row enforces the real 30-day validity,
-- and resending re-uses the token and restarts the clock).
--
-- RLS: same regime as partners itself. Money and tokens; no
-- anon/authenticated policy at all. The public /pay page and the
-- webhook run on the service role; admins read through their policy.
--
-- Apply per convention: dev first via the Supabase SQL Editor, then
-- production before the PR merges.

begin;

create table public.partner_payment_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  -- Snapshot per request: the link honours ITS amount forever.
  amount_ex_vat_pence integer not null
    constraint partner_payment_amount_chk check (amount_ex_vat_pence > 0),
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending'
    constraint partner_payment_status_chk
    check (status in ('pending', 'paid', 'cancelled')),
  -- 30 days from the latest send; a resend restarts the clock.
  expires_at timestamptz not null,
  sent_at timestamptz,
  send_count integer not null default 0,
  paid_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  vat_amount_pence integer,
  gross_paid_pence integer,
  confirmation_email_sent_at timestamptz,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index partner_payment_requests_token_idx
  on public.partner_payment_requests (token);
create index partner_payment_requests_partner_idx
  on public.partner_payment_requests (partner_id, created_at);

create trigger partner_payment_requests_set_updated_at
before update on public.partner_payment_requests
for each row execute function public.set_updated_at();

alter table public.partner_payment_requests enable row level security;

create policy partner_payment_requests_admin_all
  on public.partner_payment_requests
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

commit;
